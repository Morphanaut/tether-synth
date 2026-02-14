import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MidiConfig, MidiMapping, TriggerTarget, LfoTarget, SynthState } from '../types';
import { LFO_TARGET_VALUES } from '../data/options';
import { midiToFreq, mapReleaseTime } from '../utils/audioMath';

interface PolyVoiceState {
    note: number | null;
    released: boolean;
    timestamp: number;
    releaseUntil: number;
}

type MidiConfigUpdate = <K extends keyof MidiConfig | 'FULL'>(
    key: K,
    value: K extends 'FULL' ? Partial<MidiConfig> : MidiConfig[K & keyof MidiConfig]
) => void;

type MidiPortStateChangeEvent = Event & { port: MIDIPort };
const MAX_MIDI_MAPPINGS = 128;
const MIDI_TARGET_SET = new Set<string>(LFO_TARGET_VALUES);
const RELEASE_TAIL_MULTIPLIER = 1.5;
const RELEASE_TAIL_PADDING_MS = 20;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const sanitizeInputName = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, Math.round(num)));
};

const sanitizeMapping = (value: unknown): MidiMapping | null => {
    if (!isRecord(value)) return null;

    const cc = clampInt(value.cc, 0, 127, 0);
    const target = (typeof value.target === 'string' && MIDI_TARGET_SET.has(value.target))
        ? value.target as LfoTarget
        : 'none';

    const min = clampInt(value.min, 0, 1024, 0);
    const max = clampInt(value.max, 0, 1024, 1024);
    const normalizedMin = Math.min(min, max);
    const normalizedMax = Math.max(min, max);

    return { cc, target, min: normalizedMin, max: normalizedMax };
};

const sanitizeMappings = (value: unknown): MidiMapping[] => {
    if (!Array.isArray(value)) return [];

    const result: MidiMapping[] = [];
    for (const item of value) {
        if (result.length >= MAX_MIDI_MAPPINGS) break;
        const safe = sanitizeMapping(item);
        if (safe) result.push(safe);
    }
    return result;
};

const sanitizeMidiConfigPatch = (value: unknown): Partial<MidiConfig> => {
    if (!isRecord(value)) return {};

    const patch: Partial<MidiConfig> = {};

    if ('inputName' in value) {
        patch.inputName = sanitizeInputName(value.inputName);
    }

    if ('polyphonic' in value) {
        patch.polyphonic = typeof value.polyphonic === 'boolean' ? value.polyphonic : false;
    }

    if ('mappings' in value) {
        patch.mappings = sanitizeMappings(value.mappings);
    }

    return patch;
};

