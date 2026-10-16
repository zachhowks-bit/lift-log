import { useEffect, useState } from 'react';
import { listWorkouts, type WorkoutSummary } from '../../state/history';
import { errMsg } from '../labels';
import WorkoutRow from '../components/WorkoutRow';

interface Props {
  onOpen: (id: number) => void;
  onError: (message: string) => void;
}

const monthName = (t: number) => new Date(t).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

/** Every finished workout, newest first, grouped by month. */
export default function History({ onOpen, onError }: Props) {
  const [list, setList] = useState<WorkoutSummary[] | null>(null);

  useEffect(() => {
    let alive = true;
    listWorkouts().then((l) => { if (alive) setList(l); }, (e) => onError(errMsg(e)));
    return () => { alive = false; };
  }, [onError]);

  if (!list) return <main className="screen"><p className="hint">Loading…</p></main>;

  const groups: { month: string; items: WorkoutSummary[] }[] = [];
  for (const w of list) {
    const m = monthName(w.date);
    const g = groups[groups.length - 1];
    if (g && g.month === m) g.items.push(w);
    else groups.push({ month: m, items: [w] });
  }

  return (
    <main className="screen history">
      <h1 className="app-title">History</h1>
      {list.length === 0 && <p className="hint">Finished workouts show up here. Tap one to see or fix its sets.</p>}
      {groups.map((g) => (
        <section key={g.month} aria-label={g.month} className="hgroup">
          <h2 className="hgroup-title">{g.month}</h2>
          <ul className="wlist">
            {g.items.map((w) => <WorkoutRow key={w.id} w={w} onOpen={onOpen} />)}
          </ul>
        </section>
      ))}
    </main>
  );
}
