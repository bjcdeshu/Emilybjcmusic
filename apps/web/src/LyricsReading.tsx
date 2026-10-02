import { useEffect, useRef, useState } from 'react';
import type { PlaybackSnapshot } from './playback';
import { lyricIndex } from './lyric-position';
import type { useLyrics } from './ListeningText';

export function LyricsReading({ result, playback }: { result: ReturnType<typeof useLyrics>; playback: PlaybackSnapshot }) {
  const ref=useRef<HTMLDivElement>(null), [manual,setManual]=useState(false);
  const data=result?.data, index=data?.status==='synced'&&playback.phase==='song'?lyricIndex(data.lines,playback.time):-1;
  function locate() {
    const line=ref.current?.querySelector<HTMLElement>('[aria-current=true]'), pane=ref.current?.closest<HTMLElement>('.radio-sheet-content');
    if(line&&pane) pane.scrollTo({top:pane.scrollTop+line.getBoundingClientRect().top-pane.getBoundingClientRect().top-pane.clientHeight*.35,behavior:'instant'});
  }
  useEffect(()=>{
    const pane=ref.current?.closest<HTMLElement>('.radio-sheet-content');if(!pane)return;
    const stop=()=>setManual(true);
    const key=(e:KeyboardEvent)=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(e.key))stop();};
    pane.addEventListener('sheet-open',locate);
    pane.addEventListener('wheel',stop,{passive:true});pane.addEventListener('touchstart',stop,{passive:true});pane.addEventListener('pointerdown',stop);pane.addEventListener('keydown',key);
    return()=>{pane.removeEventListener('sheet-open',locate);pane.removeEventListener('wheel',stop);pane.removeEventListener('touchstart',stop);pane.removeEventListener('pointerdown',stop);pane.removeEventListener('keydown',key);};
  },[]);
  useEffect(()=>{
    // One initial positioning, then real line changes only. Reduced motion and
    // paused audio never pull a manual reader back to the current position.
    locate();
  },[data?.trackId]);
  useEffect(()=>{
    if(!manual&&playback.status==='playing'&&!document.hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches)locate();
  },[index,manual,playback.status]);
  return <div className="lyrics-full" ref={ref} tabIndex={0} aria-label="完整歌词阅读">
    {data?.status==='synced'&&<div className="lyrics-reading-tools"><span>真实歌词时间轴</span><button className="text-button" onClick={()=>{setManual(false);locate();}}>回到当前句</button></div>}
    {result?.failed?<p>歌词暂不可用，音乐可以继续播放。</p>:!data?<p>正在读取当前歌曲的歌词…</p>:data.status==='plain'?<><p className="transcript-note">原文无时间轴，仅供阅读。</p><p className="lyrics-plain">{data.text}</p></>:data.status==='synced'?data.lines.map((line,i)=><p key={`${line.timeMs}-${i}`} aria-current={i===index?'true':undefined} className="full-lyric-line">{line.text||'\u00a0'}</p>):<p>{data.status==='instrumental'?'纯音乐':'暂无歌词'}</p>}
  </div>;
}
