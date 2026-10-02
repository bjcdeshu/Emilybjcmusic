import {test} from 'node:test';import assert from 'node:assert/strict';
import {hasKana,mandarinNames,isHosting} from '../src/hosting-language.js';import {hostingLine} from '../src/model.js';
import {cleanup,COOKIE_SENTINEL,fixtureApp,FixtureTts,HttpFixture,temporaryDirectory} from './helpers.js';
const track={id:'101',title:'ただ君に晴れ',artist:'ヨルシカ',source:'netease' as const};
test('Mandarin safely refers to Japanese names without translating catalogue or losing the paragraph',()=>{
 const text='你点了ヨルシカ的《ただ君に晴れ》，我有点好奇这次重听会有什么不同。不急着下结论，我们先听。';
 const safe=mandarinNames(text,track);assert(!hasKana(safe));assert(isHosting(safe,'zh'));assert(safe.includes('我有点好奇'));assert(safe.includes('这首歌'));assert(!hasKana(hostingLine(track,undefined,'zh')));
 assert.equal(track.title,'ただ君に晴れ');assert.equal(mandarinNames('听宇多田ヒカル的《First Love》。',{title:'First Love',artist:'宇多田ヒカル'}),'听这位歌手的《First Love》。');
 assert(hasKana('ﾖﾙｼｶ'));assert(!hasKana('中島美嘉'),'Han-only names cannot infer pronunciation');
});
test('Japanese catalogue retains original names and actual track; model mixed names are safe spoken references, failed DJ does not skip song',async()=>{
 const dir=await temporaryDirectory(),p=new HttpFixture();await p.start();p.detailSongs=[{id:101,name:track.title,ar:[{name:track.artist}],al:{name:'TEST ALBUM',picUrl:''},dt:120000}];p.hostingText=`这首是${track.artist}的《${track.title}》。你想重听，我也好奇这次会注意到哪里。先听，感受可以慢慢说。`;
 const tts=new FixtureTts(dir,true),app=fixtureApp(dir,{EMILY_NETEASE_API_BASE:p.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL,EMILY_MODEL_BASE_URL:p.base+'v1',EMILY_MODEL_API_KEY:'TEST_ONLY',EMILY_MODEL_NAME:'fixture'},{tts});
 try{
  const result=await app.services.radio.programme({trackIds:['101'],ordered:true,limit:1});assert.equal(result.now.track?.title,track.title);assert.equal(result.now.track?.artist,track.artist);assert.equal(result.now.dj?.status,'tts_ready');assert(!hasKana(result.now.dj!.text));assert(result.now.dj!.text.includes('我也好奇'));
  const play=await app.services.radio.play();assert.equal(play.now.track?.id,'101');assert.equal(play.now.queue.length,1);
  tts.segment=async(text,voice)=>({id:'a'.repeat(64),text,voice,language:'zh',status:'tts_failed',createdAt:new Date().toISOString()});
  await app.services.radio.programme({trackIds:['101'],ordered:true,limit:1});const failed=await app.services.radio.play();assert.equal(failed.now.track?.id,'101');assert.equal(failed.now.dj?.status,'tts_failed');assert.equal(failed.now.queue[0]?.status,'resolved');
 }finally{await cleanup(app,dir);await p.close();}
});
