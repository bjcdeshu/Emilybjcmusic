import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { chromium } from 'playwright';
import { buildApp } from '../apps/server/src/app.js';
import { loadConfig } from '../apps/server/src/config.js';
import { HttpFixture, FixtureTts, OWNER_PASSWORD, COOKIE_SENTINEL } from '../apps/server/test/helpers.js';
import type { DjSegment } from '@emily/shared';

// Explicit synthetic tone/catalogue; no external music, model or TTS in this test.
test('six daily UX controls: real media checkpoint/reload, one-off host skip, metadata queue, timer, collection and safe failure', { timeout: 90000 }, async () => {
  const dir=await mkdtemp(join(tmpdir(),'emily-daily-')),provider=new HttpFixture();await provider.start();
  const file=join(dir,'TEST_TONE.mp3');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=24','-codec:a','libmp3lame',file],{timeout:15000});const bytes=await readFile(file);
  class ToneTts extends FixtureTts {
    override async segment(text:string,voice:string):Promise<DjSegment> { const segment=await super.segment(text,voice);await writeFile(join(this.audioDir,segment.id+'.mp3'),bytes);return segment; }
  }
  const config=loadConfig({EMILY_DATA_DIR:dir,EMILY_OWNER_PASSWORD:OWNER_PASSWORD,EMILY_CREDENTIAL_KEY:'0f'.repeat(32),EMILY_NETEASE_API_BASE:provider.base,EMILY_NETEASE_COOKIE:COOKIE_SENTINEL,EMILY_WEB_DIST_DIR:join(process.cwd(),'apps/web/dist')});
  const app=buildApp({config,tts:new ToneTts(dir,true),mediaOpener:async(_url,range)=>{const start=range?Number(range.slice(6).split('-')[0]||0):0,chunk=bytes.subarray(start);return{status:range?206:200,headers:{'content-type':'audio/mpeg','content-length':String(chunk.length),'accept-ranges':'bytes',...(range?{'content-range':`bytes ${start}-${bytes.length-1}/${bytes.length}`}:{})},stream:Readable.from(chunk)};}});let browser;
  try {
    const origin=await app.listen({host:'127.0.0.1',port:0});config.publicOrigin=origin;
    await app.services.radio.programme({trackIds:['101','202','303'],ordered:true,limit:3});
    browser=await chromium.launch({headless:true,...(process.env.EMILY_BROWSER_EXECUTABLE?{executablePath:process.env.EMILY_BROWSER_EXECUTABLE}:{channel:'chrome'})});const page=await browser.newPage({viewport:{width:393,height:740}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin);await page.getByLabel('个人登录口令').fill(OWNER_PASSWORD);await page.getByRole('button',{name:'进入电台'}).click();await page.locator('.main-play').waitFor();
    await page.getByRole('button',{name:'播放',exact:true}).click();await page.waitForFunction(()=>document.querySelector('audio')!.currentTime>.1);assert.equal(app.services.store.collection().recent.length,0,'hosting does not count as song listening');
    await page.getByRole('button',{name:'直接听歌'}).click();await page.waitForFunction(()=>document.querySelector('audio')!.currentSrc.includes('/media/track/101'));await page.waitForFunction(()=>document.querySelector('audio')!.currentTime>.1);
    assert.equal(app.services.radio.settings().djEnabled,true);await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByLabel('歌曲播放进度').fill('8.2');await page.waitForTimeout(250);
    assert.equal(app.services.store.collection().recent[0]?.track.id,'101');assert(Math.abs(app.services.radio.now().resume!.positionMs-8200)<100);
    await page.reload();await page.locator('.main-play').waitFor();await page.waitForFunction(()=>document.querySelector('audio')!.currentTime>8);assert.equal(await page.evaluate(()=>document.querySelector('audio')!.paused),true);assert.equal(await page.getByRole('button',{name:'直接听歌'}).count(),0);
    const source=await page.evaluate(()=>document.querySelector('audio')!.currentSrc),position=await page.evaluate(()=>document.querySelector('audio')!.currentTime),scope=app.services.radio.now().programmeId;
    await page.locator('.queue-entry').click();await page.getByRole('button',{name:'调整待播：Fixture track 303'}).click();await page.getByRole('button',{name:'下一首播放',exact:true}).click();await page.getByText('已移到下一首，当前播放不变。').waitFor();assert.deepEqual(app.services.radio.now().queue.map(i=>i.track.id),['101','303','202']);
    await page.getByRole('button',{name:'调整待播：Fixture track 303'}).click();await page.getByRole('button',{name:'移出待播',exact:true}).click();await page.getByText('已移出待播，没有写入不喜欢反馈。').waitFor();assert.deepEqual(app.services.radio.now().queue.map(i=>i.track.id),['101','202']);assert.equal(app.services.store.feedbackMap().size,0);
    assert.equal(await page.evaluate(()=>document.querySelector('audio')!.currentSrc),source);assert.equal(await page.evaluate(()=>document.querySelector('audio')!.currentTime),position);await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'喜欢这首歌',exact:true}).click();await page.getByRole('button',{name:'已喜欢这首歌',exact:true}).waitFor();
    await page.getByRole('button',{name:'节目',exact:true}).first().click();await page.getByLabel('歌曲或歌手').fill('TEST');await page.getByRole('button',{name:'搜索',exact:true}).click();await page.getByRole('button',{name:'加入待播：Fixture track 303 · Fixture artist'}).click();await page.getByRole('button',{name:'撤销加入',exact:true}).click();await page.waitForTimeout(150);assert.deepEqual(app.services.radio.now().queue.map(i=>i.track.id),['101','202']);assert.equal(app.services.radio.now().programmeId,scope);
    await page.locator('.mobile-nav').getByRole('button',{name:'历史',exact:true}).click();await page.locator('.listening-collection .track-row').waitFor();assert.equal(await page.locator('.listening-collection .track-row').count(),1);await page.getByRole('button',{name:'喜欢的歌',exact:true}).click();assert.equal(await page.locator('.listening-collection .track-row').count(),1);
    if(process.env.EMILY_BROWSER_EVIDENCE_DIR){await mkdir(process.env.EMILY_BROWSER_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:join(process.env.EMILY_BROWSER_EVIDENCE_DIR,'daily-collection.png')});}
    await page.locator('.mobile-nav').getByRole('button',{name:'收听',exact:true}).click();await page.getByRole('button',{name:'听感与节目',exact:true}).click();await page.getByLabel('定时结束').selectOption('track');await page.keyboard.press('Escape');await page.getByRole('button',{name:'播放',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('audio')!.paused);await page.getByLabel('歌曲播放进度').fill('23.7');await page.waitForFunction(()=>document.querySelector('audio')!.ended);await page.getByText('定时已结束，播放已暂停。').waitFor();assert.equal(app.services.radio.now().track?.id,'101');assert.equal(await page.evaluate(()=>document.querySelectorAll('audio').length),1);
    // UI time controls use actual wall clock; Playwright advances only this explicit fixture's clock.
    await page.clock.install();await page.getByRole('button',{name:'听感与节目',exact:true}).click();await page.getByLabel('定时结束').selectOption('15');await page.getByRole('button',{name:'取消定时',exact:true}).waitFor();await page.clock.fastForward(15*60000+1000);await page.waitForTimeout(20);assert.equal(await page.getByLabel('定时结束').inputValue(),'off');await page.keyboard.press('Escape');
    // Restore fixture position for layout checks, no synthetic time shown as playback evidence.
    await page.getByLabel('歌曲播放进度').fill('8');
    for(const size of [{width:360,height:560},{width:393,height:740},{width:768,height:900},{width:1360,height:900}]) {await page.setViewportSize(size);assert(await page.locator('.listening-tools').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+1));}
    await page.setViewportSize({width:393,height:740});await page.getByRole('button',{name:'听感与节目',exact:true}).click();if(process.env.EMILY_BROWSER_EVIDENCE_DIR)await page.screenshot({path:join(process.env.EMILY_BROWSER_EVIDENCE_DIR,'daily-options.png')});await page.keyboard.press('Escape');
    const beforeFailure=app.services.radio.now();
    await page.route('**/api/now',async route => { const response=await route.fetch();const body=await response.json();body.data.dj={...body.data.dj,status:'tts_failed',audioUrl:undefined,failure:{code:'cooldown',retryAt:new Date(Date.now()+3600000).toISOString()}};delete body.data.resume;await route.fulfill({json:body}); });
    await page.reload();await page.locator('.main-play').waitFor();await page.getByText(/Google 语音正在冷却/).first().waitFor();assert.equal(await page.getByRole('button',{name:'直接听歌'}).count(),0);
    assert.equal(app.services.radio.now().programmeId,beforeFailure.programmeId);assert.equal(app.services.radio.settings().djEnabled,true);
    await page.getByRole('button',{name:'听感与节目',exact:true}).click();await page.context().setOffline(true);await page.locator('.radio-sheet').getByText(/当前网络已断开/).waitFor();await page.context().setOffline(false);
    assert.deepEqual(errors,[]);
    if(process.env.EMILY_BROWSER_EVIDENCE_DIR)await writeFile(join(process.env.EMILY_BROWSER_EVIDENCE_DIR,'daily-fixture.json'),JSON.stringify({fixture:true,checkpointPausedReload:true,oneOffHostSkip:true,queueMetadataOnly:true,undo:true,collection:true,realEndedTimer:true,simulatedWallClockTimer:true,singleAudio:true,pageErrors:errors}));
  }finally{if(browser)await browser.close();await app.close();await provider.close();await rm(dir,{recursive:true,force:true});}
});
