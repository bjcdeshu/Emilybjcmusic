import type { LyricsResponse } from "@emily/shared";

/** Latest actual LRC timestamp at or before the current media position. */
export function lyricIndex(lines: LyricsResponse["lines"], seconds: number): number {
  let lo = 0, hi = lines.length - 1, index = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (lines[mid]!.timeMs <= seconds * 1000) { index = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return index;
}
