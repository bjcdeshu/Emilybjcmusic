import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { chmod, lstat, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GEMINI_PREVIEW_VOICES, VOICE_PREVIEW_SAMPLES, type DjSegment, type VoicePreviewSample } from "@emily/shared";
import type { AppConfig } from "./config.js";
import { AppError, asArray, asRecord } from "./errors.js";
import { privateDirectory } from "./store.js";
import { childEnvironment } from "./tts.js";
import { validateTtsAudio } from "./tts-audio.js";
import { VOICE_SAMPLES } from "./tts-samples.js";

export const GEMINI_TTS_MODEL = "gemini-3.8-flash-tts";
export const GEMINI_TTS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const VERSION = 1;
const STYLE = "Speak in natural Mandarin as a warm, curious and understated female radio host. Address one listener, not an audience. Let complete thoughts breathe: a brief pause at clauses, a clear pause at full stops and a little more space before a turn in thought. Use gentle, varied emphasis and natural sentence endings, not a uniform recitation. Keep a conversational pace, neither rushed nor artificially slow. Read only the transcript, without adding words, laughter, sighs or other vocal sounds.";
const MAX_JSON_BYTES = 8_000_000;
const MAX_WAV_BYTES = 3_000_000;
export type GeminiPreviewPort = {
  readonly ready: boolean;
  preview(voice: string, sample: VoicePreviewSample): Promise<DjSegment>;
  close(): Promise<void>;
};
type Dependencies = { fetch?: typeof fetch; convert?: typeof wavToMp3; validate?: typeof validateTtsAudio };

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

/** Audition-only by construction: no arbitrary text, catalogue or listener input. Not a TtsPort. */
export class GeminiTtsPreview implements GeminiPreviewPort {
  private readonly audioDir: string;
  private readonly pending = new Map<string, Promise<DjSegment>>();
  private readonly verified = new Map<string, string>();
  private closed = false;
  private cooldownUntil = 0;
  constructor(private readonly config: AppConfig, private readonly takeRequest: () => boolean, private readonly clock: () => number = Date.now, private readonly dependencies: Dependencies = {}) {
    this.audioDir = join(config.dataDir, "audio");
    privateDirectory(this.audioDir);
  }
  get ready(): boolean { return !this.closed && this.config.ttsEnabled && !!this.config.geminiTtsKey && this.config.geminiTtsFreeTierConfirmed; }
  async close(): Promise<void> { this.closed = true; await Promise.allSettled(this.pending.values()); }
  async preview(voice: string, sample: VoicePreviewSample): Promise<DjSegment> {
    if (!(GEMINI_PREVIEW_VOICES as readonly string[]).includes(voice) || !(VOICE_PREVIEW_SAMPLES as readonly string[]).includes(sample)) throw new AppError(400, "INVALID_TTS_INPUT", "请选择已有的 Gemini 声线与固定试听段落。");
    if (!this.ready) throw new AppError(503, "GEMINI_TTS_NOT_READY", "Gemini 试听尚未启用：需先确认该项目的免费层。现有主持与歌曲未改变。");
    const text = VOICE_SAMPLES.zh[sample], nativeVoice = voice.slice("gemini:".length);
    const id = createHash("sha256").update(JSON.stringify({ provider: "gemini", model: GEMINI_TTS_MODEL, voice: nativeVoice, language: "zh", style: STYLE, version: VERSION, text, encoding: "wav-pcm24k-mono-to-mp3-96k-v1" })).digest("hex");
    const existing = this.pending.get(id);
    if (existing) return existing;
    if (this.pending.size) throw new AppError(429, "GEMINI_TTS_BUSY", "请等上一段 Gemini 试听准备完成。");
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
      if (this.verified.size >= 12) this.verified.delete(this.verified.keys().next().value!);
      this.verified.set(id, signature);
      return true;
    } catch { return false; }
  }
  private async prepare(segment: DjSegment, nativeVoice: string): Promise<DjSegment> {
    const deadline = Date.now() + 80_000;
    const stem = join(this.audioDir, `${segment.id}.${randomBytes(8).toString("hex")}.partial`), wav = `${stem}.wav`, mp3 = `${stem}.mp3`;
    try {
      if (await this.cached(segment.id)) return segment;
      if (!this.ready) throw new Error();
      if (this.clock() < this.cooldownUntil || !this.takeRequest()) throw new AppError(429, "GEMINI_TTS_LIMIT", "本机 Gemini 试听额度暂已用完，请稍后再试；不会切换付费服务。");
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
        body: JSON.stringify({ model: GEMINI_TTS_MODEL, store: false, stream: false, input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style: STYLE }] }] }], response_format: { type: "audio", mime_type: "audio/wav", sample_rate: 24000 }, generation_config: { speech_config: [{ voice }] } })
      });
      if (response.status === 429) {
        const seconds = Number(response.headers.get("retry-after"));
        this.cooldownUntil = this.clock() + Math.min(86_400_000, Math.max(60_000, Number.isFinite(seconds) ? seconds * 1000 : 0));
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
    } finally { clearTimeout(timer); await response?.body?.cancel().catch(() => undefined); }
  }
}
