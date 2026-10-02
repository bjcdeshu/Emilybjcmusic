import { useEffect, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { ArrowRight, Check, MessageCircle, Plus, Send, X } from 'lucide-react';
import type { ListeningMessage, ListeningMode, ListeningRequest, ListeningResponse, NowPlayingState, ProgrammeRequest, QueueAddResponse, SetupStatus } from '@emily/shared';
import { errorMessage, post } from './api';
import { StationIdentity, Spinner } from './components';
export type ListeningTurn = ListeningMessage & { suggestion?: ListeningResponse; programmeId?: string; listenerNote?: string; additions?: Record<string,string> };
type Props = {
  close: () => void; setup: SetupStatus | null; busy: boolean; now: NowPlayingState | null;
  turns: ListeningTurn[]; setTurns: Dispatch<SetStateAction<ListeningTurn[]>>;
  enqueue: (trackId: string, programmeId: string, listenerNote?: string) => Promise<QueueAddResponse>;
  createProgramme: (request: ProgrammeRequest) => Promise<boolean>;
};
export function ListeningDialog({ close, setup, busy, now, turns, setTurns, enqueue, createProgramme }: Props) {
  const dialog = useRef<HTMLDialogElement>(null), controller = useRef<AbortController|null>(null), log = useRef<HTMLDivElement>(null);
  const mounted = useRef(true), retry = useRef<{ request: ListeningRequest; programmeId?: string } | null>(null);
  const [draft,setDraft] = useState(''), [sending,setSending] = useState(false), [error,setError] = useState('');
  const [mode,setMode] = useState<ListeningMode>('enqueue'), [adding,setAdding] = useState(''), [replacing,setReplacing] = useState(false), [resultNote,setResultNote] = useState('');
  useEffect(() => {
    const el = dialog.current!, previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    mounted.current = true; document.body.style.overflow = 'hidden'; el.showModal();
    return () => { mounted.current = false; controller.current?.abort(); el.close(); document.body.style.overflow = overflow; previous?.focus({preventScroll:true}); };
  }, []);
  useEffect(() => { log.current?.scrollTo({top:log.current.scrollHeight,behavior:'instant'}); }, [turns,sending,error]);
  const available = !!setup?.model.configured && !!setup.music.connected;
  async function consult(request: ListeningRequest, programmeId?: string) {
    setError(''); setSending(true); retry.current = { request, ...(programmeId?{programmeId}:{}) };
    const abort = new AbortController(); controller.current = abort;
    try {
      const response = await post<ListeningResponse>('/api/conversation',request,abort.signal);
      if (!abort.signal.aborted) { setTurns(old => [...old.slice(-29),{role:'assistant',text:response.reply,suggestion:response,listenerNote:request.messages.filter(m=>m.role==='user').slice(-3).map(m=>m.text).join('；').slice(-600),...(programmeId?{programmeId}:{})}]); retry.current = null; }
    } catch (e) { if (!abort.signal.aborted) setError(errorMessage(e)); }
    finally { if (!abort.signal.aborted) setSending(false); }
  }
  function send(e: FormEvent) {
    e.preventDefault(); if (sending || adding || replacing || !draft.trim() || !available) return;
    const next: ListeningTurn[] = [...turns.slice(-28),{role:'user',text:draft.trim().replace(/[\r\n]+/g,' ')}]; setTurns(next); setDraft('');
    const context = [...turns].reverse().find(t=>t.suggestion?.context)?.suggestion?.context;
    void consult({mode,messages:next.slice(-11).map(t=>({role:t.role,text:t.text})),...(context?{context}:{})},now?.programmeId);
  }
  async function add(turn: ListeningTurn, trackId: string) {
    if (!turn.programmeId || adding || sending || busy) return;
    setAdding(trackId); setError(''); setResultNote('');
    try {
      const result = await enqueue(trackId,turn.programmeId,turn.listenerNote);
      setTurns(old=>old.map(t=>t===turn?{...t,additions:{...t.additions,[trackId]:result.message}}:t));
      if (mounted.current) setResultNote(result.message);
    } catch(e) { if (mounted.current) setError(errorMessage(e)); }
    finally { if (mounted.current) setAdding(''); }
  }
  const latest = turns.at(-1);
  const proposal = latest?.role==='assistant' && latest.suggestion?.mode==='replace' ? latest.suggestion.programme : undefined;
  const queueChanged = (turn: ListeningTurn) => !now?.track || !now.programmeId || turn.programmeId !== now.programmeId;
  return <dialog ref={dialog} className="modal listening-dialog" aria-labelledby="listening-dialog-title" onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}}}>
    <div className="modal-inner">
      <header className="section-heading"><div><StationIdentity label="点歌与选曲"/><h2 id="listening-dialog-title">这会儿，想听什么？</h2></div><button className="icon-button" aria-label="关闭对话" onClick={close}><X size={20}/></button></header>
      <div className="listening-mode" role="group" aria-label="这次如何选曲"><button aria-pressed={mode==='enqueue'} disabled={sending||!!adding||replacing} onClick={()=>setMode('enqueue')}>点歌加入</button><button aria-pressed={mode==='replace'} disabled={sending||!!adding||replacing} onClick={()=>setMode('replace')}>另选一组</button></div>
      <p className="listening-context">{mode==='enqueue' ? now?.track ? `当前：${now.track.title} · 点歌只加在待播队尾${now.roaming?.enabled?'，原歌单继续漫游':''}。` : '先找歌。开始一个节目后，就能把它加入待播列表。' : '另选一组会更换当前节目；先找候选，最后再确认。'}</p>
      <div className="listening-log" ref={log} role="log" aria-label="听歌对话" aria-live="polite" aria-busy={sending}>
        {!turns.length && <div className="listening-welcome"><MessageCircle size={20}/><p>可以直接说歌名和歌手。点一首，就只找这一首；你核对版本后再加入。</p><button className="text-button" onClick={()=>setDraft('想听李建清的《匆匆》')}>比如：李建清的《匆匆》<ArrowRight size={15}/></button></div>}
        {turns.map((turn,index)=><article key={index} className={`listening-turn ${turn.role}`}><b>{turn.role==='user'?'你':'Emily'}</b><p>{turn.text}</p>{turn.suggestion?.clarifications?.length?<div className="listening-clarify">{turn.suggestion.clarifications.map(name=><button key={name} className="secondary-button" disabled={sending||!!adding||replacing} onClick={()=>setDraft(`确认，是${name}，只找这一首`)}>确认：{name}</button>)}</div>:null}{turn.suggestion?.tracks.length?<ul className="listening-proposal">{turn.suggestion.tracks.map(track=><li key={track.id}><span><b>{track.title}</b><small>{track.artist}{track.album?` · ${track.album}`:''}</small>{turn.additions?.[track.id]&&<small className="inline-good" role="status">{turn.additions[track.id]}</small>}</span>{turn.suggestion?.mode!=='replace'&&<button className="secondary-button" aria-label={`加入待播：${track.title} · ${track.artist}`} disabled={!!adding||sending||busy||replacing||queueChanged(turn)||!!turn.additions?.[track.id]||(turn.suggestion?.match==='choose_version'&&!!Object.keys(turn.additions||{}).length)} onClick={()=>void add(turn,track.id)}>{adding===track.id?<Spinner label="加入中"/>:turn.additions?.[track.id]?<><Check size={15}/>{turn.additions[track.id]!.startsWith('已加入')?'已加入':'已在列表'}</>:<><Plus size={15}/>加入待播</>}</button>}</li>)}</ul>:null}{turn.suggestion?.tracks.length&&turn.suggestion.mode!=='replace'&&queueChanged(turn)?<p className="muted tiny">{now?.track?'节目已经更换，请重新查找后加入当前列表。':'先从节目页开始一档节目；这里不会替你覆盖列表。'}</p>:null}{turn.suggestion?.warnings.length?<details className="listening-warnings"><summary>检索说明</summary>{turn.suggestion.warnings.map((w,i)=><p key={i}>{w}</p>)}</details>:null}</article>)}
        {sending&&<Spinner label="正在查找真实曲目，当前播放不变"/>}{error&&<div className="inline-error" role="alert"><p>{error}</p>{retry.current&&<button className="text-button" disabled={sending} onClick={()=>{const r=retry.current;if(r)void consult(r.request,r.programmeId);}}>重试这次查找</button>}</div>}
      </div>
      {proposal&&mode==='replace'&&<div className="listening-replace"><p>会更换当前列表与漫游范围，不是追加。</p><button className="primary-button listening-accept" disabled={busy||sending||replacing||!!adding} onClick={()=>{setReplacing(true);void createProgramme(proposal).then(ok=>{if(mounted.current){if(ok)close();else{setError('新节目没有准备完成，未继续播放。');setReplacing(false);}}});}}>{replacing?'正在准备新节目':`确认换成这 ${proposal.trackIds?.length || 0} 首`}<ArrowRight size={17}/></button></div>}
      {!available&&<p className="inline-error">{!setup?.model.configured?'模型尚未配置，暂时不能对话选曲。':'请先连接你的网易云音乐。'}</p>}
      {resultNote&&<p className="listening-result" role="status"><Check size={14}/>{resultNote}</p>}
      <form className="listening-compose" onSubmit={send}><label className="sr-only" htmlFor="listening-message">告诉 Emily 想听什么</label><textarea autoFocus id="listening-message" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit();}}} rows={2} maxLength={500} placeholder={mode==='enqueue'?'歌名、歌手，或者想找什么音乐…':'想换成怎样的一组音乐？'} disabled={sending||!!adding||replacing}/><button className="primary-button" type="submit" aria-label="发送听歌想法" disabled={sending||!!adding||replacing||!draft.trim()||!available}><Send size={18}/></button></form>
      <div className="listening-footnote"><small>对话不存档。确认加入时，相关原话会暂存于服务器内存供串场使用，并发给现有模型；生成的串场及音频会随节目保留。Enter 发送，Shift+Enter 换行。</small><button className="text-button" disabled={sending||!!adding||replacing||(!turns.length&&!error)} onClick={()=>{setTurns([]);setError('');setResultNote('');retry.current=null;void post('/api/hosting/context/clear',{}).catch(()=>{if(mounted.current)setError('页面对话已清空，但待播串场上下文清理失败；可重试清空。');});}}>清空对话</button></div>
    </div>
  </dialog>;
}
