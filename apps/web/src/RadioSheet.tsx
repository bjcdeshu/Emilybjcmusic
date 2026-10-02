import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Native modal semantics keep focus inside the sheet; audio is never remounted.
 * A visible close control, Escape and backdrop click all close without transport. */
export function RadioSheet({ title, close, children, transport, initialCurrent = false }: { title: string; close: () => void; children: ReactNode; transport: ReactNode; initialCurrent?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    dialog.querySelector('.radio-sheet-content')?.dispatchEvent(new Event('sheet-open'));
    if(initialCurrent){
      const pane=dialog.querySelector<HTMLElement>('.radio-sheet-content'), current=dialog.querySelector<HTMLElement>('.queue-row[aria-current=true]');
      if(pane&&current)pane.scrollTop=current.getBoundingClientRect().top-pane.getBoundingClientRect().top-64;
    }
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} className="radio-sheet" aria-labelledby="radio-sheet-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(); } }}>
    <div className="radio-sheet-inner">
      <header className="radio-sheet-header"><h2 id="radio-sheet-title">{title}</h2><button autoFocus className="icon-button" aria-label="关闭播放面板" onClick={close}><X size={20} /></button></header>
      <div className="radio-sheet-content">{children}</div>
      <footer className="sheet-transport" aria-label="面板播放控制">{transport}</footer>
    </div>
  </dialog>;
}
