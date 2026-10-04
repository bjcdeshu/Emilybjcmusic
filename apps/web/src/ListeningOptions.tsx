import { Clock3, Moon, ThumbsDown, Volume2, VolumeX } from 'lucide-react';
import type { NowPlayingState } from '@emily/shared';
import { hostingFailureMessage, type PlaybackSnapshot } from './playback';

type Props = {
  now: NowPlayingState | null; playback: PlaybackSnapshot; quiet: boolean; canSetQuiet: boolean;
  setQuiet: () => void; volume: (value: number) => void; sleep: (mode: 'track' | 15 | 30 | 60 | null) => void;
  feedbackKind?: string | undefined; feedbackBusy: boolean; less: () => void; roaming: () => void; sourceLabel: string;
};
/** Presentation only: existing timer/quiet/feedback callbacks keep their original semantics. */
export function ListeningOptions(props: Props) {
  const { now, playback, quiet } = props;
  const timer = playback.sleep;
  return <div className="listening-option-content">
    <section className="option-section sleep-control" aria-labelledby="sleep-title">
      <div className="option-heading"><h3 id="sleep-title"><Clock3 size={17} />定时结束</h3>{timer && <button className="text-button" onClick={() => props.sleep(null)}>取消定时</button>}</div>
      <p className="sleep-status" role="status">{timer?.mode === 'track' ? '这首歌播完后停止' : timer?.mode === 'time' ? `将在 ${new Date(timer.deadline).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 停止` : '听一会儿，再歇一会儿。'}</p>
      <div className="sleep-presets" role="group" aria-label="定时结束">
        <button className="sleep-track" aria-pressed={timer?.mode === 'track'} disabled={!now?.currentItemId} onClick={() => props.sleep(timer?.mode === 'track' ? null : 'track')}>本首播完</button>
        {([15, 30, 60] as const).map(minutes => <button key={minutes} aria-label={`${minutes} 分钟后停止`} onClick={() => props.sleep(minutes)}>{minutes}<small>分钟</small></button>)}
      </div>
      <details className="option-note"><summary>仅本页生效 · 定时说明</summary><p>刷新或退出后取消；切换歌曲取消“本首播完”。手机冻结页面时，到点停止可能延后，恢复页面会立即核对。</p></details>
    </section>
    <section className="option-section" aria-label="收听偏好">
      <button className="quiet-button option-toggle" aria-label="安静模式" aria-pressed={quiet} disabled={!props.canSetQuiet} onClick={props.setQuiet}><Moon size={18}/><span><b>安静模式</b><small>{quiet ? '暂不播放主持串场' : '保留 Emily 的主持串场'}</small></span><i className="toggle-track" aria-hidden="true"><i /></i></button>
      <div className="volume-control">{playback.volume === 0 ? <VolumeX size={18}/> : <Volume2 size={18}/>}<input type="range" aria-label="音量" min="0" max="1" step="0.01" value={playback.volume} onChange={e => props.volume(Number(e.target.value))}/><output>{Math.round(playback.volume * 100)}%</output></div>
      <button className={`text-button feedback-button ${props.feedbackKind === 'less_like_this' ? 'selected' : ''}`} disabled={!now?.track || props.feedbackBusy} aria-label="减少类似歌曲（跳过不会自动点踩）" aria-pressed={props.feedbackKind === 'less_like_this'} onClick={props.less}><ThumbsDown size={16}/>少来一点类似音乐</button>
    </section>
    <section className="option-section programme-context" aria-label="当前节目">
      <h3>当前节目</h3>
      {now?.programmeTitle && <p className="programme-info"><b>{now.programmeTitle}</b><span>{props.sourceLabel}</span></p>}
      {now?.track && <p className="programme-info">{now.track.title} — {now.track.artist}</p>}
      {now?.dj?.failure && <p className="programme-warning">{hostingFailureMessage(now.dj, true)}</p>}
      {now?.warning && <p className="programme-warning">{now.warning}</p>}
      {now?.roaming && <div className="roaming-control"><button className={`text-button ${now.roaming.enabled ? 'roaming-active' : ''}`} aria-pressed={now.roaming.enabled} onClick={props.roaming}>原歌单漫游 · {now.roaming.enabled ? '开启' : '关闭'}</button><span>{now.roaming.message || '每批最多12首，本轮不重复'}</span></div>}
    </section>
  </div>;
}
