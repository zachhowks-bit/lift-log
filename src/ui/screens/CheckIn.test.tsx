import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeeded } from '../../db/db';
import App from '../App';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
  const st = (await db.programState.get('main'))!;
  await db.programState.put({ ...st, sessionsInBlock: 20 });
});
afterEach(cleanup);

const pick = (group: string, option: string) =>
  fireEvent.click(within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name: option }));

describe('CheckIn', () => {
  it('submits the answers and renders the list of changes', async () => {
    render(<App initial="checkin" />);
    expect(await screen.findByText('of exercises progressed this block')).toBeTruthy();
    const submit = screen.getByRole('button', { name: 'Submit check-in' });
    expect(submit).toHaveProperty('disabled', true);

    pick('Sore into the next session?', 'Often');
    pick('Knee compared with last block', 'Same');
    fireEvent.click(await screen.findByRole('button', { name: 'Dumbbell curl' }));
    expect(submit).toHaveProperty('disabled', true);
    pick('Motivation', 'OK');
    expect(submit).toHaveProperty('disabled', false);
    fireEvent.click(submit);

    const list = await screen.findByRole('list', { name: 'Changes for next block' });
    const items = within(list).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toContain('Less volume: −2 sets/muscle (recovery)');
    expect(items.some((t) => t?.startsWith('Swapped Dumbbell curl → '))).toBe(true);
    expect((await db.programState.get('main'))!.blockNumber).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: 'Start next block' }));
    expect(await screen.findByRole('button', { name: 'Start' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Block check-in due' })).toBeNull();
  });

  it('says there are no changes when nothing changes', async () => {
    render(<App initial="checkin" />);
    await screen.findByText('of exercises progressed this block');
    pick('Sore into the next session?', 'Sometimes');
    pick('Knee compared with last block', 'Same');
    pick('Motivation', 'High');
    fireEvent.click(screen.getByRole('button', { name: 'Submit check-in' }));
    expect(await screen.findByText('No changes — keep going')).toBeTruthy();
  });
});
