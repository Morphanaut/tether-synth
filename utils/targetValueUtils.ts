
import React from 'react';
import { SynthState, LfoTarget } from '../types';

/**
 * Retrieves the current numeric value for a given LfoTarget from the SynthState.
 */
export const getTargetValue = (state: SynthState, target: LfoTarget): number => {
    switch (target) {
        case 'osc1-freq': return state.osc1.freq;
        case 'osc1-cutoff': return state.osc1.cutoff;
        case 'osc1-hp-cutoff': return state.osc1.hpCutoff;
        case 'osc1-hp-res': return state.osc1.hpResonance;
        case 'osc1-pan': return state.osc1.pan;
        case 'osc1-gain': return state.osc1.gain;
        case 'osc1-pwm': return state.osc1.pwm;
        case 'osc1-res': return state.osc1.resonance;
        case 'osc1-fine': return state.osc1.fineTune;
        case 'osc2-freq': return state.osc2.freq;
        case 'osc2-cutoff': return state.osc2.cutoff;
        case 'osc2-hp-cutoff': return state.osc2.hpCutoff;
        case 'osc2-hp-res': return state.osc2.hpResonance;
        case 'osc2-pan': return state.osc2.pan;
        case 'osc2-gain': return state.osc2.gain;
        case 'osc2-pwm': return state.osc2.pwm;
        case 'osc2-res': return state.osc2.resonance;
        case 'osc2-fine': return state.osc2.fineTune;
        case 'lfo1-rate': return state.lfo1.rate;
        case 'lfo1-depth': return state.lfo1.depth;
        case 'lfo2-rate': return state.lfo2.rate;
        case 'lfo2-depth': return state.lfo2.depth;
        case 'fm-1to2': return state.oscMod.osc1to2.amount;
        case 'fm-2to1': return state.oscMod.osc2to1.amount;
        case 'seq1-rate': return state.seq1.rate;
        case 'seq2-rate': return state.seq2.rate;
        case 'modSeq1-rate': return state.modSeq1.rate;
        case 'modSeq2-rate': return state.modSeq2.rate;
        case 'master-vol': return state.global.masterVolume;
        case 'delay-time': return state.global.delayTime;
        case 'delay-mix': return state.global.delayMix;
        case 'delay-feedback': return state.global.delayFeedback;
        case 'reverb-mix': return state.global.springReverbMix;
        case 'reverb-tone': return state.global.springReverbTone;
        case 'fuzz-drive': return state.global.fuzzDrive;
        case 'fuzz-tone': return state.global.fuzzTone;
        case 'fuzz-mix': return state.global.fuzzMix;
        case 'bitcrusher-bits': return state.global.bitcrusherBits;
        case 'bitcrusher-rate': return state.global.bitcrusherRate;
        case 'bitcrusher-mix': return state.global.bitcrusherMix;
        case 'modEnv1-depth': return state.modEnv1.depth;
        case 'modEnv2-depth': return state.modEnv2.depth;
        case 'noise-cutoff': return state.noise.cutoff;
        case 'noise-res': return state.noise.resonance;
        case 'noise-sendA': return state.noise.sendA;
        case 'noise-sendB': return state.noise.sendB;
        case 'noise-fmA': return state.noise.fmSendA;
        case 'noise-fmB': return state.noise.fmSendB;
        default: return 0;
    }
};

/**
 * Creates a setter function that updates the SynthState based on an LfoTarget.
 */
