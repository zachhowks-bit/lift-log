import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';
import { lazyWithReload, RELOAD_FLAG } from './lazyWithReload';

function Boom(): never {
  throw new Error('boom');
}

// React and jsdom report the expected render errors; keep the test output clean.
const swallow = (e: ErrorEvent) => e.preventDefault();
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  window.addEventListener('error', swallow);
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  window.removeEventListener('error', swallow);
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(<ErrorBoundary><p>fine</p></ErrorBoundary>);
    expect(screen.getByText('fine')).toBeTruthy();
  });

  it('shows a message and a Reload button when a child throws', () => {
    const reload = vi.fn();
    render(<ErrorBoundary onReload={reload}><Boom /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('lazyWithReload', () => {
  it('reloads once when the lazy import fails, then shows the boundary', async () => {
    const reload = vi.fn();
    const fail = () => Promise.reject(new Error('chunk 404'));
    const First = lazyWithReload(fail, reload);
    render(<ErrorBoundary onReload={vi.fn()}><Suspense fallback={<p>Loading…</p>}><First /></Suspense></ErrorBoundary>);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem(RELOAD_FLAG)).toBe('1');
    cleanup();

    // After the reload the flag is set, so a second failure goes to the boundary instead of looping.
    const Second = lazyWithReload(fail, reload);
    render(<ErrorBoundary onReload={vi.fn()}><Suspense fallback={<p>Loading…</p>}><Second /></Suspense></ErrorBoundary>);
    expect(await screen.findByRole('button', { name: 'Reload' })).toBeTruthy();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('clears the flag after a successful load', async () => {
    sessionStorage.setItem(RELOAD_FLAG, '1');
    const Ok = lazyWithReload(() => Promise.resolve({ default: () => <p>loaded</p> }), vi.fn());
    render(<Suspense fallback={null}><Ok /></Suspense>);
    expect(await screen.findByText('loaded')).toBeTruthy();
    expect(sessionStorage.getItem(RELOAD_FLAG)).toBeNull();
  });
});
