import { useEffect } from 'react';

export interface ToastMsg { id: number; message: string }

interface Props {
  toast: ToastMsg | null;
  onDone: () => void;
}

/** Visible error message (spec §8); auto-hides after 5 s, tap to dismiss. */
export default function Toast({ toast, onDone }: Props) {
  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(onDone, 5000);
    return () => window.clearTimeout(id);
  }, [toast, onDone]);
  if (!toast) return null;
  return <div className="toast" role="alert" onClick={onDone}>{toast.message}</div>;
}
