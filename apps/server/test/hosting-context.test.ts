import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanup,COOKIE_SENTINEL,fixtureApp,FixtureTts,HttpFixture,temporaryDirectory,login,headers} from './helpers.js';
const tick=()=>new Promise(r=>setTimeout(r,5));

test('logout discards unconsumed listener notes; model failure is bounded and cached as honest fallback',async()=>{
 const dir=await temporaryDirectory(),p=new HttpFixture();await p.start();const app=fixtureApp(dir,{EMILY_NETEASE_API_BASE:p.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL,EMILY_MODEL_BASE_URL:p.base+'v1',EMILY_MODEL_API_KEY:'TEST_ONLY',EMILY_MODEL_NAME:'fixture'},{tts:new FixtureTts(dir,true)});
 try{
  const radio=app.services.radio;radio.updateSettings({djEnabled:false});await radio.programme({trackIds:['101','202'],ordered:true,limit:2});await app.services.music.search('test');
  await radio.enqueue({trackId:'303',programmeId:radio.now().programmeId!,listenerNote:'PRIVATE_NOTE_SENTINEL'});
  const cookie=await login(app);
  const beforeClear=radio.now();const cleared=await app.inject({method:'POST',url:'/api/hosting/context/clear',headers:headers(cookie)});assert.equal(cleared.statusCode,200);assert.deepEqual(radio.now(),beforeClear);
  await app.inject({method:'POST',url:'/api/logout',headers:headers(cookie)});
  radio.updateSettings({djEnabled:true});await radio.play('303');await tick();
  const calls=p.requests.filter(r=>r.path==='/v1/chat/completions');assert(calls.length);assert(!JSON.stringify(calls).includes('PRIVATE_NOTE_SENTINEL'));
  assert(!JSON.stringify(app.services.store.get('radio')).includes('PRIVATE_NOTE_SENTINEL'));
  radio.updateSettings({djEnabled:false});await radio.programme({trackIds:['101'],ordered:true,limit:1});p.modelMode='unavailable';radio.updateSettings({djEnabled:true});
  const before=p.requests.length;const result=await radio.play();assert.match(result.now.warning||'',/简短报幕/);assert.equal(result.now.dj?.status,'tts_ready');await radio.pause();await radio.play();
  assert.equal(p.requests.slice(before).filter(r=>r.path==='/v1/chat/completions').length,1);
 }finally{await cleanup(app,dir);await p.close();}
});
