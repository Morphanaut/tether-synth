
import React, { useEffect, useRef, useState } from 'react';

const DebugVuMeter: React.FC<{ analyser: AnalyserNode | null; isPaused?: boolean }> = ({ analyser, isPaused = false }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isDocumentVisible, setIsDocumentVisible] = useState(() =>
        typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'
    );
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number>(0);
    const peakRef = useRef<number>(0);
    
    // Gradient Cache
    const gradientRef = useRef<CanvasGradient | null>(null);
    const dimsRef = useRef({ w: 0, h: 0 });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
            if (e.key === '0') setIsVisible(prev => !prev);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsDocumentVisible(document.visibilityState !== 'hidden');
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    useEffect(() => {
        if (!isVisible || !analyser || !canvasRef.current || isPaused || !isDocumentVisible) {
            cancelAnimationFrame(rafRef.current);
            return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        // Init dimensions and gradient once
        const w = canvas.width;
        const h = canvas.height;
        dimsRef.current = { w, h };
        
        // Cache Gradient creation (expensive operation)
        if (!gradientRef.current) {
            const MIN_DB = -60;
            const MAX_DB = 3;
            const DB_RANGE = MAX_DB - MIN_DB;
            const zeroDbPos = 1 - ((0 - MIN_DB) / DB_RANGE); 
            const warnDbPos = 1 - ((-6 - MIN_DB) / DB_RANGE);

            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#ef4444'); 
            grad.addColorStop(zeroDbPos, '#ef4444'); 
            grad.addColorStop(zeroDbPos + 0.01, '#eab308'); 
            grad.addColorStop(warnDbPos, '#eab308'); 
            grad.addColorStop(warnDbPos + 0.01, '#22c55e'); 
            grad.addColorStop(1, '#22c55e');
            gradientRef.current = grad;
        }

        const dataArray = new Float32Array(analyser.fftSize);
        let currentVol = 0;
        const MIN_DB = -60;
        const MAX_DB = 3;
        const DB_RANGE = MAX_DB - MIN_DB;

        const toDb = (val: number) => {
            if (val <= 0.000001) return MIN_DB;
            const db = 20 * Math.log10(val);
            return Math.max(MIN_DB, Math.min(MAX_DB, db));
        };

        const getMeterHeight = (db: number, height: number) => {
            const pct = (db - MIN_DB) / DB_RANGE;
            return Math.max(0, Math.min(1, pct)) * height;
        };

        const draw = () => {
            analyser.getFloatTimeDomainData(dataArray);

            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i] * dataArray[i];
            const rms = Math.sqrt(sum / dataArray.length);
            
            currentVol = currentVol * 0.8 + rms * 0.2;
            
            if (currentVol > peakRef.current) peakRef.current = currentVol;
            else peakRef.current *= 0.995;

            const currentDb = toDb(currentVol);
            const peakDb = toDb(peakRef.current);

            // Access local vars instead of DOM
            const { w, h } = dimsRef.current;

            ctx.fillStyle = '#0f0f10';
            ctx.fillRect(0, 0, w, h);

            const meterHeight = getMeterHeight(currentDb, h);
            const peakHeight = getMeterHeight(peakDb, h);

            // Use cached gradient
            if (gradientRef.current) {
                ctx.fillStyle = gradientRef.current;
                ctx.fillRect(0, h - meterHeight, w, meterHeight);
            }

            ctx.fillStyle = '#fff';
            const peakY = h - peakHeight;
            if (peakDb > MIN_DB) ctx.fillRect(0, peakY, w, 2);

            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            for (let db = 0; db >= MIN_DB; db -= 6) {
                const y = h - getMeterHeight(db, h);
                ctx.fillRect(0, y, (db === 0 ? w : w/2), 1);
            }

            ctx.fillStyle = '#fff';
            ctx.font = '9px monospace';
            ctx.textAlign = 'right';
            const dbStr = currentDb <= MIN_DB ? '-inf' : currentDb.toFixed(1);
            
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.strokeText(dbStr, w - 2, 12);
            ctx.fillText(dbStr, w - 2, 12);
            
            ctx.font = '7px monospace';
            ctx.strokeText("dB", w - 2, 22);
            ctx.fillText("dB", w - 2, 22);

            rafRef.current = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(rafRef.current);
    }, [isVisible, analyser, isPaused, isDocumentVisible]);

    if (!isVisible) return null;

    return (
        <div className="absolute top-0 right-0 bottom-0 w-8 z-50 border-l border-zinc-500 bg-black/90 flex flex-col items-center pointer-events-none">
            <div className="w-full text-center text-[8px] font-bold text-zinc-500 bg-zinc-900 py-1">VU</div>
            <canvas ref={canvasRef} width={32} height={200} className="w-full h-full" />
        </div>
    );
};

export default DebugVuMeter;
