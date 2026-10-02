import { useState, type CSSProperties, type RefObject } from "react";
import type { AudioAnalysis } from "./audio-analysis";
import { ArrowLeft, Heart, ListMusic, Maximize2, MessageCircle, Minimize2, Moon, Pause, Play, RefreshCw, Settings2, SkipBack, SkipForward, ThumbsDown, Volume2, VolumeX } from "lucide-react";
import type { NowPlayingState, QueueItem, RadioSettings, SetupStatus } from "@emily/shared";
import { Cover, Spinner } from "./components";
import { type PlaybackSnapshot } from "./playback";
import { RadioSignal } from "./RadioSignal";
import { RadioSheet } from "./RadioSheet";
import { ListeningText, useLyrics } from "./ListeningText";
import { LyricsReading } from './LyricsReading';
import { SeekControl } from './SeekControl';
import { HostWordmark } from "./HostWordmark";

type Props = {
  analysis: RefObject<AudioAnalysis | null>;
  now: NowPlayingState | null; queue: QueueItem[]; playback: PlaybackSnapshot; settings: RadioSettings | null; setup: SetupStatus | null;
  loading: boolean; busy: boolean; feedbackBusy: boolean; feedbackKind?: string | undefined; immersive: boolean;
  toggleImmersive: () => void; play: () => void; pause: () => void; next: () => void; previous: () => void;
  seek: (time: number) => void; volume: (volume: number) => void; quiet: () => void; library: () => void; conversation: () => void; roaming: () => void;
  feedback: (kind: "like" | "less_like_this") => void; selectTrack: (id: string) => void; retry: () => void;
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
  const currentIndex = queue.findIndex(item => item.track.id === now?.track?.id);
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
      <ListeningText trackId={now?.track?.id} speech={speech} language={now?.dj?.language || props.settings?.hostLanguage || "zh"} playback={playback} quiet={quiet} covered={sheet !== null} hosting={() => setSheet("hosting")} result={lyricsResult} lyrics={() => setSheet("lyrics")} />
    </div>
    <div className="player-paper">
      <div className="current-track" key={now?.track?.id || "track"}><h1 className="programme-title">{now?.track?.title || (props.loading ? "正在读取电台" : "此刻，听你喜欢。")}</h1><p>{now?.track?.artist || "选一个歌单，或和 Emily 聊聊想听什么。"}</p></div>
      {!now?.track && <button className="text-button empty-programme-action" onClick={props.library}>选择节目<ListMusic size={15} /></button>}
      <div className="player-transport"><SeekControl key={`${now?.track?.id}-${playback.phase}`} time={playback.time} duration={playback.duration} disabled={busy} label={isDj ? '主持串场进度' : '歌曲播放进度'} seek={props.seek}/>{controls()}</div>
      {(playback.message || playback.warning) && <div className={`playback-message ${playback.status === "error" || playback.status === "blocked" ? "needs-action" : ""}`} role={playback.status === "error" ? "alert" : "status"}><p>{playback.message || playback.warning}</p>{playback.status === "error" && now?.track && <button className="text-button" disabled={busy} onClick={props.retry}><RefreshCw size={15} />重新解析</button>}{playback.status === "blocked" && <button className="text-button" onClick={props.play}><Play size={15} />点此继续</button>}</div>}
      <div className="listening-tools"><button className={`icon-button feedback-button ${props.feedbackKind === "like" ? "selected" : ""}`} disabled={!now?.track || props.feedbackBusy || props.feedbackKind === "like"} aria-label={props.feedbackKind === "like" ? "已喜欢这首歌" : "喜欢这首歌"} aria-pressed={props.feedbackKind === "like"} onClick={() => props.feedback("like")}><Heart size={21} fill={props.feedbackKind === "like" ? "currentColor" : "none"} /></button><button className="text-button" aria-label="聊聊想听什么" onClick={props.conversation}><MessageCircle size={20} />聊聊</button><button className="text-button queue-entry" aria-label={`查看队列，接下来 ${upcoming.length} 首`} onClick={() => setSheet("queue")}><ListMusic size={21} /><span>队列{now?.roaming?.enabled && <i className="roaming-dot" aria-label="漫游已开启" />}</span></button></div>
      {now?.roaming && (now.roaming.preparing || (!now.roaming.enabled && now.roaming.message)) && <p className="roaming-status" role="status">{now.roaming.preparing ? "正在准备下一批" : now.roaming.message}</p>}
    </div>
    {sheet && <RadioSheet initialCurrent={sheet === 'queue'} title={sheet === 'queue' ? `接下来 · ${upcoming.length} 首待播` : sheetTitles[sheet]} close={() => setSheet(null)} transport={<><SheetSignal /><div className="sheet-track"><b>{now?.track?.title || "还没有节目"}</b><small>{now?.track?.artist}</small></div>{controls()}</>}>
      {(playback.message || playback.warning) && <p className="sheet-warning" role={playback.status === "error" ? "alert" : "status"}>{playback.message || playback.warning}{playback.status === "error" && <button className="text-button" onClick={props.retry}>重新解析</button>}</p>}
      {sheet === "hosting" && <div className="transcript-card"><p className="transcript-full" lang={now?.dj?.language || props.settings?.hostLanguage || "zh"}>{speech || "当前没有主持文案。"}</p>{now?.dj && now.dj.status !== "tts_ready" && <p className="transcript-note">{now.dj.status === "tts_pending" ? "主持音频尚在准备，本次播放不等待。" : now.dj.status === "tts_failed" ? "语音生成失败，目前只有文案。" : "当前仅有文案，没有可播放的主持音频。"}</p>}</div>}
      {sheet === "lyrics" && <LyricsReading key={now?.track?.id} result={lyricsResult} playback={playback} />}
      {sheet === "queue" && <div className="queue-track-list">{queue.length ? queue.map((item, index) => <button className={`queue-row ${item.track.id === now?.track?.id ? "current" : ""}`} aria-current={item.track.id === now?.track?.id ? "true" : undefined} key={item.id} disabled={busy || item.status === "failed"} onClick={() => { if(item.track.id !== now?.track?.id) props.selectTrack(item.track.id); setSheet(null); }}><span className="queue-index">{String(index + 1).padStart(2, "0")}</span><Cover title={item.track.title} url={item.track.coverUrl} /><span><b>{item.track.title}</b><small>{item.track.artist}{item.reason ? ` · ${item.reason}` : ""}</small></span><small>{item.status === "failed" ? "不可用" : item.status === "played" ? "已播" : item.track.id === now?.track?.id ? "当前" : "待播"}</small></button>) : <p className="muted tiny">还没有队列。先选歌单，或者搜索一首想听的歌。</p>}</div>}
      {sheet === "options" && <div className="listening-option-content"><button className={`quiet-button ${quiet ? "selected" : ""}`} aria-pressed={quiet} disabled={!props.settings} onClick={props.quiet}><Moon size={18} />安静模式</button><div className="volume-control">{playback.volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}<input type="range" aria-label="音量" min="0" max="1" step="0.01" value={playback.volume} onChange={(e) => props.volume(Number(e.target.value))} /><output>{Math.round(playback.volume * 100)}%</output></div><button className={`text-button feedback-button ${props.feedbackKind === "less_like_this" ? "selected" : ""}`} disabled={!now?.track || props.feedbackBusy} aria-label="减少类似歌曲（跳过不会自动点踩）" aria-pressed={props.feedbackKind === "less_like_this"} onClick={() => props.feedback("less_like_this")}><ThumbsDown size={16} />少来一点类似音乐</button>{now?.programmeTitle && <p className="programme-info"><b>{now.programmeTitle}</b><span>{sourceLabel}</span></p>}{now?.track && <p className="programme-info">{now.track.title} — {now.track.artist}</p>}{now?.warning && <p className="programme-warning">{now.warning}</p>}{now?.roaming && <div className="roaming-control"><button className={`text-button ${now.roaming.enabled ? "roaming-active" : ""}`} aria-pressed={now.roaming.enabled} onClick={props.roaming}>原歌单漫游 · {now.roaming.enabled ? "开启" : "关闭"}</button><span>{now.roaming.message || "每批最多12首，本轮不重复"}</span></div>}</div>}
    </RadioSheet>}
  </section>;
}
