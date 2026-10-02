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

test("real browser: Mandarin hosting reading scroll, pause/reduce/modal gates and timestamped lyrics with honest fallbacks", {timeout:90_000}, async () => {
  const directory=await mkdtemp(join(process.env.TMPDIR||tmpdir(),"emily-text-browser-")), provider=new HttpFixture(); await provider.start();
  const file=join(directory,"TEST_ONLY_LONG_TONE.mp3");
  execFileSync("ffmpeg",["-v","error","-f","lavfi","-i","sine=frequency=440:duration=25","-codec:a","libmp3lame",file],{timeout:15000});
  const bytes=await readFile(file);
  provider.hostingText="先把那些忙碌的事放一放。让音乐接着陪你，留一点时间给自己。".repeat(5);
  const config=loadConfig({EMILY_DATA_DIR:directory,EMILY_OWNER_PASSWORD:OWNER_PASSWORD,EMILY_CREDENTIAL_KEY:"0f".repeat(32),EMILY_NETEASE_API_BASE:provider.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL,EMILY_MODEL_BASE_URL:`${provider.base}v1`,EMILY_MODEL_API_KEY:"TEST_ONLY_MODEL",EMILY_MODEL_NAME:"TEST_ONLY_MODEL",EMILY_WEB_DIST_DIR:join(root,"apps/web/dist")});
  const app=buildApp({config,tts:new BrowserTts(directory,bytes),mediaOpener:async(_url,range)=>{validateRange(range);const match=range?range.slice(6).split('-'):[];const start=match[0]?Number(match[0]):0,end=match[1]?Math.min(Number(match[1]),bytes.length-1):bytes.length-1,chunk=bytes.subarray(start,end+1);return {status:range?206:200,headers:{"content-type":"audio/mpeg","content-length":String(chunk.length),"accept-ranges":"bytes",...(range?{"content-range":`bytes ${start}-${end}/${bytes.length}`}:{})},stream:Readable.from(chunk)};}});
  let browser;
  try {
    const origin=await app.listen({host:"127.0.0.1",port:0});config.publicOrigin=origin;
    browser=await chromium.launch({headless:true,...(process.env.EMILY_BROWSER_EXECUTABLE?{executablePath:process.env.EMILY_BROWSER_EXECUTABLE}:{channel:"chrome"})});
    const page=await browser.newPage({viewport:{width:393,height:740}}),errors:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
    await page.getByLabel('个人登录口令').fill(OWNER_PASSWORD);await page.getByRole('button',{name:'进入电台'}).click();await page.locator('.main-play').waitFor();
    await page.locator('.radio-entry').getByRole('button',{name:'节目',exact:true}).click();
    await page.getByRole('button',{name:/Fixture owner playlist/}).click();await page.getByLabel('原歌单自动漫游').uncheck();
    await page.getByRole('button',{name:'开始这档节目'}).click();
    await page.waitForFunction(()=>!document.querySelector('audio')!.paused&&document.querySelector('audio')!.currentSrc.includes('/api/audio/'));
    assert.equal(app.services.radio.now().dj?.language,'zh');assert.equal(app.services.radio.now().dj?.voice,'zh-CN-XiaoxiaoNeural');
    assert.equal(await page.locator('.transcript-text').getAttribute('lang'),'zh');assert.equal(await page.getByText('Emily 正在串场',{exact:true}).count(),0);
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.transcript-text')!).transform!=='none'&&new DOMMatrix(getComputedStyle(document.querySelector('.transcript-text')!).transform).m42< -2);
    const offset=()=>page.locator('.transcript-text').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m42);
    await page.getByRole('button',{name:'暂停',exact:true}).click();const paused=await offset();await page.waitForTimeout(350);assert.equal(await offset(),paused,'pause stops reading aid');
    await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'播放',exact:true}).click();await page.waitForTimeout(350);assert.equal(await offset(),paused,'reduce never auto-scrolls');
    await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>new DOMMatrix(getComputedStyle(document.querySelector('.transcript-text')!).transform).m42< -4);
    const source=await page.evaluate(()=>document.querySelector('audio')!.currentSrc);
    await page.getByRole('button',{name:'阅读主持全文'}).click();const modalOffset=await offset();await page.waitForTimeout(350);assert.equal(await offset(),modalOffset,'manual full reading stops preview');
    assert.equal(await page.locator('.transcript-full').textContent(),provider.hostingText);await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>document.querySelector('audio')!.currentSrc),source,'reading does not remount audio');
    await page.locator('.hosting-scroll').dispatchEvent('wheel');const manual=await offset();await page.waitForTimeout(350);assert.equal(await offset(),manual,'manual reading suppresses auto scrolling');
    await page.getByRole('button',{name:'听感与节目',exact:true}).click();await page.getByRole('button',{name:'安静模式',exact:true}).click();await page.getByRole('button',{name:'关闭播放面板'}).click();
    await page.waitForFunction(()=>document.querySelector('audio')!.currentSrc.includes('/api/media/track/'));
    await page.locator('.lyrics-preview').waitFor();await page.waitForFunction(()=>document.querySelector('audio')!.duration>0&&!document.querySelector('audio')!.paused);await page.getByRole('button',{name:'暂停',exact:true}).click();
    async function seek(time:number,index:string){const slider=page.getByLabel('歌曲播放进度');await slider.focus();await page.keyboard.press('Home');for(let step=0;step<Math.round(time*10);step++)await page.keyboard.press('ArrowRight');const actual=await page.evaluate(()=>({time:document.querySelector('audio')!.currentTime,duration:document.querySelector('audio')!.duration,value:(document.querySelector('.seek-range')as HTMLInputElement).value,disabled:(document.querySelector('.seek-range')as HTMLInputElement).disabled}));assert(Math.abs(actual.time-time)<.15,`keyboard seek changes actual media position: ${JSON.stringify(actual)}`);await page.waitForFunction(i=>document.querySelector('.lyrics-preview')!.getAttribute('data-line')===i,index);}
    await seek(2.2,'2');assert.equal(await page.locator('.lyric-current').textContent(),'TEST LYRIC third');
    await seek(.2,'0');assert.equal(await page.locator('.lyric-current').textContent(),'TEST LYRIC first');const lyricPaused=await page.locator('.lyric-current').textContent();await page.waitForTimeout(350);assert.equal(await page.locator('.lyric-current').textContent(),lyricPaused);
    for(const[width,height]of[[360,560],[393,640],[393,740],[393,851]]as const){await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.querySelector('.listening-tools')!.getBoundingClientRect().bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth));}
    await page.setViewportSize({width:393,height:740});await page.getByRole('button',{name:'阅读完整歌词'}).click();assert(await page.locator('.lyrics-full').isVisible());await page.keyboard.press('Escape');
    async function refreshLyrics(body:Record<string,unknown>){provider.lyricBody=body;await page.reload();await page.locator('.main-play').waitFor();await page.waitForTimeout(150);}
    await refreshLyrics({code:200,lrc:{lyric:'TEST untimed lyric\nTEST second untimed lyric'}});await page.getByRole('button',{name:'阅读歌词 · 无同步时间'}).waitFor();assert.equal(await page.locator('.lyrics-preview').count(),0);
    await page.getByRole('button',{name:'阅读歌词 · 无同步时间'}).click();assert.equal(await page.locator('.lyrics-plain').textContent(),'TEST untimed lyric\nTEST second untimed lyric');await page.keyboard.press('Escape');
    await refreshLyrics({code:200,nolyric:true});await page.getByText('纯音乐',{exact:true}).waitFor();assert.equal(await page.locator('.lyrics-preview').count(),0);
    await refreshLyrics({code:200,uncollected:true});await page.getByText('暂无歌词',{exact:true}).waitFor();
    provider.failPath='/lyric';await page.reload();await page.getByText('歌词暂不可用',{exact:true}).waitFor();await page.getByRole('button',{name:'播放',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('audio')!.paused);
    assert.deepEqual(errors,[]);assert.equal(app.services.radio.settings().hostLanguage,'zh');
    if(process.env.EMILY_BROWSER_EVIDENCE_DIR){await mkdir(process.env.EMILY_BROWSER_EVIDENCE_DIR,{recursive:true});await writeFile(join(process.env.EMILY_BROWSER_EVIDENCE_DIR,'listening-text-fixture-result.json'),JSON.stringify({fixture:true,chineseVoice:true,hostingScroll:true,pauseAndReducedMotion:true,manualAndModalStop:true,lyricsSeekAndPause:true,shortScreens:true,plainInstrumentalMissingAndFailure:true,lyricsFailureStillPlays:true,pageErrors:errors},null,2));}
  } finally {if(browser)await browser.close();await app.close();await provider.close();await rm(directory,{recursive:true,force:true});}
});

