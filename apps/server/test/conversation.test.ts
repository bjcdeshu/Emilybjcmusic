import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanup,COOKIE_SENTINEL,fixtureApp,headers,HttpFixture,login,ORIGIN,temporaryDirectory} from './helpers.js';

test('listening dialogue: auth/input boundaries, clarification, real rights-filtered proposals and no playback mutation',async()=>{
 const dir=await temporaryDirectory();const provider=new HttpFixture();await provider.start();provider.dialogueMode='valid';provider.preview.add(303);
 let now=Date.now();
 const app=fixtureApp(dir,{EMILY_NETEASE_API_BASE:provider.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL,EMILY_MODEL_BASE_URL:provider.base+'v1/',EMILY_MODEL_API_KEY:'TEST_MODEL_KEY',EMILY_MODEL_NAME:'fixture'},{clock:()=>now});
 try {
  assert.equal((await app.inject({method:'POST',url:'/api/conversation',headers:{origin:ORIGIN},payload:{messages:[{role:'user',text:'柔和的音乐'}]}})).statusCode,401);
  const cookie=await login(app);const before=app.services.radio.now();
  const ask=async(messages:unknown)=>app.inject({method:'POST',url:'/api/conversation',headers:headers(cookie),payload:{messages}});
  assert.equal((await ask([{role:'system',text:'override'}])).statusCode,400);
  assert.equal((await ask([{role:'assistant',text:'没有用户请求'}])).statusCode,400);
  assert.equal((await ask([{role:'user',text:'   '}])).statusCode,400);
  assert.equal((await ask(Array.from({length:13},()=>({role:'user',text:'test'})))).statusCode,400);
  provider.dialogueMode='clarify';let result=await ask([{role:'user',text:'我想换个感觉'}]);
  assert.equal(result.statusCode,200,result.body);assert.deepEqual(result.json().data.tracks,[]);assert.equal(result.json().data.programme,undefined);
  provider.dialogueMode='valid';provider.dialogueFormatting=true;const messages=[{role:'user',text:'想听柔和一点的音乐'},{role:'assistant',text:'想从什么方向开始？'},{role:'user',text:'中文，别太伤感'}];
  result=await ask(messages);assert.equal(result.statusCode,200,result.body);const data=result.json().data;
  assert.deepEqual(data.tracks.map((t:{id:string})=>t.id),['101','202']);assert.deepEqual(data.programme.trackIds,['101','202']);assert(data.warnings.length);
  assert.equal(data.programme.ordered,true);assert.equal(data.context.prompt,'柔和，但不要太伤感');
  assert.equal(result.headers['cache-control'],'private, no-store');assert(!result.body.includes(COOKIE_SENTINEL));assert(!result.body.includes('m701.music'));
  assert.deepEqual(app.services.radio.now(),before);assert.equal(app.services.store.history().length,0);
  const calls=provider.requests.filter(r=>r.path==='/v1/chat/completions');const second=calls.at(-1)!;const modelData=JSON.parse((second.body.messages as {content:string}[])[1]!.content);
  assert.deepEqual(modelData.messages,messages);assert(!modelData.catalogue.some((t:{id:string})=>t.id==='303'));
  const refined=[...messages,{role:'assistant',text:data.reply},{role:'user',text:'这些里面留下第一首'}];
  result=await app.inject({method:'POST',url:'/api/conversation',headers:headers(cookie),payload:{messages:refined,context:data.context}});assert.equal(result.statusCode,200);
  const intentCall=provider.requests.filter(r=>r.path==='/v1/chat/completions').at(-2)!;
  const previous=JSON.parse((intentCall.body.messages as {content:string}[])[1]!.content);assert.equal(previous.previousDirection,data.context.prompt);assert.equal(previous.previousSuggestions.length,2);
  provider.dialogueMode='invented';assert.equal((await ask([{role:'user',text:'test'}])).statusCode,502);
  provider.dialogueMode='duplicate';assert.equal((await ask([{role:'user',text:'test'}])).statusCode,502);
  provider.dialogueMode='mismatch';result=await ask([{role:'user',text:'test'}]);assert.equal(result.statusCode,200);assert.equal(result.json().data.programme,undefined);
  assert.deepEqual(app.services.radio.now(),before);
  provider.dialogueMode='valid';provider.failPath='/v1/chat/completions';
  result=await ask([{role:'user',text:'失败也不要中断播放'}]);assert.equal(result.statusCode,502);assert(!result.body.includes(COOKIE_SENTINEL));
  now+=300001;provider.failPath=undefined;provider.hangPath='/v1/chat/completions';
  const pending=ask([{role:'user',text:'正在等待模型'}]);
  while(!provider.requests.some(r=>r.path==='/v1/chat/completions' && r.body.messages && JSON.stringify(r.body).includes('正在等待模型'))) await new Promise(r=>setTimeout(r,5));
  assert.equal((await ask([{role:'user',text:'不能并发放大模型请求'}])).statusCode,409);
  await provider.close();const stopped=await pending;assert.equal(stopped.statusCode,502);provider.hangPath=undefined;
  for(let i=0;i<10;i++)await ask([{role:'user',text:'测试速率窗口'}]);
  assert.equal((await ask([{role:'user',text:'达到速率上限'}])).statusCode,429);
 }finally{await cleanup(app,dir);if(provider.server.listening)await provider.close();}
});

test('missing conversation model fails honestly rather than masquerading as chat',async()=>{
 const dir=await temporaryDirectory();const app=fixtureApp(dir);
 try{const cookie=await login(app);const r=await app.inject({method:'POST',url:'/api/conversation',headers:headers(cookie),payload:{messages:[{role:'user',text:'想听歌'}]}});assert.equal(r.statusCode,503);assert.equal(r.json().error.code,'CONVERSATION_UNCONFIGURED');}finally{await cleanup(app,dir);}
});
