
import React, { useEffect, useRef, useState } from 'react';

interface ColorCache {
    bg: string;
    bar: string;
}

const SpectrumAnalyzer: React.FC<{ analyser: AnalyserNode | null; isPaused?: boolean }> = ({ analyser, isPaused = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const [isDocumentVisible, setIsDocumentVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'
  );

  const dimsRef = useRef({ cssW: 0, cssH: 0 });
  const colorsRef = useRef<ColorCache>({ bg: '#111113', bar: '#71717a' });

  // 1. Theme Cache
  useEffect(() => {
      const style = getComputedStyle(document.documentElement);
      colorsRef.current = {
          bg: style.getPropertyValue('--color-fader-track').trim() || '#111113',
          bar: style.getPropertyValue('--color-text-value').trim() || '#71717a'
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
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // 2. Efficient Resize Observer with defensive guard against stale callbacks
    let isActive = true;
    const resizeObserver = new ResizeObserver(entries => {
        if (!isActive) return; // Guard against stale callbacks after cleanup
        if (!Array.isArray(entries) || !entries.length) return;
        const entry = entries[0];
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;

        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);

            dimsRef.current = { cssW: width, cssH: height };
        }
    });
    resizeObserver.observe(wrapper);

    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isActive) return;

      const { cssW, cssH } = dimsRef.current;
      const { bg, bar } = colorsRef.current;

      if (cssW === 0 || cssH === 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cssW, cssH);

      // --- 12kHz Scale Logic ---
      const sampleRate = analyser.context.sampleRate;
      const nyquist = sampleRate / 2;
      const targetFreq = 12000;
      
      // Calculate index corresponding to 12kHz
      const binsToRender = Math.floor((targetFreq / nyquist) * bufferLength);
      const safeBinsToRender = Math.min(bufferLength, Math.max(1, binsToRender));

      // Calculate dynamic bar width
      const binWidth = cssW / safeBinsToRender;
      const gap = binWidth > 2 ? 1 : 0;
      const barWidth = Math.max(0.1, binWidth - gap);

      ctx.fillStyle = bar;

      for (let i = 0; i < safeBinsToRender; i++) {
        const value = dataArray[i];
        if (value > 0) {
            const barHeight = (value / 255) * cssH;
            const x = i * binWidth;
            ctx.fillRect(x, cssH - barHeight, barWidth, barHeight);
        }
      }
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
          <span className="text-[9px] text-zinc-600 bg-black/50 px-1 font-bold uppercase tracking-widest">SPECTRUM</span>
      </div>
    </div>
  );
};

export default SpectrumAnalyzer;
