import { DatabaseSync } from "node:sqlite";
import { chmodSync, lstatSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { FeedbackRequest, HistoryEntry, RadioSettings, Track } from "@emily/shared";
import { AppError } from "./errors.js";

export function privateDirectory(path: string): void {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  if (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink()) throw new Error("Private data path must be a real directory.");
  chmodSync(path, 0o700);
}
export function metadataTrack(track: Track): Track {
  const { audioUrl: _audio, ...metadata } = track;
  return metadata;
}

export class Store {
  readonly db: DatabaseSync;
  constructor(readonly dir: string, private readonly encryptionKey: Buffer | undefined) {
    privateDirectory(dir);
    const file = join(dir, "emily.sqlite");
    try { if (lstatSync(file).isSymbolicLink()) throw new Error("Database symlinks are not allowed."); }
    catch (err) { if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err; }
    this.db = new DatabaseSync(file);
    chmodSync(file, 0o600);
    this.db.exec(`
      PRAGMA journal_mode=DELETE;
      PRAGMA foreign_keys=ON;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, owner_hash TEXT NOT NULL, expires INTEGER NOT NULL, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, start INTEGER NOT NULL, count INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS tracks (id TEXT PRIMARY KEY, metadata TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS programmes (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL, tracks TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS feedback (track_id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('like','less_like_this')), created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
      PRAGMA user_version=1;
    `);
  }
  close(): void { this.db.close(); }
  get<T>(key: string): T | undefined {
    const row = this.db.prepare("SELECT value FROM kv WHERE key=?").get(key);
    return row ? JSON.parse(String(row.value)) as T : undefined;
  }
  set(key: string, value: unknown): void {
    this.db.prepare("INSERT INTO kv(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, JSON.stringify(value));
  }
  delete(key: string): void { this.db.prepare("DELETE FROM kv WHERE key=?").run(key); }
  transaction(fn: () => void): void {
    this.db.exec("BEGIN IMMEDIATE");
    try { fn(); this.db.exec("COMMIT"); }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  saveTracks(tracks: Track[]): void {
    const statement = this.db.prepare("INSERT INTO tracks(id,metadata) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET metadata=excluded.metadata");
    this.transaction(() => { for (const track of tracks) statement.run(track.id, JSON.stringify(metadataTrack(track))); });
  }
  track(id: string): Track | undefined {
    const row = this.db.prepare("SELECT metadata FROM tracks WHERE id=?").get(id);
    return row ? JSON.parse(String(row.metadata)) as Track : undefined;
  }
  saveProgramme(entry: HistoryEntry, state: unknown): void {
    this.transaction(() => {
      this.db.prepare("INSERT INTO programmes(id,title,created_at,tracks) VALUES (?,?,?,?)").run(
        entry.id, entry.title, entry.createdAt, JSON.stringify(entry.tracks.map(metadataTrack))
      );
      this.set("radio", state);
      this.db.exec("DELETE FROM programmes WHERE id NOT IN (SELECT id FROM programmes ORDER BY created_at DESC LIMIT 100)");
    });
  }
  history(): HistoryEntry[] {
    return this.db.prepare("SELECT id,title,created_at,tracks FROM programmes ORDER BY created_at DESC LIMIT 50").all().map(row => ({
      id: String(row.id), title: String(row.title), createdAt: String(row.created_at), tracks: JSON.parse(String(row.tracks)) as Track[]
    }));
  }
  feedback(input: FeedbackRequest, now: number): void {
    this.db.prepare("INSERT INTO feedback(track_id,kind,created_at) VALUES (?,?,?) ON CONFLICT(track_id) DO UPDATE SET kind=excluded.kind,created_at=excluded.created_at")
      .run(input.trackId, input.kind, new Date(now).toISOString());
  }
  feedbackMap(): Map<string, FeedbackRequest["kind"]> {
    return new Map(this.db.prepare("SELECT track_id,kind FROM feedback").all().map(row => [String(row.track_id), String(row.kind) as FeedbackRequest["kind"]]));
  }
  settings(defaults: RadioSettings): RadioSettings { return this.get<RadioSettings>("settings") || defaults; }
  putSession(hash: string, ownerHash: string, expires: number, now: number): void {
    this.db.prepare("DELETE FROM sessions WHERE expires<=? OR owner_hash!=?").run(now, ownerHash);
    this.db.prepare("INSERT INTO sessions(hash,owner_hash,expires,created) VALUES (?,?,?,?)").run(hash, ownerHash, expires, now);
    this.db.exec("DELETE FROM sessions WHERE hash NOT IN (SELECT hash FROM sessions ORDER BY created DESC LIMIT 5)");
  }
  validSession(hash: string, ownerHash: string, now: number): boolean {
    this.db.prepare("DELETE FROM sessions WHERE expires<=?").run(now);
    return !!this.db.prepare("SELECT hash FROM sessions WHERE hash=? AND owner_hash=? AND expires>?").get(hash, ownerHash, now);
  }
  deleteSession(hash: string): void { this.db.prepare("DELETE FROM sessions WHERE hash=?").run(hash); }
  /** Durable fixed windows; bounded both per-IP and globally, even after restart. */
  takeRate(key: string, maximum: number, windowMs: number, now: number): boolean {
    this.db.prepare("DELETE FROM rate_limits WHERE start<?").run(now - Math.max(windowMs, 86_400_000));
    const row = this.db.prepare("SELECT start,count FROM rate_limits WHERE key=?").get(key);
    if (!row || Number(row.start) + windowMs <= now) {
      this.db.prepare("INSERT INTO rate_limits(key,start,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET start=excluded.start,count=1").run(key, now);
      return true;
    }
    if (Number(row.count) >= maximum) return false;
    this.db.prepare("UPDATE rate_limits SET count=count+1 WHERE key=?").run(key);
    return true;
  }
  saveCredential(cookie: string): void {
    if (!this.encryptionKey) throw new AppError(503, "CREDENTIAL_STORAGE_UNCONFIGURED", "Configure private credential encryption before connecting NetEase.");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
    cipher.setAAD(Buffer.from("emily-netease-cookie-v1"));
    const encrypted = Buffer.concat([cipher.update(cookie, "utf8"), cipher.final()]);
    this.set("music_credential", { v: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") });
  }
  credential(): string | undefined {
    if (!this.encryptionKey) return undefined;
    const record = this.get<{ v: number; iv: string; tag: string; data: string }>("music_credential");
    if (!record || record.v !== 1) return undefined;
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey, Buffer.from(record.iv, "base64"));
      decipher.setAAD(Buffer.from("emily-netease-cookie-v1"));
      decipher.setAuthTag(Buffer.from(record.tag, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(record.data, "base64")), decipher.final()]).toString("utf8");
    } catch { return undefined; }
  }
}
