import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../src/config.js";
import { EdgeTts } from "../src/tts.js";
import { VOICE_SAMPLES } from "../src/tts-samples.js";

const directory = await mkdtemp(join(process.env.TMPDIR || tmpdir(), "emily-real-edge-check-"));
try {
  const config = loadConfig({ EMILY_DATA_DIR: directory, EMILY_TTS_COMMAND: process.env.EMILY_TTS_COMMAND || "uvx", EMILY_TTS_VOICE: process.env.EMILY_TTS_VOICE, EMILY_TTS_TIMEOUT_MS: "60000" });
  const tts = new EdgeTts(config);
  assert.equal(await tts.available(config.voice), true, "Selected female voice was not found in real Edge metadata");
  const text = VOICE_SAMPLES[config.voice.startsWith("zh-") ? "zh" : "en"].reflective;
  const segment = await tts.segment(text, config.voice);
  assert.equal(segment.status, "tts_ready", "Real Edge synthesis failed");
  const file = join(tts.audioDir, `${segment.id}.mp3`);
  const info = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration,format_name", "-of", "json", file], { encoding: "utf8", timeout: 15000 }));
  assert(Number(info.format.duration) > 0);
  execFileSync("ffmpeg", ["-v", "error", "-i", file, "-f", "null", "-"], { timeout: 15000 });
  const second = await tts.segment(text, config.voice);
  assert.equal(second.id, segment.id);
  console.log(JSON.stringify({ realEdge: true, femaleMetadataVerified: true, voice: config.voice, bytes: (await stat(file)).size, format: info.format.format_name, durationSeconds: Number(info.format.duration), decoded: true, cacheReused: true }));
} finally { await rm(directory, { recursive: true, force: true }); }
