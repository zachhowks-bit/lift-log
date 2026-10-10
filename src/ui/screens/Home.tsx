import { useEffect, useState } from 'react';
import { getHomeInfo, type HomeInfo } from '../../state/home';
import { startNextSession } from '../../state/session';

interface Props {
  onOpenWorkout: () => void;
  onOpenCheckIn: () => void;
  onError: (message: string) => void;
}

const fmtDate = (t: number) =>
  new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function Home({ onOpenWorkout, onOpenCheckIn, onError }: Props) {
  const [info, setInfo] = useState<HomeInfo | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getHomeInfo(Date.now()).then((i) => { if (alive) setInfo(i); }, (e) => onError(msg(e)));
    return () => { alive = false; };
  }, [onError]);

  const start = async () => {
    if (!info) return;
    if (info.activeSessionId !== null) { onOpenWorkout(); return; }
    setBusy(true);
    try {
      await startNextSession(Date.now());
      onOpenWorkout();
    } catch (e) {
      onError(msg(e));
      setBusy(false);
    }
  };

  if (!info) return <main className="screen"><p className="hint">Loading…</p></main>;
  const resuming = info.activeSessionId !== null;

  return (
    <main className="screen home">
      <h1 className="app-title">Lift Log</h1>
      {info.kneeWarning && <div className="banner banner-warn" role="status">Knee pain rising — see a physio.</div>}
      {info.backupOverdue && (
        <div className="banner" role="status">Back up your data — Settings → Export backup</div>
      )}
      <section className="hero">
        <h2 className="hero-slot">{resuming ? 'In progress' : 'Next'}: {info.slotName}</h2>
        <p className="hero-block">Block {info.blockNumber} · Week {info.week} · {info.targetRir}</p>
        <button type="button" className="btn btn-primary btn-big" disabled={busy} onClick={() => void start()}>
          {resuming ? 'Resume' : 'Start'}
        </button>
      </section>
      {info.checkInDue && (
        <button type="button" className="btn btn-accent-outline" onClick={onOpenCheckIn}>Block check-in due</button>
      )}
      <section className="last">
        <h3 className="section-label">Last session</h3>
        {info.lastSession ? (
          <p className="last-line">
            <span>{fmtDate(info.lastSession.date)} · {info.lastSession.slotName}</span>
            <span className="last-stats">{plural(info.lastSession.sets, 'set')} · {plural(info.lastSession.exercises, 'exercise')}</span>
          </p>
        ) : <p className="hint">No workouts yet.</p>}
      </section>
    </main>
  );
}
