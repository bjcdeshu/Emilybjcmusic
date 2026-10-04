import { useCallback, useEffect, useRef } from 'react';

/** Keep the native top layer (focus trap, inert background) through the exit.
 * No delayed audio actions; only dismissal waits. Navigation/unmount cancels it. */
export function useModalDialog(close: () => void, opened?: (dialog: HTMLDialogElement) => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const callbacks = useRef({ close, opened }); callbacks.current = { close, opened };
  const pending = useRef(false), mounted = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const finish = useCallback(() => {
    clearTimeout(timeout.current);
    if (mounted.current && pending.current) { pending.current = false; callbacks.current.close(); }
  }, []);
  const dismiss = useCallback(() => {
    const dialog = ref.current;
    if (!dialog?.open || pending.current) return;
    pending.current = true;
    if (document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    dialog.dataset.closing = 'true';
    // Fallback for interrupted/unsupported CSS animation; never leaves a trapped modal.
    timeout.current = setTimeout(finish, 240);
  }, [finish]);
  useEffect(() => {
    const dialog = ref.current!, previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    mounted.current = true; pending.current = false; delete dialog.dataset.closing;
    document.body.style.overflow = 'hidden'; dialog.showModal(); callbacks.current.opened?.(dialog);
    const ended = (event: AnimationEvent) => { if (event.target === dialog && /^(sheet|modal)-out$/.test(event.animationName)) finish(); };
    const instant = () => { if (pending.current && (document.hidden || reduced.matches)) finish(); };
    dialog.addEventListener('animationend', ended); document.addEventListener('visibilitychange', instant); reduced.addEventListener('change', instant);
    return () => {
      mounted.current = false; pending.current = false; clearTimeout(timeout.current);
      dialog.removeEventListener('animationend', ended); document.removeEventListener('visibilitychange', instant); reduced.removeEventListener('change', instant);
      dialog.close(); document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [finish]);
  return { ref, dismiss };
}
