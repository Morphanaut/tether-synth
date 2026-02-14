import { AudioGraphNodes, LfoTarget, SynthState } from '../types';
import { getModulationScale, mapLfoDepth } from './audioMath';

export type ModulatorDepth = { bipolar: number; unipolar: number; scale: number };

export const stripTargetSuffix = (target: string | undefined): string => {
    if (!target) return '';
    const idx = target.indexOf(':');
    return idx >= 0 ? target.substring(0, idx) : target;
};

export const extractBaseTarget = (target: string): LfoTarget => {
    const colonIdx = target.indexOf(':');
    return (colonIdx >= 0 ? target.substring(0, colonIdx) : target) as LfoTarget;
};

export const cleanupSettlingTargets = (
    settlingTargetsMap: Map<LfoTarget, number>,
    now: number,
    settlingGracePeriodMs: number
): void => {
    for (const [target, disconnectTime] of settlingTargetsMap.entries()) {
        if (now - disconnectTime > settlingGracePeriodMs) {
            settlingTargetsMap.delete(target);
        }
    }
};

export const buildActiveTargetSet = (
    activeTargets: Record<string, string> | null | undefined
): Set<LfoTarget> => {
    const activeTargetSet = new Set<LfoTarget>();
    if (!activeTargets) return activeTargetSet;
    for (const routedTarget of Object.values(activeTargets)) {
        if (typeof routedTarget === 'string') {
            activeTargetSet.add(extractBaseTarget(routedTarget));
        }
    }
    return activeTargetSet;
};

export const buildModulatorMap = (p: SynthState): Map<LfoTarget, ModulatorDepth> => {
    const modulatorMap = new Map<LfoTarget, ModulatorDepth>();
    const isTargetEnabled = (target: LfoTarget): boolean => {
        if (target === 'none') return false;
        if (target === 'osc1-pwm') return p.osc1.wave === 'square';
        if (target === 'osc2-pwm') return p.osc2.wave === 'square';
        return true;
    };

    const addModulator = (target: LfoTarget, bipolar: number, unipolar: number) => {
        const existing = modulatorMap.get(target);
        if (existing) {
            existing.bipolar += bipolar;
            existing.unipolar += unipolar;
        } else {
            modulatorMap.set(target, { bipolar, unipolar, scale: 1.0 });
        }
    };

    if (p.lfo1.depth > 0 && isTargetEnabled(p.lfo1.target)) {
        addModulator(p.lfo1.target, mapLfoDepth(p.lfo1.depth), 0);
    }
    if (p.lfo2.depth > 0 && isTargetEnabled(p.lfo2.target)) {
        addModulator(p.lfo2.target, mapLfoDepth(p.lfo2.depth), 0);
    }
    if (p.modEnv1.depth > 0 && isTargetEnabled(p.modEnv1.target)) {
        addModulator(p.modEnv1.target, 0, Math.pow(p.modEnv1.depth / 1024, 3.0));
    }
    if (p.modEnv2.depth > 0 && isTargetEnabled(p.modEnv2.target)) {
        addModulator(p.modEnv2.target, 0, Math.pow(p.modEnv2.depth / 1024, 3.0));
    }
    if (p.modSeq1.isRunning && isTargetEnabled(p.modSeq1.target)) addModulator(p.modSeq1.target, 0, 2.0);
    if (p.modSeq2.isRunning && isTargetEnabled(p.modSeq2.target)) addModulator(p.modSeq2.target, 0, 2.0);
    if (p.seq1.isRunning && isTargetEnabled(p.seq1.target)) addModulator(p.seq1.target, 0, 2.0);
    if (p.seq2.isRunning && isTargetEnabled(p.seq2.target)) addModulator(p.seq2.target, 0, 2.0);

    modulatorMap.forEach((modDepth, target) => {
        modDepth.scale = getModulationScale(target, p);
    });

    return modulatorMap;
};

