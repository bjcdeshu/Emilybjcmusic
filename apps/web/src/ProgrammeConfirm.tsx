import { useModalDialog } from './useModalDialog';
/** Explicit replacement boundary; dismissing never touches playback. */
export function ProgrammeConfirm({ confirm, close }: { confirm: () => void; close: () => void }) {
  const { ref, dismiss } = useModalDialog(close);
  return <dialog className="modal programme-confirm" ref={ref} aria-labelledby="replace-title" onCancel={e=>{e.preventDefault();dismiss();}}>
    <div className="modal-inner"><h2 id="replace-title">更换当前节目？</h2><p>这会结束当前播放，替换待播列表与原歌单漫游范围。只想追加一首，请取消并选择“加入待播”。</p>
    <div className="confirm-actions"><button autoFocus className="secondary-button" onClick={dismiss}>保留当前节目</button><button className="primary-button" onClick={confirm}>确认更换节目</button></div></div>
  </dialog>;
}
