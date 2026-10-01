import { useEffect, useRef, useState } from "react";
import type { LyricsResponse } from "@emily/shared";
import { api } from "./api";
import type { PlaybackSnapshot } from "./playback";
import { lyricIndex } from "./lyric-position";

type HostingProps = { text: string; language: string; active: boolean; read: () => void };
/** A slow reading aid, NOT a speech timeline. Never distribute words across audio duration. */
export function HostingPreview({ text, language, active, read }: HostingProps) {
  const view = useRef<HTMLSpanElement>(null), content = useRef<HTMLSpanElement>(null);
  const position = useRef(0), manual = useRef(false);
  useEffect(() => {
    position.current = 0; manual.current = false;
    if (content.current) content.current.style.transform = "translateY(0px)";
  }, [text]);
  useEffect(() => {
    const viewport = view.current, body = content.current;
    if (!viewport || !body) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, last = 0, held = 0, hover = false, visible = true;
    function tick(now: number) {
      frame = 0;
      const delta = last ? Math.min(now - last, 100) : 0; last = now; held += delta;
      const max = Math.max(0, body!.scrollHeight - viewport!.clientHeight);
      if (held > 2000 && max > 2) {
        position.current = Math.min(max, position.current + delta * .008);
        body!.style.transform = `translateY(-${position.current.toFixed(2)}px)`;
      }
      if (position.current < max || held < 2000) frame = requestAnimationFrame(tick);
    }
    function update() {
      cancelAnimationFrame(frame); frame = 0; last = 0;
      if (active && visible && !document.hidden && !document.querySelector("dialog[open]") && !reduced.matches && !manual.current && !hover) frame = requestAnimationFrame(tick);
    }
    function stop() { manual.current = true; update(); }
    function enter() { hover = true; update(); }
    function leave() { hover = false; update(); }
    const size = new ResizeObserver(update); size.observe(viewport); size.observe(body);
    const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; update(); });
    intersection.observe(viewport);
    const modal = new MutationObserver(update);
    modal.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
    viewport.addEventListener("wheel", stop, { passive: true });
    viewport.addEventListener("touchstart", stop, { passive: true });
    viewport.parentElement?.addEventListener("focus", enter);
    viewport.parentElement?.addEventListener("blur", leave);
    viewport.addEventListener("mouseenter", enter); viewport.addEventListener("mouseleave", leave);
    document.addEventListener("visibilitychange", update); reduced.addEventListener("change", update); update();
    return () => {
      cancelAnimationFrame(frame); size.disconnect(); intersection.disconnect(); modal.disconnect();
      viewport.removeEventListener("wheel", stop); viewport.removeEventListener("touchstart", stop);
      viewport.parentElement?.removeEventListener("focus", enter); viewport.parentElement?.removeEventListener("blur", leave);
      viewport.removeEventListener("mouseenter", enter); viewport.removeEventListener("mouseleave", leave);
      document.removeEventListener("visibilitychange", update); reduced.removeEventListener("change", update);
    };
  }, [active, text]);
  return <button className="transcript-preview" aria-label="阅读主持全文" onClick={read}><span className="hosting-scroll" ref={view}><span className="transcript-text" lang={language} ref={content}>{text}</span></span></button>;
}

type TextProps = {
  trackId?: string | undefined; speech?: string | undefined; language: string;
  playback: PlaybackSnapshot; quiet: boolean; covered: boolean;
  hosting: () => void; lyrics: (data: LyricsResponse) => void;
};
export function ListeningText({ trackId, speech, language, playback, quiet, covered, hosting, lyrics }: TextProps) {
  const [result, setResult] = useState<{ id: string; data?: LyricsResponse; failed?: boolean } | null>(null);
  const cache = useRef(new Map<string, LyricsResponse>());
  useEffect(() => {
    if (!trackId) { cache.current.clear(); setResult(null); return; }
    const saved = cache.current.get(trackId);
    if (saved) { setResult({ id: trackId, data: saved }); return; }
    setResult(null);
    const cancel = new AbortController();
    api<LyricsResponse>(`/api/music/lyrics/${trackId}`, { signal: cancel.signal }).then(data => {
      if (cancel.signal.aborted || data.trackId !== trackId) return;
      cache.current.set(trackId, data);
      if (cache.current.size > 12) cache.current.delete(cache.current.keys().next().value!);
      setResult({ id: trackId, data });
    }).catch(() => { if (!cancel.signal.aborted) setResult({ id: trackId, failed: true }); });
    return () => cancel.abort();
  }, [trackId]);
  const data = result && result.id === trackId ? result.data : undefined;
  if (playback.phase === "dj" && !quiet && speech) return <HostingPreview text={speech} language={language} active={playback.status === "playing" && !covered} read={hosting} />;
  const index = data?.status === "synced" ? lyricIndex(data.lines, playback.phase === "song" ? playback.time : 0) : -1;
  return <div className="song-text">
    {data?.status === "synced" && playback.phase === "song" ? <button className="lyrics-preview" aria-label="阅读完整歌词" onClick={() => lyrics(data)} data-line={index}>
      <span className="lyric-neighbour">{data.lines[index - 1]?.text || "\u00a0"}</span>
      <span className="lyric-current">{data.lines[index]?.text || "\u00a0"}</span>
      <span className="lyric-neighbour">{data.lines[index + 1]?.text || "\u00a0"}</span>
    </button> : data?.status === "plain" ? <button className="hosting-link" onClick={() => lyrics(data)}>阅读歌词 · 无同步时间</button>
      : <span className="lyrics-note">{result && result.id === trackId && result.failed ? "歌词暂不可用" : data?.status === "instrumental" ? "纯音乐" : data?.status === "missing" ? "暂无歌词" : ""}</span>}
    {speech && <button className="hosting-link hosting-history-link" aria-label="阅读主持全文" onClick={hosting}>主持文案</button>}
  </div>;
}