export const connectModulatorTarget = (
    gainNode: GainNode,
    target: LfoTarget,
    n: AudioGraphNodes,
    p: SynthState,
    targetVoiceIdx?: number
): void => {
    if (target === 'lfo1-rate') gainNode.connect(n.lfo1.frequency);
    else if (target === 'lfo1-depth') gainNode.connect(n.lfo1Gain.gain);
    else if (target === 'lfo2-rate') gainNode.connect(n.lfo2.frequency);
    else if (target === 'lfo2-depth') gainNode.connect(n.lfo2Gain.gain);
    else if (target === 'master-vol') gainNode.connect(n.masterGain.gain);
    else if (target === 'delay-time') gainNode.connect(n.delay.delayTime);
    else if (target === 'delay-mix') gainNode.connect(n.delayWet.gain);
    else if (target === 'delay-feedback') gainNode.connect(n.delayFB.gain);
    else if (target === 'reverb-mix') gainNode.connect(n.springReverbWet.gain);
    else if (target === 'reverb-tone') gainNode.connect(n.springReverbFilter.gain);
    else if (target === 'fuzz-drive') gainNode.connect(n.fuzzInGain.gain);
    else if (target === 'fuzz-tone') { gainNode.connect(n.fuzzTrebleGain.gain); gainNode.connect(n.fuzzToneInverter); }
    else if (target === 'fuzz-mix') gainNode.connect(n.fuzzWet.gain);
    else if (target === 'bitcrusher-bits') gainNode.connect(n.bitcrusherBitsMod);
    else if (target === 'bitcrusher-rate') gainNode.connect(n.bitcrusherRateMod);
    else if (target === 'bitcrusher-mix') gainNode.connect(n.bitcrusherWet.gain);
    else if (target === 'seq1-rate') gainNode.connect(n.seq1RateModGain);
    else if (target === 'seq2-rate') gainNode.connect(n.seq2RateModGain);
    else if (target === 'modSeq1-rate') gainNode.connect(n.modSeq1RateModGain);
    else if (target === 'modSeq2-rate') gainNode.connect(n.modSeq2RateModGain);
    else if (target === 'noise-cutoff') gainNode.connect(n.noiseFilter.detune);
    else if (target === 'noise-res') gainNode.connect(n.noiseFilter.Q);
    else if (target === 'noise-sendA') gainNode.connect(n.noiseSendAGain.gain);
    else if (target === 'noise-sendB') gainNode.connect(n.noiseSendBGain.gain);
    else if (target === 'noise-fmA') gainNode.connect(n.noiseFmSendAGain.gain);
    else if (target === 'noise-fmB') gainNode.connect(n.noiseFmSendBGain.gain);
    else {
        const voicesToConnect = targetVoiceIdx !== undefined ? [n.voices[targetVoiceIdx]] : n.voices;
        voicesToConnect.forEach(v => {
            if (target === 'osc1-freq') gainNode.connect(v.osc1.frequency);
            else if (target === 'osc1-cutoff') gainNode.connect(v.filt1.detune);
            else if (target === 'osc1-res') gainNode.connect(v.filt1.Q);
            else if (target === 'osc1-hp-cutoff') gainNode.connect(v.hpFilt1.detune);
            else if (target === 'osc1-hp-res') gainNode.connect(v.hpFilt1.Q);
            else if (target === 'osc1-pan') gainNode.connect(v.pan1.pan);
            else if (target === 'osc1-gain') gainNode.connect(v.mixGain1.gain);
            else if (target === 'osc1-pwm') gainNode.connect(v.osc1.pulseWidth);
            else if (target === 'osc1-fine') gainNode.connect(v.osc1.detune);
            else if (target === 'osc2-freq') gainNode.connect(v.osc2.frequency);
            else if (target === 'osc2-cutoff') gainNode.connect(v.filt2.detune);
            else if (target === 'osc2-res') gainNode.connect(v.filt2.Q);
            else if (target === 'osc2-hp-cutoff') gainNode.connect(v.hpFilt2.detune);
            else if (target === 'osc2-hp-res') gainNode.connect(v.hpFilt2.Q);
            else if (target === 'osc2-pan') gainNode.connect(v.pan2.pan);
            else if (target === 'osc2-gain') gainNode.connect(v.mixGain2.gain);
            else if (target === 'osc2-pwm') gainNode.connect(v.osc2.pulseWidth);
            else if (target === 'osc2-fine') gainNode.connect(v.osc2.detune);
            else if (target === 'fm-1to2') { if (p.oscMod.osc1to2.type === 'fm') gainNode.connect(v.fmGain1to2.gain); else gainNode.connect(v.amGain1to2.gain); }
            else if (target === 'fm-2to1') { if (p.oscMod.osc2to1.type === 'fm') gainNode.connect(v.fmGain2to1.gain); else gainNode.connect(v.amGain2to1.gain); }
            else if (target === 'modEnv1-depth') gainNode.connect(v.modEnv1DepthNode.gain);
            else if (target === 'modEnv2-depth') gainNode.connect(v.modEnv2DepthNode.gain);
        });
    }
};
