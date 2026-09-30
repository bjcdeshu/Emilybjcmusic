import { execFile } from "node:child_process";
import { basename, join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { chmod, lstat, readdir, rename, unlink } from "node:fs/promises";
import type { DjSegment } from "@emily/shared";
import type { AppConfig } from "./config.js";
import { ENGLISH_FEMALE_VOICES } from "./config.js";
import { privateDirectory } from "./store.js";
import { AppError } from "./errors.js";

export type TtsPort = {
  readonly audioDir: string;
  available(voice: string): Promise<boolean>;
  segment(text: string, voice: string): Promise<DjSegment>;
};
export class EdgeTts implements TtsPort {
  readonly audioDir: string;
  private metadata: Set<string> | undefined;
  private metadataAt = 0;
  private probe: Promise<Set<string>> | undefined;
  private readonly pending = new Map<string, Promise<DjSegment>>();
  private active = 0;
  constructor(private readonly config: AppConfig, private readonly clock: () => number = Date.now) {
    this.audioDir = join(config.dataDir, "audio");
    privateDirectory(this.audioDir);
  }
  private run(args: string[]): Promise<string> {
    const prefix = basename(this.config.ttsCommand) === "uvx" ? ["--from", "edge-tts", "edge-tts"] : [];
    // Do not propagate application credentials to a child process.
    const env: NodeJS.ProcessEnv = {};
    for (const name of ["PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "UV_CACHE_DIR", "SSL_CERT_FILE", "SSL_CERT_DIR", "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY"]) {
      if (process.env[name] !== undefined) env[name] = process.env[name];
    }
    return new Promise((resolve, reject) => {
      execFile(this.config.ttsCommand, [...prefix, ...args], {
        timeout: this.config.ttsTimeoutMs, killSignal: "SIGKILL", maxBuffer: 512_000, windowsHide: true, env
      }, (error, stdout) => {
        if (error) reject(new AppError(503, "TTS_UNAVAILABLE", "English DJ synthesis is currently unavailable."));
        else resolve(stdout);
      });
    });
  }
  private async voices(): Promise<Set<string>> {
    if (this.metadata && this.clock() - this.metadataAt < 600_000) return this.metadata;
    if (!this.probe) this.probe = (async () => {
      const text = await this.run(["--list-voices"]);
      const voices = new Set<string>();
      for (const line of text.split(/\r?\n/)) {
        const [name, gender] = line.trim().split(/\s+/);
        if (name && gender === "Female" && (ENGLISH_FEMALE_VOICES as readonly string[]).includes(name)) voices.add(name);
      }
      this.metadata = voices;
      this.metadataAt = this.clock();
      return voices;
    })().finally(() => { this.probe = undefined; });
    return this.probe;
  }
  async available(voice: string): Promise<boolean> {
    if (!this.config.ttsEnabled || !(ENGLISH_FEMALE_VOICES as readonly string[]).includes(voice)) return false;
    try { return (await this.voices()).has(voice); } catch { return false; }
  }
  async segment(text: string, voice: string): Promise<DjSegment> {
    if (!text.trim() || text.length > 600 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text) || !(ENGLISH_FEMALE_VOICES as readonly string[]).includes(voice)) {
      throw new AppError(400, "INVALID_TTS_INPUT", "DJ text or English female voice is not supported.");
    }
    const id = createHash("sha256").update(JSON.stringify({ v: 1, text, voice, rate: "-4%", volume: "-10%" })).digest("hex");
    const segment: DjSegment = { id, text, voice, language: "en", status: "text_only", createdAt: new Date(this.clock()).toISOString() };
    if (!this.config.ttsEnabled) return segment;
    const cached = await this.cached(id);
    if (cached) return { ...segment, status: "tts_ready", audioUrl: `/api/audio/${id}` };
    const existing = this.pending.get(id);
    if (existing) return existing;
    if (this.active >= 2) return { ...segment, status: "tts_failed" };
    const work = this.generate(segment).finally(() => { this.pending.delete(id); this.active--; });
    this.pending.set(id, work);
    this.active++;
    return work;
  }
  private async cached(id: string): Promise<boolean> {
    try {
      const stat = await lstat(join(this.audioDir, `${id}.mp3`));
      return stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= 10_000_000;
    } catch { return false; }
  }
  private async prune(): Promise<void> {
    const records: { file: string; size: number; time: number }[] = [];
    for (const name of await readdir(this.audioDir)) {
      if (!/^[a-f0-9]{64}\.mp3$/.test(name)) continue;
      const file = join(this.audioDir, name);
      const stat = await lstat(file).catch(() => undefined);
      if (stat?.isFile() && !stat.isSymbolicLink()) records.push({ file, size: stat.size, time: stat.mtimeMs });
    }
    records.sort((a, b) => b.time - a.time);
    let size = 0;
    for (const [index, record] of records.entries()) {
      size += record.size;
      if (index >= 120 || size > 250_000_000 || this.clock() - record.time > 30 * 86_400_000) await unlink(record.file).catch(() => undefined);
    }
  }
  private async generate(segment: DjSegment): Promise<DjSegment> {
    const temporary = join(this.audioDir, `${segment.id}.${randomBytes(8).toString("hex")}.partial.mp3`);
    try {
      if (!(await this.available(segment.voice!))) throw new Error();
      await this.prune();
      await this.run(["--voice", segment.voice!, "--rate=-4%", "--volume=-10%", "--text", segment.text, "--write-media", temporary]);
      const stat = await lstat(temporary);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 128 || stat.size > 10_000_000) throw new Error();
      await chmod(temporary, 0o600);
      await rename(temporary, join(this.audioDir, `${segment.id}.mp3`));
      return { ...segment, status: "tts_ready", audioUrl: `/api/audio/${segment.id}` };
    } catch { return { ...segment, status: "tts_failed" }; }
    finally { await unlink(temporary).catch(() => undefined); }
  }
}
