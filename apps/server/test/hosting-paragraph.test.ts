import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import type { Track, RadioSettings } from '@emily/shared';
import { EMILY_COPY_EDITOR, hostingParagraphIssues, hostingSpokenCharacters, MIN_HOSTING_SPOKEN_CHARACTERS } from '../src/hosting-editor.js';
import { ProgrammeSelector, hostingLine } from '../src/model.js';
import { loadConfig } from '../src/config.js';

const track: Track = { id:'101', title:'测试曲目', artist:'测试歌手', source:'netease' };
const settings: RadioSettings = { hostLanguage:'zh', voice:'gemini:Sulafat', djEnabled:true, discovery:false, mood:'测试', volume:.6 };
const short='好，测试歌手的《测试曲目》，这就放。';
const full='接下来是测试歌手的《测试曲目》。这里是一段明确标记的测试正文，用来验证普通接歌也保留完整段落，不再只报一个名字。测试中的这些句子不评价真实音乐，不断言私人经历，长度合格也不表示内容质量已经通过听众认可。';
const other='这一段保留另一份完整测试稿。这些文字只用于检查同一批里的合格段落不会被编辑请求覆盖，歌曲顺序和原因也保持原样。测试不访问真实用户的聊天，不调用音频供应商，也不能把这段说明作为正式节目输出。';

test('paragraph regression floor counts letters/numbers, excludes punctuation and metadata-only padding',()=>{
 assert.equal(MIN_HOSTING_SPOKEN_CHARACTERS,60);
 assert.equal(hostingSpokenCharacters(' 中 a9，。！？\n'),3);
 assert(hostingParagraphIssues('文'.repeat(59),track).length);
 assert.deepEqual(hostingParagraphIssues('文'.repeat(60),track),[]);
 assert(hostingParagraphIssues(short+'。'.repeat(150),track).length);
 assert(hostingParagraphIssues((track.title+track.artist).repeat(10),track).length);
 assert(hostingParagraphIssues(track.title.repeat(10)+'文'.repeat(39),track).length);
 assert.deepEqual(hostingParagraphIssues(track.title.repeat(10)+'文'.repeat(40),track),[]);
 assert.deepEqual(hostingParagraphIssues(full,track),[]);
 assert(hostingParagraphIssues('接下来，听玉置浩二的这首歌。',{...track,title:'夢のつづき',artist:'玉置浩二'}).length);
});

async function fixture(initial:string, revised:string, run:(selector:ProgrammeSelector,calls:any[])=>Promise<void>) {
 const calls:any[]=[];
 const server=createServer(async(req,res)=>{
  const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
  const body=JSON.parse(Buffer.concat(chunks).toString());calls.push(body);
  const editor=body.messages[0].content===EMILY_COPY_EDITOR;
  const plan=editor?{edits:JSON.parse(body.messages[1].content).drafts.map((draft:any)=>({id:draft.id,hosting:revised}))}
   :body.messages[0].content.includes('HOST_ONE:')?{hosting:initial}
   :{title:'测试节目',selections:[{id:'202',reason:'测试原因二',hosting:initial},{id:'101',reason:'测试原因一',hosting:other}]};
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(plan)}}]}));
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert(address&&typeof address==='object');
 try{await run(new ProgrammeSelector(loadConfig({EMILY_MODEL_BASE_URL:`http://127.0.0.1:${address.port}/v1`,EMILY_MODEL_API_KEY:'TEST_ONLY_PARAGRAPH_KEY',EMILY_MODEL_NAME:'fixture'})),calls);}
 finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}

test('plain short single hosting is expanded once, normal paragraphs need no editor, over-short edit is honest fallback',async()=>{
 await fixture(short,full,async(selector,calls)=>{
  const result=await selector.host(track,settings,{requestedBy:'fallback',position:'continuation'});
  assert.equal(result.text,full);assert.equal(result.warning,undefined);assert.equal(calls.length,2);
  const draft=JSON.parse(calls[1].messages[1].content).drafts[0];
  assert.equal(draft.context.listenerNote,null);assert.equal(draft.context.origin,'fallback');assert(draft.issues.some((issue:string)=>issue.includes('只够报幕')));
 });
 await fixture(full,short,async(selector,calls)=>{assert.equal((await selector.host(track,settings)).text,full);assert.equal(calls.length,1);});
 await fixture('我就不多说了。'+full,short,async(selector,calls)=>{
  const result=await selector.host(track,settings);assert(result.warning);assert.equal(result.text,hostingLine(track,undefined,'zh'));assert.equal(calls.length,2,'no third request or retry to fill length');
 });
});

test('batch paragraph repair preserves selections, reasons, clean neighbours and fallback warning',async()=>{
 for(const revised of [full,short])await fixture(short,revised,async(selector,calls)=>{
  const result=await selector.select([track,{...track,id:'202',title:'第二测试曲目'}],{limit:2},settings,new Map());
  assert.equal(result.source,'model');assert.deepEqual(result.items.map(item=>item.track.id),['202','101']);
  assert.deepEqual(result.items.map(item=>item.reason),['测试原因二','测试原因一']);assert.equal(result.items[1]!.hosting,other);
  assert.equal(calls.length,2);const drafts=JSON.parse(calls[1].messages[1].content).drafts;assert.equal(drafts.length,1);assert.equal(drafts[0].id,'0');
  assert.equal(result.warnings.length,revised===full?0:1);if(revised===full)assert.equal(result.items[0]!.hosting,full);
 });
});
