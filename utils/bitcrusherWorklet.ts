
/**
 * AudioWorkletProcessor for Bitcrusher effect.
 * Performs bit depth reduction and sample rate reduction (sample & hold).
 */
export const BITCRUSHER_PROCESSOR_CODE = `
class BitcrusherProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = 0;
    this.lastSampleL = 0;
    this.lastSampleR = 0;

    // Pre-compute power table to avoid Math.pow in real-time audio loop
    // Covers bits range 1-16 (mapped to indices 0-15)
    // step = 0.5^bits → quantization step size for bit depth reduction
    this.powerTable = new Float32Array(16);
    for (let i = 0; i < 16; i++) {
      this.powerTable[i] = Math.pow(0.5, i + 1);
    }
  }

  static get parameterDescriptors() {
    return [
      {
        name: 'bits',
        defaultValue: 8,
        minValue: 1,
        maxValue: 16
      },
      {
        name: 'normfreq',
        defaultValue: 1,
        minValue: 0.001,
        maxValue: 1
      }
    ];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !output) return true;

    const inputL = input[0];
    const inputR = input[1] || inputL; // Handle mono input
    const outputL = output[0];
    const outputR = output[1];
    const hasR = !!outputR;

    // Parameters can be k-rate (length 1) or a-rate (length 128)
    const bitsParam = parameters.bits;
    const freqParam = parameters.normfreq;
    
    const isBitsARate = bitsParam.length > 1;
    const isFreqARate = freqParam.length > 1;

    // To optimize, if both are k-rate and frequency is 1 (bypass sample reduction), we could simplify loops.
    // But for bitcrusher correctness with modulation, we generally process sample by sample.

    const length = outputL.length;

    // Fast path for k-rate params (common case: no modulation)
    if (!isBitsARate && !isFreqARate) {
      const bits = bitsParam[0];
      const normfreq = freqParam[0];
      // Use pre-computed power table instead of Math.pow for performance
      const bitsInt = Math.floor(Math.max(1, Math.min(16, bits)));
      const step = this.powerTable[bitsInt - 1];
      const invStep = 1.0 / step;

      for (let i = 0; i < length; i++) {
        this.phase += normfreq;
        if (this.phase >= 1.0) {
          this.phase -= 1.0;
          this.lastSampleL = step * Math.floor(inputL[i] * invStep + 0.5);
          this.lastSampleR = step * Math.floor(inputR[i] * invStep + 0.5);
        }
        outputL[i] = this.lastSampleL;
        if (hasR) outputR[i] = this.lastSampleR;
      }
      return true;
    }

    for (let i = 0; i < length; i++) {
      // 1. Get current parameters
      const bits = isBitsARate ? bitsParam[i] : bitsParam[0];
      const normfreq = isFreqARate ? freqParam[i] : freqParam[0];

      // 2. Sample Rate Reduction Logic
      this.phase += normfreq;
      if (this.phase >= 1.0) {
        this.phase -= 1.0;

        // 3. Bit Depth Reduction Logic
        // Use pre-computed power table instead of Math.pow for performance
        const bitsInt = Math.floor(Math.max(1, Math.min(16, bits)));
        const step = this.powerTable[bitsInt - 1];
        const invStep = 1.0 / step;
        
        // Quantize input
        this.lastSampleL = step * Math.floor(inputL[i] * invStep + 0.5);
        this.lastSampleR = step * Math.floor(inputR[i] * invStep + 0.5);
      }

      // 4. Output held samples
      outputL[i] = this.lastSampleL;
      if (hasR) outputR[i] = this.lastSampleR;
    }

    return true;
  }
}

registerProcessor('tether-bitcrusher-processor', BitcrusherProcessor);
`;
