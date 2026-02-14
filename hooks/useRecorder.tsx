import { useState, useRef, useEffect, useCallback } from 'react';
import { 
    encodeWAV, 
    interleave, 
    createAudioBufferFromData, 
    applyFades 
} from '../utils/recorderUtils';
import { RECORDER_PROCESSOR_CODE } from '../utils/recorderWorklet';
import {
    FADE_DURATION,
    MAX_OFFLINE_RENDER_DURATION,
    MAX_RECORDING_DURATION,
    RANDOM_LOOP_MAX_MS,
    RANDOM_LOOP_MIN_DURATION,
    RANDOM_LOOP_MIN_MS,
    SPEED_CENTER,
    SPEED_SNAP_THRESHOLD,
    TIME_EPSILON,
    UI_UPDATE_INTERVAL
} from './recorder/constants';
import { getOfflineAudioContext, mapSpeed, safeDisconnect, safeStopSource, triggerDownload } from './recorder/helpers';
import type { LoopRegion, UseRecorderReturn } from './recorder/types';
import { warnOnceInDev } from '../utils/devDiagnostics';

const RECORDER_PROCESSOR_NAME = 'tether-recorder-processor';

type RecorderWorkletContext = AudioContext & {
    __tetherRecorderWorkletReady?: boolean;
    __tetherRecorderWorkletLoading?: Promise<void> | null;
};

const isRecorderAlreadyRegisteredError = (error: unknown): boolean => {
    if (!(error instanceof DOMException)) return false;
    if (error.name !== 'NotSupportedError') return false;
    const msg = String(error.message || '').toLowerCase();
    return msg.includes('already registered') && msg.includes(RECORDER_PROCESSOR_NAME);
};

