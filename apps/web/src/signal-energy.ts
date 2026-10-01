/** Normalized visual intensity from actual analyser bins, not beat/BPM detection. */
export function signalEnergy(samples: Uint8Array): { energy: number; bass: number } {
  if (!samples.length) return { energy: 0, bass: 0 };
  let total = 0, low = 0;
  const lowCount = Math.min(16, samples.length);
  for (let i = 0; i < samples.length; i++) {
    total += samples[i]!;
    if (i < lowCount) low += samples[i]!;
  }
  return { energy: total / samples.length / 255, bass: low / lowCount / 255 };
}
