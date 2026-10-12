import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Defaults to reloading the page. */
  onReload?: () => void;
}

/** Last-resort screen for any render error (e.g. a lazy chunk removed by an app update). */
export default class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lift Log crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const reload = this.props.onReload ?? (() => window.location.reload());
    return (
      <main className="screen crash" role="alert">
        <p className="crash-msg">Something went wrong.</p>
        <p className="hint">Your workouts are saved. Reload to continue.</p>
        <button type="button" className="btn btn-primary btn-big" onClick={reload}>Reload</button>
      </main>
    );
  }
}
