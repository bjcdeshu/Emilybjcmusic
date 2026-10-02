import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { validateTtsAudio } from '../src/tts-audio.js';
import { EdgeTts, type TtsExecutor } from '../src/tts.js';
import { loadConfig } from '../src/config.js';
import { temporaryDirectory } from './helpers.js';

test('fixed bounded decoder rejects corrupt/silent/tiny audio and accepts real decoded fixture MP3', async () => {
 const dir = await temporaryDirectory();
 try {
  const tone = join(dir,'tone.mp3'), silence = join(dir,'silence.mp3'), bad = join(dir,'bad.mp3'), tiny = join(dir,'tiny.mp3');
  // ffmpeg-generated test tones, never speech or production catalogue evidence.
  for (const [file,source,time] of [[tone,'sine=frequency=330:sample_rate=24000','1'],[silence,'anullsrc=r=24000:cl=mono','1'],[tiny,'sine=frequency=330:sample_rate=24000','0.02']]) {
   execFileSync('ffmpeg',['-nostdin','-v','error','-f','lavfi','-i',source!,'-t',time!,'-c:a','libmp3lame',file!],{timeout:10000,windowsHide:true});
  }
  await writeFile(bad,'invalid MP3'.repeat(100));
  assert.equal(await validateTtsAudio(tone,process.env),true);
  for (const file of [silence,bad,tiny]) assert.equal(await validateTtsAudio(file,process.env),false);
 } finally { await rm(dir,{recursive:true,force:true}); }
});

test('TTS validation is deduplicated/bounded, corrupt cache regenerated, invalid output never published', async()=>{
 const dir=await temporaryDirectory(); let valid=true, checks=0, syntheses=0;
 const execute:TtsExecutor=(_command,args,_options,callback)=>{
  if(args.includes('--list-voices')){callback(null,'zh-CN-XiaoyiNeural Female');return;}
  syntheses++;void writeFile(args[args.indexOf('--write-media')+1]!,Buffer.alloc(256,1)).then(()=>callback(null,''));
 };
 const validator=async()=>{checks++;return valid;};
 const tts=new EdgeTts(loadConfig({EMILY_DATA_DIR:dir,EMILY_TTS_COMMAND:'edge-tts'}),Date.now,execute,validator);
 try {
  const text='这是一段明确标记的测试文案，不是生产主持。';
  const [a,b]=await Promise.all([tts.segment(text,'zh-CN-XiaoyiNeural'),tts.segment(text,'zh-CN-XiaoyiNeural')]);
  assert.equal(a.status,'tts_ready');assert.equal(a.id,b.id);assert.equal(syntheses,1);assert.equal(checks,1);
  await tts.segment(text,'zh-CN-XiaoyiNeural'); const cachedChecks=checks;
  await tts.segment(text,'zh-CN-XiaoyiNeural');assert.equal(checks,cachedChecks,'unchanged file is validated once per process');
  await writeFile(join(tts.audioDir,a.id+'.mp3'),Buffer.alloc(129,2));valid=false;
  const rejected=await tts.segment(text,'zh-CN-XiaoyiNeural');assert.equal(rejected.status,'tts_failed');assert.equal(rejected.audioUrl,undefined);assert.equal(syntheses,2);
  assert(!(await readdir(tts.audioDir)).some(name=>name.includes('.partial.')));
  assert.equal((await readFile(join(tts.audioDir,a.id+'.mp3'))).length,129,'failed regeneration never replaces existing file');
  valid=true;assert.equal((await tts.segment('另一段测试文案。','zh-CN-XiaoyiNeural')).status,'tts_ready');
 }finally{await rm(dir,{recursive:true,force:true});}
});
