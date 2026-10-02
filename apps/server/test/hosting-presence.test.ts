import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOSTING_VERSION, EMILY_MANDARIN_HOST } from '../src/hosting-editor.js';
import { cleanup, COOKIE_SENTINEL, fixtureApp, FixtureTts, headers, HttpFixture, login, temporaryDirectory } from './helpers.js';
const tick = () => new Promise(r => setTimeout(r, 5));
async function until(fn: () => boolean) { for (let i=0;i<300&&!fn();i++) await tick(); assert(fn()); }
const env = (p: HttpFixture) => ({EMILY_NETEASE_API_BASE:p.base, EMILY_NETEASE_COOKIE:COOKIE_SENTINEL, EMILY_MODEL_BASE_URL:p.base+'v1', EMILY_MODEL_API_KEY:'TEST_ONLY_MODEL',EMILY_MODEL_NAME:'fixture'});
const hostCalls = (p: HttpFixture) => p.requests.filter(r=>r.path==='/v1/chat/completions'&&JSON.stringify(r.body).includes('HOST_ONE:'));

test('Emily policy allows emotional paragraphs with bounded factual and listener boundaries, not one-sentence reporting', () => {
  assert.match(EMILY_MANDARIN_HOST,/60–140/); assert.match(EMILY_MANDARIN_HOST,/好奇/); assert.match(EMILY_MANDARIN_HOST,/不重复近期/);
  assert.match(EMILY_MANDARIN_HOST,/不能编造/); assert.match(EMILY_MANDARIN_HOST,/不替用户判断/);
  assert(!EMILY_MANDARIN_HOST.includes('12-45')); assert.match(EMILY_MANDARIN_HOST,/没有听过/);
});

test('ordered confirmation writes hosting without reselecting; pending manual addition stays metadata-only and notes never persist', async () => {
 const dir=await temporaryDirectory(),p=new HttpFixture();await p.start();const app=fixtureApp(dir,env(p),{tts:new FixtureTts(dir,true)});
 try {
  await app.services.radio.programme({trackIds:['202','101'],ordered:true,limit:2,prompt:'测试：想重听以前的歌'});
  await until(()=>hostCalls(p).length===2); await tick();
  assert.deepEqual(app.services.radio.now().queue.map(i=>i.track.id),['202','101']);
  assert.equal(p.requests.filter(r=>r.path==='/v1/chat/completions').length,2,'writing only, no second selection');
  const firstData=JSON.parse((hostCalls(p)[0]!.body.messages as {content:string}[])[1]!.content);
  assert.equal(firstData.listenerNote,'测试：想重听以前的歌');
  assert(app.services.radio.now().dj!.text.length>45);
  await app.services.music.search('fixture'); await app.services.radio.play();
  const before=app.services.radio.now(), calls=hostCalls(p).length;
  const cookie=await login(app);
  const send=(listenerNote:unknown)=>app.inject({method:'POST',url:'/api/queue/add',headers:headers(cookie),payload:{trackId:'303',programmeId:before.programmeId!,listenerNote}});
  assert.equal((await send('x'.repeat(601))).statusCode,400);assert.equal((await send('bad\nline')).statusCode,400);
  const note='PRIVATE_LISTENER_NOTE_TEST_ONLY 想重听以前常听的歌';
  assert.equal((await send(note)).json().data.outcome,'added');
  assert.equal(hostCalls(p).length,calls,'enqueue does not call model or TTS');
  assert.deepEqual(app.services.radio.now().dj,before.dj); assert.equal(app.services.radio.now().status,'playing');
  assert(!JSON.stringify(app.services.store.get('radio')).includes(note));assert(!JSON.stringify(app.services.store.history()).includes(note));
  await app.services.radio.pause();await app.services.radio.move(1);
  await until(()=>hostCalls(p).length===calls+1); await tick();
  const data=JSON.parse((hostCalls(p).at(-1)!.body.messages as {content:string}[])[1]!.content);
  assert.equal(data.listenerNote,note);assert.equal(data.origin,'user');assert.equal(data.previousInQueueNotProofOfListening.title,'Fixture track 101');
  assert.equal(app.services.radio.now().status,'paused');assert.equal(app.services.store.history().length,1);
  const state=app.services.store.get<{items:{hostingVersion:number}[]}>('radio')!;assert.equal(state.items[2]!.hostingVersion,HOSTING_VERSION);
  assert(!JSON.stringify(app.services.radio.now().queue).includes('hostingVersion'));
 }finally{await cleanup(app,dir);await p.close();}
});

