import { useEffect, useRef, useState } from 'react';
import { createBackup, lastBackupAt, restoreBackup } from '../../state/backup';
import { errMsg } from '../labels';

interface Props {
  onRestored: () => void;
  onError: (message: string) => void;
}

const fmt = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Export / import backup (spec §7). Labels match the README. */
export default function BackupPanel({ onRestored, onError }: Props) {
  const [last, setLast] = useState<number | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const refresh = () => lastBackupAt().then(setLast, (e) => onError(errMsg(e)));
  useEffect(() => {
    let alive = true;
    lastBackupAt().then((t) => { if (alive) setLast(t); }, (e) => onError(errMsg(e)));
    return () => { alive = false; };
  }, [onError]);

  const doExport = async () => {
    setBusy(true);
    try {
      const { filename, json } = await createBackup();
      const file = new File([json], filename, { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
        } catch (e) {
          // Cancelling the share sheet is fine; anything else falls back to a download.
          if (!(e instanceof DOMException && e.name === 'AbortError')) download(file);
        }
      } else {
        download(file);
      }
      await refresh();
    } catch (e) {
      onError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!file) return;
    setImportError(null);
    setRestored(false);
    if (!window.confirm('This replaces all your data. Continue?')) return;
    setBusy(true);
    try {
      const res = await restoreBackup(await file.text());
      if (res.ok) {
        setRestored(true);
        await refresh();
        onRestored();
      } else {
        setImportError(res.error);
      }
    } catch (e) {
      setImportError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="backup-h">
      <h2 className="panel-title" id="backup-h">Backup</h2>
      {last !== undefined && <p className="hint">{last === null ? 'Never backed up' : `Last backup: ${fmt(last)}`}</p>}
      <button type="button" className="btn btn-primary btn-wide" disabled={busy} onClick={() => void doExport()}>
        Export backup
      </button>
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => input.current?.click()}>
        Import backup
      </button>
      <input ref={input} type="file" accept="application/json,.json" hidden data-testid="import-file"
        onChange={(e) => void doImport(e.target.files?.[0])} />
      {importError && <p className="error" role="alert">{importError}</p>}
      {restored && <p className="ok" role="status">Backup restored.</p>}
    </section>
  );
}
