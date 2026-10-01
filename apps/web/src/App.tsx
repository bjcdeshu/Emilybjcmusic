import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, ChevronRight, CircleAlert, History as HistoryIcon, ListMusic, LockKeyhole, Pause, Play, Radio, RefreshCw, Settings2, ShieldCheck, SkipForward, WifiOff, X } from "lucide-react";
import type { AuthSession, FeedbackRequest, NowPlayingState, PlayerActionResponse, ProgrammeRequest, ProgrammeResponse, QueueItem, QueueResponse, RadioSettings, SetupStatus } from "@emily/shared";
import { api, errorMessage, post } from "./api";
import { Cover, MusicQrDialog, Spinner, StationIdentity } from "./components";
import { useMediaSession, usePwa, useRadioAudio } from "./hooks";
import { Player } from "./Player";
import { ListeningDialog, type ListeningTurn } from "./ListeningDialog";
import { useAudioAnalysis } from "./audio-analysis";
import { Library, RadioHistory, Settings } from "./views";

type View = "listen" | "library" | "history" | "settings";
type Notice = { text: string; kind: "info" | "error" | "success" };
const tabs = [{ id: "listen" as const, name: "收听", icon: Radio }, { id: "library" as const, name: "节目", icon: ListMusic }, { id: "history" as const, name: "历史", icon: HistoryIcon }, { id: "settings" as const, name: "设置", icon: Settings2 }];

