import type { CSSProperties, RefObject } from "react";
import type { AudioAnalysis } from "./audio-analysis";
import { Headphones, Heart, ListMusic, Maximize2, MessageCircle, Minimize2, Moon, Pause, Play, RefreshCw, SkipBack, SkipForward, ThumbsDown, Volume2, VolumeX } from "lucide-react";
import type { NowPlayingState, QueueItem, RadioSettings, SetupStatus } from "@emily/shared";
import { Cover, Spinner } from "./components";
import { formatTime, type PlaybackSnapshot } from "./playback";
import { RadioSignal } from "./RadioSignal";
import { HostWordmark } from "./HostWordmark";

type Props = {
  analysis: RefObject<AudioAnalysis | null>;
  now: NowPlayingState | null; queue: QueueItem[]; playback: PlaybackSnapshot; settings: RadioSettings | null; setup: SetupStatus | null;
  loading: boolean; busy: boolean; feedbackBusy: boolean; feedbackKind?: string | undefined; immersive: boolean;
  toggleImmersive: () => void; play: () => void; pause: () => void; next: () => void; previous: () => void;
  seek: (time: number) => void; volume: (volume: number) => void; quiet: () => void; library: () => void; conversation: () => void; roaming: () => void;
  feedback: (kind: "like" | "less_like_this") => void; selectTrack: (id: string) => void; retry: () => void;
};
const statuses = { idle: "READY WHEN YOU ARE", loading: "TUNING IN", playing: "ON AIR", paused: "TAKE YOUR TIME", blocked: "ONE TAP TO CONTINUE", error: "SIGNAL INTERRUPTED", ended: "UNTIL NEXT TIME" };

