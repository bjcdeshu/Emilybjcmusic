import { useEffect, useRef, type RefObject } from "react";
import type { AudioAnalysis } from "./audio-analysis";
import { frequencyGroups, quietRhythm, rhythmFrame } from "./signal-rhythm";

/** One actual analyser, one RAF. All surfaces share measured envelopes, no timed drift. */
export function RadioSignal({ active, analysis }: { active: boolean; analysis: RefObject<AudioAnalysis | null> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const playing = useRef(active); playing.current = active;
  useEffect(() => {
    const canvas = ref.current, context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const device = canvas.closest<HTMLElement>(".radio-device"), surround = device?.parentElement;
    const surfaces = [device, surround], reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let samples = new Uint8Array(1024), waveform = new Uint8Array(2048);
    let frame = 0, visible = true, width = 1, height = 1, lastAt = 0, state = quietRhythm();
    let covered = !!document.querySelector("dialog[open]"), source = "";
    function draw(at = performance.now()) {
      frame = 0;
      const elapsed = lastAt ? at - lastAt : 16; lastAt = at;
      const liveSource = document.querySelector("audio")?.currentSrc || "";
      if (source !== liveSource) { source = liveSource; state = quietRhythm(); }
      const graph = analysis.current;
      if (graph && samples.length !== graph.analyser.frequencyBinCount) {
        samples = new Uint8Array(graph.analyser.frequencyBinCount); waveform = new Uint8Array(graph.analyser.fftSize);
      }
      samples.fill(0); waveform.fill(128);
      const running = playing.current && visible && !document.hidden && !reduced.matches;
      if (running && graph) { graph.analyser.getByteFrequencyData(samples); graph.analyser.getByteTimeDomainData(waveform); }
      const sounding = running && !!graph && waveform.some(value => value !== 128);
      const bars = Math.max(8, Math.min(24, Math.floor(width / 14)));
      const groups = frequencyGroups(samples, graph?.context.sampleRate || 48000, bars);
      state = rhythmFrame(groups, state, elapsed, sounding);
      const voice = device?.dataset.phase === "voice", gain = covered ? .22 : 1;
      for (const surface of surfaces) if (surface) {
        surface.dataset.motion = sounding ? "live" : "still";
        surface.dataset.covered = String(covered);
        surface.style.setProperty("--signal-energy", (state.body * gain).toFixed(3));
        surface.style.setProperty("--signal-bass", (state.bass * gain).toFixed(3));
        surface.style.setProperty("--signal-accent", (state.accent * gain * (voice ? .35 : 1)).toFixed(3));
      }
      if (device) {
        // Raw, gated detail remains available in the foreground sheet; only the
        // covered stage uses attenuated envelopes. Never build a second graph.
        state.detail.forEach((level, band) => device.style.setProperty(`--signal-band-${band}`, level.toFixed(3)));
        device.style.setProperty("--signal-voice", (voice ? state.detail[1]! * gain : 0).toFixed(3));
      }
      context!.clearRect(0, 0, width, height);
      const inset = width * .07, step = (width - inset * 2) / bars;
      for (let i = 0; i < bars; i++) {
        const level = state.levels[i] || 0;
        const edge = Math.min(1, (i + 1) / 4, (bars - i) / 4);
        const barHeight = 2 + level ** 1.35 * (height - 10) * (voice ? .42 : .56);
        context!.fillStyle = `rgba(178,199,190,${((.18 + level * .42) * edge * (covered ? .4 : 1)).toFixed(3)})`;
        const w = Math.max(2, Math.min(3, step * .23));
        context!.beginPath(); context!.roundRect(inset + i * step + (step - w) / 2, height - barHeight - 3, w, barHeight, w / 2); context!.fill();
      }
      if (running) frame = requestAnimationFrame(draw);
    }
    function update() {
      cancelAnimationFrame(frame); frame = 0; lastAt = 0;
      if (!playing.current || !visible || document.hidden || reduced.matches) state = quietRhythm();
      draw();
    }
    const size = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height;
      const ratio = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0); update();
    });
    size.observe(canvas);
    const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; update(); }); intersection.observe(canvas);
    const modal = new MutationObserver(() => { const next = !!document.querySelector("dialog[open]"); if (next !== covered) { covered = next; update(); } });
    modal.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    document.addEventListener("visibilitychange", update); reduced.addEventListener("change", update); canvas.addEventListener("signal-update", update); update();
    return () => {
      for (const surface of surfaces) if (surface) { for (const name of ["energy", "bass", "accent", "voice", "band-0", "band-1", "band-2"]) surface.style.removeProperty(`--signal-${name}`); delete surface.dataset.motion; delete surface.dataset.covered; }
      cancelAnimationFrame(frame); size.disconnect(); intersection.disconnect(); modal.disconnect(); document.removeEventListener("visibilitychange", update); reduced.removeEventListener("change", update); canvas.removeEventListener("signal-update", update);
    };
  }, [analysis]);
  useEffect(() => { ref.current?.dispatchEvent(new Event("signal-update")); }, [active]);
  return <canvas className="radio-signal" ref={ref} aria-hidden="true" />;
}
