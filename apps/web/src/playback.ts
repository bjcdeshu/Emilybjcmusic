import type { ListeningCheckpoint, NowPlayingState } from "@emily/shared";

export type AudioPhase = "idle" | "dj" | "song" | "preview";
export type SleepTimer = { mode: "track"; itemId: string } | { mode: "time"; deadline: number };
export type AudioStatus = "idle" | "loading" | "playing" | "paused" | "blocked" | "error" | "ended";
export type PlaybackSnapshot = {
  phase: AudioPhase;
  status: AudioStatus;
  time: number;
  duration: number;
  volume: number;
  wantsPlayback: boolean;
  sleep?: SleepTimer | undefined;
  message?: string | undefined;
  warning?: string | undefined;
};
// Auditions must use the exact same speech gain as real hosting.
const phaseGain = (phase: AudioPhase) => phase === "dj" || phase === "preview" ? 0.9 : 1;
export const initialPlayback: PlaybackSnapshot = {
  phase: "idle", status: "idle", time: 0, duration: 0, volume: 0.55, wantsPlayback: false
};

export type AudioPort = Pick<HTMLAudioElement,
  "src" | "currentTime" | "duration" | "volume" | "paused" | "ended" | "error" |
  "load" | "play" | "pause" | "removeAttribute" | "addEventListener" | "removeEventListener"
>;
type PlayerOptions = {
  onChange: (state: PlaybackSnapshot) => void;
  onResolved: (now: NowPlayingState) => void;
  advance: () => Promise<NowPlayingState>;
  sourceUrl: (url?: string) => string | undefined;
  onCheckpoint?: (value: ListeningCheckpoint & { heard?: boolean }, force: boolean) => void;
  onSleep?: () => void;
  clock?: () => number;
};

/** One real audio element; no timer-derived progress or pretend server playback. */
export class RadioAudio {
  private audio: AudioPort;
  private options: PlayerOptions;
  private state = { ...initialPlayback };
  private now: NowPlayingState | null = null;
  private djEnabled = true;
  private generation = 0;
  private sourceRevision = 0;
  private playAttempt = 0;
  private resolving = false;
  private switching = false;
  private destroyed = false;
  private listeners: Array<[string, EventListener]> = [];
  private previewRestore: { url: string; time: number; snapshot: PlaybackSnapshot } | undefined;
  private positionRestore: EventListener | undefined;
  private clearPositionRestore() { if (this.positionRestore) this.audio.removeEventListener("loadedmetadata", this.positionRestore); this.positionRestore = undefined; }

  constructor(audio: AudioPort, options: PlayerOptions) {
    this.audio = audio;
    this.options = options;
    this.listen("timeupdate", () => this.readPosition());
    this.listen("durationchange", () => this.readPosition());
    this.listen("loadedmetadata", () => this.readPosition());
    this.listen("playing", () => {
      if (this.resolving || this.audio.paused || this.audio.ended) return;
      if (!this.state.wantsPlayback) { this.audio.pause(); return; }
      if (this.checkSleep()) return;
      this.switching = false;
      this.emit({ status: "playing", message: undefined });
      this.checkpoint(true, this.state.phase === "song");
    });
    this.listen("pause", () => {
      // Old queued events at a source boundary must not cancel the new stream.
      if (this.switching || this.resolving || this.audio.ended || !this.audio.paused) return;
      if (!["idle", "error", "blocked", "ended"].includes(this.state.status)) {
        this.emit({ status: "paused", wantsPlayback: false });
        this.checkpoint();
      }
    });
    for (const name of ["waiting", "stalled", "seeking"]) {
      this.listen(name, () => {
        if (this.state.wantsPlayback) this.emit({ status: "loading" });
      });
    }
    this.listen("seeked", () => {
      this.readPosition();
      if (!this.audio.paused && this.state.wantsPlayback) this.emit({ status: "playing" });
    });
    this.listen("ended", () => this.ended());
    this.listen("error", () => this.mediaError());
    this.audio.volume = this.state.volume;
  }

  get snapshot() { return { ...this.state }; }
  get current() { return this.now; }

  private listen(name: string, callback: () => void) {
    const listener: EventListener = callback;
    this.listeners.push([name, listener]);
    this.audio.addEventListener(name, listener);
  }

  private emit(patch: Partial<PlaybackSnapshot>) {
    if (this.destroyed) return;
    this.state = { ...this.state, ...patch };
    this.options.onChange(this.snapshot);
  }

  private readPosition() {
    if (this.resolving || this.positionRestore) return;
    if (this.checkSleep()) return;
    const duration = Number.isFinite(this.audio.duration) && this.audio.duration > 0 ? this.audio.duration : 0;
    const time = Number.isFinite(this.audio.currentTime) ? Math.max(0, this.audio.currentTime) : 0;
    this.emit({ duration, time: duration ? Math.min(time, duration) : time });
    if (this.state.status === "playing") this.checkpoint(false);
  }

