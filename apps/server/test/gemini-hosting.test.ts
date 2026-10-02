import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { DjSegment } from "@emily/shared";
import { voiceLanguage } from "@emily/shared";
import { loadConfig } from "../src/config.js";
import { GeminiTtsPreview, GEMINI_TTS_MODEL } from "../src/gemini-tts.js";
import { HostingTts } from "../src/hosting-tts.js";
import { buildApp } from "../src/app.js";
import { COOKIE_SENTINEL, FixtureTts, HttpFixture, headers, login, ORIGIN, OWNER_PASSWORD, temporaryDirectory } from "./helpers.js";
const KEY = "TEST_ONLY_HOSTING_KEY_NOT_REAL";
const env = (dir: string) => ({ EMILY_DATA_DIR:dir, EMILY_GEMINI_TTS_API_KEY:KEY, EMILY_GEMINI_TTS_FREE_TIER_CONFIRMED:"true", EMILY_GEMINI_TTS_HOSTING_ENABLED:"true", EMILY_OWNER_PASSWORD:OWNER_PASSWORD, EMILY_PUBLIC_ORIGIN:ORIGIN });
const wait = async (check:()=>boolean) => { for(let i=0;i<300&&!check();i++) await new Promise(r=>setTimeout(r,10)); assert(check()); };
async function wav(dir:string) { const file=join(dir,"fixture.wav");execFileSync("ffmpeg",["-nostdin","-v","error","-f","lavfi","-i","sine=frequency=330:sample_rate=24000:duration=1","-c:a","pcm_s16le",file],{timeout:10000,windowsHide:true});return readFile(file); }
const audio = (bytes:Buffer) => Response.json({status:"completed",steps:[{type:"model_output",content:[{type:"audio",mime_type:"audio/wav",data:bytes.toString("base64")}]}]});

test("formal Gemini gate, bounded final script and explicit routing never fall back to Edge on provider failure",async()=>{
 const dir=await temporaryDirectory();let calls=0,edgeCalls=0;
 const edge=new FixtureTts(dir);edge.segment=async()=>{edgeCalls++;throw Error("Edge must not receive Gemini text");};
 const gemini=new GeminiTtsPreview(loadConfig(env(dir)),()=>true,Date.now,{fetch:async()=>{calls++;return new Response("PRIVATE_PROVIDER_DIAGNOSTIC",{status:429});}}),tts=new HostingTts(edge,gemini);
 try{
  assert.throws(()=>loadConfig({EMILY_GEMINI_TTS_HOSTING_ENABLED:"true"}));assert.equal(voiceLanguage("gemini:Sulafat"),"zh");assert(await tts.available("gemini:Sulafat"));
  await assert.rejects(tts.segment("超".repeat(281),"gemini:Sulafat"));await assert.rejects(tts.segment("<script>不允许标签</script>","gemini:Sulafat"));assert.equal(calls,0);
  const failure=await tts.segment("这是一段固定的中文检查样文。","gemini:Sulafat");assert.equal(failure.status,"tts_failed");assert.equal(failure.audioUrl,undefined);assert(tts.matches(failure,"gemini:Sulafat"));assert.equal(edgeCalls,0);assert.equal(calls,1);
  await tts.segment("另外一段固定样文。","gemini:Sulafat");assert.equal(calls,1,"provider429 stops subsequent network requests during cooldown");
  assert(!tts.matches({...failure,model:"gemini-3.8-flash-tts"},"gemini:Sulafat"));assert(!tts.matches({...failure,deliveryVersion:1},"gemini:Sulafat"));assert(!tts.matches(failure,"zh-CN-XiaoyiNeural"));
 }finally{await gemini.close();await rm(dir,{recursive:true,force:true});}
});

