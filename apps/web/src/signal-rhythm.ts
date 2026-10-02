/** Measured, non-overlapping frequency groups. No mirrored peaks or synthetic BPM. */
export function frequencyGroups(samples: Uint8Array, sampleRate: number, count = 24): number[] {
  if (!samples.length || !Number.isFinite(sampleRate) || sampleRate <= 0) return [];
  const hzPerBin = sampleRate / (samples.length * 2);
  const first = Math.max(1, Math.floor(60 / hzPerBin));
  const end = Math.min(samples.length, Math.ceil(10000 / hzPerBin));
  const groups = Math.max(1, Math.min(Math.floor(count), end - first));
  let start = first;
  return Array.from({ length: groups }, (_, i) => {
    const stop = i === groups - 1 ? end : Math.max(start + 1, Math.min(end - (groups - i - 1), Math.round(first * (end / first) ** ((i + 1) / groups))));
    let power = 0;
    for (let bin = start; bin < stop; bin++) power += (samples[bin]! / 255) ** 2;
    const level = Math.sqrt(power / Math.max(1, stop - start)); start = stop;
    return level;
  });
}
export type RhythmState = { levels: number[]; body: number; bass: number; accent: number; lowFloor: number; age: number };
export const quietRhythm = (): RhythmState => ({ levels: [], body: 0, bass: 0, accent: 0, lowFloor: 0, age: 0 });
const follow = (from: number, to: number, dt: number, rise: number, fall: number) => from + (to - from) * (1 - Math.exp(-dt / (to > from ? rise : fall)));
/** Accent = measured low-frequency rise relative to its recent floor, NOT a beat clock.
 * Constant tones settle; quiet never manufactures pulses. Fast restrained attack,
 * smooth release for bars; slower energy envelope for the room. */
export function rhythmFrame(groups: number[], prior: RhythmState, elapsedMs: number, sounding: boolean): RhythmState {
  if (!sounding || !groups.length) return { ...quietRhythm(), levels: groups.map(() => 0) };
  const dt = Math.max(0, Math.min(100, elapsedMs));
  const mean = groups.reduce((sum, x) => sum + x, 0) / groups.length;
  const low = groups.slice(0, Math.min(5, groups.length));
  const bass = low.reduce((sum, x) => sum + x, 0) / low.length;
  const age = prior.age + dt;
  const floor = prior.age ? prior.lowFloor : bass;
  const onset = age < 180 ? 0 : Math.min(.65, Math.max(0, bass - floor - .035) * 2.2);
  return {
    levels: groups.map((x, i) => follow(prior.levels[i] || 0, Math.min(1, Math.max(0, x)), dt, 85, 330)),
    body: follow(prior.body, mean, dt, 900, 1600),
    bass: follow(prior.bass, bass, dt, 160, 550),
    accent: Math.max(onset, prior.accent * Math.exp(-dt / 240)),
    lowFloor: follow(floor, bass, dt, 650, 650), age
  };
}
