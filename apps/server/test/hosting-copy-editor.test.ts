import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import type {RadioSettings,Track} from '@emily/shared';
import {hostingCopyIssues,EMILY_COPY_EDITOR} from '../src/hosting-editor.js';
import {ProgrammeSelector} from '../src/model.js';
import {loadConfig} from '../src/config.js';
const track:Track={id:'101',title:'测试曲目',artist:'测试歌手',source:'netease'};
const settings:RadioSettings={hostLanguage:'zh',voice:'gemini:Sulafat',djEnabled:true,discovery:false,mood:'随意',volume:.5};
const bad='我就不多说了，顺着此刻的感觉，听测试曲目。';
const good='那就再听一遍。你那时还常听哪些歌？这份旧歌单我倒挺想认识一下，有时从一首歌往旁边找，比先给歌单定好分类更让我好奇。你要是哪天愿意说，我们就从那几个名字聊起。先听测试歌手的《测试曲目》。';
const plain='继续听测试歌手的《测试曲目》。这是一段明确标记的测试段落，保留完整内容以核对编辑失败时其他合格串场不受牵连。测试文本不描述真实音乐，也不是用户原话或个人经历，更不能被当作正式节目推荐。';

test('known copy defects exclude exact metadata and do not ban all warmth or short transitions',()=>{
 for(const text of [bad,'今天就不聊那些有的没的，把话头收一收。','能把它从待办里划掉。','再翻出来，感觉总不太一样。','整个人轻松了，清单上的事情划掉了。','这首节奏挺悠闲的，今天听正好。','最后一首，听这个。','最后这首就是它。','脑子里早有个很明确的念头。','悬在那儿总觉得不利索。','日文歌名我就不专门念了。','不用全神贯注，手头继续忙。','看大家点歌，总会明白。','我通常不会多问，不用我多做铺垫。','很多人的播放列表常客，稳稳把氛围接住。','名字有沉得住气的特质。','一旦勾掉就很不一样。','事情终于划掉，在备忘录里勾掉。','我更习惯随手撕张纸当书签。','整理抽屉翻到旧门票，舍不得扔。'])assert(hostingCopyIssues(text,track).length,text);
 assert(hostingCopyIssues('你点的这首来了。',track,{requestedBy:'fallback'}).length);
 assert.deepEqual(hostingCopyIssues('如果用一张纸当书签，我会选择留着。',track),[]);
 assert.deepEqual(hostingCopyIssues(good,track),[]);assert.deepEqual(hostingCopyIssues('好，就放这首。',track),[]);
 assert.deepEqual(hostingCopyIssues('来听《我就不多说了》。',{...track,title:'我就不多说了'}),[]);
 assert(hostingCopyIssues(good,track,{recentHosting:[good]}).length);assert.deepEqual(hostingCopyIssues('接下来，测试歌手的《测试曲目》。',track,{recentHosting:['接下来，测试歌手的《测试曲目》。']}),[]);
});

async function withEditor(mode:'good'|'bad'|'foreign-id'|'markup'|'fail'|'hang',run:(selector:ProgrammeSelector,calls:{body:any;at:number}[])=>Promise<void>,timeout=12000){
 const calls:{body:any;at:number}[]=[];
 const server=createServer(async(req,res)=>{const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=JSON.parse(Buffer.concat(chunks).toString());calls.push({body,at:Date.now()});
  const editor=body.messages[0].content===EMILY_COPY_EDITOR;
  if(editor&&mode==='hang')return;
  if(editor&&mode==='fail'){res.writeHead(503).end('TEST_PRIVATE_DIAGNOSTIC');return;}
  const plan=editor?{edits:JSON.parse(body.messages[1].content).drafts.map((d:any)=>({id:mode==='foreign-id'?'wrong':d.id,hosting:mode==='bad'?bad:mode==='markup'?'<speak>禁止</speak>':good}))}:body.messages[0].content.includes('HOST_ONE:')?{hosting:bad}:{title:'测试节目',selections:[{id:'202',reason:'测试理由一',hosting:bad},{id:'101',reason:'测试理由二',hosting:plain}]};
  if(!editor&&mode==='hang')await new Promise(r=>setTimeout(r,180));
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(plan)}}]}));
 });server.listen(0,'127.0.0.1');await once(server,'listening');const a=server.address();assert(a&&typeof a==='object');
 try{await run(new ProgrammeSelector(loadConfig({EMILY_MODEL_BASE_URL:`http://127.0.0.1:${a.port}/v1`,EMILY_MODEL_API_KEY:'TEST_ONLY_EDITOR_KEY',EMILY_MODEL_NAME:'fixture',EMILY_HTTP_TIMEOUT_MS:String(timeout)})),calls);}finally{server.closeAllConnections();await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
}

test('one-track known defect gets one bounded edit with original context, no TTS/selection or third request',async()=>{
 await withEditor('good',async(selector,calls)=>{const r=await selector.host(track,settings,{requestedBy:'user',listenerNote:'TEST_PRIVATE_NOTE 以前常听',recentHosting:['其他测试串场。']});assert.equal(r.text,good);assert.equal(r.warning,undefined);assert.equal(calls.length,2);const draft=JSON.parse(calls[1]!.body.messages[1].content).drafts[0];assert.equal(draft.context.listenerNote,'TEST_PRIVATE_NOTE 以前常听');assert.equal(draft.id,'0');assert(draft.issues.length);});
 for(const mode of ['bad','foreign-id','markup','fail'] as const)await withEditor(mode,async(selector,calls)=>{const r=await selector.host(track,settings);assert(r.warning);assert(!r.text.includes('不多说'));assert(!JSON.stringify(r).includes('TEST_PRIVATE'));assert.equal(calls.length,2);});
});

test('batch edit cannot replace, reorder or discard valid selections when copy editing fails',async()=>{
 for(const mode of ['good','bad','foreign-id','fail'] as const)await withEditor(mode,async(selector,calls)=>{const r=await selector.select([track,{...track,id:'202',title:'第二测试曲目'}],{limit:2},settings,new Map());assert.equal(r.source,'model');assert.deepEqual(r.items.map(i=>i.track.id),['202','101']);assert.deepEqual(r.items.map(i=>i.reason),['测试理由一','测试理由二']);assert.equal(calls.length,2);assert.equal(r.items[1]!.hosting,plain);assert.equal(r.warnings.length,mode==='good'?0:1);});
});

test('slow editing shares the original hosting deadline, stops once and returns honest fallback',async()=>{
 await withEditor('hang',async(selector,calls)=>{const start=Date.now(),r=await selector.host(track,settings);assert(r.warning);assert.equal(calls.length,2);assert(Date.now()-start<1300,'editing must not start a second full writer budget');},800);
});