  private clock() { return (this.options.clock || Date.now)(); }
  checkpoint(force = true, heard = false) {
    if (this.resolving || this.positionRestore || !this.now?.programmeId || !this.now.currentItemId || !["dj", "song"].includes(this.state.phase) || !this.audio.src) return;
    this.options.onCheckpoint?.({ programmeId: this.now.programmeId, itemId: this.now.currentItemId, phase: this.state.phase as "dj" | "song", positionMs: Math.round(Math.max(0, this.audio.currentTime || 0) * 1000), sampledAt: this.clock(), ...(this.state.phase === "dj" && this.now.dj ? { djId: this.now.dj.id } : {}), ...(heard ? { heard: true } : {}) }, force);
  }
  skipHosting() {
    if (this.resolving || this.state.phase !== "dj" || !this.now?.track) return;
    this.source(this.now.track.audioUrl, "song");
    this.checkpoint();
  }
  setSleep(mode: "track" | 15 | 30 | 60 | null) {
    const sleep: SleepTimer | undefined = mode === null ? undefined : mode === "track" ? this.now?.currentItemId ? { mode: "track", itemId: this.now.currentItemId } : undefined : { mode: "time", deadline: this.clock() + mode * 60_000 };
    this.emit({ sleep, message: undefined });
  }
  checkSleep(): boolean {
    const sleep = this.state.sleep;
    if (sleep?.mode !== "time" || this.clock() < sleep.deadline) return false;
    this.finishSleep(); return true;
  }
  private finishSleep() {
    this.emit({ sleep: undefined });
    this.endPreview(); this.pause(); this.checkpoint();
    this.emit({ message: "定时已结束，播放已暂停。" });
    this.options.onSleep?.();
  }

  configure(settings: { volume: number; djEnabled: boolean }) {
    this.setVolume(settings.volume);
    this.setDjEnabled(settings.djEnabled);
  }

  setVolume(value: number) {
    if (!Number.isFinite(value)) return;
    const volume = Math.min(1, Math.max(0, value));
    this.emit({ volume });
    // A small difference, never a second overlapping source or a loud transition.
    this.audio.volume = volume * phaseGain(this.state.phase);
  }

  setDjEnabled(enabled: boolean) {
    this.djEnabled = enabled;
    if (!enabled && this.state.phase === "dj" && this.now?.track) this.skipHosting();
  }

  /** Queue/refill metadata is not transport: never load, play, pause or seek. */
  mergeMetadata(now: NowPlayingState): boolean {
    if (!this.now || this.resolving || now.programmeId !== this.now.programmeId || now.track?.id !== this.now.track?.id || (now.currentItemId && this.now.currentItemId && now.currentItemId !== this.now.currentItemId) || now.updatedAt < this.now.updatedAt) return false;
    this.now = { ...this.now, queue: now.queue, updatedAt: now.updatedAt, ...(now.roaming ? { roaming: now.roaming } : {}) };
    return true;
  }
  /** Use the SAME audio element for a deliberate audition. Ending/stopping
   * restores the previous source/position PAUSED, never resumes music itself. */
  async preview(url: string) {
    if (this.resolving) throw new Error("请等待当前歌曲准备完成再试听。");
    const safe = this.options.sourceUrl(url);
    if (!safe) throw new Error("没有可用的试听音源。");
    this.endPreview();
    this.pause();
    this.previewRestore = { url: this.audio.src, time: this.positionRestore ? this.state.time : this.audio.currentTime, snapshot: this.snapshot };
    this.emit({ wantsPlayback: true });
    this.source(safe, "preview");
  }
  endPreview() {
    const restore = this.previewRestore;
    if (!restore) return;
    this.previewRestore = undefined;
    this.pause();
    const volume = this.state.volume, sleep = this.state.sleep;
    if (restore.snapshot.phase === "dj" && !this.djEnabled && this.now?.track) {
      restore.url = this.options.sourceUrl(this.now.track.audioUrl) || ""; restore.time = 0;
      restore.snapshot = { ...restore.snapshot, phase: "song", time: 0, duration: 0 };
    }
    this.sourceRevision++; this.switching = true;
    this.clearPositionRestore();
    if (restore.url) this.audio.src = restore.url;
    else this.audio.removeAttribute("src");
    this.audio.load();
    this.audio.volume = volume * phaseGain(restore.snapshot.phase);
    const restoreTime = () => {
      this.clearPositionRestore();
      if (this.audio.src !== restore.url || this.previewRestore || this.destroyed) return;
      try { this.audio.currentTime = restore.time; this.readPosition(); } catch { /* Restore stays paused. */ }
    };
    this.positionRestore = restoreTime;
    if (restore.url) this.audio.addEventListener("loadedmetadata", restoreTime, { once: true });
    this.switching = false;
    this.emit({ ...restore.snapshot, volume, sleep, wantsPlayback: false, status: restore.snapshot.phase === "idle" ? "idle" : "paused" });
  }
  /** Restore metadata without autoplay, regardless of the server's playing flag. */
  restore(now: NowPlayingState) {
    this.endPreview();
    this.generation++;
    this.resolving = false;
    this.emit({ wantsPlayback: false });
    this.install(now, now.resume);
  }

