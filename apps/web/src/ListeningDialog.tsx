import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, MessageCircle, Send, X } from 'lucide-react';
import type { ListeningMessage, ListeningResponse, ProgrammeRequest, SetupStatus } from '@emily/shared';
import { errorMessage, post } from './api';
import { StationIdentity, Spinner } from './components';
export type ListeningTurn=ListeningMessage & {suggestion?:ListeningResponse};
export function ListeningDialog({close,setup,busy,turns,setTurns,createProgramme}:{close:()=>void;setup:SetupStatus|null;busy:boolean;turns:ListeningTurn[];setTurns:(value:ListeningTurn[])=>void;createProgramme:(request:ProgrammeRequest)=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);const controller=useRef<AbortController|null>(null);const log=useRef<HTMLDivElement>(null);
  const [draft,setDraft]=useState('');const [sending,setSending]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{const el=dialog.current!;el.showModal();return()=>{controller.current?.abort();el.close();};},[]);
  useEffect(()=>{log.current?.scrollTo({top:log.current.scrollHeight,behavior:'instant'});},[turns,sending,error]);
  async function send(e:FormEvent){
    e.preventDefault();if(sending || !draft.trim() || !setup?.model.configured || !setup.music.connected)return;
    const next:ListeningTurn[]=[...turns.slice(-29),{role:'user',text:draft.trim()}];setTurns(next);setDraft('');setError('');setSending(true);
    const abort=new AbortController();controller.current=abort;
    try {
      const response=await post<ListeningResponse>('/api/conversation',{messages:next.slice(-11).map(t=>({role:t.role,text:t.text}))},abort.signal);
      if(!abort.signal.aborted)setTurns([...next,{role:'assistant',text:response.reply,suggestion:response}]);
    } catch(e){if(!abort.signal.aborted)setError(errorMessage(e));}
    finally{if(!abort.signal.aborted)setSending(false);}
  }
  const latestProposal=!error && turns.at(-1)?.role==='assistant'?turns.at(-1)?.suggestion?.programme:undefined;
  return <dialog ref={dialog} className="modal listening-dialog" aria-labelledby="listening-dialog-title" onCancel={e=>{e.preventDefault();close();}}>
    <div className="modal-inner"><div className="section-heading"><div><StationIdentity label="对话选曲" /><h2 id="listening-dialog-title">和 Emily 聊聊想听什么</h2></div><button className="icon-button" aria-label="关闭对话" onClick={close}><X size={20}/></button></div>
      <div className="listening-log" ref={log} role="log" aria-label="听歌对话" aria-live="polite">
        {!turns.length && <div className="listening-welcome"><MessageCircle size={20}/><p>告诉我一个心情、一种音乐，或具体的歌名。你可以继续补充，我会先找真实音乐，再由你决定是否播放。</p></div>}
        {turns.map((turn,index)=><article key={index} className={`listening-turn ${turn.role}`}><b>{turn.role==='user'?'你':'Emily'}</b><p>{turn.text}</p>{turn.suggestion?.tracks.length? <ul className="listening-proposal">{turn.suggestion.tracks.map(track=><li key={track.id}><span>{track.title}</span><small>{track.artist}</small></li>)}</ul>:null}{turn.suggestion?.warnings.map((warning,i)=><p className="muted tiny" key={i}>{warning}</p>)}</article>)}
        {sending&&<Spinner label="正在理解你的想法、查找真实音乐"/>}{error&&<p className="inline-error" role="alert">{error}</p>}
      </div>
      {latestProposal && <button className="primary-button listening-accept" disabled={busy||sending} onClick={()=>{createProgramme(latestProposal);close();}}>播放这档节目<ArrowRight size={17}/></button>}
      {!setup?.model.configured || !setup.music.connected?<p className="inline-error">{!setup?.model.configured?'模型尚未配置，暂时不能对话选曲。':'请先连接你的网易云音乐。'}</p>:null}
      <form className="listening-compose" onSubmit={e=>void send(e)}><label className="sr-only" htmlFor="listening-message">告诉 Emily 想听什么</label><textarea autoFocus id="listening-message" value={draft} onChange={e=>setDraft(e.target.value)} rows={2} maxLength={500} placeholder="想听温柔一点的中文歌，或者先来一首…" disabled={sending}/><button className="primary-button" type="submit" aria-label="发送听歌想法" disabled={sending||!draft.trim()||!setup?.model.configured||!setup.music.connected}><Send size={18}/></button></form>
      <div className="listening-footnote"><small>对话仅在当前页面保留；最近上下文与选曲元数据会发给已配置的模型。建议不会自动打断播放。</small><button className="text-button" disabled={sending||!turns.length} onClick={()=>{setTurns([]);setError('');}}>清空对话</button></div>
    </div>
  </dialog>;
}
