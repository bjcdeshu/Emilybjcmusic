import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronRight, Headphones, History, ListMusic, LogOut, Moon, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Smartphone, Sparkles, Unplug, Volume2 } from "lucide-react";
import type { HistoryResponse, MusicSearchResponse, PlaylistResponse, PlaylistSummary, ProgrammeRequest, RadioSettings, SetupStatus, Track } from "@emily/shared";
import { ENGLISH_FEMALE_VOICES, MAX_PROGRAMME_TRACKS } from "@emily/shared";
import { api, errorMessage } from "./api";
import { Cover, Empty, Spinner } from "./components";

const programmes = [
  { name: "Soft Focus", tag: "沉下来，慢一点", prompt: "A warm, unhurried programme for focused work. Gentle textures and a calm English female host. Keep the hosting concise.", icon: Headphones },
  { name: "After Hours", tag: "给夜晚一点留白", prompt: "An intimate late-night radio programme with mellow music and short, thoughtful English hosting. No fabricated artist stories.", icon: Moon },
  { name: "Open Window", tag: "让熟悉与新鲜相遇", prompt: "A bright but relaxed personal radio programme. Find a thoughtful flow from my selected music, with concise English hosting.", icon: Sparkles }
];

type LibraryProps = { setup: SetupStatus | null; busy: boolean; createProgramme: (request: ProgrammeRequest) => void; playTrack: (id: string) => void; openQr: () => void };
export function Library({ setup, busy, createProgramme, playTrack, openQr }: LibraryProps) {
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [playlistId, setPlaylistId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selectedProgramme, setSelectedProgramme] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selection, setSelection] = useState<string[]>([]);
  const [searchController, setSearchController] = useState<AbortController | null>(null);
  useEffect(() => {
    if (!setup?.music.connected) return;
    const controller = new AbortController();
    setLoading(true); setError("");
    void api<PlaylistResponse>("/api/music/playlists", { signal: controller.signal })
      .then((response) => { if (!controller.signal.aborted) setPlaylists(response.items); })
      .catch((e) => { if (!controller.signal.aborted) setError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [setup?.music.connected, refresh]);
  useEffect(() => () => searchController?.abort(), [searchController]);
  async function search(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    searchController?.abort();
    const controller = new AbortController(); setSearchController(controller);
    setSearching(true); setSearchError("");
    try {
      const response = await api<MusicSearchResponse>(`/api/music/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
      if (!controller.signal.aborted) setResults(response.items);
    } catch (e) {
      if (!controller.signal.aborted) setSearchError(errorMessage(e));
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }
  function generate() {
    createProgramme({ ...(selection.length ? { trackIds: selection } : { playlistId }), prompt: prompt.trim() || programmes[selectedProgramme]!.prompt, limit: MAX_PROGRAMME_TRACKS });
  }
  return <section className="view-panel" aria-labelledby="library-title">
    <header className="view-heading"><p className="eyebrow">THE PROGRAMME ROOM</p><h1 id="library-title">今天，想听些什么？</h1><p>从你自己的音乐出发，让 Emily 把它们串成一档节目。</p></header>
    {!setup?.music.connected ? <Empty title={setup?.music.configured ? "先连接你的音乐" : "音乐服务还没配置"} action={setup?.music.configured && <button className="primary-button" onClick={openQr}>连接网易云<ArrowUpRight size={17} /></button>}>{setup?.music.configured ? "用本人的网易云账号扫码。你的会员权限仍属于你。" : "请由服务端配置授权的网易云适配器。这里不会用示例歌曲代替真实音乐。"}</Empty> : <>
      <section className="programme-section"><div className="section-heading"><h2>Choose a feeling</h2><span className="muted tiny">节目方向，不是固定歌单</span></div>
        <div className="programme-grid">{programmes.map(({ name, tag, icon: Icon }, index) => <button key={name} className={`programme-card ${selectedProgramme === index ? "selected" : ""}`} aria-pressed={selectedProgramme === index} onClick={() => setSelectedProgramme(index)}><Icon size={22} aria-hidden="true" /><b>{name}</b><small>{tag}</small>{selectedProgramme === index && <Check size={15} className="programme-check" />}</button>)}</div>
        <label className="field-label" htmlFor="programme-prompt">或者，告诉 Emily 此刻的心情 <span className="optional">可选</span></label>
        <textarea id="programme-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={400} rows={3} placeholder="例如：今晚想放空，先从温柔一点的歌开始。" />
      </section>
      <section><div className="section-heading"><div><p className="eyebrow">YOUR COLLECTION</p><h2>我的歌单</h2></div><button className="icon-button" aria-label="刷新歌单" disabled={loading} onClick={() => setRefresh((v) => v + 1)}><RefreshCw size={19} className={loading ? "spin" : ""} /></button></div>
        {loading && <Spinner label="正在读取真实歌单" />}{error && <p className="inline-error" role="alert">{error}</p>}
        {!loading && !error && !playlists.length && <p className="muted">当前账号没有返回歌单。可以重试，或在下方搜索音乐来编排。</p>}
        <div className="playlist-grid">{playlists.map((playlist) => <button key={playlist.id} className={`playlist-card ${playlistId === playlist.id && !selection.length ? "selected" : ""}`} aria-pressed={playlistId === playlist.id && !selection.length} onClick={() => { setPlaylistId(playlist.id); setSelection([]); }}><Cover url={playlist.coverUrl} title={playlist.name} /><span><b>{playlist.name}</b><small>{playlist.trackCount !== undefined ? `${playlist.trackCount} 首` : "网易云歌单"}</small></span>{playlistId === playlist.id && !selection.length ? <Check size={18} /> : <ChevronRight size={17} />}</button>)}</div>
      </section>
      <div className="programme-launch"><div><b>{selection.length ? `已选 ${selection.length} 首搜索结果` : playlists.find((p) => p.id === playlistId)?.name || "先选择一个歌单"}</b><p>{setup.model.configured ? "编排真实候选歌曲，准备主持语音后播放。" : "模型未配置：按歌单编排，不会伪装成 AI 选曲。"}</p></div><button className="primary-button" disabled={busy || (!playlistId && !selection.length)} onClick={generate}>{busy ? <Spinner label="准备节目" /> : <>开始这档节目<ArrowRight size={18} /></>}</button></div>
      <section className="search-section"><div className="section-heading"><div><p className="eyebrow">FIND YOUR NEXT SONG</p><h2>搜索音乐</h2></div><Search size={21} aria-hidden="true" /></div><form className="search-form" onSubmit={(e) => void search(e)}><label htmlFor="music-query" className="sr-only">歌曲或歌手</label><input id="music-query" type="search" value={query} maxLength={100} onChange={(e) => setQuery(e.target.value)} placeholder="歌曲、歌手、专辑…" /><button className="primary-button" disabled={searching || !query.trim()} type="submit">{searching ? <LoaderLabel /> : "搜索"}</button></form>
        <p className="muted tiny">曲目能否完整播放，以你本人的账号权限和音源返回为准。最多选 30 首参与编排。</p>
        {searchError && <p className="inline-error" role="alert">{searchError}</p>}{results && !results.length && <p className="muted">没有找到相关音乐，试试其他关键词。</p>}
        <div className="track-list">{results?.map((track) => <div className="track-row" key={track.id}><label className="select-track"><input type="checkbox" aria-label={`选择 ${track.title} 参与节目`} checked={selection.includes(track.id)} disabled={!selection.includes(track.id) && selection.length >= 30} onChange={(e) => setSelection((old) => e.target.checked ? [...old, track.id] : old.filter((id) => id !== track.id))} /><Cover title={track.title} url={track.coverUrl} /></label><span className="track-row-copy"><b>{track.title}</b><small>{track.artist}{track.album ? ` · ${track.album}` : ""}</small></span><button className="icon-button" disabled={busy} aria-label={`播放 ${track.title}`} onClick={() => playTrack(track.id)}><ArrowUpRight size={20} /></button></div>)}</div>
        {!!selection.length && <button className="secondary-button selection-action" disabled={busy} onClick={generate}><ListMusic size={18} />用这 {selection.length} 首编排节目<ArrowRight size={17} /></button>}
      </section>
    </>}
  </section>;
}
function LoaderLabel() { return <Spinner label="搜索中" />; }

export function RadioHistory({ createProgramme, busy, refreshKey }: { createProgramme: (request: ProgrammeRequest) => void; busy: boolean; refreshKey: number }) {
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    void api<HistoryResponse>("/api/history", { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) setHistory(value); })
      .catch((e) => { if (!controller.signal.aborted) setError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refreshKey, retry]);
  return <section className="view-panel" aria-labelledby="history-title"><header className="view-heading"><p className="eyebrow">PREVIOUSLY ON EMILY</p><h1 id="history-title">听过的时光</h1><p>服务端保存的节目记录。重新编排会生成新节目，不会伪造过去的播放进度。</p></header><div className="section-heading"><h2>节目历史</h2><button className="icon-button" aria-label="刷新历史" disabled={loading} onClick={() => setRetry((v) => v + 1)}><RefreshCw size={19} className={loading ? "spin" : ""} /></button></div>{loading && <Spinner />}{error && <p className="inline-error" role="alert">{error}</p>}{!loading && !error && !history?.items.length && <Empty title="第一档节目，留给现在。">开始听歌后，节目记录会出现在这里。</Empty>}
    <div className="history-list">{history?.items.map((entry) => <article className="history-card" key={entry.id}><div className="section-heading"><span className="history-icon"><History size={20} /></span><time dateTime={entry.createdAt}>{dateLabel(entry.createdAt)}</time></div><h3>{entry.title}</h3><p className="muted tiny">{entry.tracks.length} 首音乐</p><div className="history-tracks">{entry.tracks.map((track, index) => <span key={`${track.id}-${index}`}><b>{track.title}</b><small>{track.artist}</small></span>)}</div><button className="secondary-button" disabled={busy || !entry.tracks.length} onClick={() => createProgramme({ trackIds: entry.tracks.map((track) => track.id).slice(0, 30), prompt: `Revisit this personal programme: ${entry.title}. Concise English hosting.`, limit: Math.min(entry.tracks.length, MAX_PROGRAMME_TRACKS) })}>重新编排<ArrowUpRight size={17} /></button></article>)}</div>
  </section>;
}
function voiceLabel(id: string) {
  const names: Record<string, string> = { "en-US-EmmaMultilingualNeural": "Emma · 美式英语（多语言）", "en-US-EmmaNeural": "Emma · 美式英语", "en-US-JennyNeural": "Jenny · 美式英语", "en-US-AriaNeural": "Aria · 美式英语", "en-GB-SoniaNeural": "Sonia · 英式英语", "en-IE-EmilyNeural": "Emily · 爱尔兰英语", "en-AU-NatashaNeural": "Natasha · 澳大利亚英语" };
  return names[id] || id;
}
function dateLabel(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "日期不可用" : date.toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

type SettingsProps = {
  settings: RadioSettings | null; setup: SetupStatus | null; busy: boolean;
  save: (patch: Partial<RadioSettings>) => Promise<boolean>; disconnect: () => Promise<void>;
  logout: () => void; openQr: () => void; refresh: () => void; volume: number; setVolume: (value: number) => void;
  canInstall: boolean; install: () => Promise<void>; updateReady: boolean;
};
export function Settings(props: SettingsProps) {
  const { settings, setup, busy, save } = props;
  const [voice, setVoice] = useState(settings?.voice || "");
  const [mood, setMood] = useState(settings?.mood || "");
  const [discovery, setDiscovery] = useState(settings?.discovery ?? false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setVoice(settings?.voice || ""); setMood(settings?.mood || ""); setDiscovery(settings?.discovery ?? false); }, [settings?.voice, settings?.mood, settings?.discovery]);
  async function submit(e: FormEvent) { e.preventDefault(); setSaved(false); setSaved(await save({ voice: voice.trim(), mood: mood.trim(), discovery })); }
  return <section className="view-panel" aria-labelledby="settings-title"><header className="view-heading"><p className="eyebrow">MAKE YOURSELF AT HOME</p><h1 id="settings-title">按你的方式听。</h1><p>一个人，一台电台。声音和节奏都可以慢慢调整。</p></header>
    <section className="settings-card"><div className="section-heading"><div className="heading-icon"><ShieldCheck size={22} /><h2>音乐与服务</h2></div><button className="icon-button" aria-label="重新检查服务配置" onClick={props.refresh}><RefreshCw size={19} /></button></div>
      <div className="service-row"><span><b>网易云音乐</b><small>{setup?.music.connected ? setup.music.user?.name || "个人账号已连接" : setup?.music.configured ? "适配器已配置，等待个人授权" : "服务端未配置适配器"}</small></span>{setup?.music.connected ? <button className="text-button" onClick={() => setConfirmDisconnect(true)}><Unplug size={16} />断开</button> : <button className="secondary-button" disabled={!setup?.music.configured} onClick={props.openQr}>连接</button>}</div>
      {confirmDisconnect && <div className="confirm-inline"><p>断开后将停止播放，并移除服务端的音乐授权。需要重新扫码才能继续。</p><div className="button-row"><button className="danger-button" disabled={busy} onClick={() => { void props.disconnect().then(() => setConfirmDisconnect(false)); }}>确认断开</button><button className="text-button" onClick={() => setConfirmDisconnect(false)}>取消</button></div></div>}
      <div className="service-row"><span><b>节目编排模型</b><small>{setup?.model.configured ? "服务端已配置；实际调用结果会在节目中提示" : "未配置，使用真实歌单选曲"}</small></span><span className={`status-dot ${setup?.model.configured ? "good" : ""}`} /></div>
      <div className="service-row"><span><b>英文主持语音</b><small>{setup?.tts.available ? `可用 · ${setup.tts.voice}` : "语音服务不可用，歌曲仍可独立播放"}</small></span><span className={`status-dot ${setup?.tts.available ? "good" : ""}`} /></div>
      {setup?.music.message && <p className="muted tiny">{setup.music.message}</p>}
    </section>
    <section className="settings-card"><div className="heading-icon"><Headphones size={22} /><h2>听感</h2></div><div className="service-row"><span><b>安静模式</b><small>跳过语音串场，继续听歌；可随时关闭。</small></span><button className={`switch ${settings && !settings.djEnabled ? "on" : ""}`} role="switch" aria-checked={settings ? !settings.djEnabled : false} aria-label="安静模式" disabled={!settings || busy} onClick={() => { void save({ djEnabled: !settings?.djEnabled }); }}><span /></button></div><label className="volume-setting"><Volume2 size={19} /><span>播放器音量</span><input type="range" min="0" max="1" step="0.01" aria-label="播放器音量" value={props.volume} onChange={(e) => props.setVolume(Number(e.target.value))} /><output>{Math.round(props.volume * 100)}%</output></label>
      <p className="muted tiny">Android 的系统媒体音量仍由手机音量键控制。</p>
    </section>
    <form className="settings-card settings-form" onSubmit={(e) => void submit(e)}><div className="heading-icon"><SlidersHorizontal size={22} /><h2>主持与选曲</h2></div><div className="service-row"><span><b>Hosting language</b><small>英文主持。界面语言不影响串场语言。</small></span><span className="pill">English</span></div>
      <label className="field-label" htmlFor="voice-id">英文女声</label><select id="voice-id" value={voice} required disabled={!settings} onChange={(e) => { setVoice(e.target.value); setSaved(false); }}>{ENGLISH_FEMALE_VOICES.map(id => <option key={id} value={id}>{voiceLabel(id)}</option>)}</select>
      <p className="muted tiny">只列出服务端允许的英文女声；这是可选声线，不保证在线语音服务此刻可用。调整在下一段主持生效。</p>
      <label className="field-label" htmlFor="default-mood">默认节目心情</label><input id="default-mood" value={mood} maxLength={120} disabled={!settings} onChange={(e) => { setMood(e.target.value); setSaved(false); }} placeholder="calm, warm, thoughtful" />
      <label className="checkbox-field"><input type="checkbox" checked={discovery} disabled={!settings} onChange={(e) => { setDiscovery(e.target.checked); setSaved(false); }} /><span><b>允许更多探索</b><small>在可播放的真实候选中，给不常听的音乐一点空间。</small></span></label>
      <div className="button-row"><button className="primary-button" type="submit" disabled={!settings || busy}>保存偏好<Check size={17} /></button>{saved && <span className="inline-good" role="status"><Check size={16} />已保存</span>}</div>
    </form>
    <section className="settings-card"><div className="heading-icon"><Smartphone size={22} /><h2>随身电台</h2></div><p className="muted">{props.canInstall ? "将 Emily 添加到主屏幕，用独立窗口收听。" : "Android Chrome：菜单 ⋮ → 添加到主屏幕。需要 HTTPS 或本机 localhost。"}</p>{props.canInstall && <button className="secondary-button" onClick={() => void props.install()}>添加到主屏幕<ArrowUpRight size={17} /></button>}
      <div className="privacy-note"><ShieldCheck size={17} /><p>离线只保留应用外壳。登录口令、个人接口、歌单与音频不进入离线缓存；离线不代表还能收听。</p></div><p className="muted tiny">锁屏按钮使用浏览器 Media Session。小米系统的后台限制仍需真机验收，不承诺不间断后台播放。</p>
      {props.updateReady && <p className="inline-good">新版本已下载，下次重新打开时更新。请先暂停，再刷新页面。</p>}
    </section>
    <button className="logout-button" disabled={busy} onClick={props.logout}><LogOut size={18} />退出个人电台</button><p className="settings-footnote">EMILY / A PRIVATE FREQUENCY<br />No rooms. No audience. Just you and the music.</p>
  </section>;
}