export function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionError, setSessionError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionRetry, setSessionRetry] = useState(0);
  const [now, setNow] = useState<NowPlayingState | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [settings, setSettings] = useState<RadioSettings | null>(null);
  const [view, setView] = useState<View>("listen");
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Record<string, FeedbackRequest["kind"]>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [conversationTurns, setConversationTurns] = useState<ListeningTurn[]>([]);
  const [immersive, setImmersive] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const epoch = useRef(0);
  const actionId = useRef(0);
  const settingsWrites = useRef<Promise<unknown>>(Promise.resolve());
  const volumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef(session);
  const nowRef = useRef(now);
  sessionRef.current = session;
  nowRef.current = now;
  const { audioRef, playerRef, playback } = useRadioAudio({
    advance: async () => (await post<PlayerActionResponse>("/api/player/next")).now,
    onResolved: (value) => {
      setNow(value); setQueue(value.queue); setHistoryRefresh((v) => v + 1);
      if (!playerRef.current?.snapshot.wantsPlayback && value.status === "playing") {
        void post("/api/player/pause").catch(() => { /* Local pause stays authoritative. */ });
      }
    }
  });
  const analysis = useAudioAnalysis(audioRef);
  const pwa = usePwa();
  useEffect(() => {
    if (!session?.authenticated || !now?.roaming?.enabled) return;
    const controller = new AbortController();
    const timer = setInterval(() => {
      const id = actionId.current;
      void api<NowPlayingState>('/api/now',{signal:controller.signal}).then(value=>{
        const current = nowRef.current;
        if (controller.signal.aborted || id !== actionId.current || !current || value.track?.id !== current.track?.id || value.programmeTitle !== current.programmeTitle || value.updatedAt < current.updatedAt) return;
        setNow(previous=>previous&&value.roaming?{...previous,roaming:value.roaming}:previous);
        setQueue(value.queue);
      }).catch(()=>{});
    },10000);
    return()=>{clearInterval(timer);controller.abort();};
  },[session?.authenticated,now?.roaming?.enabled]);
  async function toggleRoaming() {
    if (actionBusy) return;
    const revision=epoch.current;
    const id=++actionId.current;
    try {const result=await post<PlayerActionResponse>('/api/player/roaming',{enabled:!now?.roaming?.enabled});if(revision===epoch.current && id===actionId.current){setNow(current=>current&&result.now.roaming?{...current,roaming:result.now.roaming}:current);}}
    catch(e){if(revision===epoch.current)setNotice({kind:'error',text:errorMessage(e)});}
  }

  function clearPrivateState() {
    epoch.current++; actionId.current++;
    if (volumeTimer.current) clearTimeout(volumeTimer.current);
    playerRef.current?.stop();
    setNow(null); setQueue([]); setSetup(null); setSettings(null); setFeedbacks({});
    setQrOpen(false); setConversationOpen(false); setConversationTurns([]); setNotice(null); setActionBusy(false); setSettingsBusy(false); setFeedbackBusy(false); setLoading(false);
    setView("listen"); setImmersive(false);
  }

  useEffect(() => {
    const expired = () => {
      clearPrivateState();
      setSession({ authenticated: false, configured: true });
      setSessionError("个人登录已过期，请重新登录。");
    };
    window.addEventListener("emily:session-expired", expired);
    return () => window.removeEventListener("emily:session-expired", expired);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setCheckingSession(true); setSessionError("");
    void api<AuthSession>("/api/session", { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) setSession(value); })
      .catch((e) => { if (!controller.signal.aborted) setSessionError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setCheckingSession(false); });
    return () => controller.abort();
  }, [sessionRetry]);

  async function refreshPrivate(signal?: AbortSignal) {
    const currentEpoch = epoch.current;
    setLoading(true);
    const results = await Promise.allSettled([
      api<SetupStatus>("/api/setup", { signal: signal ?? null }), api<RadioSettings>("/api/settings", { signal: signal ?? null }),
      api<NowPlayingState>("/api/now", { signal: signal ?? null }), api<QueueResponse>("/api/queue", { signal: signal ?? null })
    ] as const);
    if (signal?.aborted || currentEpoch !== epoch.current) return;
    const [setupResult, settingsResult, nowResult, queueResult] = results;
    if (setupResult.status === "fulfilled") setSetup(setupResult.value);
    if (settingsResult.status === "fulfilled") { setSettings(settingsResult.value); playerRef.current?.configure(settingsResult.value); }
    if (nowResult.status === "fulfilled" && !playerRef.current?.current) { setNow(nowResult.value); playerRef.current?.restore(nowResult.value); }
    if (queueResult.status === "fulfilled") setQueue(queueResult.value.items);
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failures.length) setNotice({ kind: "error", text: `部分电台数据未能载入：${errorMessage(failures[0]!.reason)}` });
    setLoading(false);
  }
  useEffect(() => {
    if (!session?.authenticated) return;
    const controller = new AbortController();
    void refreshPrivate(controller.signal);
    return () => controller.abort();
  }, [session?.authenticated]);
  useEffect(() => () => { if (volumeTimer.current) clearTimeout(volumeTimer.current); }, []);
  useEffect(() => {
    if (notice?.kind !== "success") return;
    const timer = setTimeout(() => setNotice(current => current === notice ? null : current), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function perform(resolve: () => Promise<NowPlayingState>) {
    const id = ++actionId.current;
    setActionBusy(true); setView("listen");
    window.scrollTo({ top: 0, behavior: "instant" });
    await playerRef.current?.perform(resolve, true);
    if (id === actionId.current) setActionBusy(false);
  }
  function transportPause() {
    playerRef.current?.pause();
    const currentEpoch = epoch.current;
    void post<PlayerActionResponse>("/api/player/pause").catch((e) => {
      if (currentEpoch === epoch.current) setNotice({ kind: "error", text: `本机已暂停，但服务端未同步：${errorMessage(e)}` });
    });
  }
  function transportPlay() {
    const player = playerRef.current;
    if (!player || !sessionRef.current?.authenticated) return;
    if (playback.status === "error" || !now?.track || playback.phase === "idle" || playback.status === "ended" || (settings?.djEnabled && !now.dj && playback.time === 0)) {
      void perform(async () => (await post<PlayerActionResponse>("/api/player/play", now?.track ? { trackId: now.track.id } : {})).now);
    } else {
      // Resume synchronously in the gesture; never replay a DJ intro on a pause/resume.
      void player.play();
      const currentEpoch = epoch.current;
      void post<PlayerActionResponse>("/api/player/play", {}).catch((e) => {
        if (currentEpoch === epoch.current) setNotice({ kind: "error", text: `播放状态未同步：${errorMessage(e)}` });
      });
    }
  }
  function next() { if (!actionBusy && sessionRef.current?.authenticated) void perform(async () => (await post<PlayerActionResponse>("/api/player/next")).now); }
  function previous() { if (!actionBusy && sessionRef.current?.authenticated) void perform(async () => (await post<PlayerActionResponse>("/api/player/previous")).now); }
  function playTrack(id: string) { if (!actionBusy) void perform(async () => (await post<PlayerActionResponse>("/api/player/play", { trackId: id })).now); }
  function createProgramme(request: ProgrammeRequest) {
    if (actionBusy) return;
    setNotice(null);
    // Selection source and programme warnings already live in the returned now
    // state and its listening disclosure; do not duplicate them above transport.
    void perform(async () => (await post<ProgrammeResponse>("/api/programme", request)).now);
  }
  useMediaSession(now, playback, { play: transportPlay, pause: transportPause, next, previous, seek: (time) => playerRef.current?.seek(time) });

  async function saveSettings(patch: Partial<RadioSettings>, showSaved = false): Promise<boolean> {
    const currentEpoch = epoch.current;
    setSettingsBusy(true);
    const work = settingsWrites.current.catch(() => {}).then(async () => {
      if (currentEpoch !== epoch.current) return false;
      try {
        const result = await api<RadioSettings>("/api/settings", { method: "PATCH", body: JSON.stringify(patch) });
        if (currentEpoch !== epoch.current) return false;
        setSettings({ ...result, volume: playerRef.current?.snapshot.volume ?? result.volume });
        // Do not let an earlier saved volume undo a later, real slider movement.
        playerRef.current?.setDjEnabled(result.djEnabled);
        if (showSaved) setNotice({ kind: "success", text: "偏好已保存。" });
        return true;
      } catch (e) {
        if (currentEpoch === epoch.current) setNotice({ kind: "error", text: `偏好未保存：${errorMessage(e)}` });
        return false;
      }
    });
    settingsWrites.current = work;
    const saved = await work;
    if (currentEpoch === epoch.current && settingsWrites.current === work) setSettingsBusy(false);
    return saved;
  }
  function setVolume(volume: number) {
    playerRef.current?.setVolume(volume);
    if (volumeTimer.current) clearTimeout(volumeTimer.current);
    const currentEpoch = epoch.current;
    volumeTimer.current = setTimeout(() => { if (currentEpoch === epoch.current) void saveSettings({ volume }); }, 500);
  }
  async function sendFeedback(kind: FeedbackRequest["kind"]) {
    const trackId = now?.track?.id;
    if (!trackId) return;
    const currentEpoch = epoch.current;
    setFeedbackBusy(true);
    try {
      const response = await post<{ saved: true }>("/api/feedback", { trackId, kind });
      if (currentEpoch !== epoch.current) return;
      if (response.saved) { setFeedbacks((old) => ({ ...old, [trackId]: kind })); setNotice({ kind: "success", text: kind === "like" ? "已记下：你喜欢这首歌。" : "已记下：少来一点类似音乐。跳过歌曲不会自动点踩。" }); }
    } catch (e) { if (currentEpoch === epoch.current) setNotice({ kind: "error", text: errorMessage(e) }); }
    finally { if (currentEpoch === epoch.current) setFeedbackBusy(false); }
  }
  async function disconnect() {
    const currentEpoch = epoch.current;
    setSettingsBusy(true);
    playerRef.current?.stop(); setNow(null); setQueue([]); setConversationOpen(false); setConversationTurns([]);
    try {
      const response = await post<SetupStatus>("/api/music/disconnect");
      if (currentEpoch === epoch.current) { setSetup(response); setNotice({ kind: "info", text: "已断开你的音乐账号。" }); }
    } catch (e) { if (currentEpoch === epoch.current) setNotice({ kind: "error", text: errorMessage(e) }); }
    finally { if (currentEpoch === epoch.current) setSettingsBusy(false); }
  }
  async function logout() {
    playerRef.current?.pause();
    setSettingsBusy(true);
    try {
      const result = await post<AuthSession>("/api/logout");
      if (result.authenticated) throw new Error("服务端尚未确认退出，请重试。");
      clearPrivateState(); setSession(result); setNotice(null);
    } catch (e) { setNotice({ kind: "error", text: errorMessage(e) }); }
    finally { setSettingsBusy(false); }
  }
  function toggleImmersive() {
    setImmersive(current => !current);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  useEffect(() => {
    if (!immersive || conversationOpen || qrOpen) return;
    const exit = (event: KeyboardEvent) => { if (event.key === "Escape" && !document.querySelector('dialog[open]')) setImmersive(false); };
    window.addEventListener("keydown", exit);
    return () => window.removeEventListener("keydown", exit);
  }, [immersive, conversationOpen, qrOpen]);
  function openQr() { if (setup?.music.configured) setQrOpen(true); else setNotice({ kind: "error", text: "音乐服务还未配置。需要服务端连接授权的网易云适配器。" }); }
  function navigate(nextView: View) { setView(nextView); setImmersive(false); window.scrollTo({ top: 0, behavior: "instant" }); }

  return <>
    <audio ref={audioRef} preload="metadata" className="audio-element" aria-hidden="true" />
    {!session?.authenticated ? <Login session={session} checking={checkingSession} error={sessionError} retry={() => setSessionRetry((v) => v + 1)} loggedIn={(value) => { setSessionError(""); setSession(value); }} online={pwa.online} /> : <div data-view={view} className={`app-shell ${immersive && view === "listen" ? "immersive" : ""}`}>
      <a className="skip-link" href="#main-content">跳到内容</a>
      <header className="app-header"><button className="wordmark" aria-label="Emily 首页" onClick={() => navigate("listen")}><StationIdentity /></button><nav className="desktop-nav" aria-label="电台导航">{tabs.map(({ id, name }) => <button key={id} aria-current={view === id ? "page" : undefined} onClick={() => navigate(id)}>{name}</button>)}</nav><button className="account-pill" aria-label="个人电台设置" onClick={() => navigate("settings")}><LockKeyhole size={13} /><span>PRIVATE</span><Settings2 size={15} /></button></header>
      {!pwa.online && <div className="offline-banner" role="status"><WifiOff size={17} />当前离线。外壳可打开，音乐和个人数据仍需要网络。</div>}
      {notice && <div className={`notice notice-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.kind === "success" ? <Check size={18} /> : <CircleAlert size={18} />}<p>{notice.text}</p><button className="icon-button" aria-label="关闭提示" onClick={() => setNotice(null)}><X size={17} /></button></div>}
      <main id="main-content" key={view} className={view === "listen" ? "listen-layout" : "single-view"}>
        {view === "listen" ? <>
          <div className="listen-column"><Player analysis={analysis} now={now} queue={queue} playback={playback} settings={settings} setup={setup} loading={loading} busy={actionBusy} feedbackBusy={feedbackBusy} feedbackKind={now?.track ? feedbacks[now.track.id] : undefined} immersive={immersive} toggleImmersive={toggleImmersive} play={transportPlay} pause={transportPause} next={next} previous={previous} seek={(time) => playerRef.current?.seek(time)} volume={setVolume} quiet={() => { if (settings && !settingsBusy) void saveSettings({ djEnabled: !settings.djEnabled }); }} library={() => navigate("library")} conversation={() => setConversationOpen(true)} roaming={() => void toggleRoaming()} feedback={(kind) => void sendFeedback(kind)} selectTrack={playTrack} retry={() => { if (now?.track) playTrack(now.track.id); }} />
            {!loading && !setup?.music.connected && <div className="setup-callout"><div><b>{setup?.music.configured ? "你的音乐，还差一次连接。" : "先把真实音乐接进来。"}</b><p>{setup?.music.configured ? "用自己的网易云账号扫码，然后选择一档节目。" : "音乐适配器未就绪；这里不会播放示例歌曲。"}</p></div><button className="icon-button" aria-label={setup?.music.configured ? "连接网易云" : "查看服务设置"} onClick={setup?.music.configured ? openQr : () => navigate("settings")}><ChevronRight size={22} /></button></div>}
            {notice?.kind === "error" && <button className="retry-data text-button" disabled={loading} onClick={() => void refreshPrivate()}><RefreshCw size={16} />重新读取电台数据</button>}
          </div>
        </> : view === "library" ? <Library setup={setup} busy={actionBusy} createProgramme={createProgramme} playTrack={playTrack} openQr={openQr} conversation={() => setConversationOpen(true)} /> : view === "history" ? <RadioHistory createProgramme={createProgramme} busy={actionBusy} refreshKey={historyRefresh} /> : <Settings settings={settings} setup={setup} busy={settingsBusy} save={saveSettings} disconnect={disconnect} logout={() => void logout()} openQr={openQr} refresh={() => void refreshPrivate()} volume={playback.volume} setVolume={setVolume} canInstall={pwa.canInstall} install={pwa.install} updateReady={pwa.updateReady} />}
      </main>
      <footer className="page-footer"><span>YOUR MUSIC. A LITTLE COMPANY.</span></footer>
      {view !== "listen" && now?.track && <aside className="mini-player" data-playing={playback.status === "playing"} aria-label="正在收听"><button className="mini-track" onClick={() => navigate("listen")}><Cover title={now.track.title} url={now.track.coverUrl} /><span><b>{now.track.title}</b><small>{playback.phase === "dj" ? "Emily" : now.track.artist}</small></span></button><button className="icon-button" aria-label={playback.wantsPlayback ? "暂停" : "播放"} onClick={playback.wantsPlayback ? transportPause : transportPlay}>{playback.wantsPlayback ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}</button><button className="icon-button" aria-label="下一首（不作为不喜欢反馈）" disabled={actionBusy} onClick={next}><SkipForward size={20} /></button></aside>}
      <nav className="mobile-nav" aria-label="电台导航">{tabs.map(({ id, name, icon: Icon }) => <button key={id} aria-current={view === id ? "page" : undefined} onClick={() => navigate(id)}><Icon size={20} strokeWidth={view === id ? 2.3 : 1.6} /><span>{name}</span>{id === "listen" && playback.status === "playing" && <i />}</button>)}</nav>
      {conversationOpen && <ListeningDialog close={() => setConversationOpen(false)} setup={setup} busy={actionBusy} turns={conversationTurns} setTurns={setConversationTurns} createProgramme={createProgramme} />}
      {qrOpen && <MusicQrDialog close={() => setQrOpen(false)} connected={() => { void refreshPrivate(); }} />}
    </div>}
  </>;
}

function Login({ session, checking, error, retry, loggedIn, online }: { session: AuthSession | null; checking: boolean; error: string; retry: () => void; loggedIn: (value: AuthSession) => void; online: boolean }) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");
  async function login(e: FormEvent) {
    e.preventDefault(); setSubmitting(true); setLoginError("");
    try {
      const value = await post<AuthSession>("/api/login", { password });
      if (!value.authenticated) throw new Error("尚未完成个人登录。");
      setPassword(""); loggedIn(value);
    } catch (e) { setLoginError(errorMessage(e)); setPassword(""); }
    finally { setSubmitting(false); }
  }
  return <main className="login-shell"><section className="login-device"><div className="login-host"><StationIdentity label="你的私人电台" /><h1>留一点时间，<br />给自己的音乐。</h1><p>你的歌单，Emily 的陪伴。</p></div><div className="login-paper"><div className="login-title"><h2>欢迎回来</h2><p>用个人口令进入电台。</p></div>{!online && <p className="inline-error"><WifiOff size={16} />当前离线，需要网络才能登录。</p>}{checking ? <div className="session-check"><Spinner label="正在检查个人登录状态" /></div> : !session ? <div className="session-check"><p className="inline-error" role="alert">{error || "尚未连接服务。"}</p><button className="secondary-button" onClick={retry}><RefreshCw size={16} />重新连接</button></div> : !session.configured ? <div className="owner-unconfigured"><ShieldCheck size={26} /><h3>个人登录还没配置。</h3><p>请在 Emily 服务端配置专用的个人口令。此页面不会开放注册，也不会使用其他服务的凭据。</p><button className="text-button" onClick={retry}>重新检查<RefreshCw size={16} /></button></div> : <form onSubmit={(e) => void login(e)} className="login-form"><label htmlFor="owner-password" className="field-label">个人登录口令</label><div className="password-field"><LockKeyhole size={18} /><input id="owner-password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="输入个人口令" disabled={submitting} /></div>{(loginError || error) && <p className="inline-error" role="alert">{loginError || error}</p>}<button className="primary-button" disabled={submitting || !password || !online} type="submit">{submitting ? <Spinner label="正在登录" /> : <>进入电台<ArrowRight size={19} /></>}</button></form>}<p className="login-privacy"><ShieldCheck size={14} />口令不会保存在浏览器离线缓存中。</p></div></section><p className="login-footer">YOUR MUSIC. A LITTLE COMPANY.</p></main>;
}
