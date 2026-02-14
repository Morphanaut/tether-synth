
import { DelayDivision, LfoTarget } from '../../types';
import { sanitizeInput, PARAM_MAX } from './common';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C'] as const;
const CHROMATIC_STEPS = 13;

export const midiToFreq = (note: number): number => {
    if (!Number.isFinite(note)) return 440;
    return 440 * Math.pow(2, (note - 69) / 12);
};

export const calculateDelayTime = (bpm: number, division: DelayDivision): number => {
    if (!Number.isFinite(bpm) || bpm <= 0) bpm = 120;
    const beatTime = 60 / bpm;
    let multiplier: number;
    switch (division) {
        case '1/1':   multiplier = 4; break;
        case '1/1d':  multiplier = 4 * 1.5; break;
        case '1/1t':  multiplier = 4 * (2/3); break;
        case '1/2':   multiplier = 2; break;
        case '1/2d':  multiplier = 2 * 1.5; break;
        case '1/2t':  multiplier = 2 * (2/3); break;
        case '1/4':   multiplier = 1; break;
        case '1/4d':  multiplier = 1.5; break;
        case '1/4t':  multiplier = 2/3; break; 
        case '1/8':   multiplier = 0.5; break;
        case '1/8d':  multiplier = 0.5 * 1.5; break; 
        case '1/8t':  multiplier = 0.5 * (2/3); break; 
        case '1/16':  multiplier = 0.25; break;
        case '1/16d': multiplier = 0.25 * 1.5; break;
        case '1/16t': multiplier = 0.25 * (2/3); break;
        case '1/32':  multiplier = 0.125; break;
        case '1/32d': multiplier = 0.125 * 1.5; break;
        case '1/32t': multiplier = 0.125 * (2/3); break;
        default:      multiplier = 1;
    }
    return beatTime * multiplier;
};

// ============================================================================
// NOTE QUANTIZATION
// ============================================================================

export const quantizeChromatic = (val: number): number => {
    const safe = sanitizeInput(val);
    const step = Math.floor((safe / (PARAM_MAX + 0.01)) * CHROMATIC_STEPS);
    return Math.min(step, 12);
};

export const getNoteName = (val: number): string => {
    const step = quantizeChromatic(val);
    return NOTE_NAMES[step] || '---';
};

// ============================================================================
// SEQUENCER VALUE MAPPERS
// ============================================================================

export const getModSeqValue = (v: number): number => {
    const safe = sanitizeInput(v);
    return safe / PARAM_MAX;
};

export const getSeqOutputValue = (v: number, target: LfoTarget): number => {
    const safe = sanitizeInput(v);
    if (target.includes('freq')) {
        const step = quantizeChromatic(safe);
        return step * 100;
    }
    return safe / PARAM_MAX;
};