test("formal Gemini saved voice replaces only delivery; lookahead deduplicates and pause wins while actual tone conversion is pending",async()=>{
 const dir=await temporaryDirectory(),provider=new HttpFixture();await provider.start();const bytes=await wav(dir),bodies:Record<string,any>[]=[];let release!:()=>void;const gate=new Promise<void>(r=>{release=r;});
 const config=loadConfig({...env(dir),EMILY_NETEASE_API_BASE:provider.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL});
 const gemini=new GeminiTtsPreview(config,()=>true,Date.now,{fetch:async(_url,init)=>{bodies.push(JSON.parse(String(init?.body)));await gate;return audio(bytes);}});
 const app=buildApp({config,tts:new HostingTts(new FixtureTts(dir,true),gemini),geminiPreview:gemini});
 let playing:ReturnType<typeof app.services.radio.play>|undefined;
 try{
  const cookie=await login(app);await app.services.radio.programme({limit:2});await new Promise(r=>setTimeout(r,40));const before=app.services.radio.now(),history=app.services.store.history(),settings=app.services.radio.settings();
  const selected=await app.inject({method:"PATCH",url:"/api/settings",headers:headers(cookie),payload:{voice:"gemini:Sulafat"}});assert.equal(selected.statusCode,200);assert.equal(selected.json().data.hostLanguage,"zh");assert.equal(app.services.radio.now().dj,undefined,"old Edge DJ never masquerades as Gemini");
  playing=app.services.radio.play();await wait(()=>bodies.length===2);await app.services.radio.pause();release();const prepared=await playing;
  assert.equal(prepared.now.status,"paused");assert.equal(prepared.now.dj?.status,"tts_ready");assert.equal(prepared.now.dj?.provider,"gemini");assert.equal(prepared.now.dj?.model,GEMINI_TTS_MODEL);assert.equal(prepared.now.programmeId,before.programmeId);assert.deepEqual(prepared.now.queue.map(i=>[i.id,i.track.id]),before.queue.map(i=>[i.id,i.track.id]));assert.deepEqual(app.services.store.history(),history);
  assert.deepEqual(app.services.radio.settings(),{...settings,voice:"gemini:Sulafat",hostLanguage:"zh"});
  await app.services.radio.move(1);assert.equal(bodies.length,2,"next uses prepared Gemini audio");assert.equal(app.services.radio.now().dj?.provider,"gemini");
  for(const body of bodies){assert.equal(body.store,false);assert.equal(body.model,GEMINI_TTS_MODEL);assert.equal(body.input.length,1);assert(!JSON.stringify(body).includes(COOKIE_SENTINEL));assert(!JSON.stringify(body).includes(KEY));}
  assert.equal((await app.inject({method:"PATCH",url:"/api/settings",headers:headers(cookie),payload:{voice:"gemini:Aoede"}})).statusCode,400,"unverified audition candidate cannot become formal host");
 }finally{release();await playing?.catch(()=>{});await app.close();await provider.close();await rm(dir,{recursive:true,force:true});}
});

test("restart rejects stale Gemini model/profile references but preserves scripts, programme, queue and history without startup synthesis",async()=>{
 const dir=await temporaryDirectory(),provider=new HttpFixture();await provider.start();const bytes=await wav(dir),config=loadConfig({...env(dir),EMILY_NETEASE_API_BASE:provider.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL,EMILY_TTS_VOICE:"gemini:Sulafat"});let calls=0;
 const create=()=>{const gemini=new GeminiTtsPreview(config,()=>true,Date.now,{fetch:async()=>{calls++;return audio(bytes);}});return buildApp({config,tts:new HostingTts(new FixtureTts(dir),gemini),geminiPreview:gemini});};
 let app=create();
 try{
  await app.services.radio.programme({limit:1});const before=app.services.radio.now(),history=app.services.store.history();const state=app.services.store.get<{items:{dj?:DjSegment;hosting:string}[]}>("radio")!;state.items[0]!.dj!.model="old-gemini-model";app.services.store.set("radio",state);await app.close();const count=calls;app=create();
  assert.equal(calls,count,"startup never generates");assert.equal(app.services.radio.now().dj,undefined);assert.equal(app.services.radio.now().programmeId,before.programmeId);assert.deepEqual(app.services.radio.now().queue,before.queue);assert.deepEqual(app.services.store.history(),history);
  await app.services.radio.play();assert.equal(app.services.radio.now().dj?.model,GEMINI_TTS_MODEL);assert.equal(calls,count,"valid current-identity audio cache may be reused after stale state reference is removed");
 }finally{await app.close();await provider.close();await rm(dir,{recursive:true,force:true});}
});
