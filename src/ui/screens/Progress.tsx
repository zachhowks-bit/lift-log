import { useEffect, useState } from 'react';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  currentWeekSets, exerciseHistory, kneeTrend, loggedExercises,
} from '../../state/progress';
import { errMsg, MUSCLE_LABELS, shortDate } from '../labels';
import type { Muscle } from '../../types';

interface Props {
  onError: (message: string) => void;
}

type HistoryRow = { date: number; topWeight: number; e1rm: number };

// Chart colours: categorical slots 1–2 (dark steps), validated against --surface #1c1c1e.
const C = {
  s1: '#3987e5',
  s2: '#d95926',
  grid: '#2f2f33',
  axis: '#a8a8ad',
  surface: '#1c1c1e',
};
const AXIS = { stroke: C.grid, tick: { fill: C.axis, fontSize: 13 }, tickLine: false } as const;
const CURSOR = { stroke: C.axis, strokeWidth: 1 };

interface Series { key: string; name: string; color: string; fmt: (v: number) => string }

/** Tooltip: date, then one row per series — value first, line key, then the name. */
function tipContent(series: Series[]) {
  return function Tip({ active, payload, label }: { active?: boolean; payload?: readonly { payload?: unknown }[]; label?: unknown }) {
    const row = payload?.[0]?.payload as Record<string, number> | undefined;
    if (!active || !row) return null;
    return (
      <div className="chart-tip">
        <div className="chart-tip-date">{shortDate(Number(label))}</div>
        {series.map((x) => (
          <div key={x.key} className="chart-tip-row">
            <i className="key" style={{ background: x.color }} />
            <strong>{x.fmt(row[x.key])}</strong>
            <span>{x.name}</span>
          </div>
        ))}
      </div>
    );
  };
}

const lineProps = (color: string) => ({
  type: 'monotone' as const,
  stroke: color,
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  dot: { r: 4, fill: color, stroke: C.surface, strokeWidth: 2 },
  activeDot: { r: 6, fill: color, stroke: C.surface, strokeWidth: 2 },
  isAnimationActive: false,
});
const kg = (n: number) => `${n} kg`;
const EX_SERIES: Series[] = [
  { key: 'e1rm', name: 'Estimated 1RM', color: C.s2, fmt: kg },
  { key: 'topWeight', name: 'Top set', color: C.s1, fmt: kg },
];
const KNEE_SERIES: Series[] = [{ key: 'max', name: 'Worst knee pain', color: C.s1, fmt: (v) => `${v} / 10` }];
const ExTip = tipContent(EX_SERIES);
const KneeTip = tipContent(KNEE_SERIES);

function ExerciseChart({ data }: { data: HistoryRow[] }) {
  return (
    <>
      <div className="legend" aria-hidden="true">
        <span><i className="key" style={{ background: C.s1 }} />Top set</span>
        <span><i className="key" style={{ background: C.s2 }} />Estimated 1RM</span>
      </div>
      <div className="chart">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="date" tickFormatter={shortDate} {...AXIS} minTickGap={24} />
            <YAxis {...AXIS} axisLine={false} width={44} domain={['auto', 'auto']} allowDecimals={false} />
            <Tooltip cursor={CURSOR} content={ExTip} />
            <Line dataKey="topWeight" name="Top set" {...lineProps(C.s1)} />
            <Line dataKey="e1rm" name="Estimated 1RM" {...lineProps(C.s2)} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="table-view">
        <summary>Show as table</summary>
        <table>
          <thead><tr><th>Date</th><th>Top set</th><th>Est. 1RM</th></tr></thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i}><td>{shortDate(r.date)}</td><td>{kg(r.topWeight)}</td><td>{kg(r.e1rm)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}

function KneeChart({ data }: { data: { date: number; max: number }[] }) {
  return (
    <>
      <div className="chart">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="date" tickFormatter={shortDate} {...AXIS} minTickGap={24} />
            <YAxis {...AXIS} axisLine={false} width={44} domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
            <Tooltip cursor={CURSOR} content={KneeTip} />
            <Line dataKey="max" name="Worst knee pain" {...lineProps(C.s1)} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="table-view">
        <summary>Show as table</summary>
        <table>
          <thead><tr><th>Date</th><th>Worst knee pain</th></tr></thead>
          <tbody>
            {data.map((r, i) => <tr key={i}><td>{shortDate(r.date)}</td><td>{r.max} / 10</td></tr>)}
          </tbody>
        </table>
      </details>
    </>
  );
}

function WeeklySets({ rows }: { rows: { muscle: Muscle; done: number; target: number }[] }) {
  return (
    <ul className="meters">
      {rows.map((r) => {
        const pct = r.target > 0 ? Math.min(1, r.done / r.target) : r.done > 0 ? 1 : 0;
        return (
          <li key={r.muscle} className="meter-row">
            <span className="meter-name">{MUSCLE_LABELS[r.muscle]}</span>
            <span className="meter-value">{r.done} / {r.target}</span>
            <span className="meter" role="meter" aria-label={`${MUSCLE_LABELS[r.muscle]} sets`}
              aria-valuemin={0} aria-valuemax={r.target} aria-valuenow={Math.min(r.done, r.target)}>
              <span className={pct >= 1 ? 'meter-fill meter-full' : 'meter-fill'} style={{ width: `${pct * 100}%` }} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Progress (spec §6.4): per-exercise chart, weekly sets vs target, knee pain trend. */
export default function Progress({ onError }: Props) {
  const [exercises, setExercises] = useState<{ id: string; name: string }[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [weekly, setWeekly] = useState<{ muscle: Muscle; done: number; target: number }[] | null>(null);
  const [knee, setKnee] = useState<{ date: number; max: number }[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([loggedExercises(), currentWeekSets(), kneeTrend()]).then(([ex, wk, kn]) => {
      if (!alive) return;
      setExercises(ex);
      setPicked(ex[0]?.id ?? null);
      setWeekly(wk);
      setKnee(kn);
    }, (e) => onError(errMsg(e)));
    return () => { alive = false; };
  }, [onError]);

  useEffect(() => {
    if (!picked) return undefined;
    let alive = true;
    exerciseHistory(picked).then((h) => { if (alive) setHistory(h); }, (e) => onError(errMsg(e)));
    return () => { alive = false; };
  }, [picked, onError]);

  if (!exercises || !weekly) return <main className="screen"><p className="hint">Loading…</p></main>;

  return (
    <main className="screen progress">
      <h1 className="app-title">Progress</h1>

      <section className="panel" aria-labelledby="ex-h">
        <h2 className="panel-title" id="ex-h">Strength</h2>
        {exercises.length === 0 || !picked ? <p className="hint">No sets logged yet.</p> : (
          <>
            <select className="select" aria-label="Exercise" value={picked} onChange={(e) => setPicked(e.target.value)}>
              {exercises.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            {history.length > 0 && <ExerciseChart data={history} />}
          </>
        )}
      </section>

      <section className="panel" aria-labelledby="wk-h">
        <h2 className="panel-title" id="wk-h">Sets this week</h2>
        <p className="hint">Hard sets done / target per muscle</p>
        <WeeklySets rows={weekly} />
      </section>

      <section className="panel" aria-labelledby="kn-h">
        <h2 className="panel-title" id="kn-h">Knee pain</h2>
        {knee.length === 0 ? <p className="hint">No knee ratings yet.</p> : (
          <>
            <p className="hint">Worst rating per workout, 0–10</p>
            <KneeChart data={knee} />
          </>
        )}
      </section>
    </main>
  );
}
