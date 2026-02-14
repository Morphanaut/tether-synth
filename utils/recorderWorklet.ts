
/**
 * AudioWorkletProcessor for recording audio.
 * buffering incoming audio and sending it to the main thread in chunks.
 * This runs on the audio thread, preventing dropouts caused by main thread UI blocking.
 */
export const RECORDER_PROCESSOR_CODE = `
class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.bufferIndex = 0;
    this.buffers = [
      new Float32Array(this.bufferSize),
      new Float32Array(this.bufferSize)
    ];
    this.recording = false;
    
    this.port.onmessage = (e) => {
      if (e.data.command === 'start') {
        this.recording = true;
      } else if (e.data.command === 'stop') {
        this.recording = false;
        // Send remaining data if any, then ack stop.
        if (this.bufferIndex > 0) {
            this.flush();
        }
        this.port.postMessage({ command: 'stopped' });
      }
    };
  }

  flush() {
      // Create copies to send to main thread (structured clone)
      // We only send the filled portion if it's the final flush, 
      // but for simplicity and performance of the receiver, 
      // we can just send the slice or the full buffer with a length indicator.
      // Let's send slice to be clean.
      
      const left = this.buffers[0].slice(0, this.bufferIndex);
      const right = this.buffers[1].slice(0, this.bufferIndex);
      
      this.port.postMessage({
        command: 'data',
        left: left,
        right: right
      }, [left.buffer, right.buffer]); // Transferables for performance
      
      this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    if (!this.recording) return true;

    // Default to stereo input, fallback to mono if needed
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const inputL = input[0];
    const inputR = input.length > 1 ? input[1] : input[0];
    
    const len = inputL.length;
    let offset = 0;

    // Copy in blocks to reduce per-sample overhead.
    while (offset < len) {
      const space = this.bufferSize - this.bufferIndex;
      const copyLen = Math.min(space, len - offset);
      this.buffers[0].set(inputL.subarray(offset, offset + copyLen), this.bufferIndex);
      this.buffers[1].set(inputR.subarray(offset, offset + copyLen), this.bufferIndex);
      this.bufferIndex += copyLen;
      offset += copyLen;

      if (this.bufferIndex >= this.bufferSize) {
        this.flush();
      }
    }

    // Pass through logic (optional, but good for monitoring if needed)
    // For now we just return true to keep processor alive
    return true;
  }
}

registerProcessor('tether-recorder-processor', RecorderProcessor);
`;
