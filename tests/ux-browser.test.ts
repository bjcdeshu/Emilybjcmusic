import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {chromium} from 'playwright';
import {buildApp} from '../apps/server/src/app.js';
import {loadConfig} from '../apps/server/src/config.js';
import {HttpFixture,FixtureTts,OWNER_PASSWORD,COOKIE_SENTINEL} from '../apps/server/test/helpers.js';

test('UX: current queue location, real lyric following/manual hold/track change and unread chat retention', {timeout:60000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'emily-ux-')),provider=new HttpFixture();await provider.start();
 provider.playlistSongs=Array.from({length:12},(_,i)=>({id:1001+i,name:`TEST UX track ${i}`,ar:[{name:'TEST artist'}],al:{name:'TEST album',picUrl:'http://p1.music.126.net/test'},dt:60000}));
 provider.lyricBody={code:200,lrc:{lyric:Array.from({length:55},(_,i)=>`[00:${String(i).padStart(2,'0')}.00]TEST line ${i}`).join('\n')}};
 const file=join(dir,'TEST_TONE.mp3');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=60','-codec:a','libmp3lame',file],{timeout:15000});const bytes=await readFile(file);
 const config=loadConfig({EMILY_DATA_DIR:dir,EMILY_OWNER_PASSWORD:OWNER_PASSWORD,EMILY_CREDENTIAL_KEY:'0f'.repeat(32),EMILY_NETEASE_API_BASE:provider.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL,EMILY_MODEL_BASE_URL:provider.base+'v1/',EMILY_MODEL_API_KEY:'TEST',EMILY_MODEL_NAME:'TEST',EMILY_WEB_DIST_DIR:join(process.cwd(),'apps/web/dist')});
 const app=buildApp({config,tts:new FixtureTts(dir),mediaOpener:async(_url,range)=>{const start=range?Number(range.slice(6).split('-')[0]||0):0,chunk=bytes.subarray(start);return{status:range?206:200,headers:{'content-type':'audio/mpeg','content-length':String(chunk.length),'accept-ranges':'bytes',...(range?{'content-range':`bytes ${start}-${bytes.length-1}/${bytes.length}`}:{})},stream:Readable.from(chunk)};}});let browser;
 try{
 const origin=await app.listen({host:'127.0.0.1',port:0});config.publicOrigin=origin;app.services.radio.updateSettings({djEnabled:false});await app.services.radio.programme({playlistId:'700',limit:12,ordered:true});await app.services.radio.play('1010');await app.services.radio.pause();
 browser=await chromium.launch({headless:true,...(process.env.EMILY_BROWSER_EXECUTABLE?{executablePath:process.env.EMILY_BROWSER_EXECUTABLE}:{channel:'chrome'})});const page=await browser.newPage({viewport:{width:393,height:740}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.getByLabel('个人登录口令').fill(OWNER_PASSWORD);await page.getByRole('button',{name:'进入电台'}).click();await page.locator('.main-play').waitFor();await page.getByRole('button',{name:'播放',exact:true}).click();await page.waitForFunction(()=>document.querySelector('audio')!.currentTime>.1);await page.getByRole('button',{name:'暂停',exact:true}).click();
 const source=await page.evaluate(()=>document.querySelector('audio')!.currentSrc),time=await page.evaluate(()=>document.querySelector('audio')!.currentTime);
 await page.locator('.queue-entry').click();assert(await page.locator('.radio-sheet-content').evaluate(el=>el.scrollTop>100),'queue initially positions near current');
 await page.locator('.queue-row[aria-current=true]').click();assert.equal(await page.evaluate(()=>document.querySelector('audio')!.currentSrc),source);assert.equal(await page.evaluate(()=>document.querySelector('audio')!.currentTime),time);
 await page.getByLabel('歌曲播放进度').fill('20.2');await page.getByRole('button',{name:'阅读完整歌词'}).click();await page.locator('.full-lyric-line[aria-current=true]').filter({hasText:'TEST line 20'}).waitFor();
 assert(await page.locator('.radio-sheet-content').evaluate(el=>el.scrollTop>200),'initial current lyric location');
 await page.locator('.radio-sheet-content').dispatchEvent('wheel');await page.locator('.radio-sheet-content').evaluate(el=>el.scrollTop=0);
 await page.locator('.radio-sheet').getByRole('button',{name:'播放',exact:true}).click();await page.waitForTimeout(1400);assert.equal(await page.locator('.radio-sheet-content').evaluate(el=>el.scrollTop),0,'manual reading is not pulled back');
 await page.getByRole('button',{name:'回到当前句'}).click();assert(await page.locator('.radio-sheet-content').evaluate(el=>el.scrollTop>200));
 if(process.env.EMILY_BROWSER_EVIDENCE_DIR){await mkdir(process.env.EMILY_BROWSER_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:join(process.env.EMILY_BROWSER_EVIDENCE_DIR,'mobile-full-lyrics-follow.png')});}
 const at=await page.locator('.full-lyric-line[aria-current=true]').textContent();await page.waitForTimeout(1200);assert.notEqual(await page.locator('.full-lyric-line[aria-current=true]').textContent(),at,'current line follows actual media clock');
 await page.emulateMedia({reducedMotion:'reduce'});const top=await page.locator('.radio-sheet-content').evaluate(el=>el.scrollTop);await page.waitForTimeout(1200);assert.equal(await page.locator('.radio-sheet-content').evaluate(el=>el.scrollTop),top,'reduced motion stops automatic scroll');await page.emulateMedia({reducedMotion:'no-preference'});
 provider.lyricBody={code:200,lrc:{lyric:'[00:00.00]TEST next track lyric\n[00:30.00]TEST next later'}};
 await page.locator('.radio-sheet').getByRole('button',{name:'下一首（不作为不喜欢反馈）'}).click();await page.locator('.lyrics-full').getByText('TEST next track lyric',{exact:true}).waitFor();assert.equal(await page.locator('.lyrics-full').count(),1);await page.locator('.radio-sheet').getByRole('button',{name:'暂停',exact:true}).click();await page.keyboard.press('Escape');await page.locator('dialog[data-closing=true]').waitFor({state:'detached'});
 // Explicit local HTTP fixture; delayed response lets the reader scroll back.
 let count=0;await page.route('**/api/conversation',async route=>{count++;await new Promise(r=>setTimeout(r,450));await route.fulfill({json:{ok:true,data:{reply:`TEST response ${count} `+'A long reading paragraph. '.repeat(35),tracks:[],warnings:[],mode:'enqueue'}}});});
 await page.getByRole('button',{name:'聊聊想听什么'}).click();for(let i=0;i<2;i++){await page.getByLabel('告诉 Emily 想听什么').fill(`TEST request ${i}`);await page.getByRole('button',{name:'发送听歌想法'}).click();await page.waitForFunction(n=>document.querySelectorAll('.listening-turn.assistant').length===n,i+1);}
 await page.getByLabel('告诉 Emily 想听什么').fill('TEST delayed request');await page.getByRole('button',{name:'发送听歌想法'}).click();await page.locator('.listening-log').evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new Event('scroll'));});await page.waitForFunction(()=>document.querySelectorAll('.listening-turn.assistant').length===3);assert.equal(await page.locator('.listening-log').evaluate(el=>el.scrollTop),0);await page.getByRole('button',{name:'有更新 · 查看最新回复'}).click();assert(await page.locator('.listening-log').evaluate(el=>el.scrollTop>100));
 await page.getByLabel('告诉 Emily 想听什么').fill('TEST draft to clear');await page.getByRole('button',{name:'清空对话'}).click();assert.equal(await page.getByLabel('告诉 Emily 想听什么').inputValue(),'');assert.equal(await page.locator('.listening-turn').count(),0);
 await page.setViewportSize({width:393,height:400});await page.waitForFunction(()=>document.querySelector('.listening-dialog')?.getAttribute('data-compact')==='true');assert(await page.locator('.listening-compose').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),'composer fits simulated keyboard-height viewport');
 if(process.env.EMILY_BROWSER_EVIDENCE_DIR)await page.screenshot({path:join(process.env.EMILY_BROWSER_EVIDENCE_DIR,'mobile-compact-chat.png')});
 assert.deepEqual(errors,[]);
 if(process.env.EMILY_BROWSER_EVIDENCE_DIR){await mkdir(process.env.EMILY_BROWSER_EVIDENCE_DIR,{recursive:true});await writeFile(join(process.env.EMILY_BROWSER_EVIDENCE_DIR,'ux-continuity-fixture.json'),JSON.stringify({fixture:true,currentQueueLocation:true,currentQueueNoReload:true,lyricsInitialLocate:true,manualHold:true,returnToCurrent:true,reducedMotionNoScroll:true,liveTrackChange:true,chatNoScrollSteal:true,clearDraft:true,pageErrors:errors}));}
 }finally{if(browser)await browser.close();await app.close();await provider.close();await rm(dir,{recursive:true,force:true});}
});
