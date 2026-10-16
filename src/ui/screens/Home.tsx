import { useEffect, useState } from 'react';
import { getHomeInfo, type HomeInfo } from '../../state/home';
import { startNextSession } from '../../state/session';
import WorkoutRow from '../components/WorkoutRow';

interface Props {
  onOpenWorkout: () => void;
  onOpenCheckIn: () => void;
  onOpenDetail: (id: number) => void;
  onOpenHistory: () => void;
  onError: (message: string) => void;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function Home({ onOpenWorkout, onOpenCheckIn, onOpenDetail, onOpenHistory, onError }: Props) {
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
  // A due check-in blocks new workouts (else every later session is a deload); resuming is still fine.
  const checkInFirst = info.checkInDue && !resuming;

  return (
    <main className="screen home">
      <h1 className="app-title">Lift Log</h1>
      {info.kneeWarning && <div className="banner banner-warn" role="status">Knee pain rising — see a physio.</div>}
      {info.backupOverdue && (
        <div className="banner" role="status">Back up your data — Settings → Export backup</div>
      )}
      <section className="hero">
        <h2 className="hero-slot">{resuming ? 'In progress' : 'Next'}: {info.slotName}</h2>
        <p className="hero-block">Block {info.blockNumber} · Round {info.week} · {info.targetRir}</p>
        {checkInFirst ? (
          <>
            <p className="hint">Block finished. Do the check-in to set up your next block.</p>
            <button type="button" className="btn btn-primary btn-big" onClick={onOpenCheckIn}>
              Do block check-in
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-big" disabled={busy} onClick={() => void start()}>
            {resuming ? 'Resume' : 'Start'}
          </button>
        )}
      </section>
      <section className="last" aria-labelledby="recent-h">
        <h3 className="section-label" id="recent-h">Recent workouts</h3>
        {info.recent.length === 0 ? <p className="hint">No workouts yet.</p> : (
          <>
            <ul className="wlist">
              {info.recent.map((w) => <WorkoutRow key={w.id} w={w} onOpen={onOpenDetail} />)}
            </ul>
            <button type="button" className="btn-link" onClick={onOpenHistory}>See all workouts</button>
          </>
        )}
      </section>
    </main>
  );
}
