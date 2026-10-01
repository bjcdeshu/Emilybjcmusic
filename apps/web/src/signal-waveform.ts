/** RMS of non-overlapping actual time-domain windows. No frequency bias or synthetic peaks. */
export function waveformLevels(samples: Uint8Array, count: number): number[] {
  const bars=Math.max(0,Math.min(Math.floor(count),samples.length));
  return Array.from({length:bars},(_,i)=>{
    const start=Math.floor(i*samples.length/bars),end=Math.floor((i+1)*samples.length/bars);
    let sum=0;for(let n=start;n<end;n++){const amplitude=(samples[n]!-128)/128;sum+=amplitude*amplitude;}
    return Math.min(1,Math.sqrt(sum/Math.max(1,end-start)));
  });
}
/** Spatial averaging then a frame-rate independent envelope. Every output is
 * a weighted history of measured RMS, no oscillators/random/fake beat peaks.
 * Exact silence and all visibility/transport gates reset immediately. */
export function calmWaveform(levels: number[], previous: number[], elapsedMs: number): number[] {
  if (!levels.some(x => x > 0)) return levels.map(() => 0);
  const dt = Math.max(0, Math.min(100, elapsedMs));
  return levels.map((_, i) => {
    let sum = 0, weight = 0;
    for (let n = Math.max(0, i - 3); n <= Math.min(levels.length - 1, i + 3); n++) {
      const w = 4 - Math.abs(n - i); sum += levels[n]! * w; weight += w;
    }
    const measured = sum / weight, last = previous.length === levels.length ? previous[i]! : 0;
    const alpha = 1 - Math.exp(-dt / (measured > last ? 280 : 650));
    return Math.max(0, Math.min(1, last + (measured - last) * alpha));
  });
}