export const useMidiSystem = (
    params: SynthState,
    triggerPolyVoice: (idx: number, freq: number | null, mode: 'attack' | 'legato' | 'release', target: TriggerTarget) => void,
    setActiveFreq1: (f: number | null) => void,
    setActiveFreq2: (f: number | null) => void,
    voiceAllocation: React.RefObject<PolyVoiceState[]>,
    activeMidiNotes: React.RefObject<number[]>,
    lastVOctFreq1: React.RefObject<number>,
    lastVOctFreq2: React.RefObject<number>,
    controlSourceRef: React.RefObject<'ui' | 'midi'>,
    onParamChange?: (target: LfoTarget, val: number) => void
) => {
    // Public MIDI state for UI.
    const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);
    const [midiInputs, setMidiInputs] = useState<MIDIInput[]>([]);
    const [midiConfig, setMidiConfig] = useState<MidiConfig>({ 
        inputName: null, polyphonic: false, mappings: [] 
    });

    // Internal refs for stable callbacks.
    const [learningMappingIndex, setLearningMappingIndex] = useState<number | null>(null);
    const learningMappingIndexRef = useRef<number | null>(null);
    const midiConfigRef = useRef(midiConfig);
    const paramsRef = useRef<SynthState>(params);

    useEffect(() => { midiConfigRef.current = midiConfig; }, [midiConfig]);
    useEffect(() => { paramsRef.current = params; }, [params]);

    const getReleaseWindowMs = useCallback((target: TriggerTarget, synth: SynthState): number => {
        const usesOsc1 = target === 'osc1' || target === 'both';
        const usesOsc2 = target === 'osc2' || target === 'both';
        const release1 = usesOsc1 ? mapReleaseTime(synth.env1.release) : 0;
        const release2 = usesOsc2 ? mapReleaseTime(synth.env2.release) : 0;
        const baseSeconds = Math.max(release1, release2, 0.015);
        return (baseSeconds * 1000 * RELEASE_TAIL_MULTIPLIER) + RELEASE_TAIL_PADDING_MS;
    }, []);

    // Generic config updater used by the MIDI panel.
    const updateMidiConfig = useCallback<MidiConfigUpdate>((key, value) => {
        if (key === 'FULL') {
            const safePatch = sanitizeMidiConfigPatch(value);
            if (Object.keys(safePatch).length === 0) return;
            setMidiConfig(prev => ({ ...prev, ...safePatch }));
            return;
        }

        if (key === 'inputName') {
            setMidiConfig(prev => ({ ...prev, inputName: sanitizeInputName(value) }));
            return;
        }

        if (key === 'polyphonic') {
            setMidiConfig(prev => ({
                ...prev,
                polyphonic: typeof value === 'boolean' ? value : prev.polyphonic
            }));
            return;
        }

        if (key === 'mappings') {
            setMidiConfig(prev => ({ ...prev, mappings: sanitizeMappings(value) }));
            return;
        }
    }, []);
  
    const setLearningMapping = useCallback((index: number | null) => {
        setLearningMappingIndex(index);
        learningMappingIndexRef.current = index;
    }, []);

    // Main MIDI event entry point.
    const handleMidiMessage = useCallback((e: MIDIMessageEvent) => {
        if (!e.data || e.data.length < 2) return;
        
        const [status, data1, data2 = 0] = e.data;
        const command = status & 0xf0;
        const config = midiConfigRef.current;
        const p = paramsRef.current;
        
        // Ignore messages from non-selected input when one is pinned.
        const inputName = (e.currentTarget as MIDIInput | null)?.name ?? null;
        if (config.inputName && inputName !== config.inputName) return;
        
        // CC handling: panic, learn, and mapped parameter control.
        if (command === 0xB0) {
            // All notes off.
            if (data1 === 123) {
                if (activeMidiNotes.current) activeMidiNotes.current = [];
                if (voiceAllocation.current) {
                    const releaseUntil = performance.now() + getReleaseWindowMs('both', p);
                    voiceAllocation.current.forEach((v, i) => { 
                      v.released = true; 
                      v.releaseUntil = releaseUntil;
                      triggerPolyVoice(i, null, 'release', 'both'); 
                    });
                }
                setActiveFreq1(null);
                setActiveFreq2(null);
                return;
            }
            
            if (controlSourceRef.current) controlSourceRef.current = 'midi';
            
            // Learn mode: bind incoming CC to selected mapping slot.
            if (learningMappingIndexRef.current !== null) {
                const idx = learningMappingIndexRef.current;
                const newMappings = [...config.mappings];
                if (newMappings[idx]) { 
                  newMappings[idx] = { ...newMappings[idx], cc: data1 }; 
                  setMidiConfig(prev => ({ ...prev, mappings: newMappings })); 
                }
                setLearningMappingIndex(null);
                learningMappingIndexRef.current = null;
                return;
            }
            
            // Apply mapped CC values to synth params.
            if (onParamChange) {
                const ccNorm = data2 / 127;
                for (const m of config.mappings) {
                    if (m.cc !== data1) continue;
                    const min = m.min ?? 0;
                    const max = m.max ?? 1024;
                    const val = Math.round(min + (ccNorm * (max - min)));
                    onParamChange(m.target, val);
                }
            }
            return;
        }
        
        const osc1Enabled = p.osc1.midi && !p.osc1.drone && !p.seq1.isRunning;
        const osc2Enabled = p.osc2.midi && !p.osc2.drone && !p.seq2.isRunning;
        
        if (!osc1Enabled && !osc2Enabled) return;
        
        // Determine which oscillator path receives note events.
        const target: TriggerTarget = (osc1Enabled && !osc2Enabled) 
          ? 'osc1' 
          : (!osc1Enabled && osc2Enabled ? 'osc2' : 'both');
        
        // Note on.
        if (command === 0x90 && data2 > 0) {
            const note = data1;
            // Pitch-only path: velocity is currently not mapped to amp/mod depth.
            const freq = midiToFreq(note);
            const nowMs = performance.now();
            
            // Poly mode: assign or steal voice by oldest timestamp.
            if (config.polyphonic && voiceAllocation.current) {
                const existingIdx = voiceAllocation.current.findIndex(v => v.note === note);
                if (existingIdx !== -1) { 
                  voiceAllocation.current[existingIdx].timestamp = nowMs; 
                  voiceAllocation.current[existingIdx].released = false; 
                  voiceAllocation.current[existingIdx].releaseUntil = 0;
                  triggerPolyVoice(existingIdx, freq, 'attack', target); 
                  return; 
                }
                
                let targetIdx = voiceAllocation.current.findIndex(v => v.note === null || (v.released && v.releaseUntil <= nowMs));
                if (targetIdx === -1) { 
                  let earliestRelease = Infinity;
                  voiceAllocation.current.forEach((v, i) => { 
                    if (v.released && v.releaseUntil < earliestRelease) {
                      earliestRelease = v.releaseUntil;
                      targetIdx = i;
                    }
                  }); 
                }
                if (targetIdx === -1) { 
                  targetIdx = 0; 
                  let minTime = Infinity; 
                  voiceAllocation.current.forEach((v, i) => { 
                    if (v.timestamp < minTime) { 
                      minTime = v.timestamp; 
                      targetIdx = i; 
                    } 
                  }); 
                }
                
                voiceAllocation.current[targetIdx] = { note: note, released: false, timestamp: nowMs, releaseUntil: 0 };
                triggerPolyVoice(targetIdx, freq, 'attack', target);
                
                if (osc1Enabled) setActiveFreq1(freq);
                if (osc2Enabled) setActiveFreq2(freq);
            // Mono mode: keep note stack for legato behavior.
            } else if (activeMidiNotes.current) {
                // Monophonic priority follows last pressed note.
                const isLegato = activeMidiNotes.current.length > 0;
                activeMidiNotes.current.push(note);
                
                if (osc1Enabled) { 
                  setActiveFreq1(freq); 
                  if (lastVOctFreq1.current !== undefined) lastVOctFreq1.current = freq; 
                }
                if (osc2Enabled) { 
                  setActiveFreq2(freq); 
                  if (lastVOctFreq2.current !== undefined) lastVOctFreq2.current = freq; 
                }
                
                triggerPolyVoice(0, freq, isLegato ? 'legato' : 'attack', target);
            }
        } 
        // Note off.
        else if (command === 0x80 || (command === 0x90 && data2 === 0)) {
            const note = data1;
            
            // Poly mode: release matching voice.
            if (config.polyphonic && voiceAllocation.current) {
                 const idx = voiceAllocation.current.findIndex(v => v.note === note);
                 if (idx !== -1) { 
                   voiceAllocation.current[idx].released = true; 
                   voiceAllocation.current[idx].releaseUntil = performance.now() + getReleaseWindowMs(target, p);
                   triggerPolyVoice(idx, null, 'release', target); 
                   if (voiceAllocation.current.every(v => v.released)) { 
                     setActiveFreq1(null); 
                     setActiveFreq2(null); 
                   } 
                 }
            // Mono mode: fall back to the last held note, or release.
            } else if (activeMidiNotes.current) {
                 activeMidiNotes.current = activeMidiNotes.current.filter(n => n !== note);
                 
                 // When a key is released, return to previous held note if it exists.
                 if (activeMidiNotes.current.length > 0) { 
                   const lastNote = activeMidiNotes.current[activeMidiNotes.current.length - 1]; 
                   const freq = midiToFreq(lastNote); 
                   if (osc1Enabled) setActiveFreq1(freq); 
                   if (osc2Enabled) setActiveFreq2(freq); 
                   triggerPolyVoice(0, freq, 'legato', target); 
                 } else { 
                   if (osc1Enabled) setActiveFreq1(null); 
                   if (osc2Enabled) setActiveFreq2(null); 
                   triggerPolyVoice(0, null, 'release', target); 
                 }
            }
        }
    }, [triggerPolyVoice, setActiveFreq1, setActiveFreq2, onParamChange, getReleaseWindowMs]);

    const bindInputHandlers = useCallback((inputs: MIDIInput[]) => {
        inputs.forEach((input) => {
            input.onmidimessage = input.state === 'connected' ? handleMidiMessage : null;
        });
    }, [handleMidiMessage]);

    // MIDI access init and port wiring.
    const initMidi = useCallback(async () => {
        if (!navigator.requestMIDIAccess) return;
        
        try {
            const access = await navigator.requestMIDIAccess();
            setMidiAccess(access);
            
            const updateInputList = () => { 
              const inputs = Array.from(access.inputs.values()); 
              setMidiInputs(inputs); 
              return inputs; 
            };

            const pickFirstInputName = (inputs: MIDIInput[]): string | null => {
                for (const input of inputs) {
                    const name = input.name;
                    if (typeof name === 'string' && name.trim().length > 0) return name;
                }
                return null;
            };

            const reconcileSelectedInput = (inputs: MIDIInput[]) => {
                const selectedName = midiConfigRef.current.inputName;
                const stillConnected = selectedName
                    ? inputs.some(input => (input.name ?? null) === selectedName)
                    : false;
                if (stillConnected) return;

                const fallbackName = pickFirstInputName(inputs);
                if (fallbackName !== selectedName) {
                    updateMidiConfig('inputName', fallbackName);
                }
            };
            
            const inputs = updateInputList();
            reconcileSelectedInput(inputs);
            
            bindInputHandlers(inputs);
            
            access.onstatechange = (e: MidiPortStateChangeEvent) => {
              const nextInputs = updateInputList();
              reconcileSelectedInput(nextInputs);
              if (e.port.type === 'input') bindInputHandlers(nextInputs);
            };
        } catch (err) { 
          console.warn('MIDI Access Failed', err); 
        }
    }, [bindInputHandlers, updateMidiConfig]);

    useEffect(() => {
        if (!midiAccess) return;
        return () => {
            midiAccess.onstatechange = null;
            const inputs = Array.from(midiAccess.inputs.values()) as MIDIInput[];
            inputs.forEach((input) => {
                input.onmidimessage = null;
            });
        };
    }, [midiAccess]);

    return {
        midiAccess,
        midiInputs,
        midiConfig,
        updateMidiConfig,
        learningMappingIndex,
        setLearningMapping,
        initMidi
    };
};
