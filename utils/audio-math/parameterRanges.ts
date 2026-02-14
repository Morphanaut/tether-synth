
import { LfoTarget } from '../../types';
import {
    FREQ_MIN, FREQ_MAX,
    CUTOFF_MIN, CUTOFF_MAX,
    RESONANCE_MIN, RESONANCE_MAX,
    LFO_RATE_MIN, LFO_RATE_MAX,
    SEQ_RATE_MIN, SEQ_RATE_MAX,
    FM_DEVIATION_MAX
} from './common';
import { DELAY_FEEDBACK_MAX } from '../graph-builders/constants';

export interface ParameterRange {
    min: number;
    max: number;
    unit: string;
}

export const PARAMETER_RANGES: Record<LfoTarget, ParameterRange> = {
    'osc1-freq': { min: 0, max: FREQ_MAX, unit: 'Hz' },
    'osc2-freq': { min: 0, max: FREQ_MAX, unit: 'Hz' },

    'osc1-cutoff': { min: CUTOFF_MIN, max: CUTOFF_MAX, unit: 'Hz' },
    'osc2-cutoff': { min: CUTOFF_MIN, max: CUTOFF_MAX, unit: 'Hz' },
    'osc1-hp-cutoff': { min: CUTOFF_MIN, max: CUTOFF_MAX, unit: 'Hz' },
    'osc2-hp-cutoff': { min: CUTOFF_MIN, max: CUTOFF_MAX, unit: 'Hz' },
    'noise-cutoff': { min: CUTOFF_MIN, max: CUTOFF_MAX, unit: 'Hz' },

    'osc1-res': { min: RESONANCE_MIN, max: RESONANCE_MAX, unit: 'Q' },
    'osc2-res': { min: RESONANCE_MIN, max: RESONANCE_MAX, unit: 'Q' },
    'osc1-hp-res': { min: RESONANCE_MIN, max: RESONANCE_MAX, unit: 'Q' },
    'osc2-hp-res': { min: RESONANCE_MIN, max: RESONANCE_MAX, unit: 'Q' },
    'noise-res': { min: RESONANCE_MIN, max: RESONANCE_MAX, unit: 'Q' },

    'osc1-pan': { min: -1.0, max: 1.0, unit: 'pan' },
    'osc2-pan': { min: -1.0, max: 1.0, unit: 'pan' },

    'osc1-gain': { min: 0.0, max: 1.0, unit: 'gain' },
    'osc2-gain': { min: 0.0, max: 1.0, unit: 'gain' },
    'master-vol': { min: 0.0, max: 1.3, unit: 'gain' },

    'osc1-pwm': { min: 0.0, max: 1.0, unit: 'normalized' },
    'osc2-pwm': { min: 0.0, max: 1.0, unit: 'normalized' },

    'osc1-fine': { min: -2600, max: 2600, unit: 'cents' },
    'osc2-fine': { min: -2600, max: 2600, unit: 'cents' },

    'lfo1-rate': { min: LFO_RATE_MIN, max: LFO_RATE_MAX, unit: 'Hz' },
    'lfo2-rate': { min: LFO_RATE_MIN, max: LFO_RATE_MAX, unit: 'Hz' },
    'lfo1-depth': { min: 0.0, max: 1.0, unit: 'normalized' },
    'lfo2-depth': { min: 0.0, max: 1.0, unit: 'normalized' },

    'fm-1to2': { min: 0.0, max: FM_DEVIATION_MAX, unit: 'Hz' },
    'fm-2to1': { min: 0.0, max: FM_DEVIATION_MAX, unit: 'Hz' },

    'seq1-rate': { min: SEQ_RATE_MIN, max: SEQ_RATE_MAX, unit: 'Hz' },
    'seq2-rate': { min: SEQ_RATE_MIN, max: SEQ_RATE_MAX, unit: 'Hz' },
    'modSeq1-rate': { min: SEQ_RATE_MIN, max: SEQ_RATE_MAX, unit: 'Hz' },
    'modSeq2-rate': { min: SEQ_RATE_MIN, max: SEQ_RATE_MAX, unit: 'Hz' },

    'modEnv1-depth': { min: 0.0, max: 1.0, unit: 'normalized' },
    'modEnv2-depth': { min: 0.0, max: 1.0, unit: 'normalized' },

    'delay-time': { min: 0.02, max: 1.0, unit: 's' },
    'delay-mix': { min: 0.0, max: 1.0, unit: 'normalized' },
    'delay-feedback': { min: 0.0, max: DELAY_FEEDBACK_MAX, unit: 'gain' },

    'reverb-mix': { min: 0.0, max: 1.35, unit: 'gain' },
    'reverb-tone': { min: -24.0, max: 24.0, unit: 'dB' },

    'fuzz-drive': { min: 1.0, max: 35.0, unit: 'gain' },
    'fuzz-tone': { min: 0.0, max: 1.0, unit: 'normalized' },
    'fuzz-mix': { min: 0.0, max: 1.0, unit: 'normalized' },

    'bitcrusher-bits': { min: 5.0, max: 8.0, unit: 'bits' },
    'bitcrusher-rate': { min: 0.005, max: 1.0, unit: 'normalized' },
    'bitcrusher-mix': { min: 0.0, max: 1.0, unit: 'normalized' },

    'noise-sendA': { min: 0.0, max: 1.0, unit: 'gain' },
    'noise-sendB': { min: 0.0, max: 1.0, unit: 'gain' },
    'noise-fmA': { min: 0.0, max: FM_DEVIATION_MAX, unit: 'Hz' },
    'noise-fmB': { min: 0.0, max: FM_DEVIATION_MAX, unit: 'Hz' },

    'none': { min: 0.0, max: 0.0, unit: 'none' }
};

export const getParameterRange = (target: LfoTarget): ParameterRange => {
    return PARAMETER_RANGES[target] || { min: 0.0, max: 1.0, unit: 'unknown' };
};

export const isValueInRange = (target: LfoTarget, value: number): boolean => {
    const range = getParameterRange(target);
    return value >= range.min && value <= range.max;
};


