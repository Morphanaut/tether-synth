
import React, { useEffect, useRef, useState } from 'react';

// Cache structure for colors to avoid getComputedStyle per frame
interface ColorCache {
    bg: string;
    line: string;
}

const Oscilloscope: React.FC<{ analyser: AnalyserNode | null; isPaused?: boolean }> = ({ analyser, isPaused = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const [isDocumentVisible, setIsDocumentVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'
  );

  // High-performance cache refs
  const dimsRef = useRef({ w: 0, h: 0, cssW: 0, cssH: 0 });
  const colorsRef = useRef<ColorCache>({ bg: '#111113', line: '#d4d4d8' });

  // 1. Theme Cache (Run once)
  useEffect(() => {
      const style = getComputedStyle(document.documentElement);
      colorsRef.current = {
          bg: style.getPropertyValue('--color-fader-track').trim() || '#111113',
          line: style.getPropertyValue('--color-text-title').trim() || '#d4d4d8'
      };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState !== 'hidden');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!analyser || !canvasRef.current || !wrapperRef.current || isPaused || !isDocumentVisible) return;

    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    const ctx = canvas.getContext('2d', { alpha: false }); // Alpha false optimization
    if (!ctx) return;

    // 2. Efficient Resize Observer with defensive guard against stale callbacks
    let isActive = true;
    const resizeObserver = new ResizeObserver(entries => {
        if (!isActive) return; // Guard against stale callbacks after cleanup
        if (!Array.isArray(entries) || !entries.length) return;
        const entry = entries[0];
        // Use contentRect for precise sub-pixel measurements without triggering Reflow
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;

        // Only resize canvas if dimensions actually changed
        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);

            // Cache dimensions for the draw loop
            dimsRef.current = {
                w: width * dpr,
                h: height * dpr,
                cssW: width,
                cssH: height
            };
        }
    });
    resizeObserver.observe(wrapper);

    const bufferLength = analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);
    const scale = 4.0; 

    const draw = () => {
      if (!isActive) return;

      // READ FROM CACHE (Zero DOM Access)
      const { cssW, cssH } = dimsRef.current;
      const { bg, line } = colorsRef.current;

      if (cssW === 0 || cssH === 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      analyser.getFloatTimeDomainData(dataArray);

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cssW, cssH);

      let triggerIndex = 0;
      let foundTrigger = false;
      
      // Zero-crossing trigger
      for (let i = 1; i < bufferLength / 2; i++) {
        if (!foundTrigger && dataArray[i-1] < 0 && dataArray[i] >= 0) {
            triggerIndex = i;
            foundTrigger = true;
            break;
        }
      }
      
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = line; 
      ctx.beginPath();

      const sliceWidth = cssW * 1.0 / (bufferLength - triggerIndex);
      let x = 0;

      for (let i = triggerIndex; i < bufferLength; i++) {
        const v = dataArray[i] * scale; 
        const y = (0.5 - v / 2) * cssH; 

        if (i === triggerIndex) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
        if (x > cssW) break;
      }

      ctx.stroke();
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      isActive = false; // Prevent stale ResizeObserver callbacks
      resizeObserver.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [analyser, isPaused, isDocumentVisible]);

  return (
    <div ref={wrapperRef} className="w-full flex-1 min-h-0 relative border border-zinc-400 _b-widget overflow-hidden group">
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
        <div className="absolute -top-[4px] left-1 pointer-events-none z-30">
            <span className="text-[9px] text-zinc-600 bg-black/50 px-1 font-bold uppercase tracking-widest">SCOPE</span>
        </div>
    </div>
  );
};

export default Oscilloscope;
