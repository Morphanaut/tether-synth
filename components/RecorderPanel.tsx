
import React, { useEffect, useRef, useState } from 'react';
import { useRecorder } from '../hooks/useRecorder';
import { TEXTS } from '../data/constants';
import ShortLoopWarningModal from './ShortLoopWarningModal';
import { Button, ButtonGroup, Fader, Label, PanelTitle, Row, Value } from './library/Controls';

interface RecorderPanelProps {
    analyserNode: AnalyserNode | null;
    className?: string;
    isModalOpen?: boolean;
}

interface StyleCache {
    bg: string;
    wave: string;
    playhead: string;
    grid: string;
}

const RecorderPanel: React.FC<RecorderPanelProps> = React.memo(({ analyserNode, className = "", isModalOpen = false }) => {
    const audioContext = analyserNode?.context as AudioContext || null;
    const { isRecording, isPlaying, isLooping, isReversed, hasRecording, recordedTime, playbackTime, playbackSpeed, setPlaybackSpeed, loopRegion, audioBuffer, monoBufferRef, writePointerRef, isRandomLooping, randomLoopRate, statusMessage, startRecording, stopRecording, playRecording, stopPlayback, restartPlayback, toggleLoop, updateLoopRegion, clearLoopRegion, reverseRecording, seek, downloadRawWav, downloadLoopWav, downloadSpeedWav, toggleRandomLoop, setRandomLoopRate, clearStatusMessage } = useRecorder(analyserNode, audioContext);
    
    const waveCanvasRef = useRef<HTMLCanvasElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const drawRafRef = useRef<number>(0);
    const rafScheduledRef = useRef(false);
    const requestDrawRef = useRef<(() => void) | null>(null);
    const needsRedrawRef = useRef(true);

    const dimsRef = useRef({ w: 0, h: 0, amp: 0, dpr: 1 });
    const stylesRef = useRef<StyleCache>({ bg: '#111113', wave: '#71717a', playhead: '#d4d4d8', grid: '#333' });

    const recordedTimeRef = useRef(recordedTime);
    const playbackTimeRef = useRef(playbackTime);
    const playbackSpeedRef = useRef(playbackSpeed);
    const smoothPlaybackTimeRef = useRef(playbackTime);
    const lastVisualTsRef = useRef(0);
    const waveformCacheRef = useRef<{min: Float32Array, max: Float32Array} | null>(null);
    
    const [showShortLoopWarning, setShowShortLoopWarning] = useState(false);
    const [suppressShortLoopWarning, setSuppressShortLoopWarning] = useState(false);

    useEffect(() => { recordedTimeRef.current = recordedTime; }, [recordedTime]);
    useEffect(() => {
        playbackTimeRef.current = playbackTime;
        smoothPlaybackTimeRef.current = playbackTime;
        lastVisualTsRef.current = performance.now();
        needsRedrawRef.current = true;
        requestDrawRef.current?.();
    }, [playbackTime]);
    useEffect(() => { playbackSpeedRef.current = playbackSpeed; }, [playbackSpeed]);
    useEffect(() => {
        if (!isPlaying) return;
        lastVisualTsRef.current = performance.now();
        smoothPlaybackTimeRef.current = playbackTimeRef.current;
        needsRedrawRef.current = true;
        requestDrawRef.current?.();
    }, [isPlaying]);
    useEffect(() => {
        if (isModalOpen) return;
        needsRedrawRef.current = true;
        requestDrawRef.current?.();
    }, [isModalOpen]);

    useEffect(() => {
        const style = getComputedStyle(document.documentElement);
        stylesRef.current = {
            bg: style.getPropertyValue('--color-fader-track').trim() || '#111113',
            wave: style.getPropertyValue('--color-text-value').trim() || '#71717a',
            playhead: style.getPropertyValue('--color-text-title').trim() || '#d4d4d8',
            grid: style.getPropertyValue('--color-border-dim').trim() || '#333'
        };
    }, []);

    useEffect(() => {
        if (!audioBuffer) { waveformCacheRef.current = null; return; }
        const w = 512;
        const data = audioBuffer.getChannelData(0);
        const step = Math.ceil(data.length / w);
        const minCache = new Float32Array(w);
        const maxCache = new Float32Array(w);

        for (let i = 0; i < w; i++) {
            let min = 1.0; let max = -1.0;
            const startIdx = i * step;
            const endIdx = Math.min(startIdx + step, data.length);
            for (let j = startIdx; j < endIdx; j++) {
                const datum = data[j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            minCache[i] = min > max ? 0 : min;
            maxCache[i] = min > max ? 0 : max;
        }
        waveformCacheRef.current = { min: minCache, max: maxCache };
    }, [audioBuffer]);

    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<number | null>(null);
    const [selectionPreview, setSelectionPreview] = useState<{start: number, end: number} | null>(null);

    useEffect(() => {
        const canvas = waveCanvasRef.current;
        const wrapper = wrapperRef.current;
        if (!canvas || !wrapper) return;

        const ro = new ResizeObserver(entries => {
            if (!entries[0]) return;
            const { width, height } = entries[0].contentRect;
            const dpr = window.devicePixelRatio || 1;
            
            if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
                canvas.width = width * dpr;
                canvas.height = height * dpr;
                
                dimsRef.current = { 
                    w: width, 
                    h: height,
                    amp: height / 2,
                    dpr: dpr
                };
            }
        });
        ro.observe(wrapper);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        needsRedrawRef.current = true;
    }, [audioBuffer, loopRegion, isLooping, selectionPreview]);

    useEffect(() => {
        const canvas = waveCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        let isActive = true;
        const schedule = () => {
            if (!isActive || rafScheduledRef.current) return;
            rafScheduledRef.current = true;
            drawRafRef.current = requestAnimationFrame(() => {
                rafScheduledRef.current = false;
                draw();
            });
        };
        requestDrawRef.current = schedule;

        const draw = () => {
            if (!isActive) return;

            const { w, h, amp, dpr } = dimsRef.current;
            const { bg, wave, playhead, grid } = stylesRef.current;
            const shouldAnimate = isRecording || isPlaying;
            const shouldDraw = shouldAnimate || needsRedrawRef.current;

            if (isModalOpen) {
                return;
            }

            if (!shouldDraw) {
                return;
            }

            if (w === 0 || h === 0) {
                schedule();
                return;
            }

            if (!shouldAnimate) needsRedrawRef.current = false;

            // Smooth playhead between throttled transport updates from useRecorder.
            let visualPlaybackTime = playbackTimeRef.current;
            if (isPlaying && !isRecording) {
                const nowTs = performance.now();
                const prevTs = lastVisualTsRef.current || nowTs;
                const dt = Math.max(0, (nowTs - prevTs) / 1000);
                lastVisualTsRef.current = nowTs;

                const rate = 0.2 + (playbackSpeedRef.current / 1024) * 1.6;
                let next = smoothPlaybackTimeRef.current + dt * rate;

                const start = loopRegion && isLooping ? loopRegion.start : 0;
                const end = loopRegion && isLooping ? loopRegion.end : recordedTimeRef.current;
                const duration = end - start;

                if (duration > 0) {
                    if (next >= end) {
                        next = isLooping ? start + ((next - start) % duration) : end;
                    } else if (next < start) {
                        next = start;
                    }
                } else {
                    next = start;
                }

                smoothPlaybackTimeRef.current = next;
                visualPlaybackTime = next;
            } else {
                smoothPlaybackTimeRef.current = playbackTimeRef.current;
                lastVisualTsRef.current = performance.now();
            }

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);

            if (isRecording || audioBuffer) {
                ctx.strokeStyle = grid;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, amp);
                ctx.lineTo(w, amp);
                ctx.stroke();
            }

            if (isRecording && monoBufferRef.current) {
                const buffer = monoBufferRef.current;
                const writePtr = writePointerRef.current;
                const sampleRate = audioContext?.sampleRate || 48000;

                const windowSamples = Math.floor(sampleRate * 3.0);
                const startIndex = Math.max(0, writePtr - windowSamples);
                const drawLength = writePtr - startIndex;

                if (drawLength > 0) {
                    ctx.strokeStyle = wave;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(0, amp);

                    const step = Math.max(1, Math.floor(drawLength / w));

                    for (let x = 0; x < w; x++) {
                        const sampleIdx = startIndex + x * step;
                        if (sampleIdx >= writePtr) break;

                        const v = Math.max(-1, Math.min(1, (buffer[sampleIdx] ?? 0) * 2.5));
                        ctx.lineTo(x, amp - (v * amp));
                    }
                    ctx.stroke();

                    const headX = Math.min(w, (drawLength / windowSamples) * w);
                    ctx.fillStyle = wave;
                    ctx.fillRect(headX, 0, 1, h);
                }
            } else if (audioBuffer && waveformCacheRef.current) {
                const { min, max } = waveformCacheRef.current;
                ctx.fillStyle = wave;
                ctx.beginPath();
                const step = w / min.length;
                for (let i = 0; i < min.length; i++) {
                    ctx.lineTo(i * step, amp - (Math.max(-1, Math.min(1, max[i] * 2.5)) * amp));
                }
                for (let i = min.length - 1; i >= 0; i--) {
                    ctx.lineTo(i * step, amp - (Math.max(-1, Math.min(1, min[i] * 2.5)) * amp));
                }
                ctx.closePath();
                ctx.fill();

                const recTime = recordedTimeRef.current;
                const drawReg = (s: number, e: number, color: string) => {
                    if (recTime <= 0) return;
                    const x1 = (s / recTime) * w;
                    const x2 = (e / recTime) * w;
                    ctx.fillStyle = color;
                    ctx.fillRect(x1, 0, x2 - x1, h);
                    ctx.fillStyle = "#fff";
                    ctx.fillRect(x1, 0, 1, h);
                    ctx.fillRect(x2, 0, 1, h);
                };

                if (selectionPreview) drawReg(selectionPreview.start, selectionPreview.end, "rgba(255, 255, 255, 0.1)");
                else if (loopRegion && isLooping) drawReg(loopRegion.start, loopRegion.end, "rgba(255, 255, 255, 0.1)");

                if (recTime > 0) {
                    const x = (visualPlaybackTime / recTime) * w;
                    ctx.fillStyle = playhead;
                    ctx.fillRect(x, 0, 1, h);
                }
            }
            if (shouldAnimate) {
                schedule();
            }
        };
        draw();
        return () => {
            isActive = false;
            requestDrawRef.current = null;
            cancelAnimationFrame(drawRafRef.current);
            rafScheduledRef.current = false;
        };
    }, [isRecording, isPlaying, audioBuffer, loopRegion, isLooping, selectionPreview, audioContext, monoBufferRef, writePointerRef, isModalOpen]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isRecording || !recordedTime) return; 
        const rect = e.currentTarget.getBoundingClientRect(); 
        const x = e.clientX - rect.left; 
        const pct = Math.max(0, Math.min(1, x / rect.width));
        setIsDragging(true); 
        dragStartRef.current = pct * recordedTime;
    };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || dragStartRef.current === null || !recordedTime) return; 
        const rect = e.currentTarget.getBoundingClientRect(); 
        const x = e.clientX - rect.left; 
        const pct = Math.max(0, Math.min(1, x / rect.width));
        setSelectionPreview({ 
            start: Math.min(dragStartRef.current, pct * recordedTime), 
            end: Math.max(dragStartRef.current, pct * recordedTime) 
        });
    };
    const handleMouseUp = (e: React.MouseEvent) => {
        if (!recordedTime || dragStartRef.current === null) return; 
        const rect = e.currentTarget.getBoundingClientRect(); 
        const x = e.clientX - rect.left; 
        const pct = Math.max(0, Math.min(1, x / rect.width)); 
        const end = pct * recordedTime; 
        const start = dragStartRef.current;
        if (Math.abs(end - start) < 0.015) { 
            seek(end); 
            clearLoopRegion(); 
        } else { 
            updateLoopRegion(Math.min(start, end), Math.max(start, end)); 
        }
        setIsDragging(false); 
        dragStartRef.current = null; 
        setSelectionPreview(null);
    };

    const formatTime = (t: number) => { 
        const m = Math.floor(t / 60); 
        const s = Math.floor(t % 60); 
        const ms = Math.floor((t % 1) * 10); 
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`; 
    };
    const curLoopDur = loopRegion ? (loopRegion.end - loopRegion.start) : recordedTime;
    const dispVal = isRecording ? formatTime(recordedTime) : `${formatTime(playbackTime)} / ${formatTime(recordedTime)} / ${formatTime(curLoopDur)}`;
    const dispSpeed = (0.2 + (playbackSpeed / 1024) * 1.6).toFixed(2) + "x";

    return (
        <div className={`border border-zinc-400 p-4 _b-panel relative flex flex-col overflow-hidden ${className}`}>
             <ShortLoopWarningModal isOpen={showShortLoopWarning} onClose={() => setShowShortLoopWarning(false)} onConfirm={(sup) => { if(sup) setSuppressShortLoopWarning(true); setShowShortLoopWarning(false); downloadLoopWav(); }} />
            <div className="border-b border-zinc-800 pb-2 mb-4 flex justify-between items-end _b-widget">
                <PanelTitle>{TEXTS.recorder.title}</PanelTitle>
                <div className="_t-panel-desc">{TEXTS.recorder.subTitle}</div>
            </div>
            <div className="flex flex-col md:flex-row justify-between items-center gap-3 mb-6">
                <div className="flex gap-4 items-center">
                    <ButtonGroup>
                        <Button onClick={isRecording ? stopRecording : startRecording} active={isRecording} animate={isRecording} variant="danger" title="RECORD">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill={isRecording ? "#ef4444" : "currentColor"}><circle cx="12" cy="12" r="10" /></svg>
                        </Button>
                        <Button onClick={() => isRecording ? stopRecording() : stopPlayback()} disabled={!hasRecording && !isRecording} title="STOP">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" /></svg>
                        </Button>
                        <Button onClick={playRecording} disabled={!hasRecording || isRecording} active={isPlaying} title="PLAY">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                        </Button>
                        <Button onClick={restartPlayback} disabled={!hasRecording || isRecording} title="RESET">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
                        </Button>
                    </ButtonGroup>
                    <div className="flex gap-2 pl-4 border-l border-zinc-800 _b-widget">
                         <Button onClick={toggleLoop} disabled={!hasRecording || isRecording} active={isLooping}>LOOP</Button>
                         <Button onClick={toggleRandomLoop} disabled={!hasRecording || isRecording} active={isRandomLooping}>RND</Button>
                         <Button onClick={reverseRecording} disabled={!hasRecording || isRecording} active={isReversed}>REV</Button>
                    </div>
                </div>
                <ButtonGroup>
                    <Button onClick={downloadRawWav} disabled={!hasRecording || isRecording || isPlaying}>{TEXTS.recorder.dlRaw}</Button>
                    <Button onClick={downloadSpeedWav} disabled={!hasRecording || isRecording || isPlaying}>{TEXTS.recorder.dlSpeed}</Button>
                    <Button onClick={() => { if(curLoopDur < 0.5 && !suppressShortLoopWarning) setShowShortLoopWarning(true); else downloadLoopWav(); }} disabled={!hasRecording || isRecording || isPlaying || !loopRegion}>{TEXTS.recorder.dlLoop}</Button>
                </ButtonGroup>
            </div>
            <div className="grid grid-cols-2 mb-4">
                <div className="border-r border-zinc-800 pr-6 _b-widget">
                     <Row><Label>SPEED</Label><Value>{dispSpeed}</Value></Row>
                     <Fader value={playbackSpeed} onChange={setPlaybackSpeed} disabled={!hasRecording || isRecording} />
                </div>
                <div className="pl-6">
                     <Row><Label>RND LOOP RATE</Label><Value>{((1024 / (2048 - (randomLoopRate / 1024 * 1800))).toFixed(2)) + " Hz"}</Value></Row>
                     <Fader value={randomLoopRate} onChange={setRandomLoopRate} disabled={!hasRecording || isRecording} />
                </div>
            </div>
            <div className="mt-auto">
                 {statusMessage && (
                    <div className="mb-2 px-2 py-1 border border-red-800 bg-red-950/30 text-red-300 text-[10px] uppercase tracking-wider flex items-center justify-between gap-2">
                        <span>{statusMessage}</span>
                        <button className="text-red-200 hover:text-red-100" onClick={clearStatusMessage}>x</button>
                    </div>
                 )}
                 <Row><Label>{isRecording ? "REC TIME" : "POSITION / LENGTH / LOOP"}</Label><Value>{dispVal}</Value></Row>
                <div 
                    ref={wrapperRef}
                    className="w-full h-[74px] border border-zinc-800 relative cursor-crosshair group select-none overflow-hidden"
                    style={{ backgroundColor: 'var(--color-fader-track)' }}
                >
                     <canvas ref={waveCanvasRef} className="absolute inset-0 block w-full h-full" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} />
                     {!hasRecording && !isRecording && (
                        <div
                            className="absolute inset-0 flex items-center justify-center pointer-events-none"
                            style={{ backgroundColor: 'var(--color-fader-track)' }}
                        >
                            <span className="_t-meta text-zinc-600 font-bold uppercase tracking-widest">TAPE EMPTY</span>
                        </div>
                     )}
                     {isRecording && <div className="absolute top-2 right-2 flex items-center gap-2 pointer-events-none"><span className="text-[9px] text-red-500 font-bold uppercase tracking-widest animate-pulse">REC</span><div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /></div>}
                     {hasRecording && !isRecording && <div className="absolute bottom-1 right-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-[9px] text-zinc-600 bg-black/50 px-1">DRAG TO LOOP</span></div>}
                </div>
            </div>
        </div>
    );
});

export default RecorderPanel;
