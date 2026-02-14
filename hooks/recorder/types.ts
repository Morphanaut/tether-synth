import type { MutableRefObject } from 'react';

export interface LoopRegion {
    start: number;
    end: number;
}

export interface UseRecorderReturn {
    isRecording: boolean;
    isPlaying: boolean;
    isLooping: boolean;
    isReversed: boolean;
    hasRecording: boolean;
    recordedTime: number;
    playbackTime: number;
    playbackSpeed: number;
    loopRegion: LoopRegion | null;
    audioBuffer: AudioBuffer | null;

    monoBufferRef: MutableRefObject<Float32Array | null>;
    writePointerRef: MutableRefObject<number>;

    isRandomLooping: boolean;
    randomLoopRate: number;
    statusMessage: string | null;

    startRecording: () => void;
    stopRecording: () => void;
    playRecording: () => void;
    stopPlayback: () => void;
    restartPlayback: () => void;
    toggleLoop: () => void;
    updateLoopRegion: (start: number, end: number) => void;
    clearLoopRegion: () => void;
    setPlaybackSpeed: (val: number) => void;
    reverseRecording: () => void;
    seek: (time: number, overrideLoopRegion?: LoopRegion) => void;
    downloadRawWav: () => void;
    downloadLoopWav: () => Promise<void>;
    downloadSpeedWav: () => Promise<void>;
    toggleRandomLoop: () => void;
    setRandomLoopRate: (rate: number) => void;
    clearStatusMessage: () => void;
}

