
import { OscillatorParams, EnvelopeParams, ModEnvelopeParams, OscModParams, LfoParams, SequencerParams, GlobalParams, NoiseGeneratorParams } from './params';

// ============================================================================
// COMPLETE STATE
// ============================================================================

/**
 * Complete synthesizer state.
 * This is the top-level state object containing all parameters.
 */
export interface SynthState {
  osc1: OscillatorParams;
  osc2: OscillatorParams;
  env1: EnvelopeParams;
  env2: EnvelopeParams;
  modEnv1: ModEnvelopeParams;
  modEnv2: ModEnvelopeParams;
  oscMod: OscModParams;
  lfo1: LfoParams;
  lfo2: LfoParams;
  seq1: SequencerParams;
  seq2: SequencerParams;
  modSeq1: SequencerParams;
  modSeq2: SequencerParams;
  global: GlobalParams;
  noise: NoiseGeneratorParams;
}
