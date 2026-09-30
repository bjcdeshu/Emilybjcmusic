import { randomBytes } from "node:crypto";
import type { MusicIdentity, MusicQrPollResponse, MusicQrSession, PlaylistSummary, SetupStatus, Track } from "@emily/shared";
import type { AppConfig } from "./config.js";
import { AppError, asArray, asRecord, musicId, safeText } from "./errors.js";
import { postJson } from "./http.js";
import { providerMediaUrl } from "./media.js";
import { Store } from "./store.js";

export type Playable = { id: string; url: string; expiresAt: number };
type QrTicket = {
  owner: string; providerKey: string; expiresAt: number; generation: number; lastPoll: number;
  result: MusicQrPollResponse; polling: Promise<MusicQrPollResponse> | undefined;
};
export class NeteaseAdapter {
  private cookie: string | undefined;
  private identity: MusicIdentity | undefined;
  private verifiedAt = 0;
  private verified = false;
  private verification: Promise<MusicIdentity> | undefined;
  private generation = 0;
  private readonly tickets = new Map<string, QrTicket>();
  private readonly media = new Map<string, Playable>();
  constructor(private readonly config: AppConfig, private readonly store: Store, private readonly clock: () => number) {
    if (!store.get<boolean>("music_disabled")) this.cookie = store.credential() || config.neteaseCookie;
  }
  get configured(): boolean { return !!this.config.neteaseBase; }
  private async call(path: string, params: Record<string, unknown>, cookie: string | undefined | null = this.cookie): Promise<Record<string, unknown>> {
    if (!this.config.neteaseBase) throw new AppError(503, "MUSIC_SETUP_REQUIRED", "Configure a private NetEase API adapter and connect your own account.");
    const body = await postJson(this.config.neteaseBase, path, { ...params, ...(cookie ? { cookie } : {}), noCookie: true, timestamp: this.clock() }, this.config.httpTimeoutMs, this.config.neteaseToken);
    const code = Number(body.code);
    if ([301, 401].includes(code)) {
      this.expireConnection();
      throw new AppError(409, "MUSIC_LOGIN_EXPIRED", "Your NetEase login has expired. Connect your account again.");
    }
    if (Number.isFinite(code) && code >= 400 && ![800, 801, 802, 803].includes(code)) {
      throw new AppError(502, "MUSIC_PROVIDER_ERROR", "NetEase could not complete this request. Access, region or account restrictions may apply.");
    }
    return body;
  }
  private expireConnection(): void {
    this.cookie = undefined; this.identity = undefined; this.verified = false; this.verifiedAt = 0;
    this.store.delete("music_credential"); this.store.delete("music_identity"); this.media.clear();
    this.store.set("music_disabled", true);
    this.generation++;
  }
  private profile(body: Record<string, unknown>): MusicIdentity {
    const data = asRecord(body.data);
    const profile = asRecord(data.profile ?? body.profile);
    const id = musicId(profile.userId);
    const name = safeText(profile.nickname, 80);
    if (!id || !name) throw new AppError(409, "MUSIC_LOGIN_EXPIRED", "Your NetEase login is not valid. Connect your account again.");
    const avatar = providerMediaUrl(profile.avatarUrl);
    return { id, name, ...(avatar ? { avatarUrl: avatar } : {}) };
  }
  async connected(): Promise<MusicIdentity> {
    if (!this.configured) throw new AppError(503, "MUSIC_SETUP_REQUIRED", "Configure a private NetEase API adapter and connect your own account.");
    if (!this.cookie) throw new AppError(409, "MUSIC_LOGIN_REQUIRED", "Connect your own NetEase account to play music.");
    if (this.verified && this.identity && this.clock() - this.verifiedAt < 300_000) return this.identity;
    if (!this.verification) {
      const generation = this.generation;
      this.verification = (async () => {
        try {
          const body = await this.call("login/status", {});
          const identity = this.profile(body);
          if (generation !== this.generation || !this.cookie) throw new AppError(409, "MUSIC_LOGIN_REQUIRED", "Connect your NetEase account again.");
          this.identity = identity; this.verified = true; this.verifiedAt = this.clock();
          this.store.set("music_identity", identity);
          return identity;
        } catch (error) {
          this.verified = false;
          if (error instanceof AppError && error.code === "MUSIC_LOGIN_EXPIRED") this.expireConnection();
          throw error;
        }
      })().finally(() => { this.verification = undefined; });
    }
    return this.verification;
  }
  async status(): Promise<SetupStatus["music"]> {
    if (!this.configured) return { configured: false, connected: false, message: "A private NetEase API adapter is required. No music source is connected." };
    if (!this.cookie) return { configured: true, connected: false, message: this.config.credentialKey ? "Connect your own NetEase account with QR login." : "Configure private credential encryption before QR login, or supply your own account cookie through the application environment." };
    try { return { configured: true, connected: true, user: await this.connected() }; }
    catch (error) { return { configured: true, connected: false, message: error instanceof AppError ? error.message : "The music connection could not be verified." }; }
  }
  disconnect(): void {
    this.expireConnection();
    this.tickets.clear();
  }
  async createQr(owner: string): Promise<MusicQrSession> {
    if (!this.configured) throw new AppError(503, "MUSIC_SETUP_REQUIRED", "Configure a private NetEase API adapter before QR login.");
    if (!this.config.credentialKey) throw new AppError(503, "CREDENTIAL_STORAGE_UNCONFIGURED", "Configure private credential encryption before QR login.");
    if (!this.store.takeRate("qr-create", 3, 60_000, this.clock())) throw new AppError(429, "QR_RATE_LIMITED", "Please wait before creating another QR code.");
    const generation = this.generation;
    const keyBody = await this.call("login/qr/key", {}, null);
    const keyData = asRecord(keyBody.data);
    const rawKey = keyData.unikey ?? asRecord(keyData.data).unikey;
    const providerKey = typeof rawKey === "string" ? rawKey : "";
    if (!/^[a-zA-Z0-9_-]{8,256}$/.test(providerKey)) throw new AppError(502, "MUSIC_QR_FAILED", "NetEase did not return a usable QR login key.");
    const qr = asRecord((await this.call("login/qr/create", { key: providerKey, qrimg: true }, null)).data);
    const image = typeof qr.qrimg === "string" ? qr.qrimg : "";
    let qrUrl: string | undefined;
    try {
      const u = new URL(String(qr.qrurl));
      if (u.origin === "https://music.163.com" && u.pathname === "/login" && u.searchParams.get("codekey") === providerKey && !u.username && !u.password && !u.hash) qrUrl = u.toString();
    } catch { /* No external image or arbitrary link is allowed. */ }
    if (!qrUrl || image.length > 300_000 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image)) throw new AppError(502, "MUSIC_QR_FAILED", "NetEase did not return a safe QR login image.");
    if (generation !== this.generation) throw new AppError(409, "QR_EXPIRED", "This QR login attempt is no longer active.");
    const key = randomBytes(32).toString("hex");
    const expiresAt = this.clock() + 180_000;
    this.tickets.clear();
    this.tickets.set(key, { owner, providerKey, expiresAt, generation, lastPoll: 0, result: { status: "waiting" }, polling: undefined });
    return { key, qrImageUrl: image, qrUrl, expiresAt: new Date(expiresAt).toISOString() };
  }
  async pollQr(key: string, owner: string): Promise<MusicQrPollResponse> {
    const ticket = this.tickets.get(key);
    if (!ticket || ticket.owner !== owner) throw new AppError(404, "QR_NOT_FOUND", "QR login was not found for this owner session.");
    if (ticket.expiresAt <= this.clock() || ticket.generation !== this.generation) return { status: "expired", message: "Create a new QR code to connect." };
    if (ticket.result.status === "connected" || ticket.result.status === "expired") return ticket.result;
    if (ticket.polling) return ticket.polling;
    if (ticket.lastPoll && this.clock() - ticket.lastPoll < 2000) return ticket.result;
    ticket.lastPoll = this.clock();
    ticket.polling = this.pollTicket(ticket).finally(() => { ticket.polling = undefined; });
    return ticket.polling;
  }
  private async pollTicket(ticket: QrTicket): Promise<MusicQrPollResponse> {
    const body = await this.call("login/qr/check", { key: ticket.providerKey }, null);
    if (ticket.expiresAt <= this.clock() || ticket.generation !== this.generation) return { status: "expired" };
    const code = Number(body.code);
    if (code === 800) ticket.result = { status: "expired", message: "QR code expired. Create a new one." };
    else if (code === 801) ticket.result = { status: "waiting" };
    else if (code === 802) ticket.result = { status: "scanned", message: "Confirm this login in your NetEase app." };
    else if (code === 803) {
      const cookie = typeof body.cookie === "string" ? body.cookie : "";
      if (!cookie || cookie.length > 32_768 || /[\r\n\0]/.test(cookie)) throw new AppError(502, "MUSIC_QR_FAILED", "NetEase did not return usable account authorization.");
      const identity = this.profile(await this.call("login/status", {}, cookie));
      if (ticket.generation !== this.generation || ticket.expiresAt <= this.clock()) return { status: "expired" };
      this.store.transaction(() => { this.store.saveCredential(cookie); this.store.set("music_disabled", false); this.store.set("music_identity", identity); });
      this.cookie = cookie; this.identity = identity; this.verified = true; this.verifiedAt = this.clock();
      this.media.clear();
      ticket.result = { status: "connected", user: identity };
    } else throw new AppError(502, "MUSIC_QR_FAILED", "The music provider returned an unknown QR login state.");
    return ticket.result;
  }
  async playlists(): Promise<PlaylistSummary[]> {
    const owner = await this.connected();
    const body = await this.call("user/playlist", { uid: owner.id, limit: 1000, offset: 0 });
    return asArray(body.playlist).flatMap(value => {
      const raw = asRecord(value), id = musicId(raw.id), name = safeText(raw.name, 160);
      if (!id || !name) return [];
      const coverUrl = providerMediaUrl(raw.coverImgUrl);
      const trackCount = typeof raw.trackCount === "number" && raw.trackCount >= 0 ? Math.floor(raw.trackCount) : undefined;
      return [{ id, name, ...(coverUrl ? { coverUrl } : {}), ...(trackCount !== undefined ? { trackCount } : {}) }];
    });
  }
  private tracks(values: unknown): Track[] {
    const tracks = asArray(values).flatMap(value => {
      const raw = asRecord(value), id = musicId(raw.id), title = safeText(raw.name, 180);
      const artist = asArray(raw.ar ?? raw.artists).map(a => safeText(asRecord(a).name, 100)).filter(Boolean).join(" / ").slice(0, 200);
      if (!id || !title || !artist) return [];
      const albumData = asRecord(raw.al ?? raw.album);
      const album = safeText(albumData.name, 160), coverUrl = providerMediaUrl(albumData.picUrl);
      const duration = raw.dt ?? raw.duration;
      const durationMs = typeof duration === "number" && duration > 0 && duration < 86_400_000 ? duration : undefined;
      return [{ id, title, artist, source: "netease" as const, ...(album ? { album } : {}), ...(coverUrl ? { coverUrl } : {}), ...(durationMs ? { durationMs } : {}) }];
    });
    const unique = [...new Map(tracks.map(track => [track.id, track])).values()].slice(0, 100);
    this.store.saveTracks(unique);
    return unique;
  }
  async search(query: string): Promise<Track[]> {
    await this.connected();
    const body = await this.call("cloudsearch", { keywords: query, type: 1, limit: 40, offset: 0 });
    return this.tracks(asRecord(body.result).songs);
  }
  async playlistTracks(id: string): Promise<Track[]> {
    await this.connected();
    // Only select from this account's own/subscribed playlist list.
    if (!(await this.playlists()).some(item => item.id === id)) throw new AppError(404, "PLAYLIST_NOT_FOUND", "That playlist is not in your NetEase library.");
    return this.tracks((await this.call("playlist/track/all", { id, limit: 100, offset: 0 })).songs);
  }
  async details(ids: string[]): Promise<Track[]> {
    await this.connected();
    return this.tracks((await this.call("song/detail", { ids: ids.join(",") })).songs).filter(track => ids.includes(track.id));
  }
  async playable(ids: string[]): Promise<Map<string, Playable>> {
    await this.connected();
    const body = await this.call("song/url/v1", { id: ids.join(","), level: "standard", unblock: "false" });
    const results = new Map<string, Playable>();
    for (const value of asArray(body.data)) {
      const raw = asRecord(value), id = musicId(raw.id);
      if (!id || !ids.includes(id)) continue;
      // A preview is not a full playable track. Never substitute a third-party/unlock URL.
      if ((raw.freeTrialInfo !== undefined && raw.freeTrialInfo !== null && raw.freeTrialInfo !== "null") || (raw.code !== undefined && Number(raw.code) !== 200)) continue;
      const url = providerMediaUrl(raw.url);
      if (!url) continue;
      const ttl = typeof raw.expi === "number" ? Math.min(Math.max(raw.expi * 1000 - 10_000, 1000), 300_000) : 60_000;
      const item = { id, url, expiresAt: this.clock() + ttl };
      results.set(id, item); this.media.set(id, item);
    }
    return results;
  }
  async audio(id: string): Promise<string> {
    await this.connected();
    if (!this.store.track(id)) throw new AppError(404, "TRACK_NOT_FOUND", "Track is not in your current catalogue.");
    const cached = this.media.get(id);
    if (cached && cached.expiresAt > this.clock()) return cached.url;
    const resolved = (await this.playable([id])).get(id);
    if (!resolved) throw new AppError(409, "TRACK_UNPLAYABLE", "This track is not fully playable with your account in this region. No entitlement bypass is used.");
    return resolved.url;
  }
}
