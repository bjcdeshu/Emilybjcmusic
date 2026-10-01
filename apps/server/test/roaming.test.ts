import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanup,COOKIE_SENTINEL,fixtureApp,FixtureTts,HttpFixture,temporaryDirectory} from './helpers.js';
const tick=()=>new Promise(r=>setTimeout(r,5));
async function until(fn:()=>boolean){for(let i=0;i<300&&!fn();i++)await tick();assert(fn());}

test('playlist roaming refills without repeats, respects pause, stops at source exhaustion and persists scope',async()=>{
 const dir=await temporaryDirectory(),p=new HttpFixture();await p.start();let app=fixtureApp(dir,{EMILY_NETEASE_API_BASE:p.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL});
 try {
  await app.services.radio.programme({playlistId:'700',limit:1,roaming:true});
  await until(()=>app.services.radio.now().queue.length===2);
  assert.equal(app.services.radio.now().status,'paused');
  await app.services.radio.play();await app.services.radio.move(1);
  await until(()=>app.services.radio.now().queue.length===3);
  assert.deepEqual(app.services.radio.now().queue.map(i=>i.track.id),['101','202','303']);
  await app.services.radio.pause();await app.services.radio.move(1);
  await until(()=>app.services.radio.now().roaming?.enabled===false);
  assert.equal(app.services.radio.now().status,'paused');
  assert(app.services.radio.now().roaming?.message?.includes('听完'));
  await app.close();app=fixtureApp(dir,{EMILY_NETEASE_API_BASE:p.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL});
  assert.equal(app.services.radio.now().roaming?.scope,'playlist');
  const end=await app.services.radio.move(1);assert.equal(end.now.track,undefined);assert.equal(end.now.roaming?.enabled,false);
 }finally{await cleanup(app,dir);await p.close();}
});

class Gate extends FixtureTts {
 started=false;completed=0;release:()=>void=()=>{};
 override async segment(text:string,voice:string){if(text.includes('202')){this.started=true;await new Promise<void>(r=>{this.release=r;});}const result=await super.segment(text,voice);if(text.includes('202'))this.completed++;return result;}
}
test('late roaming refill cannot write after disabling/replacing; explicit point-song keeps confirmed order',async()=>{
 const dir=await temporaryDirectory(),p=new HttpFixture();await p.start();const tts=new Gate(dir);
 const app=fixtureApp(dir,{EMILY_NETEASE_API_BASE:p.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL},{tts});
 try{
  await app.services.radio.programme({playlistId:'700',limit:1,roaming:true});await until(()=>tts.started);
  await app.services.radio.pause();app.services.radio.setRoaming(false);
  assert.equal(app.services.radio.now().roaming?.preparing,false);
  tts.release();await until(()=>tts.completed===1);await tick();
  assert.deepEqual(app.services.radio.now().queue.map(i=>i.track.id),['101']);assert.equal(app.services.radio.now().status,'paused');
  tts.started=false;app.services.radio.setRoaming(true);await until(()=>tts.started);
  await app.services.radio.programme({trackIds:['303'],ordered:true,limit:1});tts.release();await tick();
  assert.deepEqual(app.services.radio.now().queue.map(i=>i.track.id),['303']);
  await app.services.radio.programme({trackIds:['303','101'],ordered:true,limit:2});
  assert.deepEqual(app.services.radio.now().queue.map(i=>i.track.id),['303','101']);assert.equal(app.services.radio.now().roaming,undefined);
  assert.throws(()=>app.services.radio.setRoaming(true));
 }finally{tts.release();await cleanup(app,dir);await p.close();}
});
