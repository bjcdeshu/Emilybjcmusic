import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GEMINI_PREVIEW_VOICES, type DjSegment } from "@emily/shared";
import { loadConfig } from "../src/config.js";
import { GEMINI_TTS_ENDPOINT, GEMINI_TTS_MODEL, GeminiTtsPreview, validateGeminiWav } from "../src/gemini-tts.js";
import { VOICE_SAMPLES } from "../src/tts-samples.js";
import { buildApp } from "../src/app.js";
import { FixtureTts, headers, login, ORIGIN, OWNER_PASSWORD } from "./helpers.js";

const KEY = "TEST_ONLY_GEMINI_KEY_NOT_A_CREDENTIAL";
const readyConfig = (dir: string) => loadConfig({ EMILY_DATA_DIR: dir, EMILY_GEMINI_TTS_API_KEY: KEY, EMILY_GEMINI_TTS_FREE_TIER_CONFIRMED: "true" });
function wavFixture() {
  // Explicit synthetic tone fixture, not real speech.
  const data = Buffer.alloc(48_000); for (let i = 0; i < 24000; i++) data.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 330 / 24000) * 8000), i * 2);
  const header = Buffer.alloc(44); header.write("RIFF"); header.writeUInt32LE(data.length + 36, 4); header.write("WAVEfmt ", 8); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(24000, 24); header.writeUInt32LE(48000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(data.length, 40); return Buffer.concat([header, data]);
}
const response = (bytes = wavFixture()) => Response.json({ status: "completed", steps: [{ type: "model_output", content: [{ type: "audio", mime_type: "audio/wav", data: bytes.toString("base64") }] }] });
const directory = () => mkdtemp(join(process.env.TMPDIR || tmpdir(), "emily-gemini-test-"));
const dummyConvert = async (_i: string, output: string) => { await writeFile(output, Buffer.alloc(256, 1)); };

