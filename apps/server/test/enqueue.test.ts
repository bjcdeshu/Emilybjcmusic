import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MAX_QUEUE_ITEMS, type QueueAddRequest} from '@emily/shared';
import {cleanup, COOKIE_SENTINEL, fixtureApp, FixtureTts, headers, HttpFixture, login, ORIGIN, temporaryDirectory} from './helpers.js';
const tick=()=>new Promise(r=>setTimeout(r,5));
async function until(fn:()=>boolean){for(let i=0;i<200&&!fn();i++)await tick();assert(fn());}

test('single enqueue: owner/schema/catalogue/rights, tail order, duplicate, transport/history/scope preserved',async()=>{
 const dir=await temporaryDirectory(),p=new HttpFixture();await p.start();const app=fixtureApp(dir,{EMILY_NETEASE_API_BASE:p.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL},{tts:new FixtureTts(dir,true)});
 try{
  assert.equal((await app.inject({method:'POST',url:'/api/queue/add',headers:{origin:ORIGIN},payload:{trackId:'303',programmeId:'a'.repeat(36)}})).statusCode,401);
  const cookie=await login(app);const send=(payload:Record<string,unknown>)=>app.inject({method:'POST',url:'/api/queue/add',headers:headers(cookie),payload});
  await app.services.radio.programme({playlistId:'700',limit:2,roaming:false});await app.services.radio.play();await tick();
  const before=app.services.radio.now(),id=before.programmeId!;
  assert.equal((await send({trackIds:['303'],programmeId:id})).statusCode,400);
  assert.equal((await send({trackId:'303'})).statusCode,400);
  assert.equal((await send({trackId:'303',programmeId:'a'.repeat(36)})).statusCode,409);
  assert.equal((await send({trackId:'999999',programmeId:id})).statusCode,404);
  const result=await send({trackId:'303',programmeId:id});assert.equal(result.statusCode,200,result.body);assert.equal(result.json().data.outcome,'added');assert.equal(result.headers['cache-control'],'private, no-store');
  const after=app.services.radio.now();assert.deepEqual(after.track,before.track);assert.deepEqual(after.dj,before.dj);assert.equal(after.status,'playing');assert.equal(after.startedAt,before.startedAt);assert.equal(after.programmeId,id);assert.deepEqual(after.roaming,before.roaming);
  assert.deepEqual(after.queue.slice(0,2),before.queue);assert.deepEqual(after.queue.map(i=>i.track.id),['101','202','303']);assert.equal(after.queue.at(-1)?.requestedBy,'user');assert.equal(app.services.store.history().length,1);
  const again=await send({trackId:'303',programmeId:id});assert.equal(again.json().data.outcome,'already_present');assert.equal(app.services.radio.now().queue.length,3);
  await app.services.radio.pause();p.preview.add(303);const rejected=await send({trackId:'303',programmeId:id});assert.equal(rejected.statusCode,409);assert.equal(rejected.json().error.code,'TRACK_UNPLAYABLE');assert.equal(app.services.radio.now().status,'paused');
 }finally{await cleanup(app,dir);await p.close();}
});

