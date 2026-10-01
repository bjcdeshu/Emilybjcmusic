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
    const designScreens: Record<string, unknown> = {};
    async function reviewScreen(name: string) {
      for (const width of [393, 1360, 360, 768]) {
        await page.setViewportSize({ width, height: width > 740 ? 1000 : 851 });
        await page.evaluate(() => window.scrollTo({top:0,behavior:'instant'}));
        await page.waitForTimeout(450);
        const checks = await page.evaluate(() => {
          const surface = document.querySelector('.view-panel,.radio-device,.login-device,.modal');
          const button = document.querySelector('.primary-button,.main-play');
          return { overflow: document.documentElement.scrollWidth > innerWidth, font: getComputedStyle(document.body).fontFamily, controlFont:button?getComputedStyle(button).fontFamily:null,
            surfaceRadius: surface ? getComputedStyle(surface).borderRadius : null,
            buttonHeight: button?.getBoundingClientRect().height ?? null };
        });
        assert.equal(checks.overflow, false, `${name} at ${width}px must fit`);
        if(checks.controlFont) assert.equal(checks.controlFont, checks.font, `${name} controls must use the shared font`);
        if (checks.buttonHeight !== null) assert(checks.buttonHeight >= 44, `${name} primary target at ${width}px`);
        designScreens[`${name}-${width}`] = checks;
        if (env.EMILY_BROWSER_EVIDENCE_DIR && [393,1360].includes(width)) {
          await mkdir(env.EMILY_BROWSER_EVIDENCE_DIR, { recursive: true });
          await page.screenshot({ path: join(env.EMILY_BROWSER_EVIDENCE_DIR, `${width > 740 ? 'desktop' : 'mobile'}-${name}.png`), fullPage: name!=='qr-dialog' });
        }
      }
      await page.setViewportSize({ width:393, height:851 });
    }
    // Richer collection is explicit browser-only data, never stored or published.
    await page.route('https://*.music.126.net/**', async route => {
      const colours = ['#476458','#657181','#806a61','#a5a080','#526678','#777465','#796477','#57776c'];
      const url = route.request().url(); const index = Number(/fixture-cover-(\d+)/.exec(url)?.[1] || 0);
      const base = colours[index % colours.length];
      await route.fulfill({status:200,contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="${base}"/><circle cx="140" cy="70" r="75" fill="#ffffff20"/><path d="M0 170 L80 95 L200 155 V200 H0" fill="#00000020"/><text x="20" y="42" font-family="sans-serif" font-size="10" fill="white">TEST COLLECTION</text><text x="20" y="180" font-family="sans-serif" font-size="26" fill="white">${index+1}</text></svg>`});
    });
    await page.route('**/api/music/playlists', async route => {
      const response = await route.fetch(); const payload = await response.json();
      const first = {...payload.data.items[0],coverUrl:'https://p1.music.126.net/fixture-cover-0'};
      payload.data.items = [first, ...['Fixture evening collection','Fixture quiet mornings','Fixture driving songs','Fixture familiar voices','Fixture slow weekends','Fixture piano collection','Fixture open windows'].map((name,index) => ({...first,id:String(701+index),name,coverUrl:`https://p1.music.126.net/fixture-cover-${index+1}`}))];
      await route.fulfill({response,json:payload});
    });
    await page.goto(origin);
    await reviewScreen('login');
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
    await nav().getByRole("button", { name: "历史", exact: true }).click();
    await page.getByText("第一档节目，留给现在。", {exact:true}).waitFor();
    await reviewScreen('empty-history');
    await nav().getByRole("button", { name: "节目", exact: true }).click();
    await page.locator('.playlist-card').first().waitFor();
    await reviewScreen('library');
    await page.getByRole("button", { name: /Fixture owner playlist/ }).click();
    await page.getByRole("button", { name: "开始这档节目" }).click();
    await wait(page, () => {
      const a = document.querySelector("audio")!;
      return !a.paused && a.currentSrc.includes("/api/audio/") && a.currentTime > 0;
    });
    phases.push("dj");
    const signalFrame = await page.locator(".radio-signal").evaluate((el: HTMLCanvasElement) => el.toDataURL());
    assert.equal(await page.locator(".vinyl-disc").count(), 0);
    assert.equal(await page.locator(".record-stage").count(), 0);
    assert(await page.locator(".radio-signal").evaluate((el: HTMLCanvasElement) => {
      const bytes = el.getContext("2d")!.getImageData(0, 0, el.width, el.height).data;
      let rows = 0;
      for (let y = 0; y < el.height; y++) { for (let x = 0; x < el.width; x++) if (bytes[(y * el.width + x) * 4 + 3]) { rows++; break; } }
      return rows > 6;
    }), "real audio samples produce bars taller than the silent baseline");
    assert(signalFrame.startsWith("data:image/png"));
    assert.equal(await page.locator(".transcript-card").getAttribute("data-speaking"), "true");
    if (env.EMILY_BROWSER_EVIDENCE_DIR) {
      await mkdir(env.EMILY_BROWSER_EVIDENCE_DIR, { recursive: true });
      await page.screenshot({ path: join(env.EMILY_BROWSER_EVIDENCE_DIR, "mobile-speaking.png"), fullPage: true });
    }
    await page.getByRole("button", { name: "暂停", exact: true }).click();
    assert.equal(await page.evaluate(() => document.querySelector("audio")!.paused), true);
    assert.equal(app.services.radio.now().status, "paused");
    const pausedSignal = await page.locator(".radio-signal").evaluate((el: HTMLCanvasElement) => el.toDataURL());
    const stopped = await page.evaluate(() => document.querySelector("audio")!.currentTime);
    await page.waitForTimeout(250);
    assert(Math.abs(await page.evaluate(() => document.querySelector("audio")!.currentTime) - stopped) < 0.1);
    assert.equal(await page.locator(".radio-signal").evaluate((el: HTMLCanvasElement) => el.toDataURL()), pausedSignal);
    await page.getByRole("button", { name: "播放", exact: true }).click();
    await wait(page, () => !document.querySelector("audio")!.paused);
    await page.getByRole("button", { name: "安静模式", exact: true }).click();
    await wait(page, () => {
      const a = document.querySelector("audio")!;
      return !a.paused && a.currentSrc.includes("/api/media/track/101") && a.currentTime > 0;
    });
    phases.push("song-after-quiet");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(80); // Allow the media-query change event to redraw its static baseline.
    const stillFrame = await page.locator(".radio-signal").evaluate((el: HTMLCanvasElement) => el.toDataURL());
    await page.waitForTimeout(100);
    assert.equal(await page.locator(".radio-signal").evaluate((el: HTMLCanvasElement) => el.toDataURL()), stillFrame);
    await page.emulateMedia({ reducedMotion: "no-preference" });
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
      await page.getByRole("button", { name: "关闭提示" }).click();
      await reviewScreen('listen');
    }
    await nav().getByRole("button", { name: "历史", exact: true }).click();
    await page.getByRole("button", { name: "重新编排" }).waitFor();
    await reviewScreen('history');
    const mini = page.getByRole("complementary", { name: "正在收听" });
    await mini.getByRole("button", { name: "播放", exact: true }).click();
    await wait(page, () => !document.querySelector("audio")!.paused);
    await mini.getByRole("button", { name: "暂停", exact: true }).click();
    assert.equal(await page.evaluate(() => document.querySelector("audio")!.paused), true);
    if (env.EMILY_BROWSER_EVIDENCE_DIR) {
      await nav().getByRole("button", { name: "节目", exact: true }).click();
      await page.getByRole("button", { name: /Fixture owner playlist/ }).waitFor();
      await reviewScreen('library');
    }
    await nav().getByRole("button", { name: "设置", exact: true }).click();
    await page.getByLabel("英文女声", { exact: true }).waitFor();
    await reviewScreen('settings');
    await page.getByLabel("英文女声", { exact: true }).selectOption("en-GB-SoniaNeural");
    await page.getByRole("button", { name: "保存偏好" }).click();
    await page.getByText("已保存", { exact: true }).waitFor();
    assert.equal(app.services.radio.settings().voice, "en-GB-SoniaNeural");
    // Simulate the upgrade dropping a legacy cached DJ: first play must resolve a
    // fresh intro rather than silently begin music and miss repaired hosting.
    await page.route("**/api/now", async route => {
      const response = await route.fetch(); const payload = await response.json();
      delete payload.data.dj;
      await route.fulfill({ response, json: payload });
    }, { times: 1 });
    await page.reload(); await page.locator(".main-play").waitFor();
    await page.getByRole("button", { name: "播放", exact: true }).click();
    await wait(page, () => !document.querySelector("audio")!.paused && document.querySelector("audio")!.currentSrc.includes("/api/audio/"));
    await page.getByRole("button", { name: "暂停", exact: true }).click();
    await nav().getByRole("button", { name: "设置", exact: true }).click();
    // Inspect QR failure state without reconnecting/changing the real fixture auth.
    await page.route('**/api/setup', async route => {
      const response = await route.fetch(); const payload = await response.json(); payload.data.music.connected=false;
      await route.fulfill({response,json:payload});
    }, {times:1});
    await page.getByRole('button',{name:'重新检查服务配置'}).click();
    await page.getByRole('button',{name:'连接',exact:true}).click();
    await page.getByRole('dialog').waitFor();
    await page.waitForTimeout(500);
    await reviewScreen('qr-dialog');
    await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
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
    const evidence = { realBrowser: browser.version(), mobileViewport: "393x851", phases, designScreens, realAudioSignalVerified: true, noVinylOrCoverStage: true, reducedMotionVerified: true, repairedIntroOnFirstPlay: true, pausedPositionStable: true, seek: true, feedback: true, history: true, logoutAudioCleared: true, serviceWorkerInstalled: true, offlineShell: true, cachedPaths: cached, pageErrors: errors, provider: "explicit local HTTP fixture", media: "explicit ffmpeg tone MP3 fixture, not NetEase music or human listening" };
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
