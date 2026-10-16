import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, ensureSeeded } from '../../db/db';
import App from '../App';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (navigator as unknown as Record<string, unknown>).share;
  delete (navigator as unknown as Record<string, unknown>).canShare;
});

const mockShare = (share: () => Promise<void>) => {
  const fn = vi.fn(share);
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
  Object.defineProperty(navigator, 'share', { configurable: true, value: fn });
  return fn;
};

const pickFile = (content: string) => {
  const file = new File([content], 'backup.json', { type: 'application/json' });
  fireEvent.change(screen.getByTestId('import-file'), { target: { files: [file] } });
};

describe('Settings', () => {
  it('import with a bad file shows the error and keeps data', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App initial="settings" />);
    expect(await screen.findByText('Never backed up')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export backup' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Import backup' })).toBeTruthy();

    pickFile('{"not": "a backup"}');
    expect((await screen.findByRole('alert')).textContent).toBe('This file is not a valid backup.');
    expect(confirm).toHaveBeenCalledWith('This replaces all your data. Continue?');
    expect(await db.exercises.get('bench')).toBeTruthy();
  });

  it('cancelling the share sheet does not record a backup', async () => {
    const share = mockShare(() => Promise.reject(new DOMException('cancelled', 'AbortError')));
    render(<App initial="settings" />);
    await screen.findByText('Never backed up');
    fireEvent.click(screen.getByRole('button', { name: 'Export backup' }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export backup' })).toHaveProperty('disabled', false));
    expect(screen.getByText('Never backed up')).toBeTruthy();
    expect((await db.settings.get('main'))?.lastBackupAt).toBeNull();
  });

  it('a completed share records the backup', async () => {
    const share = mockShare(() => Promise.resolve());
    render(<App initial="settings" />);
    await screen.findByText('Never backed up');
    fireEvent.click(screen.getByRole('button', { name: 'Export backup' }));
    expect(await screen.findByText(/^Last backup: /)).toBeTruthy();
    expect(share).toHaveBeenCalledTimes(1);
    expect((await db.settings.get('main'))?.lastBackupAt).toBeTypeOf('number');
  });

  it('does nothing when the import is not confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App initial="settings" />);
    await screen.findByText('Never backed up');
    pickFile('garbage');
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('toggles avoid, rejects a bad increment, and reorders a template', async () => {
    render(<App initial="settings" />);
    const avoid = await screen.findByRole('switch', { name: 'Avoid Barbell bench press' });
    fireEvent.click(avoid);
    await waitFor(async () => expect((await db.exercises.get('bench'))!.avoid).toBe(true));
    expect(await screen.findByRole('switch', { name: 'Avoid Barbell bench press', checked: true })).toBeTruthy();

    const inc = screen.getByLabelText('Barbell bench press increment (kg)');
    fireEvent.change(inc, { target: { value: '0' } });
    fireEvent.blur(inc);
    expect((await screen.findByRole('alert')).textContent).toBe('Increment must be above 0.');
    fireEvent.change(inc, { target: { value: '1.25' } });
    fireEvent.blur(inc);
    await waitFor(async () => expect((await db.exercises.get('bench'))!.increment).toBe(1.25));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Move Incline dumbbell press up' }));
    await waitFor(async () => expect((await db.templates.get('pushA'))!.ids.slice(0, 2)).toEqual(['inclineDbPress', 'machineChestPress']));

    const replace = await screen.findByRole('combobox', { name: 'Replace Cable triceps pushdown' });
    fireEvent.change(replace, { target: { value: 'dbKickback' } });
    await waitFor(async () => expect((await db.templates.get('pushA'))!.ids).toContain('dbKickback'));
    expect(await screen.findByRole('combobox', { name: 'Replace Dumbbell triceps kickback' })).toBeTruthy();
    expect(screen.getByText('Changes apply from your next workout.')).toBeTruthy();
  });

  it('adds a custom exercise', async () => {
    render(<App initial="settings" />);
    const form = await screen.findByRole('form', { name: 'Add custom exercise' });
    expect(within(form).getByLabelText('Knee-sensitive')).toHaveProperty('disabled', true);
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Belt squat' } });
    fireEvent.change(within(form).getByLabelText('Primary muscle'), { target: { value: 'quads' } });
    fireEvent.click(within(form).getByLabelText('Lower-body exercise'));
    fireEvent.click(within(form).getByLabelText('Knee-sensitive'));
    fireEvent.click(within(form).getByRole('button', { name: 'Add exercise' }));
    expect(await screen.findByText('Added Belt squat.')).toBeTruthy();
    expect(await screen.findByRole('switch', { name: 'Avoid Belt squat' })).toBeTruthy();
    expect(await db.exercises.get('custom-belt-squat')).toMatchObject({ lower: true, kneeSensitive: true, primary: ['quads'] });
  });
});
