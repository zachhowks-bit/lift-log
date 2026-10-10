import { useEffect, useState } from 'react';
import { getExercises, getTemplates } from '../../state/library';
import { blockProgressPct, submitCheckIn } from '../../state/session';
import Chips from '../components/Chips';
import { errMsg } from '../labels';
import type { CheckInAnswers } from '../../types';

interface Props {
  onDone: () => void;
  onError: (message: string) => void;
}

type Recovery = CheckInAnswers['recovery'];
type Knee = CheckInAnswers['knee'];
type Motivation = CheckInAnswers['motivation'];

const RECOVERY: { value: Recovery; text: string }[] = [
  { value: 'rarely', text: 'Rarely' }, { value: 'sometimes', text: 'Sometimes' }, { value: 'often', text: 'Often' },
];
const KNEE: { value: Knee; text: string }[] = [
  { value: 'better', text: 'Better' }, { value: 'same', text: 'Same' }, { value: 'worse', text: 'Worse' },
];
const MOTIVATION: { value: Motivation; text: string }[] = [
  { value: 'high', text: 'High' }, { value: 'ok', text: 'OK' }, { value: 'low', text: 'Low' },
];

/** Block check-in (spec §6.5): four questions, then the summary of changes for the next block. */
export default function CheckIn({ onDone, onError }: Props) {
  const [pct, setPct] = useState<number | null>(null);
  const [exercises, setExercises] = useState<{ id: string; name: string }[]>([]);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [knee, setKnee] = useState<Knee | null>(null);
  const [motivation, setMotivation] = useState<Motivation | null>(null);
  const [swapIds, setSwapIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [changes, setChanges] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([blockProgressPct(), getTemplates(), getExercises()]).then(([p, tpl, lib]) => {
      if (!alive) return;
      const ids = [...new Set(Object.values(tpl).flat())].filter((id) => lib[id]);
      setPct(p);
      setExercises(ids.map((id) => ({ id, name: lib[id].name })));
    }, (e) => onError(errMsg(e)));
    return () => { alive = false; };
  }, [onError]);

  const toggleSwap = (id: string) =>
    setSwapIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const submit = async () => {
    if (!recovery || !knee || !motivation) return;
    setBusy(true);
    try {
      setChanges(await submitCheckIn({ recovery, knee, motivation, swapIds }));
    } catch (e) {
      onError(errMsg(e));
      setBusy(false);
    }
  };

  if (changes) {
    return (
      <main className="screen checkin">
        <h1 className="app-title">Next block</h1>
        {changes.length > 0 ? (
          <ul className="change-list" aria-label="Changes for next block">
            {changes.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        ) : <p className="panel">No changes — keep going</p>}
        <button type="button" className="btn btn-primary btn-big" onClick={onDone}>Start next block</button>
      </main>
    );
  }

  return (
    <main className="screen checkin">
      <h1 className="app-title">Block check-in</h1>
      {pct !== null && <p className="stat"><strong>{pct}%</strong> of exercises progressed this block</p>}
      <Chips label="Sore into the next session?" options={RECOVERY} value={recovery} onChange={setRecovery} cols={3} />
      <Chips label="Knee compared with last block" options={KNEE} value={knee} onChange={setKnee} cols={3} />
      <div className="field">
        <span className="field-label" id="swap-label">Any exercises to swap? (optional)</span>
        <div className="multi-chips" role="group" aria-labelledby="swap-label">
          {exercises.map((x) => {
            const on = swapIds.includes(x.id);
            return (
              <button key={x.id} type="button" aria-pressed={on} className={on ? 'pill pill-on' : 'pill'}
                onClick={() => toggleSwap(x.id)}>
                {x.name}
              </button>
            );
          })}
        </div>
      </div>
      <Chips label="Motivation" options={MOTIVATION} value={motivation} onChange={setMotivation} cols={3} />
      <button type="button" className="btn btn-primary btn-big" disabled={busy || !recovery || !knee || !motivation}
        onClick={() => void submit()}>
        Submit check-in
      </button>
    </main>
  );
}
