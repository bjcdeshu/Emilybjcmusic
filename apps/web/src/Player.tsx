import { useState, type CSSProperties, type RefObject, type ReactNode } from "react";
import type { AudioAnalysis } from "./audio-analysis";
import { ArrowLeft, Heart, ListMusic, Maximize2, MessageCircle, Minimize2, Music2, Pause, Play, RefreshCw, Settings2, SkipBack, SkipForward } from "lucide-react";
import type { NowPlayingState, QueueItem, RadioSettings, SetupStatus } from "@emily/shared";
import { Spinner } from "./components";
import { hostingFailureMessage, type PlaybackSnapshot } from "./playback";
import { RadioSignal } from "./RadioSignal";
import { RadioSheet } from "./RadioSheet";
import { ListeningText, useLyrics } from "./ListeningText";
import { LyricsReading } from './LyricsReading';
import { SeekControl } from './SeekControl';
import { HostWordmark } from "./HostWordmark";
import { ListeningOptions } from "./ListeningOptions";
import { QueuePanel } from "./QueuePanel";

type Props = {
  analysis: RefObject<AudioAnalysis | null>;
  now: NowPlayingState | null; queue: QueueItem[]; playback: PlaybackSnapshot; settings: RadioSettings | null; setup: SetupStatus | null;
  loading: boolean; busy: boolean; feedbackBusy: boolean; feedbackKind?: string | undefined; immersive: boolean;
  toggleImmersive: () => void; play: () => void; pause: () => void; next: () => void; previous: () => void;
  seek: (time: number) => void; volume: (volume: number) => void; quiet: () => void; library: () => void; conversation: () => void; roaming: () => void;
  feedback: (kind: "like" | "less_like_this") => void; selectTrack: (id: string) => void; retry: () => void;
  skipHosting: () => void; sleep: (mode: 'track' | 15 | 30 | 60 | null) => void;
  queueEditing: boolean; editQueue: (itemId: string, action: 'next' | 'remove') => Promise<boolean>;
  undoNotice: ReactNode; online: boolean;
};
const statuses = { idle: "选一首喜欢的歌", loading: "正在准备", playing: "正在播放", paused: "已暂停", blocked: "点播放继续", error: "播放遇到问题", ended: "本轮已播完" };
type Sheet = "queue" | "hosting" | "lyrics" | "options";
const sheetTitles = { queue: "接下来", hosting: "主持文案", lyrics: "歌词", options: "听感与节目" };
/** Fixed footprint; each stroke reads a distinct measured band from the same RAF. */
function SheetSignal() {
  return <span className="sheet-signal" aria-hidden="true">{[0, 1, 2].map(band => <i key={band} style={{ "--band-level": `var(--signal-band-${band}, 0)` } as CSSProperties} />)}</span>;
}

