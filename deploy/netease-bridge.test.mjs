import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// All upstream modules below are explicit test fixtures; never real accounts/music.
test('private bridge enforces token, POST allowlist, no cache/logs/cookies and original-provider transport only', async () => {
 const root=await mkdtemp(join(tmpdir(),'emily-bridge-test-'));
 let child;
 try {
  for(const dir of ['util','module','node_modules/axios','private'])await mkdir(join(root,dir),{recursive:true});
  await writeFile(join(root,'node_modules/axios/index.js'),'exports.default={defaults:{}};');
  await writeFile(join(root,'util/index.js'),'exports.cookieToJson=()=>({MUSIC_U:"fixture-only"});exports.generateRandomChineseIP=()=>"fixture-unused";');
  await writeFile(join(root,'util/request.js'),'module.exports=async(uri,data,options)=>({status:200,body:{code:200,crypto:options.crypto,unblock:data.unblock,level:data.level,proxy:options.proxy},cookie:["SECRET_FIXTURE_COOKIE"]});');
  const names=['login_status','login_qr_key','login_qr_create','login_qr_check','user_playlist','playlist_track_all','cloudsearch','song_detail','song_url_v1'];
  for(const name of names)await writeFile(join(root,'module',name+'.js'),'module.exports=async(q,r)=>{console.error("SECRET_FIXTURE_RAW_PROVIDER_BODY");return r("/api/fixture",q,{crypto:"xeapi"})};');
  const token='fixture-private-token-not-a-real-secret';
  child=spawn(process.execPath,[fileURLToPath(new URL('./netease-bridge.cjs',import.meta.url))],{env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,EMILY_ADAPTER_UPSTREAM:root,EMILY_ADAPTER_TOKEN:token,ENABLE_GENERAL_UNBLOCK:'false',ENABLE_PROXY:'false',TMPDIR:join(root,'private'),TEMP:join(root,'private'),TMP:join(root,'private')},stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw new Error('Fixture bridge exited')}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Fixture startup timed out')),5000).unref())]);
  const base='http://127.0.0.1:3101'; const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  assert.equal((await fetch(base+'/health')).status,401);
  assert.equal((await fetch(base+'/health',{headers:{Authorization:'Bearer wrong'}})).status,401);
  assert.equal((await fetch(base+'/health',{headers})).status,200);
  for(const route of ['/song/url/match','/login/qr/key?cookie=leak','/public','/register/anonimous'])assert.equal((await fetch(base+route,{method:'POST',headers})).status,404);
  assert.equal((await fetch(base+'/song/url/v1',{headers})).status,404);
  for(const input of [{proxy:'https://invalid.example'},{crypto:'linuxapi'},{domain:'https://invalid.example'},null,[],{cookie:{MUSIC_U:'fixture'}}])assert.equal((await fetch(base+'/song/url/v1',{method:'POST',headers,body:JSON.stringify(input)})).status,400);
  const response=await fetch(base+'/song/url/v1',{method:'POST',headers,body:JSON.stringify({id:'101',cookie:'fixture',unblock:'true',level:'lossless'})});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('set-cookie'),null);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.deepEqual(await response.json(),{code:200,crypto:'eapi',unblock:'false',level:'standard'});
  assert(!output.includes('SECRET_FIXTURE')&&!output.includes(token));
 } finally {
  if(child&&child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}
  await rm(root,{recursive:true,force:true});
 }
});