export function Player(props: Props) {
  const { now, playback, queue, busy } = props;
  const active = playback.status === "playing";
  const wants = playback.wantsPlayback;
  const isDj = playback.phase === "dj";
  const progress = playback.duration ? Math.min(100, playback.time / playback.duration * 100) : 0;
  const remaining = queue.filter((item) => item.status === "pending" || item.status === "resolved").length;
  const quiet = props.settings ? !props.settings.djEnabled : false;
  return <section data-playing={active} data-phase={isDj ? "voice" : "music"} data-busy={busy || playback.status === "loading"} className={`radio-device ${props.immersive ? "immersive-device" : ""}`} aria-label="Emily 个人电台播放器">
    <div className="listening-light" aria-hidden="true" />
    <section className={`host-panel ${active && isDj ? "host-speaking" : ""}`} aria-labelledby="host-name">
      <div className="host-light" aria-hidden="true" />
      <div className="host-topline"><div className="host-identity"><span className="host-avatar" aria-hidden="true">e</span><div><h2 id="host-name"><span className="sr-only">Emily / FM</span><HostWordmark /></h2><span className={`on-air ${active ? "active" : ""}`}><span />{quiet ? "MUSIC ONLY" : active && isDj ? "SPEAKING" : statuses[playback.status]}</span></div></div><button className="host-icon-button" aria-label={props.immersive ? "退出沉浸模式" : "进入沉浸模式"} aria-pressed={props.immersive} onClick={props.toggleImmersive}>{props.immersive ? <Minimize2 size={19} /> : <Maximize2 size={19} />}</button></div>
      <p className="host-subtitle">{quiet ? "Just you and the music." : "A voice between the songs."}</p>
      <RadioSignal active={active} analysis={props.analysis} />
      <span className="host-clock">{formatTime(playback.time)}</span>
    </section>
    <div className="player-paper">
      <div className="programme-heading"><span className="mint-tag"><Headphones size={13} />你的私人频道</span><button className="text-button" onClick={props.conversation}>聊聊想听什么<MessageCircle size={15} /></button></div>
      <h1 className="programme-title" key={now?.programmeTitle || "programme"}>{now?.programmeTitle || (now?.track ? "Your own frequency." : "此刻，\n听你喜欢。")}</h1>
      {!now?.track && <p className="intro-copy">从你的网易云歌单开始。<br />Emily 用英文串起音乐，你只管听。</p>}
      <div className="current-track" key={now?.track?.id || "track"}><Cover title={now?.track?.title || "e"} url={now?.track?.coverUrl} className="current-cover" /><div><h2>{now?.track?.title || (props.loading ? "正在读取电台" : "还没有选择歌曲")}</h2><p>{now?.track?.artist || "这里会显示你真实选择的音乐"}{now?.track?.album && <span> · {now.track.album}</span>}</p></div></div>
      <div className="player-transport"><div className="transport-progress"><div className="progress-label"><span>{isDj ? "英文主持串场" : "歌曲"}</span><span>{formatTime(playback.time)}<i> / </i>{playback.duration ? formatTime(playback.duration) : "–:––"}</span></div><input className="seek-range" type="range" min="0" max={playback.duration || 1} step="0.1" value={Math.min(playback.time, playback.duration || 0)} disabled={!playback.duration || busy} aria-label={isDj ? "主持串场进度" : "歌曲播放进度"} aria-valuetext={`${formatTime(playback.time)} / ${formatTime(playback.duration)}`} onChange={(e) => props.seek(Number(e.target.value))} style={{ "--progress": `${progress}%` } as CSSProperties} /></div>
      <div className="transport-controls"><button className="icon-button skip-button" disabled={!now?.track || busy} aria-label="上一首" onClick={props.previous}><SkipBack size={23} fill="currentColor" /></button><button className="main-play" data-active={wants || active} disabled={props.loading || (!now?.track && !busy)} aria-label={wants || active ? "暂停" : playback.status === "blocked" ? "继续播放" : "播放"} onClick={wants || active ? props.pause : props.play}>{busy && wants ? <span className="play-spinner"><Spinner label="" /></span> : wants || active ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}</button><button className="icon-button skip-button" disabled={!now?.track || busy} aria-label="下一首（不作为不喜欢反馈）" onClick={props.next}><SkipForward size={23} fill="currentColor" /></button></div></div>
      {(playback.message || playback.warning) && <div className={`playback-message ${playback.status === "error" || playback.status === "blocked" ? "needs-action" : ""}`} role={playback.status === "error" ? "alert" : "status"}><p>{playback.message || playback.warning}</p>{playback.status === "error" && now?.track && <button className="text-button" disabled={busy} onClick={props.retry}><RefreshCw size={15} />重新解析</button>}{playback.status === "blocked" && <button className="text-button" onClick={props.play}><Play size={15} />点此继续</button>}</div>}
      <section className="transcript-card" data-speaking={isDj && active} aria-label="Emily 英文主持文案"><div className="transcript-heading"><span className="transcript-dot" /><b>Emily</b><span>{quiet ? "QUIET MODE" : isDj && active ? "SPEAKING" : now?.dj?.status === "tts_ready" ? "VOICE READY" : "TRANSCRIPT"}</span></div>{now?.dj?.text ? <p className="transcript-text" key={now.dj.id} lang="en">{now.dj.text}</p> : <p className="transcript-placeholder">{props.setup?.tts.available ? "节目准备后，英文串场文案会留在这里。" : "主持语音未就绪时也可以听歌；不会用假语音代替。"}</p>}{now?.dj && now.dj.status !== "tts_ready" && <small className="transcript-note">{now.dj.status === "tts_pending" ? "主持音频尚在准备，本次播放不等待。" : now.dj.status === "tts_failed" ? "语音生成失败，目前只有文案。" : "当前仅有文案，没有可播放的主持音频。"}</small>}</section>
      <div className="listening-tools"><div className="feedback-tools"><button className={`icon-button feedback-button ${props.feedbackKind === "less_like_this" ? "selected" : ""}`} disabled={!now?.track || props.feedbackBusy} aria-label="减少类似歌曲（跳过不会自动点踩）" aria-pressed={props.feedbackKind === "less_like_this"} onClick={() => props.feedback("less_like_this")}><ThumbsDown size={15} /></button><button className={`icon-button feedback-button ${props.feedbackKind === "like" ? "selected" : ""}`} disabled={!now?.track || props.feedbackBusy || props.feedbackKind === "like"} aria-label={props.feedbackKind === "like" ? "已喜欢这首歌" : "喜欢这首歌"} aria-pressed={props.feedbackKind === "like"} onClick={() => props.feedback("like")}><Heart size={16} fill={props.feedbackKind === "like" ? "currentColor" : "none"} /></button></div><div className="volume-control">{playback.volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}<input type="range" aria-label="音量" min="0" max="1" step="0.01" value={playback.volume} onChange={(e) => props.volume(Number(e.target.value))} /><output>{Math.round(playback.volume * 100)}%</output></div><button className={`quiet-button ${quiet ? "selected" : ""}`} aria-pressed={quiet} disabled={!props.settings} onClick={props.quiet}><Moon size={15} />安静模式</button></div>
      {now?.warning && <p className="programme-warning" role="status">{now.warning}</p>}
      {now?.roaming && <div className="roaming-control"><button className={`text-button ${now.roaming.enabled?'roaming-active':''}`} aria-pressed={now.roaming.enabled} onClick={props.roaming}>原歌单漫游 · {now.roaming.enabled?'开启':'关闭'}</button><span>{now.roaming.preparing?'正在准备下一批':now.roaming.message||'每批最多12首，本轮不重复'}</span></div>}
      <details className="queue-details"><summary><span><ListMusic size={18} />接下来</span><span>{remaining} 首待播<i className="queue-chevron">⌄</i></span></summary><div className="queue-track-list">{queue.length ? queue.map((item, index) => <button className={`queue-row ${item.track.id === now?.track?.id ? "current" : ""}`} key={item.id} disabled={busy || item.status === "failed"} onClick={() => props.selectTrack(item.track.id)}><span className="queue-index">{String(index + 1).padStart(2, "0")}</span><Cover title={item.track.title} url={item.track.coverUrl} /><span><b>{item.track.title}</b><small>{item.track.artist}{item.reason ? ` · ${item.reason}` : ""}</small></span><small>{item.status === "failed" ? "不可用" : item.status === "played" ? "已播" : item.track.id === now?.track?.id ? "当前" : "待播"}</small></button>) : <p className="muted tiny">还没有队列。先选歌单，或者搜索一首想听的歌。</p>}</div></details>
    </div>
  </section>;
}
