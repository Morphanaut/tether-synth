
// ============================================================================
// AUDIO GRAPH TYPES
// ============================================================================

/**
 * Worklet oscillator interface used by each voice.
 */
export type VoiceOscillatorNode = AudioWorkletNode & {
  frequency: AudioParam;
  detune: AudioParam;
  waveform: AudioParam;
  pulseWidth: AudioParam;
  waveType: OscillatorType;
};

export interface VoiceNodes {
  // Oscillators (optimized worklet backend)
  osc1: VoiceOscillatorNode;
  osc2: VoiceOscillatorNode;

  gain1: GainNode;
  gain2: GainNode;
  mixGain1: GainNode;
  mixGain2: GainNode;
  filt1: BiquadFilterNode;
  filt2: BiquadFilterNode;
  hpFilt1: BiquadFilterNode;
  hpFilt2: BiquadFilterNode;
  
  // Drive & Feedback Gains
  preDriveGain1: GainNode;
  postDriveGain1: GainNode;
  filt1FbGain: GainNode;
  preDriveGain2: GainNode;
  postDriveGain2: GainNode;
  filt2FbGain: GainNode;

  pan1: StereoPannerNode;
  pan2: StereoPannerNode;
  osc1Dry: GainNode;
  osc1Wet: GainNode;
  osc2Dry: GainNode;
  osc2Wet: GainNode;
  fmGain1to2: GainNode;
  fmGain2to1: GainNode;
  amGain1to2: GainNode;
  amGain2to1: GainNode;
  mod1RawGain: GainNode;
  mod1FltGain: GainNode;
  mod2RawGain: GainNode;
  mod2FltGain: GainNode;
  modEnv1Source: ConstantSourceNode;
  modEnv1Gain: GainNode;
  modEnv1DepthNode: GainNode;
  modEnv2Source: ConstantSourceNode;
  modEnv2Gain: GainNode;
  modEnv2DepthNode: GainNode;
  noiseInputA: GainNode;
  noiseInputB: GainNode;
  noiseFilterGainA: GainNode;
  noiseDirectGainA: GainNode;
  noiseFilterGainB: GainNode;
  noiseDirectGainB: GainNode;
}

export type BitcrusherNode = AudioWorkletNode & {
  meta?: { bits: number; normfreq: number; };
};

export interface AudioGraphNodes {
  voices: VoiceNodes[];
  lfo1: OscillatorNode;
  lfo1Smoother: BiquadFilterNode;
  lfo1Gain: GainNode;
  lfo2: OscillatorNode;
  lfo2Smoother: BiquadFilterNode;
  lfo2Gain: GainNode;
  driftLfo1: OscillatorNode;
  driftGain1: GainNode;
  driftLfo2: OscillatorNode;
  driftGain2: GainNode;
  jitterGain1: GainNode;
  jitterGain2: GainNode;
  seq1Source: ConstantSourceNode;
  seq1FreqGain: GainNode;
  seq1DetuneGain: GainNode;
  seq2Source: ConstantSourceNode;
  seq2FreqGain: GainNode;
  seq2DetuneGain: GainNode;
  modSeq1Source: ConstantSourceNode;
  modSeq1Gain: GainNode;
  modSeq2Source: ConstantSourceNode;
  modSeq2Gain: GainNode;
  seq1RateModGain: GainNode;
  seq1RateAnalyser: AnalyserNode;
  seq2RateModGain: GainNode;
  seq2RateAnalyser: AnalyserNode;
  modSeq1RateModGain: GainNode;
  modSeq1RateAnalyser: AnalyserNode;
  modSeq2RateModGain: GainNode;
  modSeq2RateAnalyser: AnalyserNode;
  bitcrusherBitsMod: GainNode;
  bitcrusherRateMod: GainNode;
  whiteNoiseSource: AudioBufferSourceNode;
  pinkNoiseSource: AudioBufferSourceNode;
  brownNoiseSource: AudioBufferSourceNode;
  whiteNoiseGain: GainNode;
  pinkNoiseGain: GainNode;
  brownNoiseGain: GainNode;
  noiseFilter: BiquadFilterNode;
  noiseSendAGain: GainNode;
  noiseSendBGain: GainNode;
  noiseFmSendAGain: GainNode;
  noiseFmSendBGain: GainNode;
  delayBlockInput: GainNode; 
  delayBlockOutput: GainNode; 
  delayInput: GainNode;
  delay: DelayNode;
  delayTimeSource: ConstantSourceNode;
  delayTimeSmoother: BiquadFilterNode;
  delayFB: GainNode;
  delayWet: GainNode;
  delayDry: GainNode;
  delayFilter: BiquadFilterNode;
  delayHpFilter: BiquadFilterNode;
  delayShaper: WaveShaperNode;
  wowLfo?: OscillatorNode;
  wowDepth?: GainNode;
  flutterLfo?: OscillatorNode;
  flutterDepth?: GainNode;
  clockNoiseGain?: GainNode;
  bcBlockInput: GainNode; 
  bcBlockOutput: GainNode; 
  bitcrusher: BitcrusherNode;
  bitcrusherDry: GainNode;
  bitcrusherWet: GainNode;
  
