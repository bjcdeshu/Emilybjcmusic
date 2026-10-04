import { useEffect, useState, type CSSProperties } from 'react';
import { RefreshCw, Heart, History, Plus } from 'lucide-react';
import type { CollectionResponse, ProgrammeRequest, QueueAddResponse } from '@emily/shared';
import { api, errorMessage } from './api';
import { Cover, Spinner } from './components';

/** Owner-only metadata. Recently played means a real song playing event, not a prepared programme. */
export function ListeningCollection({ programmeId, enqueue, createProgramme, busy, refreshKey }: {
  programmeId?: string | undefined; enqueue: (id: string, scope: string) => Promise<QueueAddResponse>;
  createProgramme: (request: ProgrammeRequest) => void; busy: boolean; refreshKey: number;
}) {
  const [data, setData] = useState<CollectionResponse | null>(null);
  const [tab, setTab] = useState<'recent' | 'liked'>('recent');
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [adding, setAdding] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    void api<CollectionResponse>('/api/listening/collection', { signal: controller.signal }).then(value => { if(!controller.signal.aborted) setData(value); }).catch(e => { if(!controller.signal.aborted) setError(errorMessage(e)); }).finally(() => { if(!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, refreshKey]);
  async function add(id: string) {
    if (adding || busy) return;
    if (!programmeId) { createProgramme({ trackIds: [id], ordered: true, limit: 1 }); return; }
    setAdding(id); setError(''); setMessage('');
    try { const result = await enqueue(id, programmeId); setMessage(result.message); }
    catch(e) { setError(errorMessage(e)); } finally { setAdding(''); }
  }
  const rows = data?.[tab] || [];
  return <section className="listening-collection" aria-label="喜欢与最近播放">
    <div className="section-heading"><div className="collection-tabs" role="group" aria-label="歌曲回看" style={{"--tab": tab === "recent" ? 0 : 1} as CSSProperties}><button className="text-button" aria-pressed={tab === 'recent'} onClick={() => setTab('recent')}>最近播放</button><button className="text-button" aria-pressed={tab === 'liked'} onClick={() => setTab('liked')}>喜欢的歌</button></div><button className="icon-button" aria-label="刷新歌曲记录" disabled={loading} onClick={() => setRevision(v => v + 1)}><RefreshCw size={17} className={loading ? "spin" : ""}/></button></div>
    <details className="collection-note"><summary>留在 Emily 的听歌记录</summary><p>不修改网易云歌单。最近播放记录实际开始播放的歌曲，不代表听完；各显示最近 100 首，保存在个人服务端。</p></details>
    {loading && <Spinner label="读取歌曲记录"/>}{error && <p role="alert" className="inline-error">{error}</p>}{message && <p role="status" className="inline-good">{message}</p>}
    {!loading && !error && !rows.length && <div className="collection-empty">{tab === 'recent' ? <History size={22}/> : <Heart size={22}/>}<p>{tab === 'recent' ? '从下一首开始，留下听歌的记录。' : '听到喜欢的歌，点一下播放器的爱心。'}</p></div>}
    <div className="track-list collection-list" key={tab}>{rows.map(({ track, playedAt }) => <div className="track-row" key={track.id}><Cover title={track.title} url={track.coverUrl}/><span className="track-row-copy"><b>{track.title}</b><small>{track.artist}{track.album ? ` · ${track.album}` : ''}</small><small>{tab === 'liked' ? '喜欢于' : '最近播放于'} {new Date(playedAt).toLocaleString('zh-CN', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small></span><button className="secondary-button" disabled={busy || !!adding} aria-label={`${programmeId ? '加入待播' : '从这首开始'}：${track.title} · ${track.artist}`} onClick={() => void add(track.id)}>{adding === track.id ? <Spinner label="加入中"/> : programmeId ? <><Plus size={15}/><span>加入待播</span></> : '从这首开始'}</button></div>)}</div>
  </section>;
}
