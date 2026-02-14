// ============================================================================
// BASIC TYPES & ENUMS
// ============================================================================

/** Oscillator waveform types */
export type Waveform = 'sine' | 'triangle' | 'sawtooth' | 'square';

/** Noise generator color types */
export type NoiseType = 'white' | 'pink' | 'brown';

/** Noise routing path */
export type NoiseRouting = 'filter' | 'direct';

/** Sequencer playback direction */
export type SeqDirection = 'fwd' | 'rev' | 'rnd';

/** Delay/LFO sync mode */
export type DelayMode = 'free' | 'sync';

/** Cross-modulation type between oscillators */
export type OscModType = 'fm' | 'am' | 'ring';

/** Modulation signal source point */
export type ModSource = 'raw' | 'filter';

/** Available FX types for routing */
export type FxType = 'delay' | 'bitcrusher' | 'fuzz' | 'reverb';

/** Trigger target for voice allocation */
export type TriggerTarget = 'osc1' | 'osc2' | 'both';

/** Trigger mode for envelopes */
export type TriggerMode = 'attack' | 'legato' | 'release';

/**
 * Note division for tempo-synced parameters.
 * Suffix: d = dotted, t = triplet
 */
export type DelayDivision = 
  | '1/1' | '1/1d' | '1/1t'
  | '1/2' | '1/2d' | '1/2t'
  | '1/4' | '1/4d' | '1/4t'
  | '1/8' | '1/8d' | '1/8t'
  | '1/16' | '1/16d' | '1/16t'
  | '1/32' | '1/32d' | '1/32t';