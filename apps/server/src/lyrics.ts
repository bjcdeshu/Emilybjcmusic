import type { LyricsResponse } from "@emily/shared";
import { asRecord } from "./errors.js";
/** Bounded real LRC, no invented timestamps. Multi-tags and offset supported. */
export function parseLyrics(trackId: string, body: Record<string, unknown>): LyricsResponse {
  if (body.nolyric === true) return { trackId, status:"instrumental", lines:[] };
  const raw = asRecord(body.lrc).lyric;
  if (typeof raw !== "string" || !raw.trim()) return { trackId,status:"missing",lines:[] };
  if (raw.length > 100_000) throw new Error("Lyrics exceed bounds");
  const offset = Math.max(-60_000, Math.min(60_000, Number(/\[offset:([+-]?\d+)\]/i.exec(raw)?.[1]) || 0));
  const lines: LyricsResponse["lines"] = [], plain: string[] = [];
  for (const row of raw.split(/\r?\n/).slice(0,2000)) {
    const tags=[...row.matchAll(/\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)];
    const text=row.replace(/\[[^\]]*\]/g,"").replace(/[\x00-\x1f\x7f]/g,"").trim().slice(0,500);
    if (text) plain.push(text);
    for(const tag of tags) { const timeMs=Number(tag[1])*60_000+Number(tag[2])*1000+Number((tag[3]||"").padEnd(3,"0"))-offset; if(timeMs<86_400_000)lines.push({timeMs:Math.max(0,timeMs),text}); }
  }
  lines.sort((a,b)=>a.timeMs-b.timeMs);
  const unique=lines.filter((line,i)=>!i||line.timeMs!==lines[i-1]!.timeMs||line.text!==lines[i-1]!.text).slice(0,2000);
  if(unique.some(line=>line.text)) return {trackId,status:"synced",lines:unique};
  return plain.length?{trackId,status:"plain",lines:[],text:plain.join("\n").slice(0,100_000)}:{trackId,status:"missing",lines:[]};
}
