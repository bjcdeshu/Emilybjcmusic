import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CornerDownRight, MoreHorizontal, X } from 'lucide-react';
import type { QueueItem } from '@emily/shared';
import { Cover } from './components';

export function QueuePanel({ queue, currentIndex, programmeId, currentItemId, busy, editing, select, close, edit }: {
  queue: QueueItem[]; currentIndex: number; programmeId?: string | undefined; currentItemId?: string | undefined; busy: boolean; editing: boolean;
  select: (id: string) => void; close: () => void; edit: (id: string, action: 'next' | 'remove') => Promise<boolean>;
}) {
  const [menu, setMenu] = useState<string | null>(null), [message, setMessage] = useState('');
  const list = useRef<HTMLDivElement>(null), mounted = useRef(true);
  const focusIndex = useRef<number | null>(null);
  const scope = useRef({ programmeId, currentItemId }); scope.current = { programmeId, currentItemId };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setMenu(null); setMessage(''); }, [programmeId, currentItemId]);
  useLayoutEffect(() => {
    if (focusIndex.current === null) return;
    const more = list.current?.querySelectorAll<HTMLButtonElement>('.queue-more');
    const target = more?.[Math.min(focusIndex.current, more.length - 1)] || list.current?.closest('dialog')?.querySelector<HTMLButtonElement>('.radio-sheet-header button');
    target?.focus({ preventScroll: true }); focusIndex.current = null;
  }, [queue, menu]);
  async function change(item: QueueItem, action: 'next' | 'remove') {
    const before = [...(list.current?.querySelectorAll<HTMLButtonElement>('.queue-more') || [])].findIndex(el => el.dataset.item === item.id);
    const started = scope.current;
    const ok = await edit(item.id, action);
    if (ok && mounted.current && started.programmeId === scope.current.programmeId && started.currentItemId === scope.current.currentItemId) {
      focusIndex.current = action === 'next' ? 0 : Math.max(0, before); setMenu(null);
      setMessage(action === 'next' ? '已移到下一首，当前播放不变。' : '已移出待播，没有写入不喜欢反馈。');
    }
  }
  return <>
    <p className="queue-caption">点选立即播放，更多操作只调整待播。</p>
    <div className="queue-feedback" role="status">{message}</div>
    <div className="queue-track-list" ref={list}>{queue.length ? queue.map((item, index) => {
      const open = menu === item.id && index > currentIndex;
      return <div className="queue-item" data-current={index === currentIndex} key={item.id}>
        <div className="queue-item-main">
          <button className={`queue-row ${index === currentIndex ? 'current' : ''}`} aria-current={index === currentIndex ? 'true' : undefined} disabled={busy || item.status === 'failed'} onClick={() => { if (index !== currentIndex) select(item.track.id); close(); }}>
            <span className="queue-index">{String(index + 1).padStart(2, '0')}</span><Cover title={item.track.title} url={item.track.coverUrl}/><span><b>{item.track.title}</b><small>{item.track.artist}</small></span><small>{item.status === 'failed' ? '不可用' : index === currentIndex ? '当前' : index < currentIndex ? '已播' : index === currentIndex + 1 ? '下一首' : ''}</small>
          </button>
          {index > currentIndex && <button className="icon-button queue-more" data-item={item.id} aria-label={`调整待播：${item.track.title}`} aria-expanded={open} aria-controls={`queue-actions-${item.id}`} disabled={busy || editing} onClick={() => setMenu(open ? null : item.id)}><MoreHorizontal size={19}/></button>}
        </div>
        {index > currentIndex && <div className="queue-action-reveal" data-open={open} aria-hidden={!open} inert={!open} id={`queue-actions-${item.id}`}>
          <div><div className="queue-actions" role="group" aria-label={`待播操作：${item.track.title}`}>
            <button disabled={!open || busy || editing || index === currentIndex + 1} onClick={() => void change(item, 'next')}><CornerDownRight size={16}/>下一首播放</button>
            <button disabled={!open || busy || editing} onClick={() => void change(item, 'remove')}><X size={16}/>移出待播</button>
          </div></div>
        </div>}
      </div>;
    }) : <p className="muted tiny">还没有队列。先选歌单，或者搜索一首想听的歌。</p>}</div>
  </>;
}
