import React, { useEffect, useRef } from 'react';
import { engine } from '../lib/audio.js';
import { useStore } from '../lib/store.js';

/**
 * Canvas spectrum visualizer driven by the Web Audio analyser.
 * Falls back to a soft sine wave when Web Audio is unavailable.
 */
export default function Visualizer({ size = 58 }) {
  const ref = useRef(null);
  const playing = useStore((s) => s.playing);
  const mode = useStore((s) => s.visualizer);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return undefined; // canvas unavailable (e.g. headless test env)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let phase = 0;

    const draw = () => {
      const spectrum = engine.getSpectrum();
      ctx.clearRect(0, 0, size, size);

      if (spectrum) {
        const bars = 18;
        const step = Math.floor(spectrum.length / bars);
        const width = size / bars;
        for (let i = 0; i < bars; i += 1) {
          let sum = 0;
          for (let j = 0; j < step; j += 1) sum += spectrum[i * step + j] || 0;
          const value = sum / step / 255;
          const h = Math.max(2, value * size * 0.95);
          const x = i * width;
          const gradient = ctx.createLinearGradient(0, size, 0, size - h);
          gradient.addColorStop(0, 'rgba(139,92,246,0.95)');
          gradient.addColorStop(1, 'rgba(56,189,248,0.95)');
          ctx.fillStyle = gradient;
          const w = width * 0.62;
          const r = Math.min(2, w / 2);
          ctx.beginPath();
          ctx.roundRect(x + (width - w) / 2, size - h, w, h, r);
          ctx.fill();
        }
      } else {
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = 'rgba(139,92,246,0.9)';
        ctx.beginPath();
        for (let x = 0; x <= size; x += 2) {
          const y = size / 2 + Math.sin((x / size) * Math.PI * 3 + phase) * (playing ? 8 : 3);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        phase += playing ? 0.14 : 0.03;
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, playing, mode]);

  return <canvas ref={ref} className="viz" style={{ width: size, height: size }} aria-hidden="true" />;
}