test('real browser: measured bass bursts drive bounded accents, modal attenuation and zero pause', {timeout:45_000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'emily-rhythm-browser-')),provider=new HttpFixture();await provider.start();
 const file=join(directory,'TEST_ONLY_BASS_BURSTS.mp3');
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','aevalsrc=0.45*sin(2*PI*90*t)*if(lt(mod(t\\,0.8)\\,0.13)\\,1\\,0.06):s=48000:d=12','-codec:a','libmp3lame',file],{timeout:15000});
 const bytes=await readFile(file),config=loadConfig({EMILY_DATA_DIR:directory,EMILY_OWNER_PASSWORD:OWNER_PASSWORD,EMILY_CREDENTIAL_KEY:'0f'.repeat(32),EMILY_NETEASE_API_BASE:provider.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL,EMILY_WEB_DIST_DIR:join(root,'apps/web/dist')});
 const app=buildApp({config,tts:new BrowserTts(directory,bytes),mediaOpener:async()=>({status:200,headers:{'content-type':'audio/mpeg','content-length':String(bytes.length)},stream:Readable.from(bytes)})});let browser;
 try{
  const origin=await app.listen({host:'127.0.0.1',port:0});config.publicOrigin=origin;app.services.radio.updateSettings({djEnabled:false});await app.services.radio.programme({limit:1});
  browser=await chromium.launch({headless:true,...(process.env.EMILY_BROWSER_EXECUTABLE?{executablePath:process.env.EMILY_BROWSER_EXECUTABLE}:{channel:'chrome'})});const page=await browser.newPage({viewport:{width:393,height:740}});
  await page.goto(origin);await page.getByLabel('个人登录口令').fill(OWNER_PASSWORD);await page.getByRole('button',{name:'进入电台'}).click();await page.locator('.main-play').waitFor();await page.getByRole('button',{name:'播放',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('audio')!.paused&&document.querySelector('audio')!.currentTime>.5);
  const values:number[]=[];for(let i=0;i<35;i++){values.push(await page.locator('.radio-device').evaluate(el=>Number((el as HTMLElement).style.getPropertyValue('--signal-accent'))));await page.waitForTimeout(80);}
  assert(Math.max(...values)>.08,'actual bass attacks must register');assert(Math.max(...values)<=.65);assert(Math.max(...values)-Math.min(...values)>.05);
  await page.getByRole('button',{name:'听感与节目',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.radio-device')?.getAttribute('data-covered')==='true');
  assert.equal(await page.locator('.radio-sheet').evaluate(el=>getComputedStyle(el).opacity),'1');await page.waitForTimeout(100);assert(await page.locator('.radio-device').evaluate(el=>Number((el as HTMLElement).style.getPropertyValue('--signal-accent'))<=.143));
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'暂停',exact:true}).click();assert.equal(await page.locator('.radio-device').evaluate(el=>(el as HTMLElement).style.getPropertyValue('--signal-accent')),'0.000');
  if(process.env.EMILY_BROWSER_EVIDENCE_DIR)await writeFile(join(process.env.EMILY_BROWSER_EVIDENCE_DIR,'rhythm-fixture-result.json'),JSON.stringify({fixture:true,actualDecodedBassBursts:true,samples:values,accentCap:.65,modalAttenuates:true,pauseZero:true}));
 }finally{if(browser)await browser.close();await app.close();await provider.close();await rm(directory,{recursive:true,force:true});}
});

