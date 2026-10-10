import { useCallback, useEffect, useState } from 'react';
import { getExercises, getTemplates } from '../../state/library';
import BackupPanel from '../components/BackupPanel';
import LibraryEditor from '../components/LibraryEditor';
import TemplateEditor from '../components/TemplateEditor';
import { errMsg } from '../labels';
import type { Exercise, SlotId } from '../../types';

interface Props {
  onError: (message: string) => void;
}

interface Data { lib: Record<string, Exercise>; templates: Record<SlotId, string[]> }

/** Settings (spec §6.6): backup, workout templates, exercise library. */
export default function Settings({ onError }: Props) {
  const [data, setData] = useState<Data | null>(null);

  const load = useCallback(async () => {
    try {
      const [lib, templates] = await Promise.all([getExercises(), getTemplates()]);
      setData({ lib, templates });
    } catch (e) {
      onError(errMsg(e));
    }
  }, [onError]);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="screen settings">
      <h1 className="app-title">Settings</h1>
      <BackupPanel onRestored={() => void load()} onError={onError} />
      {!data ? <p className="hint">Loading…</p> : (
        <>
          <TemplateEditor lib={data.lib} templates={data.templates} reload={load} onError={onError} />
          <LibraryEditor lib={data.lib} reload={load} onError={onError} />
        </>
      )}
    </main>
  );
}
