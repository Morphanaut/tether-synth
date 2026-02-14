
// ============================================================================
// CONSTANTS
// ============================================================================

export const PARAM_MAX = 1024;
export const PARAM_CENTER = 512;

// Pre-computed reciprocals for optimization (multiplication is faster than division)
export const PARAM_MAX_INV = 1 / 1024; // 0.0009765625
export const PARAM_CENTER_INV = 1 / 512; // 0.001953125
export const LN2 = Math.log(2); // 0.693147... — for Math.exp(LN2*x) instead of Math.pow(2,x)
export const FINETUNE_SCALE = PARAM_CENTER_INV / 12; // Pre-computed for mapFineTune

export const FREQ_MIN = 20;
export const FREQ_MAX = 12000;
export const FREQ_RANGE_EXPONENT = 601;

export const CUTOFF_MIN = 20;
export const CUTOFF_MAX = 16000;
export const RESONANCE_MIN = 0.707;
export const RESONANCE_MAX = 20;

export const LFO_RATE_MIN = 0.01;
export const LFO_RATE_MAX = 50; // Final: 50 Hz
export const LFO_DEPTH_CURVE = 3.0;

export const SEQ_RATE_MIN = 0.01;
export const SEQ_RATE_MAX = 50; // Final: 50 Hz

export const CROSS_MOD_AMOUNT_CURVE = 3.0;

export const ENV_TIME_MIN = 0.005;
export const ENV_ATTACK_MAX = 10.0;
export const ENV_RELEASE_MAX = 30.0;
export const ENV_TIME_CURVE = 3;

export const FM_DEVIATION_MAX = 5000;
export const PORTAMENTO_MIN = 0.002;
export const PORTAMENTO_MAX = 2.0;

// ============================================================================
// PRE-COMPUTED CONSTANTS FOR EXPONENTIAL SCALING (Performance Optimization)
// ============================================================================
// Math.pow(base, x) is slower than Math.exp(log(base) * x)
// Pre-compute ln(MAX/MIN) for exponential scaling functions

export const FREQ_LOG_RANGE = Math.log(FREQ_RANGE_EXPONENT); // ln(601) ≈ 6.398
export const CUTOFF_LOG_RANGE = Math.log(CUTOFF_MAX / CUTOFF_MIN); // ln(800) ≈ 6.685
export const LFO_RATE_LOG_RANGE = Math.log(LFO_RATE_MAX / LFO_RATE_MIN); // ln(5000) ≈ 8.517
export const SEQ_RATE_LOG_RANGE = Math.log(SEQ_RATE_MAX / SEQ_RATE_MIN); // ln(5000) ≈ 8.517

// Pre-computed ranges for linear interpolation
export const RESONANCE_RANGE = RESONANCE_MAX - RESONANCE_MIN; // 19.293
export const PORTAMENTO_RANGE = PORTAMENTO_MAX - PORTAMENTO_MIN; // 1.998
export const ENV_ATTACK_RANGE = ENV_ATTACK_MAX - ENV_TIME_MIN; // 9.995
export const ENV_RELEASE_RANGE = ENV_RELEASE_MAX - ENV_TIME_MIN; // 29.995

export const MOD_SCALE_PITCH = 1200; // ±1 octave at max depth (was 5000, caused silencing at low frequencies)
export const MOD_SCALE_FILTER = 14400; // ±12 octaves in cents (increased to compensate for cubic LFO depth curve compression)
export const MOD_SCALE_FINE_TUNE = 1200;
export const MOD_SCALE_RESONANCE = 20.0; // ±20 Q units (covers full 0.707-20 range, protected by reflective params)

export const NOISE_BUFFER_DURATION = 4;

export const CURVE_SAMPLES = 4096;

// ============================================================================
// UTILITIES
// ============================================================================

export const sanitizeInput = (v: number, min = 0, max = PARAM_MAX): number => {
    if (!Number.isFinite(v)) return min;
    return Math.max(min, Math.min(max, v));
};

export const validateAudioContext = (ctx: AudioContext): void => {
    if (!ctx) throw new Error('AudioContext is required');
    if (ctx.state === 'closed') throw new Error('AudioContext is closed');
};