test('real browser: exact ONE-song enqueue, continuing chat, no audio/time/pause/roaming replacement; same-element voice preview', {timeout:90_000},async()=>{
 const directory=await mkdtemp(join(process.env.TMPDIR||tmpdir(),'emily-enqueue-browser-')),provider=new HttpFixture();await provider.start();
 const song={id:303,name:'匆匆',ar:[{name:'李建清'}],al:{name:'TEST exact song album',picUrl:'http://p1.music.126.net/test'},dt:120000};
 provider.detailSongs=[song];provider.searchSongs=[song];provider.dialogueMode='valid';provider.playlistSongs=Array.from({length:16},(_,i)=>({id:1001+i,name:`TEST original roam ${i}`,ar:[{name:'Test artist'}],al:{name:'Test album',picUrl:'http://p1.music.126.net/test'},dt:120000}));
 const file=join(directory,'TEST_TONE.mp3');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=25','-codec:a','libmp3lame',file],{timeout:15000});const bytes=await readFile(file);
 const config=loadConfig({EMILY_DATA_DIR:directory,EMILY_OWNER_PASSWORD:OWNER_PASSWORD,EMILY_CREDENTIAL_KEY:'0f'.repeat(32),EMILY_NETEASE_API_BASE:provider.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL,EMILY_MODEL_BASE_URL:provider.base+'v1/',EMILY_MODEL_API_KEY:'TEST',EMILY_MODEL_NAME:'TEST',EMILY_WEB_DIST_DIR:join(root,'apps/web/dist')});
 const app=buildApp({config,tts:new BrowserTts(directory,bytes),mediaOpener:async(_url,range)=>{const bounds=range?.slice(6).split('-')||[],start=bounds[0]?Number(bounds[0]):0,end=bounds[1]?Number(bounds[1]):bytes.length-1,chunk=bytes.subarray(start,end+1);return{status:range?206:200,headers:{'content-type':'audio/mpeg','content-length':String(chunk.length),'accept-ranges':'bytes',...(range?{'content-range':`bytes ${start}-${end}/${bytes.length}`}:{})},stream:Readable.from(chunk)};}});
 let browser;
 try{
  const origin=await app.listen({host:'127.0.0.1',port:0});config.publicOrigin=origin;await app.services.radio.programme({playlistId:'700',roaming:true,limit:8});app.services.radio.updateSettings({djEnabled:false});
  browser=await chromium.launch({headless:true,...(process.env.EMILY_BROWSER_EXECUTABLE?{executablePath:process.env.EMILY_BROWSER_EXECUTABLE}:{channel:'chrome'})});const page=await browser.newPage({viewport:{width:393,height:740}}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await page.getByLabel('个人登录口令').fill(OWNER_PASSWORD);await page.getByRole('button',{name:'进入电台'}).click();await page.locator('.main-play').waitFor();await page.getByRole('button',{name:'播放',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('audio')!.paused&&document.querySelector('audio')!.currentTime>1);await page.getByRole('button',{name:'暂停',exact:true}).click();
  const before=app.services.radio.now(),source=await page.evaluate(()=>document.querySelector('audio')!.currentSrc),time=await page.evaluate(()=>document.querySelector('audio')!.currentTime);await page.getByRole('button',{name:'聊聊想听什么'}).click();await page.getByLabel('告诉 Emily 想听什么').fill('想听李建清的《匆匆》');await page.getByLabel('告诉 Emily 想听什么').press('Enter');await page.getByRole('button',{name:'加入待播：匆匆 · 李建清',exact:true}).waitFor();assert.equal(await page.locator('.listening-proposal li').count(),1);assert.equal(await page.locator('.listening-accept').count(),0);
  const enqueueRequest=page.waitForRequest(r=>r.url().endsWith('/api/queue/add'));await page.getByRole('button',{name:'加入待播：匆匆 · 李建清',exact:true}).click();assert.equal((await enqueueRequest).postDataJSON().listenerNote,'想听李建清的《匆匆》');await page.locator('.listening-result').filter({hasText:'已加入待播队尾，当前播放和原列表不变。'}).waitFor();assert(await page.locator('dialog.listening-dialog[open]').isVisible());
  const after=app.services.radio.now();assert.equal(after.programmeId,before.programmeId);assert.equal(after.status,'paused');assert.equal(after.roaming?.enabled,true);assert.deepEqual(after.queue.slice(0,-1),before.queue);assert.equal(after.queue.at(-1)?.track.id,'303');assert.equal(after.queue.length,before.queue.length+1);assert.equal(app.services.store.history().length,1);assert.equal(await page.evaluate(()=>document.querySelector('audio')!.currentSrc),source);assert.equal(await page.evaluate(()=>document.querySelector('audio')!.currentTime),time);assert(await page.evaluate(()=>document.querySelector('audio')!.paused));
  for(const[width,height]of[[360,560],[393,640],[393,740],[768,1000],[1360,1000]]as const){await page.setViewportSize({width,height});assert(await page.evaluate(()=>{const r=document.querySelector('.listening-compose')!.getBoundingClientRect();return r.bottom<=innerHeight&&r.top>=0&&document.documentElement.scrollWidth<=innerWidth;}));}await page.setViewportSize({width:393,height:740});
  if(process.env.EMILY_BROWSER_EVIDENCE_DIR){await mkdir(process.env.EMILY_BROWSER_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:join(process.env.EMILY_BROWSER_EVIDENCE_DIR,'mobile-enqueue-dialog.png')});}
  await page.getByLabel('告诉 Emily 想听什么').fill('想听李建清的《匆匆》');await page.getByLabel('告诉 Emily 想听什么').press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.listening-proposal li').length===2);await page.getByRole('button',{name:'加入待播：匆匆 · 李建清',exact:true}).last().click();await page.locator('.listening-result').filter({hasText:'这首歌正在播放或已在待播列表中，没有重复加入。'}).waitFor();assert.equal(app.services.radio.now().queue.length,after.queue.length);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'队列',exact:false}).first().click();await page.locator('.queue-row').filter({hasText:'匆匆'}).waitFor();await page.keyboard.press('Escape');await page.locator('.radio-entry').getByRole('button',{name:'节目',exact:true}).click();await page.locator('.mobile-nav').getByRole('button',{name:'设置',exact:true}).click();await page.getByLabel('主持女声').selectOption('zh-TW-HsiaoChenNeural');
  await page.getByRole('button',{name:'试听这条声线'}).click();await page.waitForFunction(()=>document.querySelector('audio')!.currentSrc.includes('/api/audio/')&&!document.querySelector('audio')!.paused);assert.equal(await page.locator('audio').count(),1);assert.equal(app.services.radio.settings().voice,'zh-CN-XiaoxiaoNeural','preview must not save choice');await page.getByRole('button',{name:'停止试听'}).click();await page.waitForFunction(s=>document.querySelector('audio')!.currentSrc===s&&document.querySelector('audio')!.paused,source);await page.waitForFunction(t=>Math.abs(document.querySelector('audio')!.currentTime-t)<.1,time);assert.equal(app.services.radio.now().programmeId,before.programmeId);assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await app.close();await provider.close();await rm(directory,{recursive:true,force:true});}
});

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
        if (name === 'listen') {
          const lower = await page.evaluate(() => {
            const title=document.querySelector('.programme-title')!.getBoundingClientRect();
            const transcript=document.querySelector('.host-preview')!;
            const text=transcript.getBoundingClientRect();
            const tools=document.querySelector('.listening-tools')!;
            const paper=document.querySelector('.player-paper')!;
            return {continuous:getComputedStyle(paper).backgroundColor==='rgba(0, 0, 0, 0)'&&getComputedStyle(paper).borderTopLeftRadius==='0px'&&Math.abs(paper.getBoundingClientRect().top-text.bottom)<1,aligned:Math.abs(title.left-(text.left+28))<2,transparent:getComputedStyle(transcript).backgroundColor==='rgba(0, 0, 0, 0)' ,naturalOrder:!!(transcript.compareDocumentPosition(tools)&Node.DOCUMENT_POSITION_FOLLOWING)&&getComputedStyle(tools).order==='0',quietTarget:document.querySelector('.queue-entry')!.getBoundingClientRect().height>=44};
          });
          assert(lower.continuous && lower.aligned && lower.transparent && lower.naturalOrder && lower.quietTarget, `integrated listening surface at ${width}px`);
        }
        designScreens[`${name}-${width}`] = checks;
        if (env.EMILY_BROWSER_EVIDENCE_DIR && [393,1360].includes(width)) {
          await mkdir(env.EMILY_BROWSER_EVIDENCE_DIR, { recursive: true });
          await page.screenshot({ path: join(env.EMILY_BROWSER_EVIDENCE_DIR, `${width > 740 ? 'desktop' : 'mobile'}-${name}.png`), fullPage: !['qr-dialog','listening-dialog'].includes(name) });
        }
      }
      await page.setViewportSize({ width:393, height:851 });
    }
    async function mobileFirstScreen() {
      const checks: unknown[] = [];
      for (const [width,height] of [[360,560],[393,640],[393,740],[393,851]] as const) {
        await page.setViewportSize({width,height});
        await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
        await page.waitForTimeout(100);
        const result=await page.evaluate(()=>{
          const selectors=['.radio-entry','.on-air','.current-track','.transport-controls','.transport-progress','.listening-tools'];
          return {width:innerWidth,height:innerHeight,cutoff:innerHeight,targets:selectors.map(selector=>({selector,top:document.querySelector(selector)!.getBoundingClientRect().top,bottom:document.querySelector(selector)!.getBoundingClientRect().bottom})),overflow:document.documentElement.scrollWidth>innerWidth,optionsClosed:!document.querySelector('.radio-sheet[open]'),transcriptClosed:!document.querySelector('.radio-sheet[open]'),headerHidden:getComputedStyle(document.querySelector('.app-header')!).display==='none',navHidden:getComputedStyle(document.querySelector('.mobile-nav')!).display==='none',edge:getComputedStyle(document.querySelector('.radio-device')!).borderRadius};
        });
        assert(!result.overflow && result.optionsClosed && result.transcriptClosed && result.headerHidden && result.navHidden && result.edge==='0px');
        assert(result.targets.every(target=>target.top>=0 && target.bottom<=result.cutoff),`key listening content above mobile navigation at ${width}x${height}: ${JSON.stringify(result)}`);
        if(height===560) {
          const stress=await page.evaluate(()=>{
            const title=document.querySelector('.programme-title')!;
            const artist=document.querySelector('.current-track > p')!;
            const speech=document.querySelector('.transcript-text');
            const originals=[title.textContent,artist.textContent,speech?.textContent];
            title.textContent='A very long original track title / 一首名字很长很长的原始歌曲';
            artist.textContent='Original artist with a very long name / 原始歌手姓名';
            if(speech)speech.textContent='A long real hosting passage remains available in full through its clearly marked disclosure. '.repeat(20);
            const bottom=document.querySelector('.listening-tools')!.getBoundingClientRect().bottom;
            title.textContent=originals[0]!;artist.textContent=originals[1]!;if(speech)speech.textContent=originals[2]!;
            return {bottom,cutoff:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};
          });
          assert(!stress.overflow && stress.bottom<=stress.cutoff,`long catalogue/hosting content still exposes actions: ${JSON.stringify(stress)}`);
          checks.push({stress});
        }
        checks.push(result);
      }
      await page.setViewportSize({width:393,height:851});
      const source=await page.evaluate(()=>document.querySelector('audio')!.currentSrc);
      const paused=await page.evaluate(()=>document.querySelector('audio')!.paused);
      await page.getByRole('button',{name:'阅读主持全文'}).click();
      assert(await page.locator('.transcript-full').isVisible(),'full hosting remains accessible');
      assert(await page.locator('.sheet-transport .main-play').isVisible());
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('button',{name:'阅读主持全文'}).evaluate(el=>el===document.activeElement),true,'sheet returns focus');
      await page.getByRole('button',{name:'听感与节目',exact:true}).click();
      assert(await page.getByLabel('音量',{exact:true}).isVisible());
      await page.getByRole('button',{name:'关闭播放面板'}).click();
      // Long sheet content scrolls internally, never hides its own transport.
      await page.setViewportSize({width:360,height:560});
      await page.getByRole('button',{name:'阅读主持全文'}).click();
      await page.locator('.transcript-full').evaluate(el=>{el.textContent='Explicit browser-only long hosting fixture. '.repeat(160);});
      await page.waitForTimeout(350);
      assert(await page.locator('.radio-sheet-content').evaluate(el=>el.scrollHeight>el.clientHeight));
      const sheetBounds=await page.evaluate(()=>({footer:document.querySelector('.sheet-transport')!.getBoundingClientRect().bottom,height:innerHeight,dialog:document.querySelector('.radio-sheet')!.getBoundingClientRect().toJSON()}));
      assert(sheetBounds.footer<=sheetBounds.height,JSON.stringify(sheetBounds));
      await page.locator('.radio-sheet-content').evaluate(el=>el.scrollTo({top:el.scrollHeight}));
      await page.keyboard.press('Tab');
      assert(await page.evaluate(()=>!!document.activeElement?.closest('.radio-sheet')),'native modal keeps keyboard focus');
      await page.mouse.click(8,8); // Explicit backdrop dismissal.
      assert.equal(await page.locator('.radio-sheet').count(),0);
      await page.setViewportSize({width:393,height:851});
      assert.equal(await page.evaluate(()=>document.querySelector('audio')!.currentSrc),source,'disclosure never changes audio');
      assert.equal(await page.evaluate(()=>document.querySelector('audio')!.paused),paused);
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      designScreens.mobileFirstScreen=checks;
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
    // Full-screen listen has an explicit return; other pages retain navigation.
    const nav = () => ({ getByRole: (_role: string, options: {name:string;exact?:boolean}) => ({ click: async () => {
      if(!await page.locator('.mobile-nav').isVisible()) await page.locator('.radio-entry').getByRole('button',{name:'节目',exact:true}).click();
      await page.locator('.mobile-nav').getByRole('button',options).click();
    } }) });
    async function toggleQuiet() { await page.getByRole('button',{name:'听感与节目',exact:true}).click(); await page.getByRole('button',{name:'安静模式',exact:true}).click(); await page.getByRole('button',{name:'关闭播放面板'}).click(); }
    await nav().getByRole("button", { name: "历史", exact: true }).click();
    await page.getByText("第一档节目，留给现在。", {exact:true}).waitFor();
    await reviewScreen('empty-history');
    await nav().getByRole("button", { name: "节目", exact: true }).click();
    await page.locator('.playlist-card').first().waitFor();
    await reviewScreen('library');
    await page.getByRole("button", { name: /Fixture owner playlist/ }).click();
    await page.getByLabel('原歌单自动漫游').uncheck();
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
    assert.equal(await page.locator(".host-preview").getAttribute("data-speaking"), "true");
    await mobileFirstScreen();
    await page.waitForFunction(()=>Number((document.querySelector('.radio-device') as HTMLElement)!.style.getPropertyValue('--signal-energy'))>0);
    assert.equal(await page.locator('.radio-device').getAttribute('data-motion'),'live');
    assert(await page.locator('.host-light').evaluate(el=>Number(getComputedStyle(el).opacity)>0),'surround light follows actual audio energy');
    assert.equal(await page.locator('.listen-column').evaluate(el=>getComputedStyle(el,'::before').animationName),'none','no autonomous room drift');
    assert.equal(await page.locator('.listening-light').evaluate(el=>getComputedStyle(el).animationName),'none','light is driven only by measured envelope');
    const stableTitle=await page.locator('.current-track').boundingBox();
    await page.waitForTimeout(120);assert.deepEqual(await page.locator('.current-track').boundingBox(),stableTitle,'audio motion never moves the reading anchor');
    await page.getByRole('button',{name:'阅读主持全文'}).click();
    await page.waitForFunction(()=>document.querySelector('.radio-device')?.getAttribute('data-covered')==='true');
    assert.equal(await page.locator('.radio-sheet').evaluate(el=>getComputedStyle(el).opacity),'1','opening sheet never crossfades text over the player');
    assert.equal(await page.evaluate(()=>document.querySelector('audio')!.paused),false);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.querySelector('.radio-device')?.getAttribute('data-covered')==='false');
    assert(await page.locator('.player-paper').evaluate(el=>Number(getComputedStyle(el,'::before').opacity)>0),'light extends into lower playback area');
    await page.setViewportSize({width:1360,height:1000});
    await page.getByRole('button',{name:'进入沉浸模式',exact:true}).click();
    assert.equal(await page.evaluate(()=>document.querySelector('audio')!.paused),false,'immersion never interrupts audio');
    if(env.EMILY_BROWSER_EVIDENCE_DIR) await page.screenshot({path:join(env.EMILY_BROWSER_EVIDENCE_DIR,'mobile-immersive-playing.png'),fullPage:true});
    await page.getByRole('button',{name:'退出沉浸模式',exact:true}).click();
    await page.setViewportSize({width:393,height:851});
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
    assert.equal(await page.locator('.radio-device').getAttribute('data-motion'),'still');
    assert.equal(await page.locator('.listen-column').evaluate(el=>getComputedStyle(el,'::before').animationName),'none');
    assert.equal(await page.locator('.listening-light').evaluate(el=>getComputedStyle(el).animationName),'none');
    assert.equal(await page.locator('.radio-device').evaluate(el=>(el as HTMLElement).style.getPropertyValue('--signal-accent')),'0.000');
    assert.equal(await page.locator('.radio-device').evaluate(el=>(el as HTMLElement).style.getPropertyValue('--signal-energy')),'0.000');
    await page.setViewportSize({width:1360,height:1000});
    await page.getByRole('button',{name:'进入沉浸模式',exact:true}).click();
    for(const width of [393,1360,360,768]) {
      await page.setViewportSize({width,height:width>740?1000:851});
      assert.equal(await page.locator('.app-header').isVisible(),false);
      assert.equal(await page.locator('.mobile-nav').isVisible(),false);
      assert.equal(await page.locator('.radio-entry').getByRole('button',{name:'节目',exact:true}).isVisible(),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.equal(await page.evaluate(()=>document.querySelector('audio')!.paused),true);
      if(env.EMILY_BROWSER_EVIDENCE_DIR && [393,1360].includes(width)) await page.screenshot({path:join(env.EMILY_BROWSER_EVIDENCE_DIR,`${width>740?'desktop':'mobile'}-immersive.png`),fullPage:true});
    }
    await page.setViewportSize({width:393,height:851});
    await page.getByRole('button',{name:'听感与节目',exact:true}).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.radio-sheet').count(),0);
    assert(await page.locator('.app-shell').evaluate(el=>el.classList.contains('immersive')),'first Escape closes sheet, not immersive layout');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.mobile-nav').isVisible(),false,'mobile listen is already immersive');
    assert.equal(await page.evaluate(()=>document.querySelector('audio')!.currentSrc.includes('/api/audio/')),true);
    await page.getByRole("button", { name: "播放", exact: true }).click();
    await wait(page, () => !document.querySelector("audio")!.paused);
    await toggleQuiet();
    await wait(page, () => {
      const a = document.querySelector("audio")!;
      return !a.paused && a.currentSrc.includes("/api/media/track/101") && a.currentTime > 0;
    });
    await page.locator('.lyrics-preview').waitFor();
    assert.equal(await page.getByText('Emily 正在串场',{exact:true}).count(),0);
    const lyricsSource=await page.evaluate(()=>document.querySelector('audio')!.currentSrc);
    await page.getByRole('button',{name:'阅读完整歌词'}).click();
    assert(await page.locator('.lyrics-full').isVisible());
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>document.querySelector('audio')!.currentSrc),lyricsSource);
    phases.push("song-after-quiet");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(80); // Allow the media-query change event to redraw its static baseline.
    assert.equal(await page.locator('.radio-device').getAttribute('data-motion'),'still');
    assert.equal(await page.locator('.host-light').evaluate(el=>getComputedStyle(el).opacity),'0');
    assert.equal(await page.locator('.listening-light').evaluate(el=>getComputedStyle(el).opacity),'0');
    const stillFrame = await page.locator(".radio-signal").evaluate((el: HTMLCanvasElement) => el.toDataURL());
    await page.waitForTimeout(100);
    assert.equal(await page.locator(".radio-signal").evaluate((el: HTMLCanvasElement) => el.toDataURL()), stillFrame);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.getByLabel("歌曲播放进度").fill("1");
    assert(await page.evaluate(() => document.querySelector("audio")!.currentTime) >= 0.8);
    await toggleQuiet();
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
    await page.getByRole('button',{name:/查看队列/}).click();
    await page.locator('.queue-row').first().waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert(await page.locator('.sheet-transport').isVisible());
    await page.waitForTimeout(400);
    if(env.EMILY_BROWSER_EVIDENCE_DIR) await page.screenshot({path:join(env.EMILY_BROWSER_EVIDENCE_DIR,'mobile-queue-sheet.png')});
    for(const width of [360,393,768,1360]) {
      await page.setViewportSize({width,height:width<=740?560:1000});
      const bounds=await page.locator('.radio-sheet').evaluate(el=>{const r=el.getBoundingClientRect();return {fits:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,footer:document.querySelector('.sheet-transport')!.getBoundingClientRect().bottom<=innerHeight};});
      assert(bounds.fits&&bounds.footer,`sheet at ${width}`);
    }
    await page.setViewportSize({width:393,height:851});
    const sheetSource=await page.evaluate(()=>document.querySelector('audio')!.currentSrc);
    await page.locator('.sheet-transport').getByRole('button',{name:'播放',exact:true}).click();
    await wait(page,()=>!document.querySelector('audio')!.paused);
    await page.locator('.sheet-transport').getByRole('button',{name:'暂停',exact:true}).click();
    assert.equal(await page.evaluate(()=>document.querySelector('audio')!.currentSrc),sheetSource,'sheet resume/pause does not replace source');
    await page.getByRole('button',{name:'关闭播放面板'}).click();
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
    await page.getByLabel("主持女声", { exact: true }).waitFor();
    await reviewScreen('settings');
    await page.getByLabel("主持女声", { exact: true }).selectOption("en-GB-SoniaNeural");
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
    // Explicit conversation fixture for browser UI; server model/rights contracts
    // are independently exercised by conversation.test.ts.
    await page.route('**/api/setup', async route => {
      const response=await route.fetch();const payload=await response.json();payload.data.model.configured=true;
      await route.fulfill({response,json:payload});
    },{times:1});
    await page.getByRole('button',{name:'重新检查服务配置'}).click();
    await nav().getByRole('button',{name:'收听',exact:true}).click();
    await page.getByRole('button',{name:'聊聊想听什么'}).click();
    await page.getByRole('button',{name:'另选一组',exact:true}).click();
    let dialogueCalls=0;
    await page.route('**/api/conversation',async route=>{
      const body=route.request().postDataJSON();dialogueCalls++;
      if(dialogueCalls===2){assert.equal(body.messages.length,3);assert.equal(body.messages[2].text,'不要太伤感');}
      await route.fulfill({json:{ok:true,data:{reply:dialogueCalls===1?'想听中文歌还是英文歌？':'找到了这些真实候选，由你确认后播放。',tracks:dialogueCalls===1?[]:[{id:'101',title:'Fixture track 101',artist:'Fixture artist',source:'netease'}],warnings:[],direction:'中文、温柔、不伤感',context:{prompt:'中文、温柔、不伤感',trackIds:dialogueCalls===1?[]:['101']},mode:'replace',...(dialogueCalls===1?{}:{programme:{trackIds:['101'],prompt:'温柔但不伤感',limit:1,ordered:true}})}}});
    });
    await page.getByLabel('告诉 Emily 想听什么').fill('想听温柔一点的中文歌');
    await page.getByRole('button',{name:'发送听歌想法'}).click();
    await page.getByText('想听中文歌还是英文歌？',{exact:true}).waitFor();
    await page.getByLabel('告诉 Emily 想听什么').fill('不要太伤感');
    await page.getByRole('button',{name:'发送听歌想法'}).click();
    await page.getByRole('button',{name:'确认换成这 1 首',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>document.querySelector('audio')!.paused),true,'consultation does not interrupt playback');
    await reviewScreen('listening-dialog');
    await page.getByRole('button',{name:'关闭对话'}).click();
    await nav().getByRole('button',{name:'历史',exact:true}).click();
    await nav().getByRole('button',{name:'收听',exact:true}).click();
    await page.getByRole('button',{name:'聊聊想听什么'}).click();
    await page.getByRole('button',{name:'另选一组',exact:true}).click();
    await page.getByRole('button',{name:'确认换成这 1 首',exact:true}).click();
    await wait(page,()=>!document.querySelector('audio')!.paused);
    await page.getByRole('button',{name:'暂停',exact:true}).click();
    await page.getByRole('button',{name:'聊聊想听什么'}).click();
    await page.getByRole('button',{name:'清空对话'}).click();
    assert.equal(await page.getByRole('button',{name:'确认换成这 1 首',exact:true}).count(),0);
    await page.getByRole('button',{name:'关闭对话'}).click();
    await nav().getByRole('button',{name:'设置',exact:true}).click();
    // New playlist roaming actually extends the backend queue from real ended
    // events, with explicitly generated test-only catalogue/tone audio.
    provider.playlistSongs=Array.from({length:16},(_,i)=>({id:1001+i,name:`Fixture roam ${i}`,ar:[{name:'Fixture artist'}],al:{name:'Fixture album',picUrl:'http://p1.music.126.net/test-fixture-cover'},dt:120000}));
    await nav().getByRole('button',{name:'节目',exact:true}).click();
    await page.getByRole('button',{name:/Fixture owner playlist/}).click();
    await page.getByLabel('原歌单自动漫游').check();
    await page.getByRole('button',{name:'开始这档节目'}).click();
    await toggleQuiet();
    for(let i=0;i<12;i++){
      const old=await page.evaluate(()=>document.querySelector('audio')!.currentSrc);
      await page.getByLabel('歌曲播放进度').fill('2.9');
      await page.waitForFunction(old=>{const a=document.querySelector('audio')!;return a.currentSrc!==old&&!a.paused&&a.currentTime>0;},old);
    }
    await page.getByRole('button',{name:'暂停',exact:true}).click();
    assert(app.services.radio.now().queue.some(item=>item.track.id==='1013'),'batch13 is reached through actual ended/auto-refill');
    assert.equal(new Set(app.services.radio.now().queue.map(i=>i.track.id)).size,app.services.radio.now().queue.length);
    const pausedSource = await page.evaluate(()=>document.querySelector('audio')!.currentSrc);
    await page.getByRole('button',{name:'听感与节目',exact:true}).click();
    await page.getByRole('button',{name:'原歌单漫游 · 开启',exact:true}).click();
    await page.getByRole('button',{name:'原歌单漫游 · 关闭',exact:true}).waitFor();
    assert.equal(await page.getByText('正在准备下一批',{exact:true}).count(),0);
    assert.equal(await page.evaluate(()=>document.querySelector('audio')!.currentSrc),pausedSource);
    assert.equal(await page.evaluate(()=>document.querySelector('audio')!.paused),true);
    await page.getByRole('button',{name:'安静模式',exact:true}).click();
    await page.getByRole('button',{name:'关闭播放面板'}).click();
    await nav().getByRole('button',{name:'设置',exact:true}).click();
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
    assert.equal(await page.locator('.lyrics-preview,.lyrics-full').count(),0,'logout removes private lyrics');
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
    const evidence = { realBrowser: browser.version(), mobileViewport: "393x851", phases, designScreens, fullScreenRadioAndBottomSheetsVerified:true, mobileFirstScreenAndDisclosuresVerified:true, continuousDarkListeningSurfaceVerified:true, immersiveMotionVerified:true, energyPauseAndReducedMotionVerified:true, immersiveFourWidthsAndEscapeVerified:true, integratedLowerSurfaceVerified: true, conversationRefinementAndExplicitPlayVerified:true, playlistRoamingPastBatchVerified:true, realAudioSignalVerified: true, noVinylOrCoverStage: true, reducedMotionVerified: true, repairedIntroOnFirstPlay: true, pausedPositionStable: true, seek: true, feedback: true, history: true, logoutAudioCleared: true, serviceWorkerInstalled: true, offlineShell: true, cachedPaths: cached, pageErrors: errors, provider: "explicit local HTTP fixture", media: "explicit ffmpeg tone MP3 fixture, not NetEase music or human listening" };
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
