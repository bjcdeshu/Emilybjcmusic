import { useRef, useState, type CSSProperties } from 'react';
import { formatTime } from './playback';
/** Pointer edits are previews until release. Keyboard edits remain immediate.
 * Keyed by track/phase by the parent: late releases cannot seek another source. */
export function SeekControl({time,duration,disabled,label,seek}:{time:number;duration:number;disabled:boolean;label:string;seek:(time:number)=>void}) {
  const [preview,setPreview]=useState<number|null>(null);
  const drag=useRef<{id:number;value:number;cancelled?:boolean}|null>(null);
  const value=Math.max(0,Math.min(preview??time,duration||0));
  function cancel(){drag.current=null;setPreview(null);}
  return <div className="transport-progress">
    <input className="seek-range" type="range" min="0" max={duration||1} step="0.1" value={value} disabled={!duration||disabled} aria-label={label} aria-valuetext={`${preview===null?'':'预览跳至 '}${formatTime(value)} / ${formatTime(duration)}`}
      onPointerDown={e=>{if(e.button!==0||disabled||!duration)return;drag.current={id:e.pointerId,value:time};setPreview(time);e.currentTarget.setPointerCapture(e.pointerId);}}
      onChange={e=>{const next=Number(e.currentTarget.value);if(drag.current){if(!drag.current.cancelled){drag.current.value=next;setPreview(next);}}else seek(next);}}
      onPointerUp={e=>{const pending=drag.current;if(!pending||pending.id!==e.pointerId)return;cancel();if(!disabled&&!pending.cancelled)seek(pending.value);}}
      onPointerCancel={cancel} onLostPointerCapture={cancel} onBlur={cancel}
      onKeyDown={e=>{if(e.key==='Escape'){if(drag.current)drag.current.cancelled=true;setPreview(null);e.preventDefault();}}}
      style={{'--progress':`${duration?value/duration*100:0}%`} as CSSProperties}/>
    <div className="progress-label"><span>{formatTime(time)}</span><span className="seek-preview" role="status">{preview===null?'':`松手跳至 ${formatTime(value)}`}</span><span>{duration?formatTime(duration):'–:––'}</span></div>
  </div>;
}
