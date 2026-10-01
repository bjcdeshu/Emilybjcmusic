import { useEffect, useRef, type RefObject } from "react";
import type { AudioAnalysis } from "./audio-analysis";
import { signalEnergy } from "./signal-energy";

/** Reference-style bars from real frequency samples, never a fabricated waveform.
 * One RAF; no work in hidden tabs/offscreen, static for reduced motion. */
export function RadioSignal({ active, analysis }: { active: boolean; analysis: RefObject<AudioAnalysis | null> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const playing = useRef(active); playing.current = active;
  useEffect(() => {
    const canvas = ref.current, context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const device = canvas.closest<HTMLElement>(".radio-device");
    const surround = device?.parentElement;
    const surfaces = [device, surround];
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const samples = new Uint8Array(128);
    let frame = 0, visible = true, width = 1, height = 1;
    function draw() {
      frame = 0;
      samples.fill(0);
      if (playing.current && visible && !document.hidden && !reduced.matches) analysis.current?.analyser.getByteFrequencyData(samples);
      const { energy, bass } = signalEnergy(samples);
      // Same RAF/sample buffer drives the surrounding light. Never React-render per frame.
      for (const surface of surfaces) {
        surface?.style.setProperty("--signal-energy", energy.toFixed(3));
        surface?.style.setProperty("--signal-bass", bass.toFixed(3));
      }
      context!.clearRect(0, 0, width, height);
      const bars = Math.min(100, Math.floor(width / 5));
      const step = width / Math.max(bars, 1);
      context!.fillStyle = playing.current ? "#dbdde1" : "#5e6168";
      for (let i = 0; i < bars; i++) {
        // Logarithmic spacing exposes bass/mids rather than repeating made-up peaks.
        const bin = Math.min(127, Math.floor(Math.pow(i / Math.max(bars - 1, 1), 1.8) * 110));
        const level = samples[bin]! / 255;
        const barHeight = 2 + level * (height - 10);
        context!.fillRect(i * step + 1, height - barHeight, Math.max(1, step * .46), barHeight);
      }
      if (playing.current && visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(draw);
    }
    function update() {
      cancelAnimationFrame(frame); frame = 0;
      for (const surface of surfaces) if (surface) surface.dataset.motion = playing.current && visible && !document.hidden && !reduced.matches ? "live" : "still";
      draw();
    }
    const size = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0); update();
    });
    size.observe(canvas);
    const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; update(); });
    intersection.observe(canvas);
    document.addEventListener("visibilitychange", update);
    reduced.addEventListener("change", update);
    canvas.addEventListener("signal-update", update);
    update();
    return () => { for (const surface of surfaces) { surface?.style.removeProperty("--signal-energy"); surface?.style.removeProperty("--signal-bass"); if (surface) delete surface.dataset.motion; } cancelAnimationFrame(frame); size.disconnect(); intersection.disconnect(); document.removeEventListener("visibilitychange", update); reduced.removeEventListener("change", update); canvas.removeEventListener("signal-update", update); };
  }, [analysis]);
  useEffect(() => { ref.current?.dispatchEvent(new Event("signal-update")); }, [active]);
  return <canvas className="radio-signal" ref={ref} aria-hidden="true" />;
}
