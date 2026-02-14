import React, { useEffect } from 'react';
import { KEYBOARD_MAP_OSC1, KEYBOARD_MAP_OSC2 } from '../data/constants';
import { SynthState } from '../types';

const KEY_TOKEN_BY_CODE: Readonly<Record<string, string>> = {
    KeyZ: 'z',
    KeyX: 'x',
    KeyC: 'c',
    KeyV: 'v',
    KeyB: 'b',
    KeyN: 'n',
    KeyM: 'm',
    Comma: ',',
    KeyS: 's',
    KeyD: 'd',
    KeyG: 'g',
    KeyH: 'h',
    KeyJ: 'j',
    KeyQ: 'q',
    KeyW: 'w',
    KeyE: 'e',
    KeyR: 'r',
    KeyT: 't',
    KeyY: 'y',
    KeyU: 'u',
    KeyI: 'i',
    Digit2: '2',
    Digit3: '3',
    Digit5: '5',
    Digit6: '6',
    Digit7: '7'
};

const resolveKeyboardToken = (e: KeyboardEvent): string => KEY_TOKEN_BY_CODE[e.code] ?? e.key.toLowerCase();

export const useKeyboardSystem = (
    paramsRef: React.RefObject<SynthState>,
    triggerPolyVoice: (idx: number, freq: number | null, mode: 'attack' | 'legato' | 'release', target: 'osc1' | 'osc2') => void,
    setActiveFreq1: (f: number | null) => void,
    setActiveFreq2: (f: number | null) => void,
    lastVOctFreq1: React.RefObject<number>,
    lastVOctFreq2: React.RefObject<number>,
    keyStack1: React.RefObject<string[]>,
    keyStack2: React.RefObject<string[]>
) => {
    // Keyboard note handling for OSC1/OSC2 in V/Oct mode.
    useEffect(() => {
        // Note on handler.
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            
            // Do not hijack typing in form controls (except range sliders).
            const targetEl = e.target as HTMLElement;
            if ((targetEl.tagName === 'INPUT' || targetEl.tagName === 'TEXTAREA' || targetEl.tagName === 'SELECT') 
                && targetEl.getAttribute('type') !== 'range') {
              return;
            }
            
            const key = resolveKeyboardToken(e);
            const p = paramsRef.current;
            if (!p) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            
            // OSC1 keyboard lane.
            if (KEYBOARD_MAP_OSC1[key] !== undefined && p.osc1.voltOct && !p.osc1.drone && !p.seq1.isRunning) {
                if (keyStack1.current) {
                    // Stack keeps OSC1 monophonic with legato fallback to last held key.
                    const isLegato = keyStack1.current.length > 0;
                    if (!keyStack1.current.includes(key)) {
                      keyStack1.current.push(key);
                    }
                    const freq = KEYBOARD_MAP_OSC1[key];
                    setActiveFreq1(freq);
                    if (lastVOctFreq1.current !== undefined) lastVOctFreq1.current = freq;
                    triggerPolyVoice(0, freq, isLegato ? 'legato' : 'attack', 'osc1');
                }
            }
            
            // OSC2 keyboard lane.
            if (KEYBOARD_MAP_OSC2[key] !== undefined && p.osc2.voltOct && !p.osc2.drone && !p.seq2.isRunning) {
                if (keyStack2.current) {
                    // Stack keeps OSC2 monophonic with legato fallback to last held key.
                    const isLegato = keyStack2.current.length > 0;
                    if (!keyStack2.current.includes(key)) {
                      keyStack2.current.push(key);
                    }
                    const freq = KEYBOARD_MAP_OSC2[key];
                    setActiveFreq2(freq);
                    if (lastVOctFreq2.current !== undefined) lastVOctFreq2.current = freq;
                    triggerPolyVoice(0, freq, isLegato ? 'legato' : 'attack', 'osc2');
                }
            }
        };
        
        // Note off handler.
        const handleKeyUp = (e: KeyboardEvent) => {
            const key = resolveKeyboardToken(e);
            const p = paramsRef.current;
            if (!p) return;
            
            // OSC1 release and held-note fallback.
            if (KEYBOARD_MAP_OSC1[key] !== undefined) {
                 if (keyStack1.current) {
                     const newStack = keyStack1.current.filter(k => k !== key);
                     keyStack1.current.length = 0;
                     keyStack1.current.push(...newStack);

                     if (p.osc1.voltOct && !p.osc1.drone && !p.seq1.isRunning) {
                         if (keyStack1.current.length > 0) { 
                           const freq = KEYBOARD_MAP_OSC1[keyStack1.current[keyStack1.current.length - 1]]; 
                           setActiveFreq1(freq); 
                           triggerPolyVoice(0, freq, 'legato', 'osc1'); 
                         } else { 
                           setActiveFreq1(null); 
                           triggerPolyVoice(0, null, 'release', 'osc1'); 
                         }
                     }
                 }
            }
            
            // OSC2 release and held-note fallback.
            if (KEYBOARD_MAP_OSC2[key] !== undefined) {
                 if (keyStack2.current) {
                     const newStack = keyStack2.current.filter(k => k !== key);
                     keyStack2.current.length = 0;
                     keyStack2.current.push(...newStack);

                     if (p.osc2.voltOct && !p.osc2.drone && !p.seq2.isRunning) {
                         if (keyStack2.current.length > 0) { 
                           const freq = KEYBOARD_MAP_OSC2[keyStack2.current[keyStack2.current.length - 1]]; 
                           setActiveFreq2(freq); 
                           triggerPolyVoice(0, freq, 'legato', 'osc2'); 
                         } else { 
                           setActiveFreq2(null); 
                           triggerPolyVoice(0, null, 'release', 'osc2'); 
                         }
                     }
                 }
            }
        };

        // Reset stuck keys/gates when browser focus is lost.
        const releaseKeyboardLanes = () => {
            const p = paramsRef.current;
            if (!p) return;

            if (keyStack1.current) keyStack1.current.length = 0;
            if (keyStack2.current) keyStack2.current.length = 0;

            if (p.osc1.voltOct && !p.osc1.drone && !p.seq1.isRunning) {
                setActiveFreq1(null);
                triggerPolyVoice(0, null, 'release', 'osc1');
            }

            if (p.osc2.voltOct && !p.osc2.drone && !p.seq2.isRunning) {
                setActiveFreq2(null);
                triggerPolyVoice(0, null, 'release', 'osc2');
            }
        };

        const handleWindowBlur = () => {
            const hasPressed = (keyStack1.current?.length ?? 0) > 0 || (keyStack2.current?.length ?? 0) > 0;
            if (!hasPressed) return;
            releaseKeyboardLanes();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') releaseKeyboardLanes();
        };
        
        // Global keyboard subscription lifecycle.
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleWindowBlur);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => { 
          window.removeEventListener('keydown', handleKeyDown); 
          window.removeEventListener('keyup', handleKeyUp); 
          window.removeEventListener('blur', handleWindowBlur);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [triggerPolyVoice, setActiveFreq1, setActiveFreq2, paramsRef, keyStack1, keyStack2, lastVOctFreq1, lastVOctFreq2]);
};
