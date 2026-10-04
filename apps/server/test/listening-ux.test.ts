import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanup, COOKIE_SENTINEL, fixtureApp, FixtureTts, headers, HttpFixture, login, ORIGIN, temporaryDirectory } from './helpers.js';

test('listening checkpoint is scoped, bounded, paused after restart, and recent means reported real song playing only', async () => {
  const dir = await temporaryDirectory(), provider = new HttpFixture(); await provider.start();
  const env = { EMILY_NETEASE_API_BASE: provider.base, EMILY_NETEASE_COOKIE: COOKIE_SENTINEL };
  let app = fixtureApp(dir, env, { tts: new FixtureTts(dir, true) });
  try {
    const cookie = await login(app);
    await app.services.radio.programme({ trackIds: ['101', '202'], ordered: true, limit: 2 });
    const now = app.services.radio.now(), scope = { programmeId: now.programmeId!, itemId: now.currentItemId! };
    const post = (payload: object) => app.inject({ method: 'POST', url: '/api/listening/checkpoint', headers: headers(cookie), payload });
    const base = { ...scope, phase: 'song', positionMs: 32100, sampledAt: Date.now() };
    assert.equal((await app.inject({ method: 'POST', url: '/api/listening/checkpoint', headers: { origin: ORIGIN }, payload: base })).statusCode, 401);
    for(const payload of [{...base, positionMs:-1},{...base, positionMs:NaN},{...base, phase:'preview'},{...base,text:'PRIVATE'},{...base,phase:'dj',djId:'0'.repeat(64)}]) assert([400,409].includes((await post(payload)).statusCode));
    assert.deepEqual(app.services.store.collection().recent, [], 'programme generation is not a play');
    assert.equal((await post(base)).statusCode, 200);
    assert.deepEqual(app.services.store.collection().recent, [], 'position alone is not proof of playing');
    const heard = await post({...base,heard:true}); assert.equal(heard.statusCode,200); assert.equal(heard.headers['cache-control'],'private, no-store');
    await post({...base,positionMs:1,sampledAt:base.sampledAt-1}); assert.equal(app.services.radio.now().resume?.positionMs,32100);
    await post({...base,heard:true}); assert.equal(app.services.store.collection().recent.length,1);
    app.services.store.feedback({trackId:'101',kind:'like'},Date.now());
    const collection = await app.inject({url:'/api/listening/collection',headers:headers(cookie)});
    assert.equal(collection.statusCode,200); assert.equal(collection.json().data.liked[0].track.id,'101'); assert.equal(collection.json().data.recent[0].track.audioUrl,undefined);
    const calls=provider.requests.length;
    const resumed=await app.inject({method:'POST',url:'/api/player/resume',headers:headers(cookie),payload:scope}); assert.equal(resumed.statusCode,200);assert.equal(provider.requests.length,calls,'resume intent never regenerates TTS or resolves songs');
    await app.close();app=fixtureApp(dir,env,{tts:new FixtureTts(dir,true)});assert.equal(app.services.radio.now().status,'paused');assert.equal(app.services.radio.now().resume?.positionMs,32100);
    await app.services.radio.move(1);assert.equal(app.services.radio.now().resume,undefined);
    assert.throws(()=>app.services.radio.checkpoint({...base,phase:'song'}),/播放位置/);
    assert.throws(()=>app.services.radio.resume(scope.programmeId,scope.itemId),/节目已改变/);
    app.services.radio.clear();assert.equal(app.services.store.get('listening_checkpoint'),undefined);
  } finally {await cleanup(app,dir);await provider.close();}
});

test('queue editing preserves source, settings, roaming seen, history and feedback; protects current/stale/busy and exact added ID', async () => {
  const dir=await temporaryDirectory(),provider=new HttpFixture();await provider.start();const app=fixtureApp(dir,{EMILY_NETEASE_API_BASE:provider.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL});
  try {
    const cookie=await login(app);await app.services.radio.programme({playlistId:'700',ordered:true,limit:2,roaming:false});await app.services.radio.play();
    const before=app.services.radio.now(),programmeId=before.programmeId!,settings=app.services.radio.settings(),history=app.services.store.history();
    const added=await app.services.radio.enqueue({programmeId,trackId:'303'});assert(added.itemId);assert.equal(added.now.queue.at(-1)!.id,added.itemId);
    const send=(payload:object)=>app.inject({method:'POST',url:'/api/queue/edit',headers:headers(cookie),payload});
    assert.equal((await send({programmeId,itemId:before.currentItemId,action:'remove'})).statusCode,409);
    assert.equal((await send({programmeId:'0'.repeat(36),itemId:added.itemId,action:'next'})).statusCode,409);
    assert.equal((await send({programmeId,itemId:added.itemId,action:'other'})).statusCode,400);
    assert.equal((await send({programmeId,itemId:added.itemId,action:'next'})).statusCode,200);
    assert.deepEqual(app.services.radio.now().queue.map(i=>i.track.id),['101','303','202']);
    const after=app.services.radio.now();assert.deepEqual(after.track,before.track);assert.deepEqual(after.dj,before.dj);assert.equal(after.startedAt,before.startedAt);assert.equal(after.status,'playing');
    assert.equal((await send({programmeId,itemId:added.itemId,action:'remove'})).statusCode,200);assert.deepEqual(app.services.radio.now().queue.map(i=>i.track.id),['101','202']);
    assert.deepEqual(app.services.radio.settings(),settings);assert.deepEqual(app.services.store.history(),history);assert.equal(app.services.store.feedbackMap().size,0);
    assert(app.services.store.get<{roam:{seen:string[]}}>('radio')!.roam.seen.includes('303'),'removed song remains seen for this roam');
    assert.equal((await send({programmeId,itemId:added.itemId,action:'remove'})).statusCode,409,'no resurrection or second removal');
    let release!:()=>void;const pending=app.services.radio.exclusive(()=>new Promise<void>(r=>{release=r;}));
    assert.equal((await send({programmeId,itemId:before.queue[1]!.id,action:'remove'})).statusCode,409);release();await pending;
  }finally{await cleanup(app,dir);await provider.close();}
});
