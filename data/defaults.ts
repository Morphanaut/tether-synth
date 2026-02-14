
import { SynthState, MatrixSensitivities, LfoTarget } from '../types';

// ============================================================================
// DEFAULT STATE VALUES
// ============================================================================

const randomSteps = () => Array(8).fill(0).map(() => Math.floor(Math.random() * 1024));
const randomGates = (prob = 0.5) => Array(8).fill(0).map(() => Math.random() > (1 - prob));

/**
 * Default synthesizer parameter state
 */
export const DEFAULT_PARAMS: SynthState = {
    osc1: {
        wave: 'triangle',
        freq: 502,
        cutoff: 952,
        resonance: 0,
        hpCutoff: 0,
        hpResonance: 0,
        fineTune: 512,
        octave: 0,
        pwm: 0,
        pan: 307, // L 40
        gain: 614, // 60%
        drone: false,
        voltOct: false,
        midi: false,
        portamento: 0
    },
    osc2: {
        wave: 'triangle',
        freq: 502,
        cutoff: 952,
        resonance: 0,
        hpCutoff: 0,
        hpResonance: 0,
        fineTune: 512,
        octave: 0,
        pwm: 0,
        pan: 717, // R 40
        gain: 614, // 60%
        drone: false,
        voltOct: false,
        midi: false,
        portamento: 0
    },
    // Attack 115 ~= 0.02s, Release 80 ~= 0.02s
    env1: { attack: 115, release: 80 }, 
    env2: { attack: 115, release: 80 }, 
    modEnv1: {
        attack: 100,
        release: 200,
        delay: 0,
        depth: 1024,
        target: 'none'
    },
    modEnv2: {
        attack: 100,
        release: 200,
        delay: 0,
        depth: 1024,
        target: 'none'
    },
    oscMod: {
        osc1to2: { type: 'fm', amount: 0, range: 512, source: 'raw' },
        osc2to1: { type: 'fm', amount: 0, range: 512, source: 'raw' }
    },
    lfo1: {
        wave: 'triangle',
        rate: 0,
        depth: 0,
        target: 'none',
        rateMode: 'free',
        rateDivision: '1/4',
        bpm: 120
    },
    lfo2: {
        wave: 'sine',
        rate: 0,
        depth: 0,
        target: 'none',
        rateMode: 'free',
        rateDivision: '1/4',
        bpm: 120
    },
    seq1: {
        steps: randomSteps(),
        gates: randomGates(0.6),
        rate: 300,
        target: 'osc1-freq',
        direction: 'fwd',
        isRunning: false,
        isSynced: false,
        syncRatio: 1,
        rateMode: 'sync',
        rateDivision: '1/8',
        bpm: 120
    },
    seq2: {
        steps: randomSteps(),
        gates: randomGates(0.6),
        rate: 450,
        target: 'osc2-freq',
        direction: 'fwd',
        isRunning: false,
        isSynced: true, // Linked to master
        syncRatio: 1,
        rateMode: 'sync',
        rateDivision: '1/8',
        bpm: 120
    },
    modSeq1: {
        steps: randomSteps(),
        gates: randomGates(0.4),
        rate: 200,
        target: 'none',
        direction: 'fwd',
        isRunning: false,
        isSynced: true, // Linked to master
        syncRatio: 1,
        rateMode: 'sync',
        rateDivision: '1/4',
        bpm: 120
    },
    modSeq2: {
        steps: randomSteps(),
        gates: randomGates(0.4),
        rate: 600,
        target: 'none',
        direction: 'fwd',
        isRunning: false,
        isSynced: true, // Linked to master
        syncRatio: 1,
        rateMode: 'sync',
        rateDivision: '1/16',
        bpm: 120
    },
    global: {
        masterVolume: 819, // 80%
        noiseLevel: 0,
        fxRouting: ['delay', 'bitcrusher', 'fuzz', 'reverb'],
        eqGains: [512, 512, 512, 512, 512, 512, 512],
        delayEnabled: true,
        delayMode: 'free',
        delayTime: 350,
        bpm: 120,
        delayDivision: '1/8d',
        delayFeedback: 300,
        delayMix: 0,
        bitcrusherEnabled: false,
        bitcrusherBits: 1024,
        bitcrusherRate: 1024,
        bitcrusherMix: 512,
        springReverbEnabled: false,
        springReverbTone: 512,
        springReverbDecay: 512,
        springReverbMix: 512,
        fuzzEnabled: false,
        fuzzDrive: 512,
        fuzzTone: 512,
        fuzzMix: 512
    },
    noise: {
        type: 'white',
        routing: 'filter',
        cutoff: 1024,
        resonance: 0,
        sendA: 0,
        sendB: 0,
        fmSendA: 0,
        fmSendB: 0
    }
};

/**
 * Default matrix sensitivity values
 */
export const DEFAULT_SENSITIVITIES: MatrixSensitivities = {
    macro: 1024,
    assign1: 1024,
    assign2: 1024,
    assign3: 1024,
    assign4: 1024
};

/**
 * Default XY pad assignments
 */
export const DEFAULT_ASSIGN_TARGETS = {
    pad1: { x: 'delay-mix' as LfoTarget, y: 'delay-feedback' as LfoTarget },
    pad2: { x: 'fm-1to2' as LfoTarget, y: 'fm-2to1' as LfoTarget },
    pad3: { x: 'osc1-freq' as LfoTarget, y: 'osc1-cutoff' as LfoTarget },
    pad4: { x: 'osc2-freq' as LfoTarget, y: 'osc2-cutoff' as LfoTarget }
} as const;
