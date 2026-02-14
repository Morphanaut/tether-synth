
/**
 * Audio buffer utility functions for WAV encoding and buffer manipulation.
 */

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates that an AudioContext is usable
 */
const validateAudioContext = (ctx: AudioContext): void => {
    if (!ctx) {
        throw new Error('AudioContext is required');
    }
    if (ctx.state === 'closed') {
        throw new Error('AudioContext is closed');
    }
};

// ============================================================================
// BUFFER MANIPULATION
// ============================================================================

/**
 * Interleaves two mono channels into a single stereo Float32Array.
 * Output format: [L0, R0, L1, R1, L2, R2, ...]
 */
export function interleave(inputL: Float32Array, inputR: Float32Array): Float32Array {
    if (inputL.length !== inputR.length) {
        throw new Error(`Channel length mismatch: L=${inputL.length}, R=${inputR.length}`);
    }
    const length = inputL.length + inputR.length;
    const result = new Float32Array(length);
    let index = 0;
    let inputIndex = 0;
    while (index < length) {
        result[index++] = inputL[inputIndex];
        result[index++] = inputR[inputIndex];
        inputIndex++;
    }
    return result;
}

/**
 * Creates a stereo AudioBuffer from separate left and right channel data.
 */
export function createAudioBufferFromData(left: Float32Array, right: Float32Array, ctx: AudioContext): AudioBuffer {
    validateAudioContext(ctx);
    if (left.length !== right.length) throw new Error('Channel length mismatch');
    if (left.length === 0) throw new Error('Cannot create buffer from empty data');
    const buffer = ctx.createBuffer(2, left.length, ctx.sampleRate);
    buffer.copyToChannel(left as Float32Array<ArrayBuffer>, 0);
    buffer.copyToChannel(right as Float32Array<ArrayBuffer>, 1);
    return buffer;
}

/**
 * Applies micro fade-in and fade-out to prevent clicking during loops.
 * Modifies the buffer in place.
 */
export function applyFades(buffer: AudioBuffer, fadeDuration: number = 0.005): void {
    if (!buffer || buffer.length === 0) return;
    const safeDuration = Math.max(0, Math.min(fadeDuration, buffer.duration / 2));
    const fadeSamples = Math.floor(safeDuration * buffer.sampleRate);
    const length = buffer.length;
    if (fadeSamples <= 0) return;

    for (let c = 0; c < buffer.numberOfChannels; c++) {
        const data = buffer.getChannelData(c);
        // Fade In
        for (let i = 0; i < fadeSamples; i++) data[i] *= (i / fadeSamples);
        // Fade Out
        for (let i = 0; i < fadeSamples; i++) {
            const index = length - 1 - i;
            data[index] *= (i / fadeSamples);
        }
    }
}

// ============================================================================
// WAV ENCODING
// ============================================================================

export function writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
}

export function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array): void {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

export function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error('Invalid sample rate');
    const numChannels = 2, bitsPerSample = 16, bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample, byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample, headerSize = 44;
    const buffer = new ArrayBuffer(headerSize + dataSize), view = new DataView(buffer);
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    floatTo16BitPCM(view, headerSize, samples);
    return new Blob([view], { type: 'audio/wav' });
}
