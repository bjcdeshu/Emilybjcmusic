import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { chmod, lstat, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GEMINI_HOST_VOICES, GEMINI_PREVIEW_VOICES, VOICE_PREVIEW_SAMPLES, type DjSegment, type VoicePreviewSample } from "@emily/shared";
import type { AppConfig } from "./config.js";
import { AppError, asArray, asRecord } from "./errors.js";
import { privateDirectory } from "./store.js";
import { childEnvironment } from "./tts.js";
import { validateTtsAudio } from "./tts-audio.js";
import { VOICE_SAMPLES } from "./tts-samples.js";
import { isHosting } from "./hosting-language.js";
import type { TtsPort } from "./tts.js";

export const GEMINI_TTS_MODEL = "gemini-3.8-flash-lite-tts";
export const GEMINI_TTS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const VERSION = 2;
const STYLE = "Warm, natural conversational Mandarin. Clear pauses at sentence boundaries, gentle varied emphasis.";
const MAX_JSON_BYTES = 8_000_000;
const MAX_WAV_BYTES = 3_000_000;
export type GeminiPreviewPort = {
  readonly ready: boolean;
  readonly hostingReady?: boolean;
  preview(voice: string, sample: VoicePreviewSample): Promise<DjSegment>;
  close(): Promise<void>;
};
type Dependencies = { fetch?: typeof fetch; convert?: typeof wavToMp3; validate?: typeof validateTtsAudio; readCooldown?: () => number | undefined; saveCooldown?: (until: number) => void };

/** Strict supported unary format only; never guess PCM endianness or prepend a second WAV header. */
export function validateGeminiWav(bytes: Buffer): boolean {
  if (bytes.length < 44 || bytes.length > MAX_WAV_BYTES || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE" || bytes.readUInt32LE(4) + 8 !== bytes.length) return false;
  let offset = 12, fmt = false, data = false;
  while (offset + 8 <= bytes.length) {
    const name = bytes.toString("ascii", offset, offset + 4), length = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (start + length > bytes.length) return false;
    if (name === "fmt ") {
      if (fmt || length < 16 || bytes.readUInt16LE(start) !== 1 || bytes.readUInt16LE(start + 2) !== 1 || bytes.readUInt32LE(start + 4) !== 24000 || bytes.readUInt32LE(start + 8) !== 48000 || bytes.readUInt16LE(start + 12) !== 2 || bytes.readUInt16LE(start + 14) !== 16) return false;
      fmt = true;
    }
    if (name === "data") {
      if (data || length % 2 || length < 12_000 || length > 2_880_000) return false;
      data = true;
    }
    offset = start + length + (length % 2);
  }
  return fmt && data && offset === bytes.length;
}
export function wavToMp3(input: string, output: string, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", ["-nostdin", "-v", "error", "-xerror", "-max_alloc", "33554432", "-protocol_whitelist", "file,pipe", "-threads", "1", "-f", "wav", "-i", input, "-map", "0:a:0", "-map_metadata", "-1", "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "96k", "-n", output],
      { timeout, killSignal: "SIGKILL", maxBuffer: 16_384, windowsHide: true, env: childEnvironment() }, error => error ? reject(new Error("Audio conversion failed")) : resolve());
  });
}