test('restart retires old short Chinese DJ lazily while preserving queue, original roaming, history and quiet; current version reused',async()=>{
 const dir=await temporaryDirectory(),p=new HttpFixture();await p.start();let app=fixtureApp(dir,env(p),{tts:new FixtureTts(dir,true)});
 try {
  app.services.radio.updateSettings({djEnabled:false});await app.services.radio.programme({playlistId:'700',limit:2,roaming:false});
  const state=app.services.store.get<any>('radio');for(const item of state.items){delete item.hostingVersion;item.hosting='下一首，听测试歌。';item.dj={voice:'zh-CN-XiaoxiaoNeural',language:'zh',text:item.hosting,status:'tts_ready'};}app.services.store.set('radio',state);
  const history=app.services.store.history();await app.close();const count=hostCalls(p).length;
  app=fixtureApp(dir,env(p),{tts:new FixtureTts(dir,true)});
  assert.equal(hostCalls(p).length,count);assert.equal(app.services.radio.settings().djEnabled,false);assert.equal(app.services.radio.now().dj,undefined);
  assert.equal(app.services.radio.now().programmeId,state.programmeId);assert.equal(app.services.radio.now().roaming?.scope,'playlist');assert.deepEqual(app.services.store.history(),history);
  app.services.radio.updateSettings({djEnabled:true});await app.services.radio.play();await app.services.radio.pause();
  await until(()=>hostCalls(p).length===count+2);await tick();const script=app.services.radio.now().dj!.text;assert(script.length>45);
  await app.close();app=fixtureApp(dir,env(p),{tts:new FixtureTts(dir,true)});await app.services.radio.play();
  assert.equal(app.services.radio.now().dj!.text,script);assert.equal(hostCalls(p).length,count+2,'no regeneration per restart');
 }finally{await cleanup(app,dir);await p.close();}
});

test('late model writing obeys pause, voice/clear invalidation and close draining, without retries on invalid output',async()=>{
 const dir=await temporaryDirectory(),p=new HttpFixture();await p.start();const app=fixtureApp(dir,env(p),{tts:new FixtureTts(dir,true)});
 const radio=app.services.radio;
 let release=()=>{};
 try {
  radio.updateSettings({djEnabled:false});await radio.programme({trackIds:['101'],ordered:true,limit:1});
  const original=radio.selector.host.bind(radio.selector);let started=false;
  radio.selector.host=async (...args)=>{started=true;await new Promise<void>(r=>{release=r;});return original(...args);};
  radio.updateSettings({djEnabled:true});const playing=radio.play();await until(()=>started);await radio.pause();release();assert.equal((await playing).now.status,'paused');
  radio.updateSettings({djEnabled:false});await radio.programme({trackIds:['101'],ordered:true,limit:1});started=false;radio.updateSettings({djEnabled:true});
  const stale=radio.play();await until(()=>started);radio.clear();const rejected=assert.rejects(stale,(e:{code:string})=>e.code==='QUEUE_CHANGED');release();await rejected;assert.equal(radio.now().queue.length,0);assert.equal(radio.now().dj,undefined);
  radio.selector.host=original;radio.updateSettings({djEnabled:false});await radio.programme({trackIds:['101'],ordered:true,limit:1});p.hostingText='<speak>无效测试</speak>';radio.updateSettings({djEnabled:true});
  const failed=await radio.play();assert.match(failed.now.warning||'',/简短报幕/);const count=hostCalls(p).length;await radio.play();assert.equal(hostCalls(p).length,count,'fallback avoids retry loop');
  radio.updateSettings({djEnabled:false});await radio.programme({trackIds:['101'],ordered:true,limit:1});started=false;
  radio.selector.host=async (...args)=>{started=true;await new Promise<void>(r=>{release=r;});return original(...args);};radio.updateSettings({djEnabled:true});const switching=radio.play();await until(()=>started);radio.updateSettings({voice:'en-GB-SoniaNeural'});release();const switched=await switching;assert.equal(switched.now.dj?.voice,'en-GB-SoniaNeural');assert(!switched.now.dj?.text.includes('<speak>'));
  radio.updateSettings({voice:'zh-CN-XiaoxiaoNeural',djEnabled:false});await radio.programme({trackIds:['101'],ordered:true,limit:1});started=false;radio.selector.host=async()=>{started=true;await new Promise<void>(r=>{release=r;});return {text:'这是一个测试段落。'};};radio.updateSettings({djEnabled:true});const pending=radio.play();await until(()=>started);let closed=false;const closing=app.close().then(()=>{closed=true;});await tick();assert.equal(closed,false);release();await pending;await closing;
 }finally{release();await cleanup(app,dir);await p.close();}
});
