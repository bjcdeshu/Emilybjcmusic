import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { chromium, type Page } from "playwright";
import { buildApp } from "../apps/server/src/app.js";
import { loadConfig } from "../apps/server/src/config.js";
import { validateRange } from "../apps/server/src/media.js";
import { COOKIE_SENTINEL, FixtureTts, HttpFixture, OWNER_PASSWORD } from "../apps/server/test/helpers.js";
import type { DjSegment } from "@emily/shared";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
// Explicit browser-only provider/MP3 fixtures. No production catalogue or service imports these.
class BrowserTts extends FixtureTts {
  constructor(directory: string, private readonly bytes: Buffer) { super(directory, true); }
  override async segment(text: string, voice: string): Promise<DjSegment> {
    const segment = await super.segment(text, voice);
    await writeFile(join(this.audioDir, `${segment.id}.mp3`), this.bytes);
    return segment;
  }
}
const wait = async (page: Page, fn: () => boolean) => { await page.waitForFunction(fn); };

test("real browser: programme audio, pause/quiet/seek, history, logout and static-only offline PWA", { timeout: 120_000 }, async () => {
  const directory = await mkdtemp(join(process.env.TMPDIR || tmpdir(), "emily-browser-test-"));
  const provider = new HttpFixture();
  await provider.start();
  const file = join(directory, "TEST_ONLY_TONE.mp3");
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-codec:a", "libmp3lame", file], { timeout: 15000 });
  const bytes = await readFile(file);
  const config = loadConfig({ EMILY_DATA_DIR: directory, EMILY_OWNER_PASSWORD: OWNER_PASSWORD, EMILY_CREDENTIAL_KEY: "0f".repeat(32), EMILY_NETEASE_API_BASE: provider.base, EMILY_NETEASE_COOKIE: COOKIE_SENTINEL, EMILY_TTS_ENABLED: "false", EMILY_WEB_DIST_DIR: join(root, "apps/web/dist") });
  const app = buildApp({ config, tts: new BrowserTts(directory, bytes), mediaOpener: async (_url, range) => {
    validateRange(range);
    let start = 0, end = bytes.length - 1;
    if (range) {
      const [s, e] = range.slice(6).split("-");
      if (s) { start = Number(s); if (e) end = Math.min(end, Number(e)); }
      else start = Math.max(0, bytes.length - Number(e));
    }
    const chunk = bytes.subarray(start, end + 1);
    return { status: range ? 206 : 200, headers: { "content-type": "audio/mpeg", "content-length": String(chunk.length), "accept-ranges": "bytes", ...(range ? { "content-range": `bytes ${start}-${end}/${bytes.length}` } : {}) }, stream: Readable.from([chunk]) };
  } });
  let browser;
  try {
    const origin = await app.listen({ host: "127.0.0.1", port: 0 });
    config.publicOrigin = origin;
    const env = process.env;
    browser = await chromium.launch({ headless: true, ...(env.EMILY_BROWSER_EXECUTABLE ? { executablePath: env.EMILY_BROWSER_EXECUTABLE } : { channel: "chrome" }) });
    const context = await browser.newContext({ viewport: { width: 393, height: 851 } });
    const page = await context.newPage();
    const errors: string[] = [];
    const phases: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin);
    await page.getByLabel("个人登录口令").fill(OWNER_PASSWORD);
    await page.getByRole("button", { name: "进入电台" }).click();
    await page.locator(".main-play").waitFor();
    await page.evaluate(() => {
      const audio = document.querySelector("audio")!;
      (window as any).emilyAudioEvents = [];
      for (const event of ["playing", "pause", "ended", "error"]) audio.addEventListener(event, () => {
        (window as any).emilyAudioEvents.push({ event, src: audio.currentSrc, time: audio.currentTime });
      });
    });
    const nav = () => page.locator(".mobile-nav");
    await nav().getByRole("button", { name: "节目", exact: true }).click();
    await page.getByRole("button", { name: /Fixture owner playlist/ }).click();
    await page.getByRole("button", { name: "开始这档节目" }).click();
    await wait(page, () => {
      const a = document.querySelector("audio")!;
      return !a.paused && a.currentSrc.includes("/api/audio/") && a.currentTime > 0;
    });
    phases.push("dj");
    await page.getByRole("button", { name: "暂停", exact: true }).click();
    assert.equal(await page.evaluate(() => document.querySelector("audio")!.paused), true);
    assert.equal(app.services.radio.now().status, "paused");
    const stopped = await page.evaluate(() => document.querySelector("audio")!.currentTime);
    await page.waitForTimeout(250);
    assert(Math.abs(await page.evaluate(() => document.querySelector("audio")!.currentTime) - stopped) < 0.1);
    await page.getByRole("button", { name: "播放", exact: true }).click();
    await wait(page, () => !document.querySelector("audio")!.paused);
    await page.getByRole("button", { name: "安静模式", exact: true }).click();
    await wait(page, () => {
      const a = document.querySelector("audio")!;
      return !a.paused && a.currentSrc.includes("/api/media/track/101") && a.currentTime > 0;
    });
    phases.push("song-after-quiet");
    await page.getByLabel("歌曲播放进度").fill("1");
    assert(await page.evaluate(() => document.querySelector("audio")!.currentTime) >= 0.8);
    await page.getByRole("button", { name: "安静模式", exact: true }).click();
    await wait(page, () => document.querySelector("audio")!.currentSrc.includes("/api/audio/"));
    await wait(page, () => {
      const a = document.querySelector("audio")!;
      return !a.paused && a.currentSrc.includes("/api/media/track/202") && a.currentTime > 0;
    });
    phases.push("next-dj-to-song");
    await page.getByRole("button", { name: "暂停", exact: true }).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.getByRole("button", { name: "喜欢这首歌" }).click();
    assert.equal(app.services.store.feedbackMap().get("202"), "like");
    if (env.EMILY_BROWSER_EVIDENCE_DIR) {
      await mkdir(env.EMILY_BROWSER_EVIDENCE_DIR, { recursive: true });
      await page.screenshot({ path: join(env.EMILY_BROWSER_EVIDENCE_DIR, "mobile-listen.png"), fullPage: true });
      await page.setViewportSize({ width: 1360, height: 1000 });
      await page.screenshot({ path: join(env.EMILY_BROWSER_EVIDENCE_DIR, "desktop-listen.png"), fullPage: true });
      await page.setViewportSize({ width: 393, height: 851 });
    }
    await nav().getByRole("button", { name: "历史", exact: true }).click();
    await page.getByRole("button", { name: "重新编排" }).waitFor();
    const mini = page.getByRole("complementary", { name: "正在收听" });
    await mini.getByRole("button", { name: "播放", exact: true }).click();
    await wait(page, () => !document.querySelector("audio")!.paused);
    await mini.getByRole("button", { name: "暂停", exact: true }).click();
    assert.equal(await page.evaluate(() => document.querySelector("audio")!.paused), true);
    if (env.EMILY_BROWSER_EVIDENCE_DIR) {
      await nav().getByRole("button", { name: "节目", exact: true }).click();
      await page.getByRole("button", { name: /Fixture owner playlist/ }).waitFor();
      await page.screenshot({ path: join(env.EMILY_BROWSER_EVIDENCE_DIR, "mobile-library.png"), fullPage: true });
    }
    await nav().getByRole("button", { name: "设置", exact: true }).click();
    await page.getByLabel("英文女声", { exact: true }).selectOption("en-GB-SoniaNeural");
    await page.getByRole("button", { name: "保存偏好" }).click();
    await page.getByText("已保存", { exact: true }).waitFor();
    assert.equal(app.services.radio.settings().voice, "en-GB-SoniaNeural");
    await page.getByRole("button", { name: "退出个人电台" }).click();
    await page.getByLabel("个人登录口令").waitFor();
    assert.equal(await page.evaluate(() => document.querySelector("audio")!.getAttribute("src")), null);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await wait(page, () => !!navigator.serviceWorker.controller);
    const cached = await page.evaluate(async () => {
      const paths = [];
      for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) paths.push(new URL(request.url).pathname);
      return paths;
    });
    assert(cached.includes("/icons/emily-192.png"));
    assert(cached.every(path => !path.startsWith("/api/") && !/audio|track/.test(path)));
    await context.setOffline(true);
    await page.reload();
    await page.getByText("当前离线，需要网络才能登录。", { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    const evidence = { realBrowser: browser.version(), mobileViewport: "393x851", phases, pausedPositionStable: true, seek: true, feedback: true, history: true, logoutAudioCleared: true, serviceWorkerInstalled: true, offlineShell: true, cachedPaths: cached, pageErrors: errors, provider: "explicit local HTTP fixture", media: "explicit ffmpeg tone MP3 fixture, not NetEase music or human listening" };
    if (env.EMILY_BROWSER_EVIDENCE_DIR) {
      await mkdir(env.EMILY_BROWSER_EVIDENCE_DIR, { recursive: true });
      await writeFile(join(env.EMILY_BROWSER_EVIDENCE_DIR, "browser-fixture-result.json"), JSON.stringify(evidence, null, 2));
    }
    console.log(JSON.stringify(evidence));
  } finally {
    if (browser) await browser.close();
    await app.close(); await provider.close();
    await rm(directory, { recursive: true, force: true });
  }
});
