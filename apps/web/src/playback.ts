import type { NowPlayingState } from "@emily/shared";

export type AudioPhase = "idle" | "dj" | "song";
export type AudioStatus = "idle" | "loading" | "playing" | "paused" | "blocked" | "error" | "ended";
export type PlaybackSnapshot = {
  phase: AudioPhase;
  status: AudioStatus;
  time: number;
  duration: number;
  volume: number;
  wantsPlayback: boolean;
  message?: string | undefined;
  warning?: string | undefined;
};
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

  constructor(audio: AudioPort, options: PlayerOptions) {
    this.audio = audio;
    this.options = options;
    this.listen("timeupdate", () => this.readPosition());
    this.listen("durationchange", () => this.readPosition());
    this.listen("loadedmetadata", () => this.readPosition());
    this.listen("playing", () => {
      if (this.resolving || this.audio.paused || this.audio.ended) return;
      if (!this.state.wantsPlayback) { this.audio.pause(); return; }
      this.switching = false;
      this.emit({ status: "playing", message: undefined });
    });
    this.listen("pause", () => {
      // Old queued events at a source boundary must not cancel the new stream.
      if (this.switching || this.resolving || this.audio.ended || !this.audio.paused) return;
      if (!["idle", "error", "blocked", "ended"].includes(this.state.status)) {
        this.emit({ status: "paused", wantsPlayback: false });
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
    if (this.resolving) return;
    const duration = Number.isFinite(this.audio.duration) && this.audio.duration > 0 ? this.audio.duration : 0;
    const time = Number.isFinite(this.audio.currentTime) ? Math.max(0, this.audio.currentTime) : 0;
    this.emit({ duration, time: duration ? Math.min(time, duration) : time });
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
    this.audio.volume = volume * (this.state.phase === "dj" ? 0.9 : 1);
  }

  setDjEnabled(enabled: boolean) {
    this.djEnabled = enabled;
    if (!enabled && this.state.phase === "dj" && this.now?.track) {
      this.source(this.now.track.audioUrl, "song");
    }
  }

  /** Restore metadata without autoplay, regardless of the server's playing flag. */
  restore(now: NowPlayingState) {
    this.generation++;
    this.resolving = false;
    this.emit({ wantsPlayback: false });
    this.install(now);
  }

  /** Resolve a queue operation; a pause while it is in-flight remains authoritative. */
  async perform(resolve: () => Promise<NowPlayingState>, autoplay = true) {
    const generation = ++this.generation;
    this.playAttempt++;
    this.resolving = true;
    this.switching = true;
    this.audio.pause();
    this.emit({ status: "loading", wantsPlayback: autoplay, time: 0, duration: 0, message: undefined, warning: undefined });
    try {
      const now = await resolve();
      if (this.destroyed || generation !== this.generation) return;
      this.resolving = false;
      this.install(now);
      this.options.onResolved(now);
    } catch (error) {
      if (this.destroyed || generation !== this.generation) return;
      this.resolving = false;
      this.switching = false;
      this.emit({ status: "error", wantsPlayback: false, message: error instanceof Error ? error.message : "无法准备下一首。" });
    }
  }

  private install(now: NowPlayingState) {
    this.now = now;
    if (!now.track) {
      const finished = this.state.wantsPlayback;
      this.clearSource();
      this.emit({ phase: "idle", status: finished ? "ended" : "idle", wantsPlayback: false, time: 0, duration: 0, warning: undefined, message: finished ? "这一轮已经播完。选一档新节目继续。" : undefined });
      return;
    }
    const readyDj = this.djEnabled && now.dj?.status === "tts_ready" && this.options.sourceUrl(now.dj.audioUrl);
    this.emit({ warning: this.djEnabled && now.dj && !readyDj ? "这段主持语音尚不可用，将直接播放歌曲；文案仍可阅读。" : undefined });
    if (readyDj) this.source(readyDj, "dj");
    else this.source(now.track.audioUrl, "song");
  }

  private clearSource() {
    this.sourceRevision++;
    this.switching = true;
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.switching = false;
  }

  private source(url: string | undefined, phase: AudioPhase) {
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
    this.audio.volume = this.state.volume * (phase === "dj" ? 0.9 : 1);
    this.audio.load();
    if (this.state.wantsPlayback) void this.play();
    else this.switching = false;
  }

  async play() {
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
  }

  seek(seconds: number) {
    if (!Number.isFinite(seconds) || !this.state.duration || this.resolving) return;
    try {
      this.audio.currentTime = Math.max(0, Math.min(seconds, this.state.duration));
      this.readPosition();
    } catch {
      this.emit({ warning: "当前音源暂不支持跳转。" });
    }
  }

  private ended() {
    if (!this.state.wantsPlayback || this.resolving) return;
    if (this.state.phase === "dj") {
      this.source(this.now?.track?.audioUrl, "song");
    } else if (this.state.phase === "song") {
      // Advance once from a real ended event, not a guessed duration or interval.
      void this.perform(this.options.advance, true);
    }
  }

  private mediaError() {
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
    this.generation++;
    this.resolving = false;
    this.now = null;
    this.emit({ ...initialPlayback, volume: this.state.volume, message: undefined, warning: undefined });
    this.clearSource();
  }

  destroy() {
    this.stop();
    this.destroyed = true;
    for (const [name, listener] of this.listeners) this.audio.removeEventListener(name, listener);
    this.listeners = [];
  }
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