const ensureRecorderWorkletLoaded = async (audioContext: AudioContext): Promise<void> => {
    const ctx = audioContext as RecorderWorkletContext;
    if (ctx.__tetherRecorderWorkletReady) return;
    if (ctx.__tetherRecorderWorkletLoading) {
        await ctx.__tetherRecorderWorkletLoading;
        return;
    }

    const loadPromise = (async () => {
        const blob = new Blob([RECORDER_PROCESSOR_CODE], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        try {
            await audioContext.audioWorklet.addModule(url);
        } catch (e) {
            if (!isRecorderAlreadyRegisteredError(e)) throw e;
        } finally {
            URL.revokeObjectURL(url);
        }
        ctx.__tetherRecorderWorkletReady = true;
    })();

    ctx.__tetherRecorderWorkletLoading = loadPromise;
    try {
        await loadPromise;
    } finally {
        ctx.__tetherRecorderWorkletLoading = null;
    }
};

export const useRecorder = (
    sourceNode: AudioNode | null, 
    audioContext: AudioContext | null
): UseRecorderReturn => {
    // UI-visible transport and mode state.
    const [isRecording, setIsRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLooping, setIsLooping] = useState(false);
    const [isReversed, setIsReversed] = useState(false);
    const [isRandomLooping, setIsRandomLooping] = useState(false);
    
    const [playbackSpeed, setPlaybackSpeed] = useState(512);
    const [randomLoopRate, setRandomLoopRate] = useState(512);
    const [loopRegion, setLoopRegion] = useState<LoopRegion | null>(null);
    
    const [recordedTime, setRecordedTime] = useState(0);
    const [playbackTime, setPlaybackTime] = useState(0);
    const [hasRecording, setHasRecording] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [, setBufferVersion] = useState(0);

    // Runtime mirrors used inside animation and audio callbacks.
    const isRecordingRef = useRef(false);
    const isPlayingRef = useRef(false);
    const isLoopingRef = useRef(false);
    const isRandomLoopingRef = useRef(false);
    const loopRegionRef = useRef<LoopRegion | null>(null);
    const recordedTimeRef = useRef(0);
    const playbackTimeRef = useRef(0);
    const randomLoopRateRef = useRef(512);
    const playbackSpeedRef = useRef(SPEED_CENTER);
    
    const lastUiUpdateRef = useRef(0);

    // Keep refs in sync with state for stable callback logic.
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);
    useEffect(() => { isRandomLoopingRef.current = isRandomLooping; }, [isRandomLooping]);
    useEffect(() => { loopRegionRef.current = loopRegion; }, [loopRegion]);
    useEffect(() => { recordedTimeRef.current = recordedTime; }, [recordedTime]);
    useEffect(() => { randomLoopRateRef.current = randomLoopRate; }, [randomLoopRate]);

    const lastFrameTimeRef = useRef(0);
    const playbackFrameRef = useRef(0);
    
    // Pre-allocated recording buffers to avoid chunk allocations while recording.
    const preAllocLeftRef = useRef<Float32Array | null>(null);
    const preAllocRightRef = useRef<Float32Array | null>(null);
    const writePointerRef = useRef(0);
    
    const audioBufferRef = useRef<AudioBuffer | null>(null);
    
    // Audio graph nodes used by recorder/playback.
    const processorRef = useRef<AudioWorkletNode | null>(null);
    const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const muteGainRef = useRef<GainNode | null>(null);
    // Stop/finalize invariants: avoid duplicate finalization when stop ack and timeout race.
    const pendingStopRef = useRef(false);
    const finalizedRef = useRef(false);
    const stopTimeoutRef = useRef<number | null>(null);
    const isStartingRef = useRef(false);
    const isOfflineRenderingRef = useRef(false);
    const statusTimeoutRef = useRef<number | null>(null);
    
    const rndTimerRef = useRef<number | null>(null);

    const clearStatusMessage = useCallback(() => {
        if (statusTimeoutRef.current) {
            clearTimeout(statusTimeoutRef.current);
            statusTimeoutRef.current = null;
        }
        setStatusMessage(null);
    }, []);

    const reportStatus = useCallback((message: string, timeoutMs = 5000) => {
        if (statusTimeoutRef.current) {
            clearTimeout(statusTimeoutRef.current);
            statusTimeoutRef.current = null;
        }
        setStatusMessage(message);
        statusTimeoutRef.current = window.setTimeout(() => {
            setStatusMessage(null);
            statusTimeoutRef.current = null;
        }, timeoutMs);
    }, []);

    // UI setter with center snap and live rate update.
    const setPlaybackSpeedUI = useCallback((val: number) => {
        let actualVal = Math.max(0, Math.min(1024, val));
        if (Math.abs(actualVal - 512) < SPEED_SNAP_THRESHOLD) {
            actualVal = 512;
        }
        setPlaybackSpeed(actualVal);
        const rate = mapSpeed(actualVal);
        playbackSpeedRef.current = rate;
        
        const source = playbackSourceRef.current;
        if (source && audioContext) {
            try {
                source.playbackRate.setValueAtTime(rate, audioContext.currentTime);
            } catch (e) {
                warnOnceInDev('[useRecorder] failed to set playbackRate during speed update', e);
            }
        }
    }, [audioContext]);

    // Lightweight UI ticker while recording.
    useEffect(() => {
        if (!isRecording) return;
        let rafId: number;
        const updateUI = () => {
            const now = performance.now();
            if (now - lastUiUpdateRef.current > UI_UPDATE_INTERVAL) {
                setRecordedTime(recordedTimeRef.current);
                lastUiUpdateRef.current = now;
            }
            rafId = requestAnimationFrame(updateUI);
        };
        rafId = requestAnimationFrame(updateUI);
        return () => cancelAnimationFrame(rafId);
    }, [isRecording]);

    // Playback time loop driven by AudioContext time.
    const updatePlaybackTime = useCallback(() => {
        if (!audioContext || !isPlayingRef.current) return;
        const now = audioContext.currentTime;
        const dt = now - lastFrameTimeRef.current;
        lastFrameTimeRef.current = now;

        let current = playbackTimeRef.current + (dt * playbackSpeedRef.current);
        const start = loopRegionRef.current && isLoopingRef.current ? loopRegionRef.current.start : 0;
        const end = loopRegionRef.current && isLoopingRef.current ? loopRegionRef.current.end : recordedTimeRef.current;
        const duration = end - start;

        if (current >= end) {
            if (isLoopingRef.current && duration > TIME_EPSILON) {
                const overflow = current - end;
                current = start + (overflow % duration);
            } else if (isLoopingRef.current) {
                current = start;
            } else {
                current = end;
            }
        }
        
        playbackTimeRef.current = current; 
        
        const realTime = performance.now();
        if (realTime - lastUiUpdateRef.current > UI_UPDATE_INTERVAL) {
            setPlaybackTime(current);
            lastUiUpdateRef.current = realTime;
        }

        playbackFrameRef.current = requestAnimationFrame(updatePlaybackTime);
    }, [audioContext]);

    // Start/stop playback animation loop with transport state.
    useEffect(() => {
        if (isPlaying && audioContext) {
            lastFrameTimeRef.current = audioContext.currentTime;
            playbackFrameRef.current = requestAnimationFrame(updatePlaybackTime);
        } else {
            cancelAnimationFrame(playbackFrameRef.current);
        }
        return () => cancelAnimationFrame(playbackFrameRef.current);
    }, [isPlaying, updatePlaybackTime, audioContext]);

    // Auto-stop when non-looping playback reaches the end.
    useEffect(() => {
        if (!isPlaying || isLooping || recordedTime <= 0) return;
        if (playbackTimeRef.current >= recordedTimeRef.current - TIME_EPSILON) {
            setIsPlaying(false);
            cancelAnimationFrame(playbackFrameRef.current);
            safeStopSource(playbackSourceRef.current);
            playbackSourceRef.current = null;
            setPlaybackTime(recordedTimeRef.current);
        }
    }, [playbackTime, isPlaying, isLooping, recordedTime]);

    // Apply loop boundaries to current playback source.
    useEffect(() => {
        const source = playbackSourceRef.current;
        if (!source) return;
        try {
            if (isLooping && loopRegion) {
                source.loopStart = loopRegion.start;
                source.loopEnd = loopRegion.end;
            } else {
                source.loopStart = 0;
                source.loopEnd = recordedTime;
            }
            source.loop = isLooping;
        } catch (e) {
            warnOnceInDev('[useRecorder] failed to update loop properties on source', e);
        }
    }, [isLooping, loopRegion, recordedTime]);

    // Full cleanup on unmount.
    useEffect(() => {
        return () => {
            if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
            if (processorRef.current) {
                processorRef.current.port.postMessage({ command: 'stop' });
                processorRef.current.port.onmessage = null;
                safeDisconnect(processorRef.current);
            }
            safeDisconnect(muteGainRef.current);
            safeStopSource(playbackSourceRef.current);
            if (rndTimerRef.current) clearTimeout(rndTimerRef.current);
            cancelAnimationFrame(playbackFrameRef.current);
            if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
            preAllocLeftRef.current = null;
            preAllocRightRef.current = null;
        };
    }, []);

    // Recorder graph teardown helper.
    const cleanupProcessor = useCallback(() => {
        const proc = processorRef.current;
        if (!proc) return;
        try { proc.port.onmessage = null; } catch (e) {
            warnOnceInDev('[useRecorder] failed to clear processor port handler', e);
        }
        try { proc.disconnect(); } catch (e) {
            warnOnceInDev('[useRecorder] failed to disconnect recorder processor', e);
        }
        if (sourceNode) {
            try { sourceNode.disconnect(proc); } catch (e) {
                warnOnceInDev('[useRecorder] failed to disconnect source from recorder processor', e);
            }
        }
        processorRef.current = null;
        safeDisconnect(muteGainRef.current);
        muteGainRef.current = null;
    }, [sourceNode]);

    // Finalize pre-allocated capture into an AudioBuffer.
    const finalizeRecording = useCallback(() => {
        if (finalizedRef.current) return;
        finalizedRef.current = true;

        if (!audioContext || audioContext.state === 'closed') return;

        try {
            const length = writePointerRef.current;
            
            if (length > 0 && preAllocLeftRef.current && preAllocRightRef.current) {
                const finalL = preAllocLeftRef.current.subarray(0, length);
                const finalR = preAllocRightRef.current.subarray(0, length);
                
                const buffer = createAudioBufferFromData(finalL, finalR, audioContext);
                applyFades(buffer, FADE_DURATION);
                audioBufferRef.current = buffer;
                setHasRecording(true);
                setBufferVersion(v => v + 1);
                setRecordedTime(buffer.duration);
                recordedTimeRef.current = buffer.duration;
                setLoopRegion(null);
            }
            
            preAllocLeftRef.current = null;
            preAllocRightRef.current = null;
            writePointerRef.current = 0;
        } catch (err) {
            warnOnceInDev('[useRecorder] failed to finalize recording buffer', err);
            reportStatus('Failed to finalize recording buffer.');
        }
    }, [audioContext, reportStatus]);

    // Start capture: prepare buffers, load worklet, wire graph, stream data.
    const startRecording = useCallback(async () => {
        if (!sourceNode || !audioContext || audioContext.state === 'closed' || isRecordingRef.current) return;
        if (pendingStopRef.current || isStartingRef.current || processorRef.current) {
            warnOnceInDev('[useRecorder] start ignored while recorder is transitioning', 'recorder-transitioning');
            return;
        }

        isStartingRef.current = true;
        try {
        
        // Reset transport first so new recording always starts from a clean state.
        safeStopSource(playbackSourceRef.current);
        playbackSourceRef.current = null;
        setIsPlaying(false);
        setIsRandomLooping(false);
        setIsReversed(false);
        if (rndTimerRef.current) clearTimeout(rndTimerRef.current);
        
        const sampleRate = audioContext.sampleRate;
        const maxSamples = sampleRate * MAX_RECORDING_DURATION;
        
        try {
            preAllocLeftRef.current = new Float32Array(maxSamples);
            preAllocRightRef.current = new Float32Array(maxSamples);
        } catch (e) {
            warnOnceInDev('[useRecorder] allocation failed while starting recording', e);
            preAllocLeftRef.current = null;
            preAllocRightRef.current = null;
            writePointerRef.current = 0;
            reportStatus('Not enough memory to start recording.');
            return;
        }
        
        writePointerRef.current = 0;
        audioBufferRef.current = null;
        pendingStopRef.current = false;
        finalizedRef.current = false;
        setHasRecording(false);
        setRecordedTime(0);
        recordedTimeRef.current = 0;
        setPlaybackTime(0);
        playbackTimeRef.current = 0;
        setLoopRegion(null);

        try {
            await ensureRecorderWorkletLoaded(audioContext);
            const processor = new AudioWorkletNode(audioContext, RECORDER_PROCESSOR_NAME);
            processorRef.current = processor;
            
            processor.port.onmessage = (e) => {
                // Ignore late packets after teardown unless stop flow is still in progress.
                if (!isRecordingRef.current && !pendingStopRef.current) return;
                
                if (e.data.command === 'data') {
                    const inputL = e.data.left;
                    const inputR = e.data.right;
                    
                    if (!inputL || !inputR) return;
                    
                    const len = inputL.length;
                    const currentPtr = writePointerRef.current;
                    
                    if (preAllocLeftRef.current && preAllocRightRef.current) {
                        const maxLen = preAllocLeftRef.current.length;
                        const space = maxLen - currentPtr;
                        if (space > 0) {
                            const copyLen = Math.min(len, space);
                            preAllocLeftRef.current.set(inputL.subarray(0, copyLen), currentPtr);
                            preAllocRightRef.current.set(inputR.subarray(0, copyLen), currentPtr);
                            writePointerRef.current += copyLen;
                        }
                    }

                    const currentRecTime = writePointerRef.current / sampleRate;
                    recordedTimeRef.current = currentRecTime;
                    
                    if (currentRecTime >= MAX_RECORDING_DURATION) {
                        stopRecording();
                    }
                } else if (e.data.command === 'stopped') {
                    if (stopTimeoutRef.current) {
                        clearTimeout(stopTimeoutRef.current);
                        stopTimeoutRef.current = null;
                    }
                    pendingStopRef.current = false;
                    cleanupProcessor();
                    finalizeRecording();
                }
            };

            sourceNode.connect(processor);
            
            const mute = audioContext.createGain();
            mute.gain.value = 0;
            processor.connect(mute);
            mute.connect(audioContext.destination);
            muteGainRef.current = mute;

            isRecordingRef.current = true;
            setIsRecording(true);
            
            processor.port.postMessage({ command: 'start' });

        } catch (err) {
            warnOnceInDev('[useRecorder] failed to setup recorder worklet', err);
            if (stopTimeoutRef.current) {
                clearTimeout(stopTimeoutRef.current);
                stopTimeoutRef.current = null;
            }
            pendingStopRef.current = false;
            cleanupProcessor();
            preAllocLeftRef.current = null;
            preAllocRightRef.current = null;
            writePointerRef.current = 0;
            reportStatus('Failed to start recording.');
            isRecordingRef.current = false;
            setIsRecording(false);
        }
        } finally {
            isStartingRef.current = false;
        }
    }, [sourceNode, audioContext, cleanupProcessor, reportStatus]);

    // Stop capture with timeout fallback in case worklet stop ack is delayed.
    const stopRecording = useCallback(() => {
        
        if (pendingStopRef.current) return;
        if (!isRecordingRef.current && !processorRef.current) return;
        
        isRecordingRef.current = false;
        pendingStopRef.current = true;
        setIsRecording(false);
        
        if (processorRef.current) {
            try {
                processorRef.current.port.postMessage({ command: 'stop' });
            } catch (e) {
                warnOnceInDev('[useRecorder] failed to post stop command to recorder processor', e);
            }
        }

        if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
        // Fallback: finalize even if worklet never sends the "stopped" acknowledgment.
        stopTimeoutRef.current = window.setTimeout(() => {
            stopTimeoutRef.current = null;
            pendingStopRef.current = false;
            cleanupProcessor();
            finalizeRecording();
        }, 200);
    }, [cleanupProcessor, finalizeRecording]);

    // Playback transport helpers.
    // STOP behavior:
    // 1st press while playing -> pause at current position.
    // 2nd press while already stopped -> reset to start (or loop start when loop is active).
    const stopPlayback = useCallback(() => {
        const wasPlaying = isPlayingRef.current;
        safeStopSource(playbackSourceRef.current);
        playbackSourceRef.current = null;
        cancelAnimationFrame(playbackFrameRef.current);
        setIsPlaying(false);

        if (isRandomLoopingRef.current) {
            setIsRandomLooping(false);
            if (rndTimerRef.current) clearTimeout(rndTimerRef.current);
        }

        if (wasPlaying) {
            const held = Math.max(0, Math.min(playbackTimeRef.current, recordedTimeRef.current));
            setPlaybackTime(held);
            playbackTimeRef.current = held;
            return;
        }

        const resetTo = (isLoopingRef.current && loopRegionRef.current) ? loopRegionRef.current.start : 0;
        setPlaybackTime(resetTo);
        playbackTimeRef.current = resetTo;
    }, []);

    // Seek rebuilds source when playback is active.
    const seek = useCallback((time: number, overrideLoopRegion?: LoopRegion) => {
        const clamped = Math.max(0, Math.min(time, recordedTimeRef.current));
        setPlaybackTime(clamped);
        playbackTimeRef.current = clamped; 
        
        const buffer = audioBufferRef.current;
        if (!isPlayingRef.current || !audioContext || !buffer) return;
        
        safeStopSource(playbackSourceRef.current);
        const activeLoopRegion = overrideLoopRegion || loopRegionRef.current;
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = playbackSpeedRef.current;
        if (isLoopingRef.current && activeLoopRegion) {
            source.loopStart = activeLoopRegion.start;
            source.loopEnd = activeLoopRegion.end;
        } else {
            source.loopStart = 0;
            source.loopEnd = buffer.duration;
        }
        source.loop = isLoopingRef.current;
        source.connect(audioContext.destination);
        source.start(0, clamped);
        playbackSourceRef.current = source;
        lastFrameTimeRef.current = audioContext.currentTime;
    }, [audioContext]);

    // Toggle play/pause with current loop mode.
    const playRecording = useCallback(() => {
        const buffer = audioBufferRef.current;
        if (!buffer || !audioContext || audioContext.state === 'closed') return;
        safeStopSource(playbackSourceRef.current);
        playbackSourceRef.current = null;

        if (isPlayingRef.current) {
            setIsPlaying(false);
            if (isRandomLoopingRef.current) {
                setIsRandomLooping(false);
                if (rndTimerRef.current) clearTimeout(rndTimerRef.current);
            }
            return;
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = playbackSpeedRef.current;
        if (loopRegionRef.current) {
            source.loopStart = loopRegionRef.current.start;
            source.loopEnd = loopRegionRef.current.end;
        } else {
            source.loopStart = 0;
            source.loopEnd = buffer.duration;
        }
        source.loop = isLoopingRef.current;
        source.connect(audioContext.destination);
        
        let offset = playbackTimeRef.current;
        if (offset >= recordedTimeRef.current - TIME_EPSILON) offset = 0;
        if (isLoopingRef.current && loopRegionRef.current) {
            if (isRandomLoopingRef.current || offset > loopRegionRef.current.end) offset = loopRegionRef.current.start;
        }
        
        setPlaybackTime(offset);
        playbackTimeRef.current = offset;
        source.start(0, offset);
        playbackSourceRef.current = source;
        lastFrameTimeRef.current = audioContext.currentTime;
        setIsPlaying(true);
    }, [audioContext]);

    // Restart from loop start (or from zero when loop is off).
    const restartPlayback = useCallback(() => {
        if (hasRecording) seek((isLoopingRef.current && loopRegionRef.current) ? loopRegionRef.current.start : 0);
    }, [hasRecording, seek]);

    // Loop region controls.
    const toggleLoop = useCallback(() => setIsLooping(prev => !prev), []);

    const updateLoopRegion = useCallback((start: number, end: number) => {
        const clampedStart = Math.max(0, Math.min(start, recordedTimeRef.current));
        const clampedEnd = Math.max(0, Math.min(end, recordedTimeRef.current));
        if (clampedStart >= clampedEnd - TIME_EPSILON) return;
        
        const newRegion = { start: clampedStart, end: clampedEnd };
        setLoopRegion(newRegion);
        setIsLooping(true);

        if (isPlayingRef.current && audioContext) {
            if (isRandomLoopingRef.current || playbackTimeRef.current > clampedEnd) {
                seek(clampedStart, newRegion);
            } else {
                const source = playbackSourceRef.current;
                if (source) {
                    source.loopStart = clampedStart;
                    source.loopEnd = clampedEnd;
                    source.loop = true;
                }
            }
        }
    }, [audioContext, seek]);
    
    const clearLoopRegion = useCallback(() => setLoopRegion(null), []);

    // Random loop mode toggles autonomous loop reselection.
    const toggleRandomLoop = useCallback(() => {
        if (isRandomLooping) {
            setIsRandomLooping(false);
            if (rndTimerRef.current) clearTimeout(rndTimerRef.current);
        } else {
            setIsRandomLooping(true);
            setIsPlaying(true);
        }
    }, [isRandomLooping]);

    // Random loop scheduler.
    useEffect(() => {
        if (!isRandomLooping || !hasRecording || recordedTime <= 0) {
            if (rndTimerRef.current) clearTimeout(rndTimerRef.current);
            return;
        }
        
        const scheduleNextLoop = () => {
            if (!isRandomLoopingRef.current) return;

            const rate = randomLoopRateRef.current;
            const pct = rate / 1024;
            const baseMs = RANDOM_LOOP_MAX_MS - (pct * (RANDOM_LOOP_MAX_MS - RANDOM_LOOP_MIN_MS));
            
            const multipliers = [0.25, 0.5, 1.0, 2.0];
            const mult = multipliers[Math.floor(Math.random() * multipliers.length)];
            let loopLen = Math.max(RANDOM_LOOP_MIN_DURATION, Math.min((baseMs * mult) / 1000, recordedTimeRef.current));
            
            const start = Math.random() * Math.max(0, recordedTimeRef.current - loopLen);
            const end = start + loopLen;
            
            let repeats = loopLen < 0.2 ? Math.floor(Math.random() * 5) + 4 : (loopLen < 0.5 ? Math.floor(Math.random() * 3) + 2 : Math.floor(Math.random() * 2) + 1);
            const lifeSpanMs = (loopLen * repeats * 1000) / (playbackSpeedRef.current || 1);
            
            updateLoopRegion(start, end);
            rndTimerRef.current = window.setTimeout(scheduleNextLoop, lifeSpanMs);
        };
        
        scheduleNextLoop();
        return () => { if (rndTimerRef.current) clearTimeout(rndTimerRef.current); };
    }, [isRandomLooping, hasRecording, recordedTime, updateLoopRegion]);

    // Destructive reverse of in-memory recording buffer.
    const reverseRecording = useCallback(() => {
        const oldBuf = audioBufferRef.current;
        if (!oldBuf || !audioContext || audioContext.state === 'closed') return;
        safeStopSource(playbackSourceRef.current);
        playbackSourceRef.current = null;
        setIsPlaying(false);
        setPlaybackTime(0);
        playbackTimeRef.current = 0;

        const newBuf = audioContext.createBuffer(oldBuf.numberOfChannels, oldBuf.length, oldBuf.sampleRate);
        for (let ch = 0; ch < oldBuf.numberOfChannels; ch++) {
            const oldD = oldBuf.getChannelData(ch);
            const newD = newBuf.getChannelData(ch);
            const len = oldD.length;
            for (let i = 0; i < len; i++) newD[i] = oldD[len - 1 - i];
        }
        audioBufferRef.current = newBuf;
        setIsReversed(prev => !prev);
        setBufferVersion(v => v + 1);
    }, [audioContext]);

    // Offline render used for speed-processed exports.
    const renderOffline = async (start: number, end: number, rate: number): Promise<Blob | null> => {
        const buffer = audioBufferRef.current;
        if (!buffer) return null;
        const duration = end - start;
        
        const effectiveDuration = duration / rate;
        if (effectiveDuration > MAX_OFFLINE_RENDER_DURATION) {
            reportStatus(`Cannot export more than ${MAX_OFFLINE_RENDER_DURATION}s at current speed.`);
            return null;
        }

        const OfflineCtx = getOfflineAudioContext();
        if (duration <= 0 || !OfflineCtx) return null;

        // Single-flight lock to prevent concurrent OfflineAudioContext renders.
        if (isOfflineRenderingRef.current) {
            warnOnceInDev('[useRecorder] duplicate offline render request ignored', 'offline-render-busy');
            return null;
        }

        isOfflineRenderingRef.current = true;
        try {
            const ctx = new OfflineCtx(2, Math.ceil(effectiveDuration * buffer.sampleRate), buffer.sampleRate);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.playbackRate.value = rate;
            source.connect(ctx.destination);
            source.start(0, start);

            const rendered = await ctx.startRendering();
            return encodeWAV(interleave(rendered.getChannelData(0), rendered.getChannelData(1)), buffer.sampleRate);
        } catch (e) {
            warnOnceInDev('[useRecorder] offline render failed', e);
            reportStatus('Export failed. Try a shorter loop or faster speed.');
            return null;
        } finally {
            isOfflineRenderingRef.current = false;
        }
    };

    // Export helpers.
    const downloadRawWav = useCallback(() => {
        const b = audioBufferRef.current;
        if (b) triggerDownload(encodeWAV(interleave(b.getChannelData(0), b.getChannelData(1)), b.sampleRate), 'raw');
    }, []);

    const downloadLoopWav = useCallback(async () => {
        const b = audioBufferRef.current;
        if (!b) return;
        const s = loopRegionRef.current ? loopRegionRef.current.start : 0;
        const e = loopRegionRef.current ? loopRegionRef.current.end : recordedTimeRef.current;
        const r = playbackSpeedRef.current;
        if (Math.abs(r - 1.0) < TIME_EPSILON) {
            const startF = Math.floor(s * b.sampleRate);
            const endF = Math.floor(e * b.sampleRate);
            const frames = endF - startF;
            if (frames <= 0) return;
            const lRaw = b.getChannelData(0);
            const rRaw = b.getChannelData(1);
            const lS = lRaw.slice(startF, endF);
            const rS = rRaw.slice(startF, endF);
            triggerDownload(encodeWAV(interleave(lS, rS), b.sampleRate), 'loop');
        } else {
            const blob = await renderOffline(s, e, r);
            if (blob) triggerDownload(blob, 'loop-speed');
        }
    }, []);
    
    const downloadSpeedWav = useCallback(async () => {
        const blob = await renderOffline(0, recordedTimeRef.current, playbackSpeedRef.current);
        if (blob) triggerDownload(blob, 'speed');
    }, []);

    // Public recorder API.
    return {
        isRecording, isPlaying, isLooping, isReversed, hasRecording, recordedTime, playbackTime, playbackSpeed, loopRegion, audioBuffer: audioBufferRef.current, 
        
        monoBufferRef: preAllocLeftRef,
        writePointerRef: writePointerRef,
        
        isRandomLooping, randomLoopRate, statusMessage,
        startRecording, stopRecording, playRecording, stopPlayback, restartPlayback, toggleLoop, updateLoopRegion, clearLoopRegion, setPlaybackSpeed: setPlaybackSpeedUI, reverseRecording, seek, downloadRawWav, downloadLoopWav, downloadSpeedWav, toggleRandomLoop, setRandomLoopRate,
        clearStatusMessage
    };
};
