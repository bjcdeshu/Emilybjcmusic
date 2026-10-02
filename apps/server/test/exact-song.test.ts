import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanup, COOKIE_SENTINEL, fixtureApp, FIXTURE_SONGS, headers, HttpFixture, login, temporaryDirectory} from './helpers.js';

test('named song is exact ONE, never expands default six or silently corrects artist; versions and rights explicit',async()=>{
 const dir=await temporaryDirectory(),p=new HttpFixture();await p.start();p.dialogueMode='valid';p.dialogueLimit=6;
 p.searchSongs=[{...FIXTURE_SONGS[0]!,name:'匆匆',ar:[{name:'李建清'}]}, {...FIXTURE_SONGS[1]!,name:'匆匆',ar:[{name:'其他歌手'}]}, {...FIXTURE_SONGS[2]!,name:'别的歌',ar:[{name:'李建清'}]}];p.detailSongs=p.searchSongs;
 const app=fixtureApp(dir,{EMILY_NETEASE_API_BASE:p.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL,EMILY_MODEL_BASE_URL:p.base+'v1/',EMILY_MODEL_API_KEY:'TEST_MODEL_KEY',EMILY_MODEL_NAME:'fixture'});
 try{
  const cookie=await login(app),before=app.services.radio.now();const ask=(text:string)=>app.inject({method:'POST',url:'/api/conversation',headers:headers(cookie),payload:{messages:[{role:'user',text}]}});
  let result=await ask('我想听李建清的《匆匆》');assert.equal(result.statusCode,200,result.body);const data=result.json().data;assert.deepEqual(data.tracks.map((t:{id:string})=>t.id),['101']);assert.equal(data.mode,'enqueue');assert.equal(data.match,'exact');assert.equal(data.programme,undefined);assert.equal(p.requests.filter(r=>r.path==='/v1/chat/completions').length,1,'exact metadata match needs no recommendation selection');
  p.searchSongs=[{...p.searchSongs[0]!,ar:[{name:'李剑青'}]}];result=await ask('我想听李建清的《匆匆》');assert.equal(result.statusCode,200);assert.deepEqual(result.json().data.tracks,[]);assert.deepEqual(result.json().data.clarifications,['李剑青的《匆匆》']);assert.equal(result.json().data.programme,undefined);
  result=await ask('确认，是李剑青的《匆匆》，只找这一首');assert.equal(result.statusCode,200,result.body);assert.deepEqual(result.json().data.tracks.map((t:{id:string})=>t.id),['101']);
  p.searchSongs.push({...p.searchSongs[0]!,id:202,al:{...p.searchSongs[0]!.al,name:'TEST other edition'}});result=await ask('听李剑青的《匆匆》');assert.equal(result.json().data.match,'choose_version');assert.equal(result.json().data.tracks.length,2);assert.equal(result.json().data.programme,undefined);
  p.preview.add(101);p.preview.add(202);result=await ask('听李剑青的《匆匆》');assert.deepEqual(result.json().data.tracks,[]);assert.match(result.json().data.reply,/权益/);
  p.preview.clear();result=await ask('只查询李剑青的《匆匆》，先核对权益');assert.equal(result.json().data.tracks.length,2,'query verb is not part of the artist');p.dialogueTarget={title:'编出来的歌名',artist:'李剑青'};result=await ask('想听李剑青的一首歌');assert.equal(result.statusCode,502,'model target must come from user text, not hallucinated metadata');
  assert.deepEqual(app.services.radio.now(),before);assert.equal(app.services.store.history().length,0);
 }finally{await cleanup(app,dir);await p.close();}
});

test('fixed voice preview requires auth/allowlist/rate and never changes radio or settings',async()=>{
 const dir=await temporaryDirectory();const {FixtureTts}=await import('./helpers.js');const app=fixtureApp(dir,{}, {tts:new FixtureTts(dir,true)});
 try{const cookie=await login(app),before=app.services.radio.now(),settings=app.services.radio.settings();const preview=(body:Record<string,unknown>)=>app.inject({method:'POST',url:'/api/tts/preview',headers:headers(cookie),payload:body});assert.equal((await preview({voice:'not-supported'})).statusCode,400);assert.equal((await preview({voice:'zh-TW-HsiaoChenNeural',text:'arbitrary synthesis forbidden'})).statusCode,400);const response=await preview({voice:'zh-TW-HsiaoChenNeural'});assert.equal(response.statusCode,200);assert.equal(response.headers['cache-control'],'private, no-store');assert.equal(response.json().data.segment.language,'zh');assert.deepEqual(app.services.radio.now(),before);assert.deepEqual(app.services.radio.settings(),settings);const variants=[];for(const sample of ['bright','reflective']){const r=await preview({voice:'zh-CN-XiaoyiNeural',sample});assert.equal(r.statusCode,200);variants.push(r.json().data.segment.text);}assert.notEqual(variants[0],variants[1]);assert.equal((await preview({voice:'zh-CN-XiaoyiNeural',sample:'arbitrary'})).statusCode,400);assert.deepEqual(app.services.radio.now(),before);assert.deepEqual(app.services.radio.settings(),settings);for(let i=0;i<3;i++)await preview({voice:'zh-CN-XiaoyiNeural'});assert.equal((await preview({voice:'zh-CN-XiaoyiNeural'})).statusCode,429);}finally{await cleanup(app,dir);}
});