test("Gemini preview fails closed without both dedicated key and confirmed free tier; no guessed provider or voice", async () => {
  const dir = await directory(); let calls = 0;
  try {
    assert.equal(loadConfig({}).geminiTtsFreeTierConfirmed, false);
    assert.throws(() => loadConfig({ EMILY_GEMINI_TTS_FREE_TIER_CONFIRMED: "yes" }));
    assert.throws(() => loadConfig({ EMILY_GEMINI_TTS_API_KEY: "key=value\n" }));
    for (const env of [{}, { EMILY_GEMINI_TTS_API_KEY: KEY }, { EMILY_GEMINI_TTS_FREE_TIER_CONFIRMED: "true" }]) {
      const client = new GeminiTtsPreview(loadConfig({ ...env, EMILY_DATA_DIR: dir }), () => { calls++; return true; });
      assert.equal(client.ready, false);
      await assert.rejects(client.preview(GEMINI_PREVIEW_VOICES[0], "transition"), (e: {code?: string}) => e.code === "GEMINI_TTS_NOT_READY");
      await client.close();
    }
    const client = new GeminiTtsPreview(readyConfig(dir), () => { calls++; return true; });
    await assert.rejects(client.preview("zh-CN-XiaoyiNeural", "transition"));
    await assert.rejects(client.preview(GEMINI_PREVIEW_VOICES[0], "private text" as never));
    assert.equal(calls, 0); await client.close();
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("Gemini fixed samples use official stateless Interactions, separate delivery metadata, real WAV-to-MP3 decode/cache and deduplication", async () => {
  const dir = await directory(); let calls = 0, reservations = 0, captured: RequestInit | undefined, endpoint: unknown;
  const config = readyConfig(dir);
  config.modelKey = "TEST_ONLY_PRIVATE_WRITER_KEY"; config.neteaseCookie = "TEST_ONLY_COOKIE";
  const client = new GeminiTtsPreview(config, () => { reservations++; return true; }, Date.now, { fetch: async (url, init) => { calls++; endpoint = url; captured = init; return response(); } });
  try {
    const [a, b] = await Promise.all([client.preview("gemini:Sulafat", "reflective"), client.preview("gemini:Sulafat", "reflective")]);
    assert.equal(a.id, b.id); assert.equal(a.status, "tts_ready"); assert.equal(a.language, "zh"); assert.equal(a.model, GEMINI_TTS_MODEL); assert.equal(a.provider, "gemini"); assert.equal(calls, 1); assert.equal(reservations, 1);
    assert.equal(endpoint, GEMINI_TTS_ENDPOINT); assert.equal(captured!.redirect, "error");
    assert.deepEqual(captured!.headers, { "x-goog-api-key": KEY, "Content-Type": "application/json", Accept: "application/json" });
    const body = JSON.parse(String(captured!.body));
    assert.equal(body.store, false); assert.equal(body.stream, false); assert.equal(body.model, GEMINI_TTS_MODEL);
    assert.deepEqual(body.response_format, { type: "audio", mime_type: "audio/wav", sample_rate: 24000 });
    assert.deepEqual(body.generation_config, { speech_config: [{ voice: "Sulafat" }] });
    assert.equal(body.input[0].content[0].text, VOICE_SAMPLES.zh.reflective);
    assert.equal(body.input[0].content[0].annotations[0].type, "speech_metadata");
    assert(!String(captured!.body).includes(KEY)); assert(!String(captured!.body).includes("PRIVATE_WRITER")); assert(!String(captured!.body).includes("TEST_ONLY_COOKIE"));
    const file = join(dir, "audio", a.id + ".mp3");
    execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-i", file, "-f", "null", "-"], { timeout: 10_000, windowsHide: true });
    await client.preview("gemini:Sulafat", "reflective"); assert.equal(calls, 1, "cache validation cannot trigger a new generation");
    const changed = await client.preview("gemini:Aoede", "reflective"); assert.notEqual(changed.id, a.id);
    const textChanged = await client.preview("gemini:Aoede", "bright"); assert.notEqual(textChanged.id, changed.id);
    assert(!(await readdir(join(dir, "audio"))).some(n => n.includes("partial")));
  } finally { await client.close(); await rm(dir, { recursive: true, force: true }); }
});

test("Gemini WAV parser handles RIFF chunks, rejects raw PCM, wrong rate/length/stereo/truncated/overlong data", () => {
  const good = wavFixture(); assert.equal(validateGeminiWav(good), true);
  const junk = Buffer.alloc(10); junk.write("JUNK"); junk.writeUInt32LE(1, 4);
  const padded = Buffer.concat([good.subarray(0,12), junk, good.subarray(12)]); padded.writeUInt32LE(padded.length - 8, 4); assert.equal(validateGeminiWav(padded), true);
  for (const change of [(b: Buffer) => b.writeUInt16LE(2, 22), (b: Buffer) => b.writeUInt32LE(16000, 24), (b: Buffer) => b.writeUInt32LE(3_000_000, 40), (b: Buffer) => b.writeUInt32LE(1, 4)]) {
    const bad = Buffer.from(good); change(bad); assert.equal(validateGeminiWav(bad), false);
  }
  assert.equal(validateGeminiWav(good.subarray(44)), false); assert.equal(validateGeminiWav(good.subarray(0, good.length-1)), false);
});

test("Gemini 429 cooldown and local budget stop network without automatic retries or fallback; caches remain usable", async () => {
  const dir = await directory(); let calls = 0, clock = 1000, budget = true;
  const client = new GeminiTtsPreview(readyConfig(dir), () => budget, () => clock, { fetch: async () => { calls++; return new Response("TEST_PRIVATE_ERROR", { status: 429, headers: { "retry-after": "120" } }); } });
  try {
    await assert.rejects(client.preview("gemini:Sulafat", "transition"), (e: Error) => !e.message.includes("TEST_PRIVATE_ERROR")); assert.equal(calls, 1);
    await assert.rejects(client.preview("gemini:Aoede", "bright")); assert.equal(calls, 1);
    clock += 121_000; budget = false; await assert.rejects(client.preview("gemini:Aoede", "bright")); assert.equal(calls, 1);
  } finally { await client.close(); await rm(dir, { recursive: true, force: true }); }
});

test("Gemini rejects malformed/oversize/empty/remote or incomplete audio and timeouts, never publishes failed output", async () => {
  const dir = await directory();
  const samples = [
    () => new Response("TEST_PRIVATE", { status: 403 }),
    () => new Response("not json", { headers: { "content-type": "application/json" } }),
    () => new Response(" ".repeat(8_000_001), { headers: { "content-type": "application/json" } }),
    () => Response.json({ status: "completed", steps: [] }),
    () => Response.json({ status: "failed", steps: [] }),
    () => Response.json({ status: "completed", steps: [{ type: "model_output", content: [{ type: "audio", mime_type: "audio/wav", uri: "https://private.invalid/audio" }] }] }),
    () => Response.json({ status: "completed", steps: [{ type: "model_output", content: [{ type: "audio", mime_type: "audio/wav", data: "not base64?" }] }] }),
    () => response(Buffer.alloc(100, 0))
  ];
  try {
    for (const make of samples) {
      let calls = 0;
      const client = new GeminiTtsPreview(readyConfig(dir), () => true, Date.now, { fetch: async () => { calls++; return make(); } });
      await assert.rejects(client.preview("gemini:Sulafat", "transition"), (e: Error) => !e.message.includes("TEST_PRIVATE")); assert.equal(calls, 1);
      assert.deepEqual(await readdir(join(dir, "audio")), []); await client.close();
    }
    const client = new GeminiTtsPreview({ ...readyConfig(dir), ttsTimeoutMs: 100 }, () => true, Date.now, { fetch: async (_url, options) => new Promise((_resolve, reject) => { options!.signal!.addEventListener("abort", () => reject(new Error("TEST_PRIVATE_TIMEOUT")), { once: true }); }) });
    await assert.rejects(client.preview("gemini:Sulafat", "transition"), (e: Error) => !e.message.includes("TEST_PRIVATE_TIMEOUT")); await client.close();
    const invalid = new GeminiTtsPreview(readyConfig(dir), () => true, Date.now, { fetch: async () => response(), convert: dummyConvert, validate: async () => false });
    await assert.rejects(invalid.preview("gemini:Sulafat", "transition")); assert.deepEqual(await readdir(join(dir, "audio")), []); await invalid.close();
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("Gemini single-flight rejects another voice, close drains but never publishes late output", async () => {
  const dir = await directory(); let release!: () => void, entered!: () => void;
  const started = new Promise<void>(r => { entered = r; }), gate = new Promise<void>(r => { release = r; });
  const client = new GeminiTtsPreview(readyConfig(dir), () => true, Date.now, { fetch: async () => { entered(); await gate; return response(); }, convert: dummyConvert, validate: async () => true });
  try {
    const pending = client.preview("gemini:Sulafat", "transition"); const rejected = assert.rejects(pending); await started;
    await assert.rejects(client.preview("gemini:Aoede", "transition"), (e: { code?: string }) => e.code === "GEMINI_TTS_BUSY");
    const closing = client.close(); assert.equal(client.ready, false); release(); await rejected; await closing;
    assert.deepEqual(await readdir(join(dir, "audio")), []);
  } finally { release(); await client.close(); await rm(dir, { recursive: true, force: true }); }
});

test("Gemini owner audition route is fixed-only, no settings migration or programme/hosting access, and opt-in capability is honest", async () => {
  const dir = await directory(); let calls = 0;
  const tts = new FixtureTts(dir, true);
  const app = buildApp({ env: { EMILY_DATA_DIR: dir, EMILY_OWNER_PASSWORD: OWNER_PASSWORD, EMILY_PUBLIC_ORIGIN: ORIGIN }, tts,
    geminiPreview: { ready: true, close: async () => {}, preview: async (voice, sample) => { calls++; const text = VOICE_SAMPLES.zh[sample]; return { ...await tts.segment(text, voice), language: "zh", provider: "gemini", model: GEMINI_TTS_MODEL } as DjSegment; } } });
  try {
    app.services.store.set("private-fixture-marker", "TEST_ONLY_PRIVATE_LISTENER_CONTEXT");
    const cookie = await login(app), before = app.services.radio.now(), settings = app.services.radio.settings();
    const setup = await app.inject({ method: "GET", url: "/api/setup", headers: headers(cookie) }); assert.equal(setup.json().data.tts.geminiPreview.ready, true); assert.equal(calls, 0);
    const send = (payload: Record<string, unknown>) => app.inject({ method: "POST", url: "/api/tts/preview", headers: headers(cookie), payload });
    assert.equal((await app.inject({ method: "POST", url: "/api/tts/preview", headers: { origin: ORIGIN }, payload: { voice: "gemini:Sulafat" } })).statusCode, 401);
    for (const bad of [{ voice: "gemini:Sulafat", text: "TEST_ONLY_PRIVATE_LISTENER_CONTEXT" }, { voice: "gemini:Sulafat", style: "private" }, { voice: "gemini:Unknown" }]) assert.equal((await send(bad)).statusCode, 400);
    const result = await send({ voice: "gemini:Sulafat", sample: "reflective" }); assert.equal(result.statusCode, 200); assert.equal(result.headers["cache-control"], "private, no-store"); assert.equal(result.json().data.segment.text, VOICE_SAMPLES.zh.reflective); assert.equal(calls, 1);
    assert.equal((await app.inject({ method: "PATCH", url: "/api/settings", headers: headers(cookie), payload: { voice: "gemini:Sulafat" } })).statusCode, 400, "audition-only voice cannot become formal hosting");
    assert.deepEqual(app.services.radio.now(), before); assert.deepEqual(app.services.radio.settings(), settings); assert.equal(app.services.store.history().length, 0);
  } finally { await app.close(); await rm(dir, { recursive: true, force: true }); }
});
