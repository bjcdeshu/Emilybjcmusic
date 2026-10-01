import { randomUUID } from "node:crypto";
import type { DjSegment, NowPlayingState, PlayerActionResponse, ProgrammeRequest, ProgrammeResponse, QueueItem, RadioSettings } from "@emily/shared";
import type { AppConfig } from "./config.js";
import { AppError } from "./errors.js";
import { NeteaseAdapter } from "./netease.js";
import { hostingLine, ProgrammeSelector } from "./model.js";
import { voiceLanguage, CHINESE_FEMALE_VOICES } from "@emily/shared";
import { isHosting } from "./hosting-language.js";
import { metadataTrack, Store } from "./store.js";
import type { TtsPort } from "./tts.js";

type PreparedItem = QueueItem & { hosting: string; dj?: DjSegment };
type RadioState = {
  status: NowPlayingState["status"]; items: PreparedItem[]; index: number; title?: string;
  warning?: string; startedAt?: string; updatedAt: string;
  roam?: { enabled: boolean; playlistId: string; prompt?: string; limit: number; seen: string[]; offset?: number; message?: string };
};
export class Radio {
  private state: RadioState;
  private busy = false;
  private pauseRevision = 0;
  private audioRevision = 0;
  private closed = false;
  private restartNotice = false;
  private roamRevision = 0;
  private refill: Promise<void> | undefined;
  private refillRevision: number | undefined;
  private readonly intros = new Map<string, Promise<void>>();
  readonly defaults: RadioSettings;
  constructor(private readonly config: AppConfig, private readonly store: Store, readonly music: NeteaseAdapter, readonly selector: ProgrammeSelector, readonly tts: TtsPort, private readonly clock: () => number) {
    this.defaults = { hostLanguage: voiceLanguage(config.voice), voice: config.voice, djEnabled: true, discovery: false, mood: "Easy and unhurried", volume: 0.65 };
    this.state = store.get<RadioState>("radio") || { status: "idle", items: [], index: 0, updatedAt: this.iso() };
    const storedSettings = this.store.settings(this.defaults);
    // David's approved Chinese default supersedes the old English-only version once.
    const migrate = !this.store.get<boolean>("chinese_hosting_v1");
    if (migrate) {
      this.store.transaction(() => {
        if (this.store.get<RadioSettings>("settings")) this.store.set("settings", { ...storedSettings, hostLanguage:"zh", voice:CHINESE_FEMALE_VOICES[0] });
        this.store.set("chinese_hosting_v1", true);
      });
    }
    const language = this.settings().hostLanguage;
    // Repair stored mixed-language scripts and cached speech on upgrade.
    let repaired = false;
    for (const item of this.state.items) {
      if (migrate || !isHosting(item.hosting, language) || (item.dj && (!isHosting(item.dj.text, language) || item.dj.text !== item.hosting || item.dj.language !== language))) {
        if (migrate || !isHosting(item.hosting, language) || (item.dj && item.dj.language !== language)) item.hosting = hostingLine(item.track, undefined, language);
        delete item.dj; repaired = true;
      }
    }
    if (this.state.items.length) {
      this.state.status = "paused";
      this.restartNotice = true;
      this.state.warning = "Playback is paused after a restart. Press play to recheck account access and the track URL.";
    } else this.state.status = "idle";
    delete this.state.startedAt;
    if (repaired) this.persist();
  }
  private iso(): string { return new Date(this.clock()).toISOString(); }
  settings(): RadioSettings { return this.store.settings(this.defaults); }
  updateSettings(patch: Partial<RadioSettings>): RadioSettings {
    const previous = this.settings();
    const voice = patch.voice || (patch.hostLanguage && patch.hostLanguage !== previous.hostLanguage ? patch.hostLanguage === "zh" ? CHINESE_FEMALE_VOICES[0] : "en-US-EmmaMultilingualNeural" : previous.voice);
    if (patch.hostLanguage && patch.hostLanguage !== voiceLanguage(voice)) throw new AppError(400,"INVALID_INPUT","Hosting language must match the selected voice.");
    const settings = { ...previous, ...patch, voice, hostLanguage: voiceLanguage(voice) };
    this.store.set("settings", settings);
    if (settings.voice !== previous.voice || settings.djEnabled !== previous.djEnabled) {
      this.audioRevision++;
      this.prefetch();
    }
    return settings;
  }
  /** Conflicting actions fail clearly, rather than applying stale network results out of order. */
  async exclusive<T>(action: () => Promise<T>): Promise<T> {
    if (this.busy) throw new AppError(409, "RADIO_BUSY", "The radio is preparing another action. Please try again shortly.");
    this.busy = true;
    try { return await action(); } finally { this.busy = false; this.prefetch(); }
  }
  now(): NowPlayingState {
    const current = this.state.items[this.state.index];
    const settings = this.settings();
    return {
      status: this.state.status,
      ...(current ? { track: { ...current.track, audioUrl: `/api/media/track/${current.track.id}` } } : {}),
      ...(current?.dj && settings.djEnabled && current.dj.voice === settings.voice ? { dj: current.dj } : {}),
      queue: this.state.items.map(({ hosting: _hosting, dj: _dj, ...item }) => ({ ...item, track: { ...item.track, ...(item.status !== "failed" ? { audioUrl: `/api/media/track/${item.track.id}` } : {}) } })),
      updatedAt: this.state.updatedAt,
      ...(this.state.roam ? { roaming: { enabled: this.state.roam.enabled, scope: "playlist" as const, preparing: this.state.roam.enabled && !!this.refill && this.refillRevision === this.roamRevision, ...(this.state.roam.message ? { message: this.state.roam.message } : {}) } } : {}),
      ...(this.state.startedAt ? { startedAt: this.state.startedAt } : {}),
      ...(this.state.title ? { programmeTitle: this.state.title } : {}),
      ...(this.state.warning ? { warning: this.state.warning } : {})
      // Real audio-element events own playback progress. No fabricated timer/position is sent.
    };
  }
  private persist(): void {
    this.state.updatedAt = this.iso();
    this.store.set("radio", this.state);
  }
  setRoaming(enabled: boolean): PlayerActionResponse {
    if (!this.state.roam) throw new AppError(409, "ROAMING_SOURCE_REQUIRED", "请先从一个歌单开始节目，才能在原歌单内漫游。");
    this.roamRevision++;
    this.state.roam.enabled = enabled;
    delete this.state.roam.message;
    this.persist();
    if (enabled) this.refillSoon();
    return { now: this.now() };
  }
  clear(): void {
    this.roamRevision++;
    this.audioRevision++;
    this.pauseRevision++;
    this.restartNotice = false;
    this.state = { status: "idle", items: [], index: 0, updatedAt: this.iso() };
    this.persist();
  }
  /** Drain bounded work before SQLite/private media is closed or removed. */
  async close(): Promise<void> {
    this.closed = true;
    this.roamRevision++;
    this.audioRevision++;
    await this.refill;
    await Promise.allSettled(this.intros.values());
  }
  private async intro(item: PreparedItem, revision = this.audioRevision): Promise<void> {
    const settings = this.settings();
    if (this.closed || revision !== this.audioRevision || !settings.djEnabled) return;
    if (!isHosting(item.hosting, settings.hostLanguage)) { item.hosting = hostingLine(item.track, undefined, settings.hostLanguage); delete item.dj; }
    if (item.dj?.voice === settings.voice && item.dj.text === item.hosting && isHosting(item.dj.text, settings.hostLanguage) && item.dj.status !== "tts_failed") return;
    const key = `${revision}:${item.id}:${settings.voice}`;
    const existing = this.intros.get(key);
    if (existing) return existing;
    // At most two jobs, including stale work that has not settled yet.
    if (this.intros.size >= 2) {
      await Promise.race(this.intros.values()).catch(() => undefined);
      return this.intro(item, revision);
    }
    const work = Promise.resolve().then(() => this.tts.segment(item.hosting, settings.voice)).then(segment => {
      if (this.closed || revision !== this.audioRevision) return;
      item.dj = segment;
      if (this.state.items.includes(item)) this.persist();
    }).finally(() => {
      this.intros.delete(key);
      if (!this.busy && (item.dj || revision !== this.audioRevision)) this.prefetch();
    });
    this.intros.set(key, work);
    return work;
  }
  private prefetch(): void {
    this.refillSoon();
    if (this.closed || !this.settings().djEnabled || this.intros.size >= 2) return;
    // One-track lookahead, not an unbounded whole-programme synthesis fan-out.
    const next = this.state.items[this.state.index + 1];
    if (!next || next.dj?.voice === this.settings().voice) return;
    void this.intro(next).catch(() => undefined);
  }
  private refillSoon(): void {
    if (this.closed || !this.state.roam?.enabled || this.refill || this.state.items.length - this.state.index > 3) return;
    const revision = this.roamRevision;
    const source = { ...this.state.roam, seen: [...this.state.roam.seen] };
    this.refillRevision = revision;
    this.refill = this.extend(source, revision).catch(() => {
      if (!this.closed && revision === this.roamRevision && this.state.roam) {
        this.state.roam.enabled = false;
        this.state.roam.message = "漫游准备失败，已保留当前歌曲与队列。可重新开启漫游重试。";
        this.persist();
      }
    }).finally(() => {
      this.refill = undefined; this.refillRevision = undefined;
      // A toggle/replacement can invalidate work while it drains. Retry only the new scope.
      if (revision !== this.roamRevision) this.refillSoon();
    });
  }
  private async extend(source: NonNullable<RadioState["roam"]>, revision: number): Promise<void> {
    const feedback = this.store.feedbackMap();
    const seen = new Set(source.seen);
    if (seen.size >= 1000) {
      if (!this.closed && revision === this.roamRevision && this.state.roam) {
        this.state.roam.enabled = false; this.state.roam.message = "本轮已选1000首，漫游已到安全上限；可重新开始一档节目。"; this.persist();
      }
      return;
    }
    let offset = source.offset || 0;
    let permitted: Awaited<ReturnType<NeteaseAdapter["playlistTracks"]>> = [];
    const started = Date.now();
    for (let page = 0; page < 10 && !permitted.length; page++) {
      if (this.closed || revision !== this.roamRevision) return;
      if (Date.now() - started > 60_000) throw new Error("Roaming retrieval budget");
      const catalogue = await this.music.playlistTracks(source.playlistId, offset);
      const candidates = catalogue.filter(t => !seen.has(t.id) && feedback.get(t.id) !== "less_like_this");
      const playable = candidates.length ? await this.music.playable(candidates.map(t => t.id)) : new Map();
      permitted = candidates.filter(t => playable.has(t.id));
      if (permitted.length || catalogue.length < 100) break;
      offset += 100;
      if (page === 9) throw new Error("Roaming retrieval page budget");
    }
    if (this.closed || revision !== this.roamRevision || !this.state.roam?.enabled) return;
    if (!permitted.length) {
      this.state.roam.enabled = false;
      this.state.roam.message = "原歌单本轮可播放歌曲已听完；不会自动重复或切换其他音源。";
      this.persist(); return;
    }
    const selection = await this.selector.select(permitted, { ...(source.prompt ? { prompt: source.prompt } : {}), limit: Math.min(source.limit, 1000 - seen.size) }, this.settings(), feedback, this.state.title);
    const items: PreparedItem[] = selection.items.map(item => ({ id: randomUUID(), track: metadataTrack(item.track), reason: item.reason, requestedBy: selection.source === "model" ? "model" : "fallback", status: "resolved", hosting: item.hosting }));
    if (items[0]) await this.intro(items[0]);
    if (this.closed || revision !== this.roamRevision || !this.state.roam?.enabled) return;
    // Keep two prior tracks for Back, bounded current/upcoming items, no endless queue.
    const remove = this.busy ? 0 : Math.max(0, this.state.index - 2);
    this.state.items.splice(0, remove); this.state.index -= remove;
    this.state.items.push(...items);
    this.state.roam.offset = offset;
    this.state.roam.seen = [...new Set([...source.seen, ...items.map(i => i.track.id)])];
    this.state.roam.message = selection.source === "model" ? "继续在原歌单内选曲；不会重放本轮已选歌曲。" : "模型暂不可用，按原歌单继续；不是模型选曲。";
    this.persist();
  }
  async programme(request: ProgrammeRequest): Promise<ProgrammeResponse> {
    return this.exclusive(() => this.assemble(request));
  }
  private async assemble(request: ProgrammeRequest): Promise<ProgrammeResponse> {
    this.roamRevision++;
    await this.music.connected();
    const settings = this.settings(), feedback = this.store.feedbackMap();
    let candidates;
    let playlistTitle: string | undefined;
    if (request.trackIds?.length) candidates = await this.music.details(request.trackIds);
    else if (request.playlistId) {
      candidates = await this.music.playlistTracks(request.playlistId);
      playlistTitle = (await this.music.playlists()).find(item => item.id === request.playlistId)?.name;
    } else if (settings.discovery && request.prompt) candidates = await this.music.search(request.prompt);
    else {
      const playlist = (await this.music.playlists()).find(item => item.trackCount !== 0);
      if (!playlist) throw new AppError(409, "EMPTY_LIBRARY", "Your NetEase account has no available playlists. Choose tracks from search or add a playlist.");
      request = { ...request, playlistId: playlist.id };
      candidates = await this.music.playlistTracks(playlist.id);
      playlistTitle = playlist.name;
    }
    if (!request.trackIds?.length) {
      candidates = candidates.filter(track => feedback.get(track.id) !== "less_like_this");
      candidates.sort((a, b) => Number(feedback.get(b.id) === "like") - Number(feedback.get(a.id) === "like"));
    }
    if (!candidates.length) throw new AppError(409, "EMPTY_CATALOGUE", "No tracks are available in the selected catalogue after your preferences.");
    const playable = await this.music.playable(candidates.map(track => track.id));
    const permitted = candidates.filter(track => playable.has(track.id));
    if (!permitted.length) throw new AppError(409, "NO_PLAYABLE_TRACKS", "No full tracks are playable with your NetEase account in this region. VIP, licensing or provider restrictions may apply; no unlock is attempted.");
    const selection = await this.selector.select(permitted, request, settings, feedback, playlistTitle);
    const warnings = [...selection.warnings];
    if (permitted.length < candidates.length) warnings.push(`${candidates.length - permitted.length} catalogue track(s) were excluded because full playback was not authorized or a safe media URL was unavailable.`);
    const items: PreparedItem[] = selection.items.map(item => ({
      id: randomUUID(), track: metadataTrack(item.track), reason: item.reason,
      requestedBy: selection.source === "model" ? "model" : request.trackIds?.length ? "user" : "fallback",
      status: "resolved", hosting: item.hosting
    }));
    this.roamRevision++;
    this.audioRevision++;
    if (settings.djEnabled && items[0]) {
      await this.intro(items[0]);
      if (items[0].dj?.status === "tts_failed" || items[0].dj?.status === "text_only") warnings.push("主持语音暂不可用，文案仍可阅读，音乐可以继续播放。");
    }
    this.restartNotice = false;
    this.state = {
      status: "paused", items, index: 0, title: selection.title, updatedAt: this.iso(),
      ...(request.playlistId ? { roam: { enabled: request.roaming ?? false, playlistId: request.playlistId, limit: request.limit || 6, seen: items.map(i => i.track.id), ...(request.prompt ? { prompt: request.prompt } : {}) } } : {}),
      ...(warnings.length ? { warning: warnings.join(" ") } : {})
    };
    this.store.saveProgramme({ id: randomUUID(), title: selection.title, createdAt: this.iso(), tracks: items.map(item => item.track) }, this.state);
    this.prefetch();
    return { now: this.now(), selectionSource: selection.source, warnings };
  }
  private async prepare(index: number): Promise<void> {
    const current = this.state.items[index];
    if (!current) throw new AppError(409, "QUEUE_EMPTY", "Create a programme before playing music.");
    await this.music.audio(current.track.id);
    await this.intro(current);
    // A voice change during synthesis invalidates the old result; prepare the current voice.
    while (!this.closed && this.settings().djEnabled && current.dj?.voice !== this.settings().voice) {
      await this.intro(current);
    }
    if (this.restartNotice) { delete this.state.warning; this.restartNotice = false; }
    if (this.settings().djEnabled && current.dj?.status !== "tts_ready") this.state.warning = "主持语音暂不可用，实际歌曲仍可播放。";
    current.status = "resolved";
  }
  async play(trackId?: string): Promise<PlayerActionResponse> {
    return this.exclusive(async () => {
      const pauseRevision = this.pauseRevision;
      let index = trackId ? this.state.items.findIndex(item => item.track.id === trackId) : this.state.index;
      if (trackId && index < 0) {
        await this.assemble({ trackIds: [trackId], limit: 1 });
        index = 0;
      }
      if (index >= this.state.items.length && this.state.items.length) index = 0;
      await this.prepare(index);
      this.state.index = index;
      this.state.status = pauseRevision === this.pauseRevision ? "playing" : "paused";
      if (this.state.status === "playing") this.state.startedAt = this.iso();
      else delete this.state.startedAt;
      this.persist();
      this.prefetch();
      return { now: this.now() };
    });
  }
  async pause(): Promise<PlayerActionResponse> {
    // Pause is synchronous transport intent, not a competing network preparation.
    this.pauseRevision++;
    this.state.status = this.state.items[this.state.index] ? "paused" : "idle";
    delete this.state.startedAt;
    this.persist();
    return { now: this.now() };
  }
  async move(direction: 1 | -1): Promise<PlayerActionResponse> {
    return this.exclusive(async () => {
      if (!this.state.items.length) throw new AppError(409, "QUEUE_EMPTY", "Create a programme before advancing the queue.");
      const playing = this.state.status === "playing";
      const pauseRevision = this.pauseRevision;
      const priorIndex = this.state.index;
      if (direction === 1 && priorIndex + 1 >= this.state.items.length) {
        this.refillSoon();
        await this.refill;
      }
      const currentIndex = this.state.index;
      let index = direction === 1 ? currentIndex + 1 : Math.max(0, currentIndex - 1);
      const skipped: string[] = [];
      while (index >= 0 && index < this.state.items.length) {
        try { await this.prepare(index); break; }
        catch (error) {
          if (!(error instanceof AppError) || error.code !== "TRACK_UNPLAYABLE") throw error;
          this.state.items[index]!.status = "failed";
          skipped.push(this.state.items[index]!.track.id);
          index += direction;
        }
      }
      if (currentIndex < this.state.items.length && direction === 1) this.state.items[currentIndex]!.status = "played";
      this.state.index = index;
      this.state.status = index >= 0 && index < this.state.items.length ? playing && pauseRevision === this.pauseRevision ? "playing" : "paused" : "idle";
      delete this.state.startedAt;
      if (this.state.status === "playing") this.state.startedAt = this.iso();
      if (skipped.length) this.state.warning = `${skipped.length} track(s) were skipped because full account playback is no longer available.`;
      else if (this.state.status === "idle") this.state.warning = "End of programme. Choose a new programme or replay a track.";
      if (this.state.roam && this.state.index > 2) {
        const remove = this.state.index - 2;
        this.state.items.splice(0, remove); this.state.index -= remove;
      }
      // Navigation does not write feedback. A skip is never a permanent dislike.
      this.persist();
      this.prefetch();
      return { now: this.now() };
    });
  }
}
