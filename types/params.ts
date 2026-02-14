
import { Waveform, DelayMode, DelayDivision, OscModType, ModSource, SeqDirection, FxType, NoiseType, NoiseRouting } from './enums';
import { LfoTarget } from './targets';

// ============================================================================
// OSCILLATOR PARAMETERS
// ============================================================================

/**
 * Parameters for a single oscillator channel.
 * All numeric values use 0-1024 range.
 */
export interface OscillatorParams {
  /** Waveform shape */
  wave: Waveform;
  /** Base frequency (0-1024) */
  freq: number;
  /** Fine tune (0-1024, center=512) */
  fineTune: number;
  /** Low Pass Filter cutoff (0-1024) */
  cutoff: number;
  /** Low Pass Filter resonance (0-1024) */
  resonance: number;
  /** High Pass Filter cutoff (0-1024) */
  hpCutoff: number;
  /** High Pass Filter resonance (0-1024) */
  hpResonance: number;
  /** Octave shift (-2 to +2) */
  octave: number;
  /** Square-only pulse width control (0-1024, 0=50%, 1024=0%) */
  pwm: number;
  /** Stereo pan (0=Left, 512=Center, 1024=Right) */
  pan: number;
  /** Channel volume (0-1024) */
  gain: number;
  /** Continuous sound (bypass envelope) */
  drone: boolean;
  /** Enable computer keyboard control */
  voltOct: boolean;
  /** Enable MIDI note control */
  midi: boolean;
  /** Glide time (0-1024) */
  portamento: number;
}

// ============================================================================
// MODULATION PARAMETERS
// ============================================================================

/**
 * LFO (Low Frequency Oscillator) parameters.
 */
export interface LfoParams {
  /** Waveform shape */
  wave: Waveform;
  /** Rate in free mode (0-1024) */
  rate: number;
  /** Modulation depth (0-1024) */
  depth: number;
  /** Modulation destination */
  target: LfoTarget;
  /** Rate control mode */
  rateMode: DelayMode;
  /** Note division for sync mode */
  rateDivision: DelayDivision;
  /** BPM for sync mode (30-300) */
  bpm: number;
}

/**
 * Amplitude envelope (ADSR simplified to AR) parameters.
 */
export interface EnvelopeParams {
  /** Attack time (0-1024) */
  attack: number;
  /** Release time (0-1024) */
  release: number;
}

/**
 * Modulation envelope with delay and routable output.
 */
export interface ModEnvelopeParams {
  /** Attack time (0-1024) */
  attack: number;
  /** Release time (0-1024) */
  release: number;
  /** Delay before attack starts (0-1024) */
  delay: number;
  /** Output amount to target (0-1024) */
  depth: number;
  /** Modulation destination */
  target: LfoTarget;
}

/**
 * Cross-modulation path between oscillators.
 */
export interface ModPathParams {
  /** Modulation type */
  type: OscModType;
  /** Modulation amount (0-1024) */
  amount: number;
  /** FM deviation range (0-1024) */
  range: number;
  /** Signal tap point */
  source: ModSource;
}

/**
 * Bidirectional oscillator cross-modulation.
 */
export interface OscModParams {
  /** Osc 1 modulating Osc 2 */
  osc1to2: ModPathParams;
  /** Osc 2 modulating Osc 1 */
  osc2to1: ModPathParams;
}

// ============================================================================
// SEQUENCER PARAMETERS
// ============================================================================

/**
 * Step sequencer parameters.
 */
export interface SequencerParams {
  /** Step values (8 steps, each 0-1024) */
  steps: number[];
  /** Gate on/off per step (8 booleans) */
  gates: boolean[];
  /** Rate in free mode (0-1024) */
  rate: number;
  /** Output destination */
  target: LfoTarget;
  /** Playback direction */
  direction: SeqDirection;
  /** Running state */
  isRunning: boolean;
  /** Link to master sequencer */
  isSynced: boolean;
  /** Rate multiplier when synced */
  syncRatio: number;
  /** Rate control mode */
  rateMode: DelayMode;
  /** Note division for sync mode */
  rateDivision: DelayDivision;
  /** BPM for sync mode (30-300) */
  bpm: number;
}

// ============================================================================
// GLOBAL PARAMETERS
// ============================================================================

/**
 * Global synthesizer parameters and effects.
 */
export interface GlobalParams {
  /** Master output volume (0-1024) */
  masterVolume: number;
  /** Noise generator level (0-1024) */
  noiseLevel: number;
  
  /** Dynamic FX Chain Routing */
  fxRouting: FxType[];

  // Master EQ (7 Bands)
  eqGains: number[];

  // Delay
  /** Delay effect enabled */
  delayEnabled: boolean;
  /** Delay time mode */
  delayMode: DelayMode;
  /** Delay time in free mode (0-1024) */
  delayTime: number;
  /** Global BPM for tempo sync (30-300) */
  bpm: number;
  /** Delay note division */
  delayDivision: DelayDivision;
  /** Delay feedback amount (0-1024) */
  delayFeedback: number;
  /** Delay wet/dry mix (0-1024) */
  delayMix: number;

  // Bitcrusher
  /** Bitcrusher effect enabled */
  bitcrusherEnabled: boolean;
  /** Bit depth (0-1024) */
  bitcrusherBits: number;
  /** Sample rate reduction (0-1024) */
  bitcrusherRate: number;
  /** Bitcrusher wet/dry mix (0-1024) */
  bitcrusherMix: number;

  // Spring Reverb
  /** Reverb effect enabled */
  springReverbEnabled: boolean;
  /** Reverb tone/color (0-1024) */
  springReverbTone: number;
  /** Reverb decay/size (0-1024) */
  springReverbDecay: number;
  /** Reverb wet/dry mix (0-1024) */
  springReverbMix: number;

  // Fuzz
  /** Fuzz effect enabled */
  fuzzEnabled: boolean;
  /** Fuzz drive/gain (0-1024) */
  fuzzDrive: number;
  /** Fuzz tone/filter (0-1024) */
  fuzzTone: number;
  /** Fuzz wet/dry mix (0-1024) */
  fuzzMix: number;
}

// ============================================================================
// NOISE GENERATOR
// ============================================================================

/**
 * Noise generator routing parameters.
 */
export interface NoiseGeneratorParams {
  /** Noise color type */
  type: NoiseType;
  /** Routing path: into Osc Filter or Direct to VCA */
  routing: NoiseRouting;
  /** Filter cutoff (0-1024) */
  cutoff: number;
  /** Filter resonance (0-1024) */
  resonance: number;
  /** Send to Osc 1 filter input (0-1024) */
  sendA: number;
  /** Send to Osc 2 filter input (0-1024) */
  sendB: number;
  /** FM send to Osc 1 (0-1024) */
  fmSendA: number;
  /** FM send to Osc 2 (0-1024) */
  fmSendB: number;
}
