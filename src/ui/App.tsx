import { Suspense, useCallback, useEffect, useState } from 'react';
import { unlockAudio } from './audio';
import Toast, { type ToastMsg } from './components/Toast';
import ErrorBoundary from './ErrorBoundary';
import { lazyWithReload } from './lazyWithReload';
import CheckIn from './screens/CheckIn';
import History from './screens/History';
import Home from './screens/Home';
import WorkoutDetail from './screens/WorkoutDetail';
import Settings from './screens/Settings';
import Workout from './screens/Workout';

// Recharts is large; load the Progress screen (and its charts) only when opened.
// If the chunk is gone after an update, reload once to pick up the new build.
const Progress = lazyWithReload(() => import('./screens/Progress'));

export type Screen = 'home' | 'workout' | 'progress' | 'settings' | 'checkin' | 'history' | 'detail' | 'summary';

const TABS: { id: Screen; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'history', label: 'History' },
  { id: 'progress', label: 'Progress' },
  { id: 'settings', label: 'Settings' },
];

export default function App(props: { initial?: Screen }) {
  return (
    <ErrorBoundary>
      <AppScreens {...props} />
    </ErrorBoundary>
  );
}

function AppScreens({ initial = 'home' }: { initial?: Screen }) {
  const [screen, setScreen] = useState<Screen>(initial);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailFrom, setDetailFrom] = useState<Screen>('history');

  const showError = useCallback((message: string) => setToast({ id: Date.now(), message }), []);
  const clearToast = useCallback(() => setToast(null), []);
  const goHome = useCallback(() => setScreen('home'), []);
  const finished = useCallback((checkInDue: boolean, sessionId: number) => {
    setDetailId(sessionId);
    setScreen(checkInDue ? 'checkin' : 'summary');
  }, []);
  const openDetail = useCallback((from: Screen) => (id: number) => {
    setDetailId(id);
    setDetailFrom(from);
    setScreen('detail');
  }, []);

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
        <Home onOpenWorkout={() => setScreen('workout')} onOpenCheckIn={() => setScreen('checkin')}
          onOpenDetail={openDetail('home')} onOpenHistory={() => setScreen('history')} onError={showError} />
      )}
      {screen === 'workout' && <Workout onExit={goHome} onFinished={finished} onError={showError} />}
      {screen === 'progress' && (
        <Suspense fallback={<main className="screen"><p className="hint">Loading…</p></main>}>
          <Progress onError={showError} />
        </Suspense>
      )}
      {screen === 'settings' && <Settings onError={showError} />}
      {screen === 'history' && <History onOpen={openDetail('history')} onError={showError} />}
      {(screen === 'detail' || screen === 'summary') && detailId !== null && (
        <WorkoutDetail key={`${screen}-${detailId}`} id={detailId} mode={screen === 'summary' ? 'summary' : 'history'}
          onBack={() => setScreen(screen === 'summary' ? 'home' : detailFrom)} onError={showError} />
      )}
      {screen === 'checkin' && <CheckIn onDone={goHome} onError={showError} />}
      {screen !== 'workout' && screen !== 'checkin' && screen !== 'summary' && (
        <nav className="tabs" aria-label="Main">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={screen === t.id || (screen === 'detail' && t.id === detailFrom) ? 'tab tab-on' : 'tab'}
              aria-current={screen === t.id || (screen === 'detail' && t.id === detailFrom) ? 'page' : undefined} onClick={() => setScreen(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      )}
      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
}
