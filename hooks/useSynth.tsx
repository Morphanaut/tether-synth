
import { useEffect, useRef, useState, useCallback } from 'react';
import { SynthState, LfoTarget, AudioGraphNodes, TriggerTarget, TriggerMode, EnvelopeParams, ModEnvelopeParams } from '../types';
import { 
    mapAttackTime, mapReleaseTime, mapPortamento, mapModEnvDelay, midiToFreq,
    generateTolerances, AnalogTolerances, createSpringImpulseResponse
} from '../utils/audioMath';
import { createSynthNodes, updateFxRouting } from '../utils/audioGraph';
import { updateAudioNodes } from '../utils/nodeUpdater';
import { BITCRUSHER_PROCESSOR_CODE } from '../utils/bitcrusherWorklet';
import { ANALOG_OSC_PROCESSOR_CODE } from '../utils/analogOscWorklet';
import { warnOnceInDev } from '../utils/devDiagnostics';
import { useMidiSystem } from './useMidiSystem';
import { useSequencerSystem } from './useSequencerSystem';
import { useKeyboardSystem } from './useKeyboardSystem';

interface PolyVoiceState {
    note: number | null;
    released: boolean;
    timestamp: number;
    releaseUntil: number;
}

export const useSynth = (
    params: SynthState, 
    interactionMode: 'smooth' | 'instant' = 'smooth',
    onParamChange?: (target: LfoTarget, val: number) => void
) => {
  const [isStarted, setIsStarted] = useState(false);
  const paramsRef = useRef(params);
  const isStartedRef = useRef(isStarted);
  useEffect(() => { paramsRef.current = params; }, [params]);
  useEffect(() => { isStartedRef.current = isStarted; }, [isStarted]);

  const tolerances = useRef<AnalogTolerances | null>(null);
  const getTolerances = useCallback(() => {
    if (!tolerances.current) tolerances.current = generateTolerances();
    return tolerances.current;
  }, []);
  
  // Optimization: Cache last set values to avoid redundant AudioParam calls
  const paramCache = useRef<WeakMap<AudioParam, number>>(new WeakMap());

  const keyStack1 = useRef<string[]>([]);
  const keyStack2 = useRef<string[]>([]);
  const activeMidiNotes = useRef<number[]>([]);
  const mobileMonoNotes = useRef<number[]>([]);
  const mobilePolyNoteToVoice = useRef<Map<number, number>>(new Map());
  const controlSourceRef = useRef<'ui' | 'midi'>('ui');
  const activeTargetsRef = useRef<Record<string, string>>({});
  
  const lastReverbDecayRef = useRef<number>(params.global.springReverbDecay);
  const pendingReverbDecayRef = useRef<number | null>(null);
  const reverbDebounceTimer = useRef<number | null>(null);
  const reverbSwapTimer = useRef<number | null>(null);
  const startupReadyTimer = useRef<number | null>(null);
  const voiceAllocation = useRef<PolyVoiceState[]>(Array(6).fill(null).map(() => ({ note: null, released: true, timestamp: 0, releaseUntil: 0 })));

  const setActiveFreq1 = useCallback((_f: number | null) => {}, []);
  const setActiveFreq2 = useCallback((_f: number | null) => {}, []);
  const lastVOctFreq1 = useRef<number>(440); 
  const lastVOctFreq2 = useRef<number>(444);
  const [isVOctGateActive1, setIsVOctGateActive1] = useState(false);
  const [isVOctGateActive2, setIsVOctGateActive2] = useState(false);

  const notifyUiControl = useCallback(() => { controlSourceRef.current = 'ui'; }, []);
  
  const tapTimes = useRef<number[]>([]);
  const tapTimeout = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodes = useRef<AudioGraphNodes | null>(null);
  const uiUpdateRafRef = useRef<number | null>(null);
  const pendingUiParamsRef = useRef<SynthState>(params);
  const pendingUiInteractionRef = useRef<'smooth' | 'instant'>(interactionMode);

  useEffect(() => {
      if (!params.osc1.voltOct) keyStack1.current = [];
      if (!params.osc2.voltOct) keyStack2.current = [];
      if (!params.osc1.midi && !params.osc2.midi) activeMidiNotes.current = [];
  }, [params.osc1.voltOct, params.osc2.voltOct, params.osc1.midi, params.osc2.midi]);

  useEffect(() => {
    return () => {
      if (tapTimeout.current !== null) { clearTimeout(tapTimeout.current); tapTimeout.current = null; }
      if (reverbDebounceTimer.current !== null) { clearTimeout(reverbDebounceTimer.current); reverbDebounceTimer.current = null; }
      if (reverbSwapTimer.current !== null) { clearTimeout(reverbSwapTimer.current); reverbSwapTimer.current = null; }
      if (startupReadyTimer.current !== null) { clearTimeout(startupReadyTimer.current); startupReadyTimer.current = null; }
      if (uiUpdateRafRef.current !== null) {
        cancelAnimationFrame(uiUpdateRafRef.current);
        uiUpdateRafRef.current = null;
      }
      if (ctxRef.current) {
        try { if (ctxRef.current.state !== 'closed') ctxRef.current.close(); } catch (e) {
          warnOnceInDev('[useSynth] failed to close AudioContext during cleanup', e);
        }
        ctxRef.current = null;
      }
    };
  }, []);

  const triggerPolyVoice = useCallback((voiceIdx: number, freq: number | null, mode: TriggerMode, target: TriggerTarget, when?: number) => {
      if (!nodes.current || !ctxRef.current) return;
      const ctx = ctxRef.current;
      const t = Math.max(ctx.currentTime, when ?? ctx.currentTime);
      const p = paramsRef.current;
      const v = nodes.current.voices[voiceIdx];
      if (!v) return;
      
      const triggerOsc1 = target === 'osc1' || target === 'both';
      const triggerOsc2 = target === 'osc2' || target === 'both';

      if (freq !== null && mode !== 'release') {
        const isLegato = mode === 'legato';
        const glide1 = isLegato ? mapPortamento(p.osc1.portamento) : 0;
        const glide2 = isLegato ? mapPortamento(p.osc2.portamento) : 0;
        
        // Voice worklet oscillator parameter updates
        if (triggerOsc1) {
            v.osc1.frequency.cancelScheduledValues(t);
            // Anchor current frequency before glide to reduce discontinuity clicks.
            v.osc1.frequency.setValueAtTime(v.osc1.frequency.value, t);
            v.osc1.frequency.setTargetAtTime(freq, t, isLegato && glide1 > 0 ? glide1 : 0.001);
            // Bypass cache for triggers as they are time-critical and mandatory
        }
        if (triggerOsc2) {
            v.osc2.frequency.cancelScheduledValues(t);
            // Anchor current frequency before glide to reduce discontinuity clicks.
            v.osc2.frequency.setValueAtTime(v.osc2.frequency.value, t);
            v.osc2.frequency.setTargetAtTime(freq, t, isLegato && glide2 > 0 ? glide2 : 0.001);
        }
      }

      const scheduleEnv = (gainNode: GainNode, envParams: EnvelopeParams | ModEnvelopeParams, isMod: boolean) => {
          gainNode.gain.cancelScheduledValues(t);
          if (mode === 'attack') {
              const att = mapAttackTime(envParams.attack);
              gainNode.gain.setTargetAtTime(0, t, 0.002);
              gainNode.gain.setTargetAtTime(isMod ? 1.0 : 0.3, t + 0.005, att / 3); 
          } else if (mode === 'release') {
              const rel = mapReleaseTime(envParams.release);
              gainNode.gain.setTargetAtTime(0, t, rel / 3);
          }
      };

      const scheduleModEnv = (gainNode: GainNode, env: ModEnvelopeParams) => {
          gainNode.gain.cancelScheduledValues(t);
          if (mode === 'attack') {
              const att = mapAttackTime(env.attack);
              const delay = mapModEnvDelay(env.delay);
              gainNode.gain.setTargetAtTime(0, t, 0.002);
              gainNode.gain.setTargetAtTime(1, t + 0.005 + delay, att / 3);
          } else if (mode === 'release') {
              const rel = mapReleaseTime(env.release);
              gainNode.gain.setTargetAtTime(0, t, rel / 3);
          }
      };

      if (triggerOsc1) { scheduleEnv(v.gain1, p.env1, false); scheduleModEnv(v.modEnv1Gain, p.modEnv1); }
      if (triggerOsc2) { scheduleEnv(v.gain2, p.env2, false); scheduleModEnv(v.modEnv2Gain, p.modEnv2); }
  }, []);

  const triggerGate = useCallback((voiceId: 1 | 2, isOpen: boolean, force = false, _isInstant = false) => {
    const p = paramsRef.current;
    if (!isOpen && force) {
        if (nodes.current && ctxRef.current) {
            const t = ctxRef.current.currentTime;
            nodes.current.voices.forEach(v => {
                if (voiceId === 1) { v.gain1.gain.cancelScheduledValues(t); v.gain1.gain.setTargetAtTime(0, t, 0.015); v.modEnv1Gain.gain.cancelScheduledValues(t); v.modEnv1Gain.gain.setTargetAtTime(0, t, 0.015); }
                else { v.gain2.gain.cancelScheduledValues(t); v.gain2.gain.setTargetAtTime(0, t, 0.015); v.modEnv2Gain.gain.cancelScheduledValues(t); v.modEnv2Gain.gain.setTargetAtTime(0, t, 0.015); }
            });
            voiceAllocation.current.forEach(v => { v.released = true; v.note = null; v.releaseUntil = 0; });
            if (voiceId === 1) setIsVOctGateActive1(false);
            if (voiceId === 2) setIsVOctGateActive2(false);
        }
        return;
    }
    if (!force) {
        if (voiceId === 1 && (p.osc1.drone || p.seq1.isRunning)) return;
        if (voiceId === 2 && (p.osc2.drone || p.seq2.isRunning)) return;
    }
    triggerPolyVoice(0, null, isOpen ? 'attack' : 'release', voiceId === 1 ? 'osc1' : 'osc2');
    if (voiceId === 1) setIsVOctGateActive1(isOpen);
    if (voiceId === 2) setIsVOctGateActive2(isOpen);
  }, [triggerPolyVoice]);

  const getMobileKeyboardTarget = useCallback((): TriggerTarget | null => {
    const p = paramsRef.current;
    const osc1Enabled = p.osc1.voltOct && !p.osc1.drone && !p.seq1.isRunning;
    const osc2Enabled = p.osc2.voltOct && !p.osc2.drone && !p.seq2.isRunning;
    if (!osc1Enabled && !osc2Enabled) return null;
    if (osc1Enabled && osc2Enabled) return 'both';
    return osc1Enabled ? 'osc1' : 'osc2';
  }, []);

  const getMobileReleaseMs = useCallback((target: TriggerTarget) => {
    const p = paramsRef.current;
    const usesOsc1 = target === 'osc1' || target === 'both';
    const usesOsc2 = target === 'osc2' || target === 'both';
    const rel1 = usesOsc1 ? mapReleaseTime(p.env1.release) : 0;
    const rel2 = usesOsc2 ? mapReleaseTime(p.env2.release) : 0;
    return Math.max(140, Math.round(Math.max(rel1, rel2, 0.02) * 1000 * 1.5));
  }, []);

  const releaseMobileKeyboardNotes = useCallback(() => {
    const target = getMobileKeyboardTarget();
    const now = performance.now();

    mobileMonoNotes.current = [];

    mobilePolyNoteToVoice.current.forEach((voiceIdx) => {
      if (target) {
        triggerPolyVoice(voiceIdx, null, 'release', target);
      }
      const voice = voiceAllocation.current[voiceIdx];
      if (!voice) return;
      voice.released = true;
      voice.note = null;
      voice.releaseUntil = now + (target ? getMobileReleaseMs(target) : 160);
    });
    mobilePolyNoteToVoice.current.clear();

    if (target) {
      triggerPolyVoice(0, null, 'release', target);
    }
  }, [getMobileKeyboardTarget, getMobileReleaseMs, triggerPolyVoice]);

  const triggerMobileKeyboardNote = useCallback((note: number, isPressed: boolean, polyphonic: boolean) => {
    if (!nodes.current || !ctxRef.current) return;
    if (!Number.isFinite(note)) return;
    const target = getMobileKeyboardTarget();
    if (!target) return;

    const freq = midiToFreq(note);
    const now = performance.now();
    controlSourceRef.current = 'ui';

    if (polyphonic) {
      const noteVoiceMap = mobilePolyNoteToVoice.current;

      if (isPressed) {
        const existingVoice = noteVoiceMap.get(note);
        if (existingVoice !== undefined) {
          const existingState = voiceAllocation.current[existingVoice];
          if (existingState) {
            existingState.note = note;
            existingState.released = false;
            existingState.timestamp = now;
            existingState.releaseUntil = 0;
          }
          triggerPolyVoice(existingVoice, freq, 'attack', target);
          return;
        }

        let targetIdx = voiceAllocation.current.findIndex(v => v.note === null || (v.released && v.releaseUntil <= now));
        if (targetIdx === -1) {
          let minTimestamp = Infinity;
          voiceAllocation.current.forEach((v, idx) => {
            if (v.timestamp < minTimestamp) {
              minTimestamp = v.timestamp;
              targetIdx = idx;
            }
          });
        }
        if (targetIdx < 0) targetIdx = 0;

        voiceAllocation.current[targetIdx] = {
          note,
          released: false,
          timestamp: now,
          releaseUntil: 0
        };
        noteVoiceMap.set(note, targetIdx);
        triggerPolyVoice(targetIdx, freq, 'attack', target);
        return;
      }

      const releaseVoice = noteVoiceMap.get(note);
      if (releaseVoice === undefined) return;
      noteVoiceMap.delete(note);

      const releaseState = voiceAllocation.current[releaseVoice];
      if (releaseState) {
        releaseState.released = true;
        releaseState.note = null;
        releaseState.releaseUntil = now + getMobileReleaseMs(target);
      }
      triggerPolyVoice(releaseVoice, null, 'release', target);
      return;
    }

    if (isPressed) {
      const stack = mobileMonoNotes.current;
      const isLegato = stack.length > 0;
      if (!stack.includes(note)) {
        stack.push(note);
      }
      triggerPolyVoice(0, freq, isLegato ? 'legato' : 'attack', target);
      return;
    }

    const nextStack = mobileMonoNotes.current.filter(n => n !== note);
    mobileMonoNotes.current = nextStack;
    if (nextStack.length > 0) {
      const fallback = nextStack[nextStack.length - 1];
      triggerPolyVoice(0, midiToFreq(fallback), 'legato', target);
    } else {
      triggerPolyVoice(0, null, 'release', target);
    }
  }, [getMobileKeyboardTarget, getMobileReleaseMs, triggerPolyVoice]);

  const { midiAccess, midiInputs, midiConfig, updateMidiConfig, learningMappingIndex, setLearningMapping, initMidi } = useMidiSystem(params, triggerPolyVoice, setActiveFreq1, setActiveFreq2, voiceAllocation, activeMidiNotes, lastVOctFreq1, lastVOctFreq2, controlSourceRef, onParamChange);
  useKeyboardSystem(paramsRef, triggerPolyVoice, setActiveFreq1, setActiveFreq2, lastVOctFreq1, lastVOctFreq2, keyStack1, keyStack2);
  const { currentStep1, currentStep2, currentStepMod1, currentStepMod2, manualSeqStep, syncSequencers, resetSequencer, manualModSeqStep, resetModSequencer, syncModToMaster, syncModSequencers } = useSequencerSystem(ctxRef, nodes, params, isStarted, triggerPolyVoice);

  const handleTapTempo = useCallback(() => {
    const now = performance.now();
    if (tapTimeout.current !== null) clearTimeout(tapTimeout.current);
    if (tapTimes.current.length > 0 && now - tapTimes.current[tapTimes.current.length - 1] > 2000) tapTimes.current = [];
    tapTimes.current.push(now);
    if (tapTimes.current.length > 4) tapTimes.current.shift();
    tapTimeout.current = window.setTimeout(() => { tapTimes.current = []; tapTimeout.current = null; }, 2000);
    if (tapTimes.current.length >= 2) {
        let totalInterval = 0;
        for (let i = 1; i < tapTimes.current.length; i++) totalInterval += tapTimes.current[i] - tapTimes.current[i - 1];
        return Math.max(30, Math.min(300, Math.round(60000 / (totalInterval / (tapTimes.current.length - 1)))));
    }
    return null;
  }, []);

  const startAudio = useCallback(async () => {
    if (ctxRef.current) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        throw new Error('Web Audio API is not supported in this browser');
      }

      const ctx = new AudioCtx();
      ctxRef.current = ctx;

      // Resume immediately
      if (ctx.state === 'suspended') await ctx.resume();

      // Load optimized oscillator worklet (required for voice graph).
      {
          const blob = new Blob([ANALOG_OSC_PROCESSOR_CODE], { type: 'application/javascript' });
          const url = URL.createObjectURL(blob);
          try {
              await ctx.audioWorklet.addModule(url);
          } finally {
              URL.revokeObjectURL(url);
          }
      }

      // Load Bitcrusher Worklet
      try {
          const blob = new Blob([BITCRUSHER_PROCESSOR_CODE], { type: 'application/javascript' });
          const url = URL.createObjectURL(blob);
          await ctx.audioWorklet.addModule(url);
          URL.revokeObjectURL(url);
      } catch (e) {
          console.warn("Failed to load Bitcrusher Worklet:", e);
      }

      const tol = getTolerances();
      const n = createSynthNodes(ctx, tol);
      nodes.current = n;

      // 1. First apply all parameters at Gain = 0
      updateFxRouting(n, paramsRef.current.global.fxRouting);
      // Pass empty paramCache initially
      updateAudioNodes(ctx, n, paramsRef.current, tol, 'smooth', 'ui', [], activeTargetsRef, paramCache);

      // 2. Wait for filters and circuits to stabilize
      if (startupReadyTimer.current !== null) {
        clearTimeout(startupReadyTimer.current);
      }
      startupReadyTimer.current = window.setTimeout(() => {
          startupReadyTimer.current = null;
          if (ctxRef.current && nodes.current) {
              const t = ctxRef.current.currentTime;
              nodes.current.outputGate.gain.setTargetAtTime(1, t, 0.05);
              nodes.current.dryGain.gain.setTargetAtTime(0.12, t, 0.05);

              setIsStarted(true);
              initMidi();
          }
      }, 200);

    } catch (error) {
      console.error('[useSynth] Failed to initialize audio:', error);
      warnOnceInDev('[useSynth] AudioContext initialization failed', error);
      // Clean up on error
      if (ctxRef.current) {
        try {
          ctxRef.current.close();
        } catch (e) {
          // Ignore close errors
        }
        ctxRef.current = null;
      }
      setIsStarted(false);
      if (startupReadyTimer.current !== null) {
        clearTimeout(startupReadyTimer.current);
        startupReadyTimer.current = null;
      }
      // User should see initialization failed (setIsStarted(false) prevents UI from showing "ready")
    }
  }, [initMidi, getTolerances]);

  useEffect(() => {
      if (nodes.current && isStarted) updateFxRouting(nodes.current, params.global.fxRouting);
  }, [params.global.fxRouting, isStarted]);

  useEffect(() => {
      const decay = params.global.springReverbDecay;
      const reverbEnabled = params.global.springReverbEnabled;

      if (!reverbEnabled) {
          if (reverbDebounceTimer.current !== null) { clearTimeout(reverbDebounceTimer.current); reverbDebounceTimer.current = null; }
          if (reverbSwapTimer.current !== null) { clearTimeout(reverbSwapTimer.current); reverbSwapTimer.current = null; }
          pendingReverbDecayRef.current = decay !== lastReverbDecayRef.current ? decay : null;
          return;
      }

      const targetDecay = pendingReverbDecayRef.current ?? decay;
      if (targetDecay === lastReverbDecayRef.current) {
          pendingReverbDecayRef.current = null;
          return;
      }

      if (reverbDebounceTimer.current !== null) clearTimeout(reverbDebounceTimer.current);
      if (reverbSwapTimer.current !== null) { clearTimeout(reverbSwapTimer.current); reverbSwapTimer.current = null; }
      reverbDebounceTimer.current = window.setTimeout(() => {
          if (!nodes.current || !ctxRef.current) return;
          const n = nodes.current; const ctx = ctxRef.current;
          const revMix = paramsRef.current.global.springReverbEnabled ? (paramsRef.current.global.springReverbMix / 1024) : 0;
          const revWetLevel = Math.sqrt(revMix) * 1.2;
          const t = ctx.currentTime;
          n.springReverbWet.gain.cancelScheduledValues(t); n.springReverbWet.gain.setTargetAtTime(0, t, 0.005); 
          reverbSwapTimer.current = window.setTimeout(() => {
              reverbSwapTimer.current = null;
              try { const newImpulse = createSpringImpulseResponse(ctx, targetDecay); if (n.springReverb) { n.springReverb.buffer = newImpulse; lastReverbDecayRef.current = targetDecay; pendingReverbDecayRef.current = null; } } 
              catch (e) { console.warn("Failed to regenerate reverb impulse:", e); }
              const t2 = ctx.currentTime; n.springReverbWet.gain.cancelScheduledValues(t2); n.springReverbWet.gain.setTargetAtTime(revWetLevel, t2, 0.01); reverbDebounceTimer.current = null;
          }, 40); 
      }, 100); 
  }, [params.global.springReverbDecay, params.global.springReverbEnabled, params.global.springReverbMix]);

  // Coalesce rapid UI updates (pads/faders) to one audio-graph update per frame.
  const scheduleUiAudioUpdate = useCallback(() => {
    if (uiUpdateRafRef.current !== null) return;
    uiUpdateRafRef.current = window.requestAnimationFrame(() => {
      uiUpdateRafRef.current = null;
      if (!ctxRef.current || !nodes.current || !isStartedRef.current) return;
      updateAudioNodes(
        ctxRef.current,
        nodes.current,
        pendingUiParamsRef.current,
        getTolerances(),
        pendingUiInteractionRef.current,
        'ui',
        activeMidiNotes.current,
        activeTargetsRef,
        paramCache
      );
    });
  }, [getTolerances]);

  // Audio update effect: only depends on params that affect audio output.
  useEffect(() => {
    if (!ctxRef.current || !nodes.current || !isStarted) return;
    // MIDI automation stays immediate for responsiveness.
    if (controlSourceRef.current === 'midi') {
      if (uiUpdateRafRef.current !== null) {
        cancelAnimationFrame(uiUpdateRafRef.current);
        uiUpdateRafRef.current = null;
      }
      updateAudioNodes(ctxRef.current, nodes.current, params, getTolerances(), interactionMode, 'midi', activeMidiNotes.current, activeTargetsRef, paramCache);
      return;
    }

    pendingUiParamsRef.current = params;
    pendingUiInteractionRef.current = interactionMode;
    scheduleUiAudioUpdate();
  }, [params, isStarted, interactionMode, getTolerances, scheduleUiAudioUpdate]);

  return { isStarted, startAudio, triggerGate, triggerMobileKeyboardNote, releaseMobileKeyboardNotes, manualSeqStep, syncSequencers, resetSequencer, manualModSeqStep, resetModSequencer, syncModToMaster, syncModSequencers, handleTapTempo, analyserNode: nodes.current?.analyser || null, currentStep1, currentStep2, currentStepMod1, currentStepMod2, isVOctGateActive1, isVOctGateActive2, midiAccess, midiConfig, updateMidiConfig, midiInputs, setLearningMapping, learningMappingIndex, notifyUiControl };
};

