import { SLOTS, slotName, setTemplate } from '../../state/library';
import { errMsg } from '../labels';
import type { Exercise, SlotId } from '../../types';

interface Props {
  lib: Record<string, Exercise>;
  templates: Record<SlotId, string[]>;
  reload: () => Promise<void>;
  onError: (message: string) => void;
}

/** Template editor: reorder and replace exercises per workout (spec §6.6). */
export default function TemplateEditor({ lib, templates, reload, onError }: Props) {
  const save = async (slot: SlotId, ids: string[]) => {
    try {
      await setTemplate(slot, ids);
      await reload();
    } catch (e) {
      onError(errMsg(e));
    }
  };

  const move = (slot: SlotId, i: number, by: -1 | 1) => {
    const ids = [...templates[slot]];
    [ids[i], ids[i + by]] = [ids[i + by], ids[i]];
    void save(slot, ids);
  };

  const replace = (slot: SlotId, i: number, to: string) => {
    if (!to) return;
    const ids = [...templates[slot]];
    ids[i] = to;
    void save(slot, ids);
  };

  return (
    <section className="panel" aria-labelledby="tpl-h">
      <h2 className="panel-title" id="tpl-h">Workouts</h2>
      {SLOTS.map((slot) => {
        const ids = templates[slot] ?? [];
        return (
          <details key={slot} className="tpl">
            <summary className="tpl-summary">
              <span className="sub-title">{slotName(slot)}</span>
              <span className="tpl-count">{ids.length} exercises</span>
            </summary>
            <ol className="tpl-list">
              {ids.map((id, i) => {
                const ex = lib[id];
                const options = (ex?.alternatives ?? [])
                  .map((a) => lib[a])
                  .filter((a): a is Exercise => !!a && !a.avoid && !ids.includes(a.id));
                return (
                  <li key={id} className="tpl-row">
                    <div className="tpl-head">
                      <span className="tpl-name">
                        {ex?.name ?? id}
                        {ex?.avoid && <span className="tpl-note"> · avoided, skipped</span>}
                      </span>
                      <div className="tpl-moves">
                        <button type="button" className="icon-btn" aria-label={`Move ${ex?.name ?? id} up`}
                          disabled={i === 0} onClick={() => move(slot, i, -1)}>↑</button>
                        <button type="button" className="icon-btn" aria-label={`Move ${ex?.name ?? id} down`}
                          disabled={i === ids.length - 1} onClick={() => move(slot, i, 1)}>↓</button>
                      </div>
                    </div>
                    <select className="select" value="" aria-label={`Replace ${ex?.name ?? id}`}
                      disabled={options.length === 0} onChange={(e) => replace(slot, i, e.target.value)}>
                      <option value="">{options.length ? 'Replace…' : 'No alternatives'}</option>
                      {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </li>
                );
              })}
            </ol>
          </details>
        );
      })}
      <p className="hint">Changes apply from your next workout.</p>
    </section>
  );
}
