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
import { GeminiTtsPreview, GEMINI_TTS_MODEL } from "../apps/server/src/gemini-tts.js";
import { HostingTts } from "../apps/server/src/hosting-tts.js";
import { COOKIE_SENTINEL, FixtureTts, HttpFixture, OWNER_PASSWORD } from "../apps/server/test/helpers.js";

// Only explicit local catalogue + synthetic audio fixture, no Google/key/real account.
test("formal Gemini browser: saved host, Chinese language, actual host-to-song, prefetched next, same-audio audition and preserved programme",{timeout:90000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),"emily-gemini-host-browser-")),root=dirname(dirname(fileURLToPath(import.meta.url))),provider=new HttpFixture();await provider.start();
 const songFile=join(dir,"song.mp3"),wavFile=join(dir,"voice.wav");execFileSync("ffmpeg",["-nostdin","-v","error","-f","lavfi","-i","sine=frequency=440:duration=30","-c:a","libmp3lame",songFile],{timeout:10000,windowsHide:true});execFileSync("ffmpeg",["-nostdin","-v","error","-f","lavfi","-i","sine=frequency=330:sample_rate=24000:duration=2","-c:a","pcm_s16le",wavFile],{timeout:10000,windowsHide:true});const song=await readFile(songFile),wav=await readFile(wavFile);let calls=0;
 const config=loadConfig({EMILY_DATA_DIR:dir,EMILY_OWNER_PASSWORD:OWNER_PASSWORD,EMILY_CREDENTIAL_KEY:"0f".repeat(32),EMILY_NETEASE_API_BASE:provider.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL,EMILY_WEB_DIST_DIR:join(root,"apps/web/dist"),EMILY_GEMINI_TTS_API_KEY:"TEST_ONLY_HOSTING_KEY_NOT_REAL",EMILY_GEMINI_TTS_FREE_TIER_CONFIRMED:"true",EMILY_GEMINI_TTS_HOSTING_ENABLED:"true"});
 const gemini=new GeminiTtsPreview(config,()=>true,Date.now,{fetch:async(_url,init)=>{calls++;assert(!String(init?.body).includes(COOKIE_SENTINEL));return Response.json({status:"completed",steps:[{type:"model_output",content:[{type:"audio",mime_type:"audio/wav",data:wav.toString("base64")}]}]});}});
 const app=buildApp({config,tts:new HostingTts(new FixtureTts(dir,true),gemini),geminiPreview:gemini,mediaOpener:async(_url,range)=>{const bounds=range?.slice(6).split("-")||[],start=bounds[0]?Number(bounds[0]):0,end=bounds[1]?Number(bounds[1]):song.length-1,chunk=song.subarray(start,end+1);return{status:range?206:200,headers:{"content-type":"audio/mpeg","content-length":String(chunk.length),"accept-ranges":"bytes",...(range?{"content-range":`bytes ${start}-${end}/${song.length}`}:{})},stream:Readable.from(chunk)};}});
 let browser;
 try{
  const origin=await app.listen({host:"127.0.0.1",port:0});config.publicOrigin=origin;await app.services.radio.programme({limit:2});const before=app.services.radio.now(),history=app.services.store.history();
  browser=await chromium.launch({headless:true,...(process.env.EMILY_BROWSER_EXECUTABLE?{executablePath:process.env.EMILY_BROWSER_EXECUTABLE}:{channel:"chrome"})});const page=await browser.newPage({viewport:{width:393,height:740}}),errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(origin);await page.getByLabel("个人登录口令").fill(OWNER_PASSWORD);await page.getByRole("button",{name:"进入电台"}).click();await page.locator(".main-play").waitFor();await page.locator(".radio-entry").getByRole("button",{name:"节目",exact:true}).click();await page.locator(".mobile-nav").getByRole("button",{name:"设置",exact:true}).click();
  assert.equal(await page.getByLabel("试听引擎",{exact:true}).count(),0,"formal host does not require a separate audition-engine selection");await page.getByLabel("主持女声",{exact:true}).selectOption("gemini:Sulafat");await page.getByRole("button",{name:"保存偏好",exact:true}).click();await page.getByText("已保存",{exact:true}).waitFor();assert.equal(app.services.radio.settings().voice,"gemini:Sulafat");assert.equal(app.services.radio.settings().hostLanguage,"zh");
  await page.getByText("可用 · Sulafat · Gemini 中文主持",{exact:true}).waitFor();
  await page.locator(".mobile-nav").getByRole("button",{name:"收听",exact:true}).click();await page.getByRole("button",{name:"播放",exact:true}).click();await page.waitForFunction(()=>document.querySelector("audio")!.currentSrc.includes("/api/audio/")&&!document.querySelector("audio")!.paused);assert.equal(app.services.radio.now().dj?.model,GEMINI_TTS_MODEL);assert.equal(await page.locator("audio").evaluate(el=>(el as HTMLAudioElement).volume),app.services.radio.settings().volume*.9);
  await page.waitForFunction(()=>document.querySelector("audio")!.currentSrc.includes("/api/media/track/")&&!document.querySelector("audio")!.paused);await page.getByRole("button",{name:"暂停",exact:true}).click();const source=await page.locator("audio").evaluate(el=>{(window as any).__hostAudio=el;return (el as HTMLAudioElement).currentSrc;}),time=await page.locator("audio").evaluate(el=>(el as HTMLAudioElement).currentTime);
  await page.locator(".radio-entry").getByRole("button",{name:"节目",exact:true}).click();await page.locator(".mobile-nav").getByRole("button",{name:"设置",exact:true}).click();assert.equal(await page.getByLabel("主持女声").inputValue(),"gemini:Sulafat");await page.getByRole("button",{name:"试听这条声线",exact:true}).click();await page.waitForFunction(()=>document.querySelector("audio")!.currentSrc.includes("/api/audio/")&&!document.querySelector("audio")!.paused);await page.waitForFunction(s=>document.querySelector("audio")!.currentSrc===s&&document.querySelector("audio")!.paused,source);await page.waitForFunction(t=>Math.abs(document.querySelector("audio")!.currentTime-t)<.1,time);assert(await page.evaluate(()=>(window as any).__hostAudio===document.querySelector("audio")));assert.equal(calls,3);
  for(const[width,height]of[[360,560],[393,640],[393,740],[393,851]]){await page.setViewportSize({width:width!,height:height!});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  if(process.env.EMILY_BROWSER_EVIDENCE_DIR){await mkdir(process.env.EMILY_BROWSER_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:join(process.env.EMILY_BROWSER_EVIDENCE_DIR,"gemini-formal-host-fixture.png"),fullPage:true});}
  assert.equal(app.services.radio.now().programmeId,before.programmeId);assert.deepEqual(app.services.radio.now().queue.map(i=>[i.id,i.track.id]),before.queue.map(i=>[i.id,i.track.id]));assert.deepEqual(app.services.store.history(),history);assert.equal(app.services.radio.now().status,"paused");assert.equal(await page.locator("audio").count(),1);assert.deepEqual(errors,[]);
  const next=await app.services.radio.move(1);assert.equal(next.now.dj?.provider,"gemini");assert.equal(calls,3,"next reuses already generated host");await page.getByRole("button",{name:"退出个人电台"}).click();await page.getByLabel("个人登录口令").waitFor();assert.equal(await page.locator("audio").getAttribute("src"),null);
 }finally{if(browser)await browser.close();await app.close();await provider.close();await rm(dir,{recursive:true,force:true});}
});
