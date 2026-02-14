
import { 
    Waveform, NoiseType, LfoTarget, OscModType, ModSource, 
    SeqDirection, DelayDivision 
} from '../types';

// ============================================================================
// DROPDOWN & TOGGLE OPTIONS
// ============================================================================

export const WAVEFORMS = [
    { label: 'SIN', value: 'sine' },
    { label: 'TRI', value: 'triangle' },
    { label: 'SAW', value: 'sawtooth' },
    { label: 'SQR', value: 'square' },
] as const satisfies readonly { label: string; value: Waveform }[];

export const NOISE_TYPES = [
    { label: 'WHITE', value: 'white' },
    { label: 'PINK', value: 'pink' },
    { label: 'BROWN', value: 'brown' },
] as const satisfies readonly { label: string; value: NoiseType }[];

export const OCTAVE_FOOTAGE = [
    { label: "32'", value: -2 },
    { label: "16'", value: -1 },
    { label: "8'",  value: 0 },
    { label: "4'",  value: 1 },
    { label: "2'",  value: 2 },
] as const;

export const MOD_TYPES = [
    { label: 'FM', value: 'fm' },
    { label: 'AM', value: 'am' },
    { label: 'RING', value: 'ring' }
] as const satisfies readonly { label: string; value: OscModType }[];

export const MOD_SOURCES = [
    { labelKey: 'raw', value: 'raw' },
    { labelKey: 'filter', value: 'filter' }
] as const satisfies readonly { labelKey: 'raw' | 'filter'; value: ModSource }[];

export const SEQ_DIRECTION_VALUES: readonly SeqDirection[] = ['fwd', 'rev', 'rnd'];

export const SYNC_RATIOS = [
    { label: '1/4', value: 0.25 },
    { label: '1/2', value: 0.5 },
    { label: '1X',  value: 1.0 },
    { label: '2X',  value: 2.0 },
    { label: '4X',  value: 4.0 },
    { label: '8X',  value: 8.0 },
] as const;

export const DELAY_DIVISIONS = [
    { label: '1/1',      value: '1/1' },
    { label: '1/1 DOT',  value: '1/1d' },
    { label: '1/1 TRIP', value: '1/1t' },
    { label: '1/2',      value: '1/2' },
    { label: '1/2 DOT',  value: '1/2d' },
    { label: '1/2 TRIP', value: '1/2t' },
    { label: '1/4',      value: '1/4' },
    { label: '1/4 DOT',  value: '1/4d' },
    { label: '1/4 TRIP', value: '1/4t' },
    { label: '1/8',      value: '1/8' },
    { label: '1/8 DOT',  value: '1/8d' },
    { label: '1/8 TRIP', value: '1/8t' },
    { label: '1/16',      value: '1/16' },
    { label: '1/16 DOT',  value: '1/16d' },
    { label: '1/16 TRIP', value: '1/16t' },
    { label: '1/32',      value: '1/32' },
    { label: '1/32 DOT',  value: '1/32d' },
    { label: '1/32 TRIP', value: '1/32t' },
] as const satisfies readonly { label: string; value: DelayDivision }[];

// ============================================================================
// MODULATION TARGETS
// ============================================================================

export const LFO_TARGET_VALUES: readonly LfoTarget[] = [
    'none',
    'osc1-freq', 'osc1-cutoff', 'osc1-res', 'osc1-hp-cutoff', 'osc1-hp-res',
    'osc1-pan', 'osc1-gain', 'osc1-pwm', 'osc1-fine',
    'osc2-freq', 'osc2-cutoff', 'osc2-res', 'osc2-hp-cutoff', 'osc2-hp-res',
    'osc2-pan', 'osc2-gain', 'osc2-pwm', 'osc2-fine',
    'lfo1-rate', 'lfo1-depth',
    'lfo2-rate', 'lfo2-depth',
    'modEnv1-depth',
    'modEnv2-depth',
    'fm-1to2',
    'fm-2to1',
    'seq1-rate', 'seq2-rate',
    'modSeq1-rate', 'modSeq2-rate',
    'master-vol',
    'noise-cutoff', 'noise-res', 'noise-sendA', 'noise-sendB',
    'noise-fmA', 'noise-fmB',
    'delay-time', 'delay-mix', 'delay-feedback',
    'reverb-mix', 'reverb-tone',
    'fuzz-drive', 'fuzz-tone', 'fuzz-mix',
    'bitcrusher-bits', 'bitcrusher-rate', 'bitcrusher-mix'
] as const;

export const ASSIGN_TARGET_VALUES: readonly LfoTarget[] = LFO_TARGET_VALUES.filter(
    (t): t is Exclude<LfoTarget, 'none'> => t !== 'none'
);

export const TARGET_GROUPS = [
    { label: 'OSCILLATOR A', check: (t: string) => t.startsWith('osc1-') },
    { label: 'OSCILLATOR B', check: (t: string) => t.startsWith('osc2-') },
    { label: 'MOD ENVELOPES', check: (t: string) => t.startsWith('modEnv') },
    { label: 'LFOs', check: (t: string) => t.startsWith('lfo') },
    { label: 'OSC CROSS MOD', check: (t: string) => t === 'fm-1to2' || t === 'fm-2to1' },
    { label: 'VOICE SEQUENCER', check: (t: string) => t.startsWith('seq') },
    { label: 'MOD SEQUENCER', check: (t: string) => t.startsWith('modSeq') },
    { label: 'GLOBAL', check: (t: string) => t === 'master-vol' },
    { label: 'NOISE GENERATOR', check: (t: string) => t.startsWith('noise-') },
    { label: 'DELAY', check: (t: string) => t.startsWith('delay-') },
    { label: 'REVERB', check: (t: string) => t.startsWith('reverb-') },
    { label: 'FUZZ', check: (t: string) => t.startsWith('fuzz-') },
    { label: 'BITCRUSHER', check: (t: string) => t.startsWith('bitcrusher-') }
];