  /** Resolve a queue operation; a pause while it is in-flight remains authoritative. */
  async perform(resolve: () => Promise<NowPlayingState>, autoplay = true, resume?: ListeningCheckpoint) {
    this.endPreview();
    const generation = ++this.generation;
    this.playAttempt++;
    this.resolving = true;
    this.switching = true;
    this.audio.pause();
    this.emit({ status: "loading", wantsPlayback: autoplay, time: 0, duration: 0, message: "正在准备歌曲与主持；可以随时暂停。", warning: undefined });
    try {
      const now = await resolve();
      if (this.destroyed || generation !== this.generation) return;
      this.resolving = false;
      this.checkSleep();
      this.install(now, resume);
      this.options.onResolved(now);
    } catch (error) {
      if (this.destroyed || generation !== this.generation) return;
      this.resolving = false;
      this.switching = false;
      this.emit({ status: "error", wantsPlayback: false, message: error instanceof Error ? error.message : "无法准备下一首。" });
    }
  }

  private install(now: NowPlayingState, resume?: ListeningCheckpoint) {
    this.now = now;
    if (this.state.sleep?.mode === "track" && this.state.sleep.itemId !== now.currentItemId) this.emit({ sleep: undefined });
    if (!now.track) {
      const finished = this.state.wantsPlayback;
      this.clearSource();
      this.emit({ phase: "idle", status: finished ? "ended" : "idle", wantsPlayback: false, time: 0, duration: 0, warning: undefined, message: finished ? "这一轮已经播完。选一档新节目继续。" : undefined });
      return;
    }
    const readyDj = this.djEnabled && now.dj?.status === "tts_ready" && this.options.sourceUrl(now.dj.audioUrl);
    const restored = resume && resume.programmeId === now.programmeId && resume.itemId === now.currentItemId && (resume.phase === "song" || (resume.djId === now.dj?.id && readyDj)) ? resume : undefined;
    this.emit({ warning: this.djEnabled && now.dj && !readyDj ? hostingFailureMessage(now.dj) : undefined });
    if (restored?.phase === "song") this.source(now.track.audioUrl, "song", restored.positionMs / 1000);
    else if (readyDj) this.source(readyDj, "dj", restored?.positionMs ? restored.positionMs / 1000 : 0);
    else this.source(now.track.audioUrl, "song");
  }

  private clearSource() {
    this.clearPositionRestore();
    this.sourceRevision++;
    this.switching = true;
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.switching = false;
  }

  private source(url: string | undefined, phase: AudioPhase, position = 0) {
    this.clearPositionRestore();
    const safe = this.options.sourceUrl(url);
    if (!safe) {
      this.clearSource();
      this.emit({ phase, status: "error", wantsPlayback: false, time: 0, duration: 0, message: "没有可播放的音源。请检查账号权限、音乐服务或尝试下一首。" });
      return;
    }
    this.sourceRevision++;
    this.switching = true;
    this.audio.pause();
    this.emit({ phase, status: this.state.wantsPlayback ? "loading" : "paused", time: 0, duration: 0, message: undefined });
    this.audio.src = safe;
    this.audio.volume = this.state.volume * phaseGain(phase);
    if (position > 0) {
      const revision = this.sourceRevision;
      const restore = () => {
        this.clearPositionRestore();
        if (revision !== this.sourceRevision || this.destroyed) return;
        try { this.audio.currentTime = Math.min(position, Number.isFinite(this.audio.duration) ? Math.max(0, this.audio.duration - 0.1) : position); } catch { this.emit({ warning: "音源暂不支持恢复位置，将从当前可用位置继续。" }); }
        this.readPosition();
        if (this.state.wantsPlayback) void this.play();
      };
      this.positionRestore = restore;
      this.audio.addEventListener("loadedmetadata", restore, { once: true });
      this.emit({ time: position });
    }
    this.audio.load();
    if (this.state.wantsPlayback && !this.positionRestore) void this.play();
    else this.switching = false;
  }

