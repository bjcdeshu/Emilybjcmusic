import { type ReactNode } from "react";
import { useModalDialog } from "./useModalDialog";
import { X } from "lucide-react";

/** Native modal semantics keep focus inside the sheet; audio is never remounted.
 * A visible close control, Escape and backdrop click all close without transport. */
export function RadioSheet({ title, close, children, transport, initialCurrent = false }: { title: string; close: () => void; children: ReactNode | ((dismiss: () => void) => ReactNode); transport: ReactNode; initialCurrent?: boolean }) {
  const { ref, dismiss } = useModalDialog(close, dialog => {
    dialog.querySelector('.radio-sheet-content')?.dispatchEvent(new Event('sheet-open'));
    if(initialCurrent){
      const pane=dialog.querySelector<HTMLElement>('.radio-sheet-content'), current=dialog.querySelector<HTMLElement>('.queue-row[aria-current=true]');
      if(pane&&current)pane.scrollTop=current.getBoundingClientRect().top-pane.getBoundingClientRect().top-64;
    }
  });
  return <dialog ref={ref} className="radio-sheet" aria-labelledby="radio-sheet-title" onCancel={event => { event.preventDefault(); dismiss(); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dismiss(); } }}>
    <div className="radio-sheet-inner">
      <header className="radio-sheet-header"><h2 id="radio-sheet-title">{title}</h2><button autoFocus className="icon-button" aria-label="关闭播放面板" onClick={dismiss}><X size={20} /></button></header>
      <div className="radio-sheet-content">{typeof children === "function" ? children(dismiss) : children}</div>
      <footer className="sheet-transport" aria-label="面板播放控制">{transport}</footer>
    </div>
  </dialog>;
}
