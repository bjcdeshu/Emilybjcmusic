import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { chromium } from "playwright";
import { buildApp } from "../apps/server/src/app.js";
import { loadConfig } from "../apps/server/src/config.js";
import { GeminiTtsPreview } from "../apps/server/src/gemini-tts.js";
import { VOICE_SAMPLES } from "../apps/server/src/tts-samples.js";
import { COOKIE_SENTINEL, FixtureTts, HttpFixture, OWNER_PASSWORD } from "../apps/server/test/helpers.js";

// Local HTTP + synthetic tones only. This test never calls Google or reads real credentials.
test("real browser: isolated Gemini audition, fixed payload, actual WAV conversion, same audio/paused restore and late cancellation", { timeout: 90_000 }, async () => {
  const directory = await mkdtemp(join(process.env.TMPDIR || tmpdir(), "emily-gemini-browser-")), root = dirname(dirname(fileURLToPath(import.meta.url)));
  const provider = new HttpFixture(); await provider.start();
  const songFile = join(directory, "fixture-song.mp3"), voiceFile = join(directory, "fixture-voice.wav");
  execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=20", "-c:a", "libmp3lame", songFile], { timeout: 10_000, windowsHide: true });
  execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=24000:duration=2", "-c:a", "pcm_s16le", voiceFile], { timeout: 10_000, windowsHide: true });
  const song = await readFile(songFile), wav = await readFile(voiceFile), calls: Record<string, any>[] = [];
  const config = loadConfig({ EMILY_DATA_DIR: directory, EMILY_OWNER_PASSWORD: OWNER_PASSWORD, EMILY_CREDENTIAL_KEY: "0f".repeat(32), EMILY_NETEASE_API_BASE: provider.base, EMILY_NETEASE_COOKIE: COOKIE_SENTINEL, EMILY_WEB_DIST_DIR: join(root,"apps/web/dist"), EMILY_GEMINI_TTS_API_KEY: "TEST_ONLY_GEMINI_NOT_A_CREDENTIAL", EMILY_GEMINI_TTS_FREE_TIER_CONFIRMED: "true" });
  let block = false, release: () => void = () => {};
  const gemini = new GeminiTtsPreview(config, () => true, Date.now, { fetch: async (_url, init) => {
    calls.push(JSON.parse(String(init!.body))); if (block) await new Promise<void>(r => { release = r; });
    return Response.json({ status: "completed", steps: [{ type: "model_output", content: [{ type: "audio", mime_type: "audio/wav", data: wav.toString("base64") }] }] });
  } });
  const app = buildApp({ config, tts: new FixtureTts(directory), geminiPreview: gemini, mediaOpener: async (_url, range) => {
    const bounds = range?.slice(6).split("-") || [], start = bounds[0] ? Number(bounds[0]) : 0, end = bounds[1] ? Number(bounds[1]) : song.length - 1, chunk = song.subarray(start,end+1);
    return { status: range ? 206 : 200, headers: { "content-type": "audio/mpeg", "content-length": String(chunk.length), "accept-ranges": "bytes", ...(range ? { "content-range": `bytes ${start}-${end}/${song.length}` } : {}) }, stream: Readable.from(chunk) };
  } });
  let browser;
  try {
    const origin = await app.listen({ host: "127.0.0.1", port: 0 }); config.publicOrigin = origin;
    app.services.radio.updateSettings({ djEnabled: false, voice: "zh-CN-XiaoyiNeural" }); await app.services.radio.programme({ limit: 2 });
    const before = app.services.radio.now(), settings = app.services.radio.settings(), history = app.services.store.history();
    browser = await chromium.launch({ headless: true, ...(process.env.EMILY_BROWSER_EXECUTABLE ? { executablePath: process.env.EMILY_BROWSER_EXECUTABLE } : { channel: "chrome" }) });
    const page = await browser.newPage({ viewport: { width: 393, height: 740 } }), errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(origin); await page.getByLabel("个人登录口令").fill(OWNER_PASSWORD); await page.getByRole("button", { name: "进入电台" }).click(); await page.locator(".main-play").waitFor();
    await page.getByRole("button", { name: "播放", exact: true }).click(); await page.waitForFunction(() => document.querySelector("audio")!.currentTime > 1); await page.getByRole("button", { name: "暂停", exact: true }).click();
    const source = await page.locator("audio").evaluate(el => { (window as any).__geminiAudio = el; return (el as HTMLAudioElement).currentSrc; }), time = await page.locator("audio").evaluate(el => (el as HTMLAudioElement).currentTime);
    await page.locator(".radio-entry").getByRole("button", { name: "节目", exact: true }).click(); await page.locator(".mobile-nav").getByRole("button", { name: "设置", exact: true }).click();
    assert.equal(calls.length, 0, "setup does not synthesize"); await page.getByLabel("试听引擎", { exact: true }).selectOption("gemini"); await page.getByLabel("试听段落", { exact: true }).selectOption("reflective");
    await page.getByRole("button", { name: "试听这条声线", exact: true }).click(); await page.waitForFunction(() => document.querySelector("audio")!.currentSrc.includes("/api/audio/") && !document.querySelector("audio")!.paused);
    assert.equal(await page.locator("audio").count(), 1); assert(await page.evaluate(() => (window as any).__geminiAudio === document.querySelector("audio")));
    assert.equal(await page.locator("audio").evaluate(el => (el as HTMLAudioElement).volume), settings.volume * .9); assert.equal(calls.length, 1);
    assert.equal(calls[0]!.input[0].content[0].text, VOICE_SAMPLES.zh.reflective); assert.equal(calls[0]!.store, false); assert(!JSON.stringify(calls).includes(COOKIE_SENTINEL));
    await page.waitForFunction(s => document.querySelector("audio")!.currentSrc === s && document.querySelector("audio")!.paused, source); await page.waitForFunction(t => Math.abs(document.querySelector("audio")!.currentTime - t) < .1, time);
    await page.getByRole("button", { name: "试听这条声线", exact: true }).click(); await page.waitForFunction(() => !document.querySelector("audio")!.paused); await page.getByRole("button", { name: "停止试听", exact: true }).click(); assert.equal(calls.length, 1, "same sample uses validated cache");
    await page.waitForFunction(s => document.querySelector("audio")!.currentSrc === s && document.querySelector("audio")!.paused, source);
    block = true; await page.getByLabel("Gemini 试听声线", { exact: true }).selectOption("gemini:Aoede"); await page.getByRole("button", { name: "试听这条声线", exact: true }).click();
    for (let i = 0; i < 100 && calls.length < 2; i++) await page.waitForTimeout(20); assert.equal(calls.length, 2);
    await page.getByLabel("试听引擎", { exact: true }).selectOption("edge"); release(); await page.getByText("已取消试听。", { exact: true }).waitFor(); assert.equal(await page.locator("audio").evaluate(el => (el as HTMLAudioElement).currentSrc), source); assert(await page.locator("audio").evaluate(el => (el as HTMLAudioElement).paused));
    await page.getByLabel("试听引擎", { exact: true }).selectOption("gemini");
    for (const [width,height] of [[360,560],[393,640],[393,740],[393,851]] as const) { await page.setViewportSize({width,height}); await page.getByLabel("Gemini 试听声线",{exact:true}).scrollIntoViewIfNeeded(); assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)); }
    if (process.env.EMILY_BROWSER_EVIDENCE_DIR) { await mkdir(process.env.EMILY_BROWSER_EVIDENCE_DIR,{recursive:true}); await page.screenshot({path:join(process.env.EMILY_BROWSER_EVIDENCE_DIR,"gemini-audition-fixture.png"),fullPage:true}); }
    assert.deepEqual(app.services.radio.settings(),settings); assert.equal(app.services.radio.now().programmeId,before.programmeId); assert.deepEqual(app.services.radio.now().queue,before.queue); assert.deepEqual(app.services.store.history(),history); assert.deepEqual(errors,[]);
    await page.getByRole("button",{name:"退出个人电台"}).click(); await page.getByLabel("个人登录口令").waitFor(); assert.equal(await page.locator("audio").getAttribute("src"),null);
  } finally { release(); if(browser)await browser.close(); await app.close(); await provider.close(); await rm(directory,{recursive:true,force:true}); }
});
