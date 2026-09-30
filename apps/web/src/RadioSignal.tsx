import { useEffect, useRef } from "react";

/** A designed phase indicator, not an audio analyser or timed transcript.
 * One canvas/RAF, paused offscreen, in hidden tabs and for reduced motion. */
export function RadioSignal({ active, phase }: { active: boolean; phase: "voice" | "music" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mode = useRef({ active, phase });
  mode.current = { active, phase };
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, visible = true, last = 0, time = 0, strength = 0;
    let width = 1, height = 1;
    function draw(stamp: number) {
      frame = 0;
      const dt = Math.min(50, Math.max(0, stamp - last)); last = stamp;
      if (!reduced.matches) time += dt / 1000;
      const target = mode.current.active ? 1 : .12;
      strength += (target - strength) * (reduced.matches ? 1 : .12);
      context!.clearRect(0, 0, width, height);
      for (let layer = 0; layer < 3; layer++) {
        context!.beginPath();
        for (let x = 0; x <= width; x += 2) {
          const u = x / width;
          const envelope = Math.pow(Math.sin(u * Math.PI), 1.7);
          const voice = mode.current.phase === "voice";
          const wave = Math.sin(u * Math.PI * (voice ? 7 : 4) - time * (voice ? 2.5 : 1.2) + layer * .55);
          const modulation = .6 + .4 * Math.sin(u * 11 + time * .6 + layer);
          const y = height / 2 + wave * modulation * envelope * height * .38 * strength;
          if (x === 0) context!.moveTo(x, y); else context!.lineTo(x, y);
        }
        context!.strokeStyle = ["rgba(193,236,224,.85)", "rgba(153,179,234,.5)", "rgba(224,213,244,.28)"][layer]!;
        context!.lineWidth = layer === 0 ? 1.7 : 1;
        context!.stroke();
      }
      if (visible && !document.hidden && !reduced.matches && (mode.current.active || Math.abs(strength - target) > .005)) frame = requestAnimationFrame(draw);
    }
    function update() {
      cancelAnimationFrame(frame); frame = 0; last = performance.now();
      if (visible && !document.hidden) draw(last);
    }
    const observer = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0); update();
    });
    observer.observe(canvas);
    const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; update(); });
    intersection.observe(canvas);
    document.addEventListener("visibilitychange", update);
    reduced.addEventListener("change", update);
    // Phase/status changes redraw through a DOM event, without rebuilding observers.
    canvas.addEventListener("signal-update", update);
    update();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect(); document.removeEventListener("visibilitychange", update); reduced.removeEventListener("change", update); canvas.removeEventListener("signal-update", update); };
  }, []);
  useEffect(() => { ref.current?.dispatchEvent(new Event("signal-update")); }, [active, phase]);
  return <canvas className="radio-signal" ref={ref} aria-hidden="true" />;
}