  // Big Muff Fuzz Extended Nodes
  fuzzBlockInput: GainNode; 
  fuzzBlockOutput: GainNode; 
  fuzzInGain: GainNode;
  fuzzDrive1: GainNode;
  fuzzDrive2: GainNode;
  fuzzDrive3: GainNode;
  fuzzClip1: WaveShaperNode;
  fuzzClip2: WaveShaperNode;
  fuzzClip3: WaveShaperNode;
  fuzzRc1: BiquadFilterNode;
  fuzzRc2: BiquadFilterNode;
  fuzzBassFilter: BiquadFilterNode;
  fuzzBassGain: GainNode;
  fuzzTrebleFilter: BiquadFilterNode;
  fuzzTrebleGain: GainNode;
  fuzzToneSum: GainNode;
  fuzzToneInverter: GainNode;
  fuzzWet: GainNode;
  fuzzDry: GainNode;

  // Spring Reverb Extended Nodes
  reverbBlockInput: GainNode; 
  reverbBlockOutput: GainNode; 
  springReverb: ConvolverNode;
  springReverbFilter: BiquadFilterNode;
  springReverbPreEmphasis: BiquadFilterNode;
  springReverbInputGate: GainNode;
  springReverbInputDrive: GainNode;
  springReverbInputSat: WaveShaperNode;
  springReverbDeEmphasis: BiquadFilterNode;
  springReverbOutputSat: WaveShaperNode;
  springReverbDry: GainNode;
  springReverbWet: GainNode;

  // Always-on subtle saturation stages
  masterEqSat: WaveShaperNode;
  postFxSat: WaveShaperNode;

  /**
   * Fixed input point for the dynamic FX chain.
   *
   * This node is used so `updateFxRouting()` can disconnect/reconnect outgoing
   * edges safely without breaking the permanent pre-FX wiring (e.g. DRY bus -> EQ).
   */
  fxInput: GainNode;

  dryGain: GainNode; 
  analogShaper: WaveShaperNode;
  noiseNode: AudioBufferSourceNode;
  noiseGain: GainNode;
  humOsc: OscillatorNode;
  humGain: GainNode;
  crackleNode: AudioBufferSourceNode;
  crackleGain: GainNode;

  // Master Bus & Safety (No Saturation Stages)
  busCompressor: DynamicsCompressorNode;
  masterGain: GainNode;
  masterEQ: BiquadFilterNode[]; // 7-Band EQ Chain
  acCoupler: BiquadFilterNode;
  limiter: DynamicsCompressorNode;
  masterLowPass: BiquadFilterNode;
  analyser: AnalyserNode;
  outputGate: GainNode;
}
