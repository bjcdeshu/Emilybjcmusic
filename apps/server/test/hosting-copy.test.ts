import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import type { RadioSettings, Track } from "@emily/shared";
import { EMILY_MANDARIN_HOST, HOSTING_VERSION, hostingData } from "../src/hosting-editor.js";
import { ProgrammeSelector } from "../src/model.js";
import { loadConfig } from "../src/config.js";

// Synthetic copy/context and HTTP replies test contracts, NOT provider writing quality.
const track: Track = { id:"101", title:"测试曲目", artist:"测试歌手", source:"netease" };
const settings: RadioSettings = { hostLanguage:"zh", voice:"gemini:Sulafat", djEnabled:true, discovery:false, mood:"Easy and unhurried", volume:.6 };

test("conversational writing receives bounded truthful context without inventing listening or a generic minimum length", () => {
 const notes="测试语境".repeat(200), recent=Array.from({length:5},(_,i)=>`${i}：${"测试".repeat(200)}`);
 const data=hostingData(track,{requestedBy:"fallback",listenerNote:notes,programmePrompt:notes,previous:track,recentHosting:recent,position:"continuation"},"随意".repeat(200));
 assert.equal(data.origin,"fallback");assert.equal(data.position,"continuation");assert.equal(data.listenerNote?.length,600);assert.equal(data.programmeDirection?.length,600);assert.equal(data.moodPreference.length,160);
 assert.deepEqual(data.recentScriptsForAvoidingRepetition,recent.slice(-3).map(s=>s.slice(0,280)));assert.equal(data.previousInQueueNotProofOfListening?.title,track.title);
 const empty=hostingData({...track,title:"テスト",artist:"テスト歌手"},{},settings.mood);assert.equal(empty.listenerNote,null);assert.equal(empty.programmeDirection,null);assert.equal(empty.track.spokenTitle,null);assert.equal(empty.track.spokenArtist,null);
 assert.equal(HOSTING_VERSION,5);assert.match(EMILY_MANDARIN_HOST,/不证明播放过或听完了/);assert.match(EMILY_MANDARIN_HOST,/不从《匆匆》推导慢下来/);
});

test("both one-track and batch paths send the new policy, accept variable-length copy, retain bounds and never rewrite catalogue IDs",async()=>{
 const requests:{messages:{role:string;content:string}[]}[]=[];let invalid=false;
 const short="好，就听测试歌手的《测试曲目》。",long="今天的事情做完了，还想听这首庆祝一下，那就放这首。要是每次都得等到什么大事才庆祝，也太难等了。测试歌手的《测试曲目》，现在放。";
 const server=createServer(async(req,res)=>{const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const body=JSON.parse(Buffer.concat(chunks).toString());requests.push(body);const single=body.messages[0].content.includes("HOST_ONE:");const text=invalid?"长".repeat(281):short;res.setHeader("Content-Type","application/json");res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(single?{hosting:text}:{title:"测试节目",selections:[{id:"101",reason:"测试原因",hosting:text},{id:"202",reason:"另一测试原因",hosting:long}]})}}]}));});
 server.listen(0,"127.0.0.1");await once(server,"listening");const address=server.address();assert(address&&typeof address==="object");
 const selector=new ProgrammeSelector(loadConfig({EMILY_MODEL_BASE_URL:`http://127.0.0.1:${address.port}/v1`,EMILY_MODEL_API_KEY:"TEST_ONLY_COPY_KEY",EMILY_MODEL_NAME:"fixture"}));
 try{
  const note="PRIVATE_TEST_ONLY 想重听这首",prior=["最近的测试串场。"];
  const host=await selector.host(track,settings,{requestedBy:"user",listenerNote:note,recentHosting:prior});assert.equal(host.text,short);assert.equal(host.warning,undefined);
  const data=JSON.parse(requests[0]!.messages[1]!.content);assert.equal(data.listenerNote,note);assert.equal(data.origin,"user");assert.deepEqual(data.recentScriptsForAvoidingRepetition,prior);
  const tracks=[track,{...track,id:"202",title:"另一测试曲目"}];const batch=await selector.select(tracks,{limit:2,prompt:"虚构场景：事情做完想庆祝"},settings,new Map(),undefined,prior);
  assert.equal(batch.source,"model");assert.deepEqual(batch.items.map(i=>i.track.id),["101","202"]);assert.deepEqual(batch.items.map(i=>i.hosting),[short,long]);assert(batch.items.every(i=>i.hostingVersion===HOSTING_VERSION));
  assert(requests.every(r=>r.messages[0]!.content.startsWith(EMILY_MANDARIN_HOST)));assert.match(requests[1]!.messages[0]!.content,/不强行为每首找感悟或问题/);assert.equal(requests.length,2);
  invalid=true;assert((await selector.host(track,settings)).warning);const fallback=await selector.select(tracks,{limit:2},settings,new Map());assert.equal(fallback.source,"playlist");assert.deepEqual(fallback.items.map(i=>i.track.id),["101","202"]);assert.equal(requests.length,4,"no rewrite/retry calls for invalid prose");
 }finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
