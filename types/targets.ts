
// ============================================================================
// MODULATION TARGETS
// ============================================================================

/**
 * All available modulation destinations.
 * Used by LFOs, Mod Envelopes, and Sequencers.
 */
export type LfoTarget = 
  // No modulation
  | 'none' 
  // Oscillator 1 parameters
  | 'osc1-freq' 
  | 'osc1-cutoff' 
  | 'osc1-res'
  | 'osc1-hp-cutoff'
  | 'osc1-hp-res'
  | 'osc1-pan' 
  | 'osc1-gain'
  | 'osc1-pwm'
  | 'osc1-fine'
  // Oscillator 2 parameters
  | 'osc2-freq' 
  | 'osc2-cutoff' 
  | 'osc2-res'
  | 'osc2-hp-cutoff'
  | 'osc2-hp-res'
  | 'osc2-pan' 
  | 'osc2-gain'
  | 'osc2-pwm'
  | 'osc2-fine'
  // Cross-modulation parameters
  | 'fm-1to2'
  | 'fm-2to1'
  // LFO parameters (for meta-modulation)
  | 'lfo1-rate'
  | 'lfo1-depth'
  | 'lfo2-rate'
  | 'lfo2-depth'
  // Mod envelope parameters
  | 'modEnv1-depth'
  | 'modEnv2-depth'
  // Sequencer rate parameters
  | 'seq1-rate'
  | 'seq2-rate'
  | 'modSeq1-rate'
  | 'modSeq2-rate'
  // Global parameters
  | 'master-vol'
  // Noise parameters
  | 'noise-cutoff'
  | 'noise-res'
  | 'noise-sendA'
  | 'noise-sendB'
  | 'noise-fmA'
  | 'noise-fmB'
  // Delay parameters
  | 'delay-time' 
  | 'delay-mix' 
  | 'delay-feedback'
  // Reverb parameters
  | 'reverb-mix' 
  | 'reverb-tone'
  // Fuzz parameters
  | 'fuzz-drive'
  | 'fuzz-tone'
  | 'fuzz-mix'
  // Bitcrusher parameters
  | 'bitcrusher-bits'
  | 'bitcrusher-rate'
  | 'bitcrusher-mix';
