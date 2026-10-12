import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { unlockAudio } from './audio';
import Toast, { type ToastMsg } from './components/Toast';
import CheckIn from './screens/CheckIn';
import Home from './screens/Home';
import Settings from './screens/Settings';
import Workout from './screens/Workout';

// Recharts is large; load the Progress screen (and its charts) only when opened.
const Progress = lazy(() => import('./screens/Progress'));

export type Screen = 'home' | 'workout' | 'progress' | 'settings' | 'checkin';

const TABS: { id: Screen; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'progress', label: 'Progress' },
  { id: 'settings', label: 'Settings' },
];

export default function App({ initial = 'home' }: { initial?: Screen }) {
  const [screen, setScreen] = useState<Screen>(initial);
  const [toast, setToast] = useState<ToastMsg | null>(null);

  const showError = useCallback((message: string) => setToast({ id: Date.now(), message }), []);
  const clearToast = useCallback(() => setToast(null), []);
  const goHome = useCallback(() => setScreen('home'), []);
  const finished = useCallback((checkInDue: boolean) => setScreen(checkInDue ? 'checkin' : 'home'), []);

  // Audio can only start after a user gesture (iOS); unlock on any tap, never at load.
  useEffect(() => {
    const unlock = () => unlockAudio();
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('touchend', unlock, true);
    return () => {
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('touchend', unlock, true);
    };
  }, []);

  return (
    <div className={screen === 'workout' ? 'app app-workout' : 'app'}>
      {screen === 'home' && (
        <Home onOpenWorkout={() => setScreen('workout')} onOpenCheckIn={() => setScreen('checkin')} onError={showError} />
      )}
      {screen === 'workout' && <Workout onExit={goHome} onFinished={finished} onError={showError} />}
      {screen === 'progress' && (
        <Suspense fallback={<main className="screen"><p className="hint">Loading…</p></main>}>
          <Progress onError={showError} />
        </Suspense>
      )}
      {screen === 'settings' && <Settings onError={showError} />}
      {screen === 'checkin' && <CheckIn onDone={goHome} onError={showError} />}
      {screen !== 'workout' && screen !== 'checkin' && (
        <nav className="tabs" aria-label="Main">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={screen === t.id ? 'tab tab-on' : 'tab'}
              aria-current={screen === t.id ? 'page' : undefined} onClick={() => setScreen(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      )}
      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
}
