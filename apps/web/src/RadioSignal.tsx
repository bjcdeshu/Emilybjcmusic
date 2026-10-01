import { useEffect, useRef, type RefObject } from "react";
import type { AudioAnalysis } from "./audio-analysis";
import { calmWaveform, waveformLevels } from "./signal-waveform";
import { signalEnergy } from "./signal-energy";

/** Reference-style bars from real time-domain RMS windows; light retains actual frequency energy.
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
    const samples = new Uint8Array(128), waveform = new Uint8Array(256);
    let frame = 0, visible = true, width = 1, height = 1;
    let envelope: number[] = [], lastAt = 0;
    function draw(at = performance.now()) {
      frame = 0;
      const elapsed = lastAt ? at - lastAt : 16; lastAt = at;
      samples.fill(0); waveform.fill(128);
      if (playing.current && visible && !document.hidden && !reduced.matches) {
        analysis.current?.analyser.getByteFrequencyData(samples);
        analysis.current?.analyser.getByteTimeDomainData(waveform);
      }
      const { energy, bass } = signalEnergy(samples);
      const responding = energy > 0 || waveform.some(value => value !== 128);
      for (const surface of surfaces) if (surface) surface.dataset.motion = responding ? "live" : "still";
      // Same RAF/sample buffer drives the surrounding light. Never React-render per frame.
      for (const surface of surfaces) {
        surface?.style.setProperty("--signal-energy", energy.toFixed(3));
        surface?.style.setProperty("--signal-bass", bass.toFixed(3));
      }
      context!.clearRect(0, 0, width, height);
      const bars = Math.max(1, Math.min(40, Math.floor(width / 10)));
      const step = width / Math.max(bars, 1);
      context!.fillStyle = playing.current ? "#a2b5ad" : "#4c5955";
      const measured = waveformLevels(waveform,bars);
      envelope = calmWaveform(measured,envelope,elapsed);
      const levels = envelope;
      for (let i = 0; i < bars; i++) {
        const level = levels[i]!;
        // Fixed perceptual scale reveals quiet real amplitude, still exactly flat at silence.
        const barHeight = 2 + Math.sqrt(level) * (height - 10) * .62;
        context!.fillRect(i * step + step * .32, height - barHeight, Math.max(1, step * .36), barHeight);
      }
      if (playing.current && visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(draw);
    }
    function update() {
      cancelAnimationFrame(frame); frame = 0; lastAt = 0;
      if (!playing.current || !visible || document.hidden || reduced.matches) envelope = [];
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
