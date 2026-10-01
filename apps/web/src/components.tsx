import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, Check, CheckCircle2, LoaderCircle, QrCode, RefreshCw, X } from "lucide-react";
import type { MusicQrPollResponse, MusicQrSession, SetupStatus } from "@emily/shared";
import { api, errorMessage, post, safeUrl } from "./api";
import { HostWordmark } from "./HostWordmark";

export function StationIdentity({ label = "Personal radio" }: { label?: string }) {
  return <div className="station-identity"><span className="sr-only">Emily</span><HostWordmark /><span className="station-label">{label}</span></div>;
}

export function PageHeading({ id, section, title, children }: { id: string; section: string; title: string; children: ReactNode }) {
  return <header className="view-heading"><StationIdentity label={section} /><h1 id={id}>{title}</h1><p>{children}</p></header>;
}

export function Spinner({ label = "正在载入" }: { label?: string }) {
  return <span className="spinner-label"><LoaderCircle size={17} className="spin" aria-hidden="true" />{label}</span>;
}

export function Empty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><h3>{title}</h3><p>{children}</p>{action}</div>;
}

export function Cover({ url, title, className = "" }: { url?: string | undefined; title: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const source = safeUrl(url);
  return <span className={`cover ${className}`} aria-hidden="true">{source && !failed ? <img src={source} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <span>{title.charAt(0) || "e"}</span>}</span>;
}

export function Modal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog className="modal" ref={ref} aria-labelledby="modal-title" onCancel={(e) => { e.preventDefault(); close(); }} onClick={(e) => { if (e.target === ref.current) close(); }}>
    <div className="modal-inner"><header className="section-heading"><div><StationIdentity label="音乐账号" /><h2 id="modal-title">{title}</h2></div><button className="icon-button" aria-label="关闭" onClick={close}><X size={22} /></button></header>{children}</div>
  </dialog>;
}

export function SetupIndicators({ setup, openQr, showSettings }: { setup: SetupStatus | null; openQr: () => void; showSettings: () => void }) {
  const music = !setup ? "等待连接" : setup.music.connected ? setup.music.user?.name || "已连接" : setup.music.configured ? "待扫码连接" : "服务未配置";
  return <div className="provider-strip" aria-label="服务状态">
    <button onClick={setup?.music.connected ? showSettings : openQr} disabled={!setup?.music.configured}><span className={`status-dot ${setup?.music.connected ? "good" : ""}`} /><span><b>网易云</b><small>{music}</small></span></button>
    <button onClick={showSettings}><span className={`status-dot ${setup?.model.configured ? "good" : ""}`} /><span><b>节目编排</b><small>{setup ? setup.model.configured ? "模型已配置" : "歌单模式" : "等待连接"}</small></span></button>
    <button onClick={showSettings}><span className={`status-dot ${setup?.tts.available ? "good" : ""}`} /><span><b>Emily · 主持</b><small>{setup ? setup.tts.available ? "语音可用" : "语音未就绪" : "等待连接"}</small></span></button>
  </div>;
}

export function MusicQrDialog({ close, connected }: { close: () => void; connected: () => void }) {
  const [qr, setQr] = useState<MusicQrSession | null>(null);
  const [poll, setPoll] = useState<MusicQrPollResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const connectedRef = useRef(connected);
  connectedRef.current = connected;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setQr(null); setPoll(null); setImageFailed(false);
    void post<MusicQrSession>("/api/music/login/qr", undefined, controller.signal)
      .then((session) => { if (!controller.signal.aborted) setQr(session); })
      .catch((e) => { if (!controller.signal.aborted) setError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    if (!qr) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const expires = Date.parse(qr.expiresAt);
    async function check() {
      if (controller.signal.aborted) return;
      if (!Number.isFinite(expires) || Date.now() >= expires) { setPoll({ status: "expired" }); return; }
      try {
        const result = await api<MusicQrPollResponse>(`/api/music/login/qr/${encodeURIComponent(qr!.key)}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setPoll(result); setError(""); failures = 0;
        if (result.status === "connected") { connectedRef.current(); return; }
        if (result.status === "expired") return;
      } catch (e) {
        if (controller.signal.aborted) return;
        failures++;
        setError(`${errorMessage(e)} 扫码状态尚未确认。`);
        if (failures >= 3) return;
      }
      timer = setTimeout(() => void check(), failures ? 5000 : 2500);
    }
    void check();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [qr]);
  const image = safeUrl(qr?.qrImageUrl, true);
  const link = safeUrl(qr?.qrUrl);
  const done = poll?.status === "connected";
  return <Modal title="连接你的网易云" close={close}>
    <p className="muted">仅用于你的个人账号，播放权限遵循你自己的会员与曲目授权。不使用共享会员或解锁音源。</p>
    <div className="qr-frame">
      {loading ? <Spinner label="正在向音乐服务申请二维码" /> : done ? <div className="qr-success"><CheckCircle2 size={50} /><h3>你好，{poll.user?.name || "已连接"}</h3><p>现在可以从你的歌单开始了。</p></div> : poll?.status === "expired" ? <div className="qr-success"><QrCode size={48} /><h3>二维码已过期</h3><p>重新获取一个即可。</p></div> : image && !imageFailed ? <img src={image} alt="用网易云音乐 App 扫描此登录二维码" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} /> : <div className="qr-success"><QrCode size={48} /><p>{qr ? "二维码图片不可用，请重新获取。" : "二维码尚未准备好"}</p></div>}
    </div>
    {poll?.status === "scanned" && <p className="inline-good"><Check size={17} />已扫描，请在网易云 App 内确认。</p>}
    {poll?.message && <p className="muted" role="status">{poll.message}</p>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    {!done && <div className="qr-help"><b>在同一部手机上？</b><p>长按保存二维码，打开网易云音乐的扫一扫，从相册选择；扫码后回到 Emily 等待确认。二维码仅在本次窗口有效。</p></div>}
    <div className="button-row">{done ? <button className="primary-button" onClick={close}>开始选节目<ArrowUpRight size={18} /></button> : <>
      <button className="primary-button" disabled={loading} onClick={() => setAttempt((v) => v + 1)}><RefreshCw size={17} />重新获取</button>
      {link && <a className="secondary-button" href={link} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">打开授权页面<ArrowUpRight size={17} /></a>}
    </>}</div>
  </Modal>;
}