test('enqueue allows next/pause while rights pending, but clear/replacement/close invalidate late additions',async()=>{
 const dir=await temporaryDirectory(),p=new HttpFixture();await p.start();const app=fixtureApp(dir,{EMILY_NETEASE_API_BASE:p.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL});
 const music=app.services.music,original=music.playable.bind(music);let release=()=>{},started=false;
 function gate(){started=false;music.playable=async ids=>{if(ids.length===1&&ids[0]==='303'){started=true;await new Promise<void>(r=>{release=r;});}return original(ids);};}
 try{
  await app.services.radio.programme({trackIds:['101','202'],ordered:true,limit:2});await music.search('TEST song to add');const req=():QueueAddRequest=>({trackId:'303',programmeId:app.services.radio.now().programmeId!});gate();
  const first=app.services.radio.enqueue(req());await until(()=>started);await assert.rejects(app.services.radio.enqueue(req()),(e:{code:string})=>e.code==='QUEUE_BUSY');
  await app.services.radio.play();await app.services.radio.move(1);await app.services.radio.pause();release();const done=await first;assert.equal(done.now.track?.id,'202');assert.equal(done.now.status,'paused');assert.deepEqual(done.now.queue.map(i=>i.track.id),['101','202','303']);
  await app.services.radio.programme({trackIds:['101'],ordered:true,limit:1});gate();const stale=app.services.radio.enqueue(req());await until(()=>started);app.services.radio.clear();release();await assert.rejects(stale,(e:{code:string})=>e.code==='QUEUE_CHANGED');assert.equal(app.services.radio.now().queue.length,0);
  music.playable=original;await app.services.radio.programme({trackIds:['101'],ordered:true,limit:1});gate();const replaced=app.services.radio.enqueue(req());await until(()=>started);await app.services.radio.programme({trackIds:['202'],ordered:true,limit:1});release();await assert.rejects(replaced,(e:{code:string})=>e.code==='QUEUE_CHANGED');assert.equal(app.services.radio.now().track?.id,'202');
  gate();const closing=app.services.radio.enqueue(req());await until(()=>started);const rejected=assert.rejects(closing,(e:{code:string})=>e.code==='QUEUE_CHANGED');let closed=false;const close=app.close().then(()=>{closed=true;});await tick();assert.equal(closed,false);release();await rejected;await close;
 }finally{release();await cleanup(app,dir);await p.close();}
});

class RefillGate extends FixtureTts {
 started=false;release=()=>{};gated=false;
 override async segment(text:string,voice:string){if(text.includes('202')&&!this.gated){this.gated=true;}else return super.segment(text,voice);if(text.includes('202')){this.started=true;await new Promise<void>(r=>{this.release=r;});}return super.segment(text,voice);}
}
test('enqueue during original-playlist refill keeps scope/seen, cannot be duplicated by stale refill; queue bounded',async()=>{
 const dir=await temporaryDirectory(),p=new HttpFixture();await p.start();const tts=new RefillGate(dir);const app=fixtureApp(dir,{EMILY_NETEASE_API_BASE:p.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL},{tts});
 try{
  await app.services.radio.programme({playlistId:'700',roaming:true,limit:1});await until(()=>tts.started);const before=app.services.radio.now();
  const added=await app.services.radio.enqueue({trackId:'202',programmeId:before.programmeId!});assert.equal(added.outcome,'added');assert.equal(added.now.roaming?.enabled,true);assert.equal(added.now.track?.id,'101');assert.equal(added.now.status,'paused');tts.release();await until(()=>app.services.radio.now().roaming?.preparing===false);
  assert.deepEqual(app.services.radio.now().queue.map(i=>i.track.id),['101','202']);const state=app.services.store.get<{roam:{playlistId:string;seen:string[];offset:number}}>('radio')!;assert.equal(state.roam.playlistId,'700');assert(state.roam.seen.includes('202'));
  await app.services.radio.move(1);await until(()=>app.services.radio.now().queue.some(i=>i.track.id==='303'));assert.equal(app.services.radio.now().queue.filter(i=>i.track.id==='202').length,1);
  app.services.radio.setRoaming(false);
 }finally{tts.release();await cleanup(app,dir);await p.close();}
});

test('queue maximum rejects addition rather than dropping pending original songs',async()=>{
 const dir=await temporaryDirectory(),p=new HttpFixture();await p.start();let app=fixtureApp(dir,{EMILY_NETEASE_API_BASE:p.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL});
 try{await app.services.radio.programme({trackIds:['101'],ordered:true,limit:1});const state=app.services.store.get<any>('radio');state.items=Array.from({length:MAX_QUEUE_ITEMS},(_,i)=>({...state.items[0],id:`test-only-${i}`}));app.services.store.set('radio',state);await app.close();app=fixtureApp(dir,{EMILY_NETEASE_API_BASE:p.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL});await app.services.music.search('test');await assert.rejects(app.services.radio.enqueue({trackId:'303',programmeId:app.services.radio.now().programmeId!}),(e:{code:string})=>e.code==='QUEUE_LIMIT');assert.equal(app.services.radio.now().queue.length,MAX_QUEUE_ITEMS);}finally{await cleanup(app,dir);await p.close();}
});