/** Fixed public auditions; bounded final scripts only through the internal TtsPort. */
export class GeminiTtsPreview implements GeminiPreviewPort, TtsPort {
  readonly audioDir: string;
  private readonly pending = new Map<string, Promise<DjSegment>>();
  private readonly verified = new Map<string, string>();
  private closed = false;
  private cooldownUntil = 0;
  constructor(private readonly config: AppConfig, private readonly takeRequest: () => boolean, private readonly clock: () => number = Date.now, private readonly dependencies: Dependencies = {}) {
    this.audioDir = join(config.dataDir, "audio");
    privateDirectory(this.audioDir);
    const saved = dependencies.readCooldown?.();
    if (saved && Number.isFinite(saved)) this.cooldownUntil = Math.min(saved, this.clock() + 86_400_000);
  }
  get ready(): boolean { return !this.closed && this.config.ttsEnabled && !!this.config.geminiTtsKey && this.config.geminiTtsFreeTierConfirmed; }
  get hostingReady(): boolean { return this.ready && this.config.geminiTtsHostingEnabled; }
  async available(voice: string): Promise<boolean> { return this.hostingReady && (GEMINI_HOST_VOICES as readonly string[]).includes(voice); }
  matches(segment: DjSegment, voice: string): boolean { return segment.voice === voice && segment.provider === "gemini" && segment.model === GEMINI_TTS_MODEL && segment.deliveryVersion === VERSION; }
  async close(): Promise<void> { this.closed = true; await Promise.allSettled(this.pending.values()); }
  async segment(text: string, voice: string): Promise<DjSegment> {
    if (!(GEMINI_HOST_VOICES as readonly string[]).includes(voice) || !isHosting(text, "zh") || text.length > 280) throw new AppError(400, "INVALID_TTS_INPUT", "Gemini 主持只接收有界中文朗读稿和已启用的声线。");
    if (!this.hostingReady) return { id: createHash("sha256").update(text + voice).digest("hex"), text, voice, language: "zh", provider: "gemini", model: GEMINI_TTS_MODEL, deliveryVersion: VERSION, status: "text_only", createdAt: new Date(this.clock()).toISOString() };
    try { return await this.synthesize(text, voice, false); }
    catch (error) {
      const code = error instanceof AppError ? error.code : '';
      const failure: NonNullable<DjSegment['failure']> = code === 'GEMINI_TTS_COOLDOWN' || code === 'GEMINI_TTS_RATE_LIMITED' ? { code: 'cooldown', retryAt: new Date(this.cooldownUntil).toISOString() } : { code: code === 'GEMINI_TTS_LIMIT' ? 'local_limit' : code === 'GEMINI_TTS_TIMEOUT' ? 'timeout' : code === 'GEMINI_TTS_BUSY' ? 'busy' : 'unavailable' };
      return { id: this.identity(text, voice), text, voice, language: "zh", provider: "gemini", model: GEMINI_TTS_MODEL, deliveryVersion: VERSION, status: "tts_failed", failure, createdAt: new Date(this.clock()).toISOString() };
    }
  }
  private identity(text: string, voice: string): string { return createHash("sha256").update(JSON.stringify({ provider: "gemini", model: GEMINI_TTS_MODEL, voice: voice.slice(7), language: "zh", style: STYLE, version: VERSION, text, encoding: "wav-pcm24k-mono-to-mp3-96k-v1" })).digest("hex"); }
  async preview(voice: string, sample: VoicePreviewSample): Promise<DjSegment> {
    if (!(GEMINI_PREVIEW_VOICES as readonly string[]).includes(voice) || !(VOICE_PREVIEW_SAMPLES as readonly string[]).includes(sample)) throw new AppError(400, "INVALID_TTS_INPUT", "请选择已有的 Gemini 声线与固定试听段落。");
    if (!this.ready) throw new AppError(503, "GEMINI_TTS_NOT_READY", "Gemini 试听尚未启用：需先确认该项目的免费层。现有主持与歌曲未改变。");
    return this.synthesize(VOICE_SAMPLES.zh[sample], voice, true);
  }
  private async synthesize(text: string, voice: string, audition: boolean): Promise<DjSegment> {
    const nativeVoice = voice.slice(7), id = this.identity(text, voice);
    const existing = this.pending.get(id);
    if (existing) return existing;
    if (this.pending.size >= (audition ? 1 : 2)) throw new AppError(429, "GEMINI_TTS_BUSY", "请等上一段 Gemini 试听准备完成。");
    const segment: DjSegment = { id, text, voice, language: "zh", provider: "gemini", model: GEMINI_TTS_MODEL, deliveryVersion: VERSION, status: "tts_ready", audioUrl: `/api/audio/${id}`, createdAt: new Date(this.clock()).toISOString() };
    const work = this.prepare(segment, nativeVoice).finally(() => { this.pending.delete(id); });
    this.pending.set(id, work);
    return work;
  }
  private async cached(id: string): Promise<boolean> {
    try {
      const file = join(this.audioDir, `${id}.mp3`), stat = await lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 128 || stat.size > 1_000_000) return false;
      const signature = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
      if (this.verified.get(id) === signature) return true;
      if (!await (this.dependencies.validate || validateTtsAudio)(file, childEnvironment())) return false;
      if (this.verified.size >= 128) this.verified.delete(this.verified.keys().next().value!);
      this.verified.set(id, signature);
      return true;
    } catch { return false; }
  }
  private async prune(): Promise<void> {
    const records: { file: string; size: number; time: number }[] = [];
    for (const name of await readdir(this.audioDir)) {
      if (!/^[a-f0-9]{64}\.mp3$/.test(name)) continue;
      const file = join(this.audioDir, name), stat = await lstat(file).catch(() => undefined);
      if (stat?.isFile() && !stat.isSymbolicLink() && !this.pending.has(name.slice(0,64))) records.push({ file, size: stat.size, time: stat.mtimeMs });
    }
    records.sort((a,b) => b.time-a.time); let bytes = 0;
    for (const [index, record] of records.entries()) { bytes += record.size; if (index >= 120 || bytes > 250_000_000 || this.clock()-record.time > 30*86_400_000) await unlink(record.file).catch(() => undefined); }
  }
  private async prepare(segment: DjSegment, nativeVoice: string): Promise<DjSegment> {
    const deadline = Date.now() + 80_000;
    const stem = join(this.audioDir, `${segment.id}.${randomBytes(8).toString("hex")}.partial`), wav = `${stem}.wav`, mp3 = `${stem}.mp3`;
    try {
      if (await this.cached(segment.id)) return segment;
      if (!this.ready) throw new Error();
      if (this.clock() < this.cooldownUntil) throw new AppError(429, "GEMINI_TTS_COOLDOWN", `Google 语音正在冷却；本机在 ${new Date(this.cooldownUntil).toISOString()} 后允许手动再试，不保证供应商届时恢复。不会自动重试或启用付费。`);
      if (!this.takeRequest()) throw new AppError(429, "GEMINI_TTS_LIMIT", "本机 Gemini 语音防护额度暂已用完，请稍后再试；这不是 Google 实际配额说明，不会切换付费服务。");
      await this.prune();
      const timeout = Math.min(this.config.ttsTimeoutMs, 60_000, deadline - Date.now() - 18_000);
      if (timeout <= 0) throw new Error();
      const audio = await this.request(segment.text, nativeVoice, timeout);
      if (!this.ready || !validateGeminiWav(audio)) throw new Error();
      await writeFile(wav, audio, { flag: "wx", mode: 0o600 });
      const conversionTime = Math.min(8000, deadline - Date.now() - 10_000);
      if (conversionTime <= 0) throw new Error();
      await (this.dependencies.convert || wavToMp3)(wav, mp3, conversionTime);
      const stat = await lstat(mp3);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 128 || stat.size > 1_000_000) throw new Error();
      await chmod(mp3, 0o600);
      if (!await (this.dependencies.validate || validateTtsAudio)(mp3, childEnvironment()) || !this.ready || Date.now() > deadline) throw new Error();
      this.verified.delete(segment.id);
      await rename(mp3, join(this.audioDir, `${segment.id}.mp3`));
      return segment;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(503, "GEMINI_TTS_UNAVAILABLE", "Gemini 未返回可用的试听音频，原声线与歌曲未改变。没有自动重试或付费回退。");
    } finally { await Promise.all([unlink(wav).catch(() => undefined), unlink(mp3).catch(() => undefined)]); }
  }
  private async request(text: string, voice: string, timeout: number): Promise<Buffer> {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
    let response: Response | undefined;
    try {
      response = await (this.dependencies.fetch || fetch)(GEMINI_TTS_ENDPOINT, {
        method: "POST", redirect: "error", signal: controller.signal,
        headers: { "x-goog-api-key": this.config.geminiTtsKey!, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ model: GEMINI_TTS_MODEL, store: false, stream: false, input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style: STYLE }] }] }], response_format: { type: "audio" }, generation_config: { speech_config: [{ voice }] } })
      });
      if (response.status === 429) {
        const retry = response.headers.get("retry-after") || "";
        const delay = /^\d+(\.\d+)?$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - this.clock();
        this.cooldownUntil = this.clock() + Math.min(86_400_000, Math.max(60_000, Number.isFinite(delay) ? delay : 0));
        this.dependencies.saveCooldown?.(this.cooldownUntil);
        throw new AppError(429, "GEMINI_TTS_RATE_LIMITED", "Google 的语音额度或速率已达限制，请稍后再试；不会自动重试或启用付费。");
      }
      if (!response.ok || !response.body || !/^application\/json\b/i.test(response.headers.get("content-type") || "")) throw new Error();
      const reader = response.body.getReader(), chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.byteLength; if (size > MAX_JSON_BYTES) throw new Error(); chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      const data = asRecord(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      if (data.status !== "completed") throw new Error();
      const blocks = asArray(data.steps).flatMap(step => { const record = asRecord(step); return record.type === "model_output" ? asArray(record.content).filter(part => asRecord(part).type === "audio") : []; });
      // One complete unary response only; never concatenate partial/gapped audio or fetch returned URLs.
      if (blocks.length !== 1) throw new Error();
      const block = asRecord(blocks[0]), encoded = block.data;
      if (block.mime_type !== "audio/wav" || (block.sample_rate !== undefined && block.sample_rate !== 24000) || typeof encoded !== "string" || encoded.length > Math.ceil(MAX_WAV_BYTES / 3) * 4 || encoded.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(encoded)) throw new Error();
      const bytes = Buffer.from(encoded, "base64");
      if (bytes.toString("base64") !== encoded) throw new Error();
      return bytes;
    } catch (error) {
      if (controller.signal.aborted) throw new AppError(504, "GEMINI_TTS_TIMEOUT", "Gemini 本次准备超时，未获得完整音频。没有自动重试或收费回退；当前歌曲保持暂停，可稍后手动再试。");
      throw error;
    } finally { clearTimeout(timer); await response?.body?.cancel().catch(() => undefined); }
  }
}