  async play() {
    if (this.checkSleep()) return;
    if (this.positionRestore) { this.emit({ wantsPlayback: true, status: "loading", message: undefined }); return; }
    if (this.resolving) {
      this.emit({ wantsPlayback: true, status: "loading", message: undefined });
      return;
    }
    if (this.state.phase === "idle" || !this.audio.src) return;
    const revision = this.sourceRevision;
    const attempt = ++this.playAttempt;
    this.emit({ wantsPlayback: true, status: "loading", message: undefined });
    try {
      await this.audio.play();
      if (this.destroyed || revision !== this.sourceRevision || attempt !== this.playAttempt) return;
      this.switching = false;
      if (!this.state.wantsPlayback) this.audio.pause();
      // Only the actual `playing` event declares success.
    } catch (error) {
      if (this.destroyed || revision !== this.sourceRevision || attempt !== this.playAttempt) return;
      this.switching = false;
      if (!this.state.wantsPlayback) return;
      if (error instanceof Error && error.name === "NotAllowedError") {
        this.emit({ status: "blocked", wantsPlayback: false, message: "Chrome 暂停了自动播放。点播放继续，Emily 不会偷偷开始。" });
      } else if (error instanceof Error && error.name === "AbortError") {
        this.emit({ status: "paused", wantsPlayback: false });
      } else {
        this.mediaError();
      }
    }
  }

  pause() {
    this.playAttempt++;
    this.switching = false;
    this.emit({ wantsPlayback: false, status: this.state.phase === "idle" && !this.resolving ? "idle" : "paused" });
    this.audio.pause();
    this.checkpoint();
  }

  seek(seconds: number) {
    if (!Number.isFinite(seconds) || !this.state.duration || this.resolving) return;
    try {
      this.audio.currentTime = Math.max(0, Math.min(seconds, this.state.duration));
      this.readPosition();
      this.checkpoint();
    } catch {
      this.emit({ warning: "当前音源暂不支持跳转。" });
    }
  }

  private ended() {
    if (this.checkSleep()) return;
    if (this.state.phase === "preview") { this.endPreview(); return; }
    if (!this.state.wantsPlayback || this.resolving) return;
    if (this.state.phase === "dj") {
      this.source(this.now?.track?.audioUrl, "song");
      this.checkpoint();
    } else if (this.state.phase === "song") {
      if (this.state.sleep?.mode === "track" && this.state.sleep.itemId === this.now?.currentItemId) { this.finishSleep(); return; }
      // Advance once from a real ended event, not a guessed duration or interval.
      void this.perform(this.options.advance, true);
    }
  }

  private mediaError() {
    if (this.state.phase === "preview") { this.endPreview(); this.emit({ warning: "声线试听播放失败，音乐已保持暂停。" }); return; }
    if (this.switching && !this.audio.error) return;
    if (this.state.phase === "dj" && this.now?.track) {
      this.emit({ warning: "主持语音播放失败，已转到歌曲。" });
      this.source(this.now.track.audioUrl, "song");
      return;
    }
    this.switching = false;
    this.emit({ status: "error", wantsPlayback: false, message: "音频无法播放。音源可能过期、网络不可用，或当前账号没有播放权限。可重新解析或跳过。" });
  }

  stop() {
    this.previewRestore = undefined;
    this.generation++;
    this.resolving = false;
    this.now = null;
    this.emit({ ...initialPlayback, volume: this.state.volume, sleep: undefined, message: undefined, warning: undefined });
    this.clearSource();
  }

  destroy() {
    this.stop();
    this.destroyed = true;
    for (const [name, listener] of this.listeners) this.audio.removeEventListener(name, listener);
    this.listeners = [];
  }
}

export function hostingFailureMessage(dj: NonNullable<NowPlayingState["dj"]>, details = false) {
  const failure = dj.failure;
  const cooling = failure?.retryAt && Date.parse(failure.retryAt) > Date.now();
  const reason = failure?.code === "cooldown" ? cooling ? "Google 语音正在冷却" : "上次主持遇到 Google 限流，尚未重新验证" : failure?.code === "local_limit" ? "本机语音防护额度暂已用完" : failure?.code === "timeout" ? "本次主持准备超时" : failure?.code === "busy" ? "另一段语音正在准备" : "这段主持语音尚不可用";
  const retry = failure?.retryAt && Date.parse(failure.retryAt) > Date.now() ? `；本机将在 ${new Date(failure.retryAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 后允许再试，不保证供应商已恢复` : "";
  return details ? `${reason}${retry}。可直接听歌，文案仍可阅读；不会自动重试或切换收费服务。` : `${reason}。本次直接听歌，文案仍可阅读。`;
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