export const createTargetValueSetter = (
    setParams: React.Dispatch<React.SetStateAction<SynthState>>
) => (target: LfoTarget, val: number) => {
    setParams(prev => {
        if (target === 'none') return prev;
        if (getTargetValue(prev, target) === val) return prev;
        const next = { ...prev };
        switch (target) {
            case 'osc1-freq': next.osc1 = { ...next.osc1, freq: val }; break;
            case 'osc1-cutoff': next.osc1 = { ...next.osc1, cutoff: val }; break;
            case 'osc1-hp-cutoff': next.osc1 = { ...next.osc1, hpCutoff: val }; break;
            case 'osc1-hp-res': next.osc1 = { ...next.osc1, hpResonance: val }; break;
            case 'osc1-pan': next.osc1 = { ...next.osc1, pan: val }; break;
            case 'osc1-gain': next.osc1 = { ...next.osc1, gain: val }; break;
            case 'osc1-pwm': next.osc1 = { ...next.osc1, pwm: val }; break;
            case 'osc1-res': next.osc1 = { ...next.osc1, resonance: val }; break;
            case 'osc1-fine': next.osc1 = { ...next.osc1, fineTune: val }; break;
            case 'osc2-freq': next.osc2 = { ...next.osc2, freq: val }; break;
            case 'osc2-cutoff': next.osc2 = { ...next.osc2, cutoff: val }; break;
            case 'osc2-hp-cutoff': next.osc2 = { ...next.osc2, hpCutoff: val }; break;
            case 'osc2-hp-res': next.osc2 = { ...next.osc2, hpResonance: val }; break;
            case 'osc2-pan': next.osc2 = { ...next.osc2, pan: val }; break;
            case 'osc2-gain': next.osc2 = { ...next.osc2, gain: val }; break;
            case 'osc2-pwm': next.osc2 = { ...next.osc2, pwm: val }; break;
            case 'osc2-res': next.osc2 = { ...next.osc2, resonance: val }; break;
            case 'osc2-fine': next.osc2 = { ...next.osc2, fineTune: val }; break;
            case 'lfo1-rate': next.lfo1 = { ...next.lfo1, rate: val }; break;
            case 'lfo1-depth': next.lfo1 = { ...next.lfo1, depth: val }; break;
            case 'lfo2-rate': next.lfo2 = { ...next.lfo2, rate: val }; break;
            case 'lfo2-depth': next.lfo2 = { ...next.lfo2, depth: val }; break;
            case 'fm-1to2': next.oscMod.osc1to2 = { ...next.oscMod.osc1to2, amount: val }; break;
            case 'fm-2to1': next.oscMod.osc2to1 = { ...next.oscMod.osc2to1, amount: val }; break;
            case 'seq1-rate': next.seq1 = { ...next.seq1, rate: val }; break;
            case 'seq2-rate': next.seq2 = { ...next.seq2, rate: val }; break;
            case 'modSeq1-rate': next.modSeq1 = { ...next.modSeq1, rate: val }; break;
            case 'modSeq2-rate': next.modSeq2 = { ...next.modSeq2, rate: val }; break;
            case 'master-vol': next.global = { ...next.global, masterVolume: val }; break;
            case 'delay-time': next.global = { ...next.global, delayTime: val }; break;
            case 'delay-mix': next.global = { ...next.global, delayMix: val }; break;
            case 'delay-feedback': next.global = { ...next.global, delayFeedback: val }; break;
            case 'reverb-mix': next.global = { ...next.global, springReverbMix: val }; break;
            case 'reverb-tone': next.global = { ...next.global, springReverbTone: val }; break;
            case 'fuzz-drive': next.global = { ...next.global, fuzzDrive: val }; break;
            case 'fuzz-tone': next.global = { ...next.global, fuzzTone: val }; break;
            case 'fuzz-mix': next.global = { ...next.global, fuzzMix: val }; break;
            case 'bitcrusher-bits': next.global = { ...next.global, bitcrusherBits: val }; break;
            case 'bitcrusher-rate': next.global = { ...next.global, bitcrusherRate: val }; break;
            case 'bitcrusher-mix': next.global = { ...next.global, bitcrusherMix: val }; break;
            case 'modEnv1-depth': next.modEnv1 = { ...next.modEnv1, depth: val }; break;
            case 'modEnv2-depth': next.modEnv2 = { ...next.modEnv2, depth: val }; break;
            case 'noise-cutoff': next.noise = { ...next.noise, cutoff: val }; break;
            case 'noise-res': next.noise = { ...next.noise, resonance: val }; break;
            case 'noise-sendA': next.noise = { ...next.noise, sendA: val }; break;
            case 'noise-sendB': next.noise = { ...next.noise, sendB: val }; break;
            case 'noise-fmA': next.noise = { ...next.noise, fmSendA: val }; break;
            case 'noise-fmB': next.noise = { ...next.noise, fmSendB: val }; break;
        }
        return next;
    });
};

/**
 * Applies a numeric delta to a SynthState target and returns the new state.
 */