export function Player(props: Props) {
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const lyricsResult = useLyrics(props.now?.track?.id);
  const { now, playback, queue, busy } = props;
  const active = playback.status === "playing", wants = playback.wantsPlayback, isDj = playback.phase === "dj";
  const currentIndex = queue.findIndex(item => now?.currentItemId ? item.id === now.currentItemId : item.track.id === now?.track?.id);
  const upcoming = queue.slice(currentIndex + 1).filter(item => item.status !== "failed" && item.status !== "played");
  const quiet = props.settings ? !props.settings.djEnabled : false;
  const speech = now?.dj?.text;
  const sourceLabel = queue.some(item => item.requestedBy === "model") ? "模型选曲" : queue.some(item => item.requestedBy === "fallback") ? "歌单选曲" : "你的选曲";
  function controls() {
    return <div className="transport-controls"><button className="icon-button skip-button" disabled={!now?.track || busy} aria-label="上一首" onClick={props.previous}><SkipBack size={23} fill="currentColor" /></button><button className="main-play" data-active={wants || active} disabled={props.loading || (!now?.track && !busy)} aria-label={wants || active ? "暂停" : playback.status === "blocked" ? "继续播放" : "播放"} onClick={wants || active ? props.pause : props.play}>{busy && wants ? <span className="play-spinner"><Spinner label="" /></span> : wants || active ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}</button><button className="icon-button skip-button" disabled={!now?.track || busy} aria-label="下一首（不作为不喜欢反馈）" onClick={props.next}><SkipForward size={23} fill="currentColor" /></button></div>;
  }
  return <section data-playing={active} data-phase={isDj ? "voice" : "music"} data-busy={busy || playback.status === "loading"} className={`radio-device ${props.immersive ? "immersive-device" : ""}`} aria-label="Emily 个人电台播放器">
    <div className="listening-light" aria-hidden="true" />
    <div className="radio-entry"><button className="text-button" onClick={props.library}><ArrowLeft size={18} />节目</button><button className="icon-button" aria-label="听感与节目" onClick={() => setSheet("options")}><Settings2 size={20} /></button></div>
    <section className={`host-panel ${active && isDj ? "host-speaking" : ""}`} aria-labelledby="host-name">
      <div className="host-light" aria-hidden="true" />
      <div className="host-topline"><div className="host-identity"><h2 id="host-name"><span className="sr-only">Emily / FM</span><HostWordmark /></h2><span className={`on-air ${active ? "active" : ""}`} data-speaking={active && isDj}><span aria-hidden="true" /><span className={active ? "sr-only" : ""}>{statuses[playback.status]}</span></span></div><button className="host-icon-button" aria-label={props.immersive ? "退出沉浸模式" : "进入沉浸模式"} aria-pressed={props.immersive} onClick={props.toggleImmersive}>{props.immersive ? <Minimize2 size={19} /> : <Maximize2 size={19} />}</button></div>
      <RadioSignal active={active} analysis={props.analysis} />
    </section>
    <div className="host-preview" data-speaking={isDj && active}>
      <div className="listening-copy" key={`${now?.track?.id}-${playback.phase}`}><ListeningText trackId={now?.track?.id} speech={speech} language={now?.dj?.language || props.settings?.hostLanguage || "zh"} playback={playback} quiet={quiet} covered={sheet !== null} hosting={() => setSheet("hosting")} result={lyricsResult} lyrics={() => setSheet("lyrics")} /></div>
    </div>
    <div className="player-paper">
      <div className="current-track" key={now?.track?.id || "track"}><h1 className="programme-title">{now?.track?.title || (props.loading ? "正在读取电台" : "此刻，听你喜欢。")}</h1><p>{now?.track?.artist || "选一个歌单，或和 Emily 聊聊想听什么。"}</p></div>
      {!now?.track && <button className="text-button empty-programme-action" onClick={props.library}>选择节目<ListMusic size={15} /></button>}
      <div className="player-transport"><SeekControl key={`${now?.track?.id}-${playback.phase}`} time={playback.time} duration={playback.duration} disabled={busy} label={isDj ? '主持串场进度' : '歌曲播放进度'} seek={props.seek} action={isDj ? <button className="skip-hosting" disabled={busy} onClick={event => { event.currentTarget.closest(".player-transport")?.querySelector<HTMLButtonElement>(".main-play")?.focus({preventScroll:true}); props.skipHosting(); }}><Music2 size={14}/>直接听歌</button> : playback.sleep ? <button className="timer-shortcut" onClick={() => setSheet("options")} aria-label="查看定时结束">{playback.sleep.mode === "track" ? "本首播完停止" : `${new Date(playback.sleep.deadline).toLocaleTimeString("zh-CN", {hour:"2-digit",minute:"2-digit"})} 停止`}</button> : null}/>{controls()}</div>
      {(playback.message || playback.warning) && <div className={`playback-message ${playback.status === "error" || playback.status === "blocked" ? "needs-action" : ""}`} role={playback.status === "error" ? "alert" : "status"}><p>{playback.message || playback.warning}</p>{playback.status === "error" && now?.track && <button className="text-button" disabled={busy} onClick={props.retry}><RefreshCw size={15} />重新解析</button>}{playback.status === "blocked" && <button className="text-button" onClick={props.play}><Play size={15} />点此继续</button>}</div>}
      <div className="listening-tools"><button className={`icon-button feedback-button ${props.feedbackKind === "like" ? "selected" : ""}`} disabled={!now?.track || props.feedbackBusy || props.feedbackKind === "like"} aria-label={props.feedbackKind === "like" ? "已喜欢这首歌" : "喜欢这首歌"} aria-pressed={props.feedbackKind === "like"} onClick={() => props.feedback("like")}><Heart size={21} fill={props.feedbackKind === "like" ? "currentColor" : "none"} /></button><button className="text-button" aria-label="聊聊想听什么" onClick={props.conversation}><MessageCircle size={20} />聊聊</button><button className="text-button queue-entry" aria-label={`查看队列，接下来 ${upcoming.length} 首`} onClick={() => setSheet("queue")}><ListMusic size={21} /><span>队列{now?.roaming?.enabled && <i className="roaming-dot" aria-label="漫游已开启" />}</span></button></div>
      {!sheet && props.undoNotice}
      {now?.roaming && (now.roaming.preparing || (!now.roaming.enabled && now.roaming.message)) && <p className="roaming-status" role="status">{now.roaming.preparing ? "正在准备下一批" : now.roaming.message}</p>}
    </div>
    {sheet && <RadioSheet initialCurrent={sheet === 'queue'} title={sheet === 'queue' ? `接下来 · ${upcoming.length} 首待播` : sheetTitles[sheet]} close={() => setSheet(null)} transport={<><SheetSignal /><div className="sheet-track"><b>{now?.track?.title || "还没有节目"}</b><small>{now?.track?.artist}</small></div>{controls()}</>}>{dismiss => <>
      {!props.online && <p className="sheet-warning" role="status">当前网络已断开。已缓冲内容可能继续，重新连接后请手动播放或重试。</p>}
      {props.undoNotice}
      {(playback.message || playback.warning) && <p className={playback.status === 'error' || playback.warning ? 'sheet-warning' : 'sheet-status'} role={playback.status === "error" ? "alert" : "status"}>{playback.message || playback.warning}{playback.status === "error" && <button className="text-button" onClick={props.retry}>重新解析</button>}</p>}
      {sheet === "hosting" && <div className="transcript-card"><p className="transcript-full" lang={now?.dj?.language || props.settings?.hostLanguage || "zh"}>{speech || "当前没有主持文案。"}</p>{now?.dj && now.dj.status !== "tts_ready" && <p className="transcript-note">{now.dj.status === "tts_pending" ? "主持音频尚在准备，本次播放不等待。" : hostingFailureMessage(now.dj, true)}</p>}</div>}
      {sheet === "lyrics" && <LyricsReading key={now?.track?.id} result={lyricsResult} playback={playback} />}
      {sheet === "queue" && <QueuePanel queue={queue} currentIndex={currentIndex} programmeId={now?.programmeId} currentItemId={now?.currentItemId} busy={busy} editing={props.queueEditing} select={props.selectTrack} close={dismiss} edit={props.editQueue}/>}
      {sheet === "options" && <ListeningOptions now={now} playback={playback} quiet={quiet} canSetQuiet={!!props.settings} setQuiet={props.quiet} volume={props.volume} sleep={props.sleep} feedbackKind={props.feedbackKind} feedbackBusy={props.feedbackBusy} less={() => props.feedback("less_like_this")} roaming={props.roaming} sourceLabel={sourceLabel}/>}
    </>}</RadioSheet>}
  </section>;
}