export const applyTargetDelta = (state: SynthState, target: LfoTarget, delta: number): SynthState => {
    if (delta === 0 || target === 'none') return state;
    
    const clamp = (v: number) => Math.max(0, Math.min(1024, v));
    const currentVal = getTargetValue(state, target);
    const newVal = clamp(currentVal + delta);
    if (newVal === currentVal) return state;
    
    const next = { ...state };
    switch (target) {
        case 'osc1-freq': next.osc1 = { ...next.osc1, freq: newVal }; break;
        case 'osc1-cutoff': next.osc1 = { ...next.osc1, cutoff: newVal }; break;
        case 'osc1-hp-cutoff': next.osc1 = { ...next.osc1, hpCutoff: newVal }; break;
        case 'osc1-hp-res': next.osc1 = { ...next.osc1, hpResonance: newVal }; break;
        case 'osc1-pan': next.osc1 = { ...next.osc1, pan: newVal }; break;
        case 'osc1-gain': next.osc1 = { ...next.osc1, gain: newVal }; break;
        case 'osc1-pwm': next.osc1 = { ...next.osc1, pwm: newVal }; break;
        case 'osc1-res': next.osc1 = { ...next.osc1, resonance: newVal }; break;
        case 'osc1-fine': next.osc1 = { ...next.osc1, fineTune: newVal }; break;
        case 'osc2-freq': next.osc2 = { ...next.osc2, freq: newVal }; break;
        case 'osc2-cutoff': next.osc2 = { ...next.osc2, cutoff: newVal }; break;
        case 'osc2-hp-cutoff': next.osc2 = { ...next.osc2, hpCutoff: newVal }; break;
        case 'osc2-hp-res': next.osc2 = { ...next.osc2, hpResonance: newVal }; break;
        case 'osc2-pan': next.osc2 = { ...next.osc2, pan: newVal }; break;
        case 'osc2-gain': next.osc2 = { ...next.osc2, gain: newVal }; break;
        case 'osc2-pwm': next.osc2 = { ...next.osc2, pwm: newVal }; break;
        case 'osc2-res': next.osc2 = { ...next.osc2, resonance: newVal }; break;
        case 'osc2-fine': next.osc2 = { ...next.osc2, fineTune: newVal }; break;
        case 'lfo1-rate': next.lfo1 = { ...next.lfo1, rate: newVal }; break;
        case 'lfo1-depth': next.lfo1 = { ...next.lfo1, depth: newVal }; break;
        case 'lfo2-rate': next.lfo2 = { ...next.lfo2, rate: newVal }; break;
        case 'lfo2-depth': next.lfo2 = { ...next.lfo2, depth: newVal }; break;
        case 'fm-1to2': next.oscMod.osc1to2 = { ...next.oscMod.osc1to2, amount: newVal }; break;
        case 'fm-2to1': next.oscMod.osc2to1 = { ...next.oscMod.osc2to1, amount: newVal }; break;
        case 'seq1-rate': next.seq1 = { ...next.seq1, rate: newVal }; break;
        case 'seq2-rate': next.seq2 = { ...next.seq2, rate: newVal }; break;
        case 'modSeq1-rate': next.modSeq1 = { ...next.modSeq1, rate: newVal }; break;
        case 'modSeq2-rate': next.modSeq2 = { ...next.modSeq2, rate: newVal }; break;
        case 'master-vol': next.global = { ...next.global, masterVolume: newVal }; break;
        case 'delay-time': next.global = { ...next.global, delayTime: newVal }; break;
        case 'delay-mix': next.global = { ...next.global, delayMix: newVal }; break;
        case 'delay-feedback': next.global = { ...next.global, delayFeedback: newVal }; break;
        case 'reverb-mix': next.global = { ...next.global, springReverbMix: newVal }; break;
        case 'reverb-tone': next.global = { ...next.global, springReverbTone: newVal }; break;
        case 'fuzz-drive': next.global = { ...next.global, fuzzDrive: newVal }; break;
        case 'fuzz-tone': next.global = { ...next.global, fuzzTone: newVal }; break;
        case 'fuzz-mix': next.global = { ...next.global, fuzzMix: newVal }; break;
        case 'bitcrusher-bits': next.global = { ...next.global, bitcrusherBits: newVal }; break;
        case 'bitcrusher-rate': next.global = { ...next.global, bitcrusherRate: newVal }; break;
        case 'bitcrusher-mix': next.global = { ...next.global, bitcrusherMix: newVal }; break;
        case 'modEnv1-depth': next.modEnv1 = { ...next.modEnv1, depth: newVal }; break;
        case 'modEnv2-depth': next.modEnv2 = { ...next.modEnv2, depth: newVal }; break;
        case 'noise-cutoff': next.noise = { ...next.noise, cutoff: newVal }; break;
        case 'noise-res': next.noise = { ...next.noise, resonance: newVal }; break;
        case 'noise-sendA': next.noise = { ...next.noise, sendA: newVal }; break;
        case 'noise-sendB': next.noise = { ...next.noise, sendB: newVal }; break;
        case 'noise-fmA': next.noise = { ...next.noise, fmSendA: newVal }; break;
        case 'noise-fmB': next.noise = { ...next.noise, fmSendB: newVal }; break;
    }
    return next;
};
