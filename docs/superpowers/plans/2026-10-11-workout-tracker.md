# Lift Log (Workout Tracker) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A personal iPhone-installable PWA that prescribes each workout (exercise, weight, reps, sets, rest) from logged history using transparent rules.

**Architecture:** Pure TypeScript rule engine (`src/engine`) with no React or storage, fully unit-tested. Dexie/IndexedDB storage (`src/db`), a thin state layer (`src/state`) that loads history, calls the engine and saves results, and React screens (`src/ui`) that only talk to `state`.

**Tech Stack:** Vite, React 18, TypeScript, Dexie 4, vite-plugin-pwa, Recharts, Vitest, fake-indexeddb (tests), GitHub Pages via GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-11-workout-tracker-design.md` — read it first; this plan cites its section numbers (§).

## Global Constraints

- App name: **Lift Log**. Repo name: `lift-log`. Vite `base: '/lift-log/'`.
- Units: kg only. All weights rounded to the exercise `increment` (round half up).
- No network calls, no accounts, no analytics. Works fully offline after first load.
- Split order fixed: `upperA → lowerA → upperB → lowerB`, sequence-based (§4).
- Week = 4 completed sessions; block = 20 sessions; week 5 = deload (§4).
- Rest: H 180 s, C 120 s, I 90 s, +30 s after a set at effective RIR 0 (§5).
- Reps: H 6–10, C 8–12, I 10–15; knee-sensitive exercises 10–15; lower-body exercises start at 2 sets, others 3 (§5).
- Copy is plain English, short. Every prescription shows a `why` line (§5).
- Mobile-first layout, minimum tap target 44 px, works at 375 px width, respects iPhone safe areas.
- Owner is not a developer: README must explain install-to-home-screen and backup in plain steps.

## Review Focus

1. **App closed mid-workout or mid-rest** → reopening restores the in-progress session and a correct remaining rest time (timer stores an end timestamp). Test in Task 7 and Task 8.
2. **First-ever session (no history at all)** → every card asks for a calibration weight instead of crashing or prescribing `NaN`. Test in Task 3.
3. **Bad set input** (blank weight, 0 full reps, negative numbers) → rejected at the input, never stored; 0 full reps with partials is allowed. Test in Task 7.
4. **Weight math producing off-increment or zero weights** (7.5% drop on 5 kg dumbbell, −20% break) → result rounded to increment and never below one increment. Test in Task 3.
5. **Importing a bad backup** (wrong JSON, newer schemaVersion, truncated file) → rejected with a message, existing data untouched. Test in Task 6.

---

## File Structure

```
src/
  types.ts                 shared types (Task 1)
  engine/
    round.ts               roundTo
    rules.ts               defaultsFor, restFor, effectiveRir
    block.ts               weekInBlock, targetRirLabel, isDeloadWeek
    progression.ts         nextPrescription, isValidExposure
    knee.ts                kneeAction, kneeRising
    stall.ts               isStalled
    breaks.ts              breakFactor
    volume.ts              weeklySets, rampLegSets
    checkin.ts             applyCheckIn
    *.test.ts              one test file per module
  data/library.ts          EXERCISES, TEMPLATES, initialProgramState
  db/db.ts                 Dexie schema + helpers
  db/backup.ts             exportBackup, importBackup
  state/session.ts         startNextSession, logSet, finishSession, swapExercise
  state/progress.ts        progress queries for charts
  ui/                      App.tsx, screens/*.tsx, components/*.tsx
.github/workflows/deploy.yml
```

---

### Task 1: Scaffold + shared types

**Files:**
- Create: Vite React-TS project at repo root, `vite.config.ts`, `src/types.ts`, `README.md`, `.github/workflows/deploy.yml`
- Test: `src/types.test.ts` (smoke)

**Interfaces — Produces (`src/types.ts`):**
```ts
export type ExType = 'H' | 'C' | 'I';
export type Muscle = 'chest' | 'frontDelt' | 'sideDelt' | 'rearDelt' | 'triceps' | 'biceps'
  | 'lats' | 'midBack' | 'lowerBack' | 'quads' | 'glutes' | 'gluteMed' | 'hamstrings' | 'calves';
export const LEG_MUSCLES: Muscle[] = ['quads','glutes','gluteMed','hamstrings','calves'];
export type SlotId = 'upperA' | 'lowerA' | 'upperB' | 'lowerB';
export interface Exercise { id: string; name: string; type: ExType; primary: Muscle[]; secondary: Muscle[];
  equipment: 'barbell'|'dumbbell'|'machine'|'cable'|'bodyweight'; increment: number;
  lower: boolean; kneeSensitive: boolean; alternatives: string[]; avoid: boolean; }
export interface SetLog { weight: number; fullReps: number; partialReps: number; rir: number;
  restTakenSec: number | null; restSkipped: boolean; kneePain: number | null; }
export interface Prescription { exerciseId: string; weight: number | null; sets: number; repMin: number;
  repMax: number; targetReps: number[]; restSec: number; targetRir: string; why: string;
  needsCalibration: boolean; suggestSwap: boolean; }
export interface ExerciseEntry { exerciseId: string; prescription: Prescription; doneOutOfOrder: boolean;
  isDeload: boolean; sets: SetLog[]; }
export interface Session { id?: number; slot: SlotId; startedAt: number; finishedAt: number | null;
  blockNumber: number; weekInBlock: number; entries: ExerciseEntry[]; restEndsAt: number | null; }
export interface ProgramState { id: 'main'; nextSlotIndex: number; blockNumber: number; sessionsInBlock: number;
  volumeTargets: Record<Muscle, number>; setsByExercise: Record<string, number>; legRampFrozen: boolean; }
export interface CheckInAnswers { recovery: 'rarely'|'sometimes'|'often'; knee: 'better'|'same'|'worse';
  swapIds: string[]; motivation: 'high'|'ok'|'low'; }
export interface CheckIn extends CheckInAnswers { id?: number; blockNumber: number; at: number;
  pctProgressed: number; changes: string[]; }
export interface Settings { id: 'main'; lastBackupAt: number | null; schemaVersion: number; }
export const SCHEMA_VERSION = 1;
```

- [ ] **Step 1:** `npm create vite@latest . -- --template react-ts`; install `dexie recharts`, dev `vitest jsdom fake-indexeddb @testing-library/react vite-plugin-pwa`. Add `"test": "vitest run"`.
- [ ] **Step 2:** `vite.config.ts`: `base: '/lift-log/'`, VitePWA with `registerType: 'autoUpdate'`, manifest `{ name: 'Lift Log', short_name: 'Lift Log', display: 'standalone', start_url: '/lift-log/', theme_color: '#111111', background_color: '#111111' }`, 192/512 PNG icons in `public/`, plus `apple-touch-icon.png` (180) and `<meta name="apple-mobile-web-app-capable" content="yes">` in `index.html`. Vitest `environment: 'jsdom'`.
- [ ] **Step 3:** Write `src/types.ts` exactly as above; smoke test `expect(SCHEMA_VERSION).toBe(1)`.
- [ ] **Step 4:** `deploy.yml`: on push to `main` → `npm ci && npm test && npm run build` → `actions/upload-pages-artifact` (`dist`) → `actions/deploy-pages`.
- [ ] **Step 5:** README: what it is; how to open on iPhone (Safari → Share → Add to Home Screen); backup weekly; "not medical advice".
- [ ] **Step 6:** Run `npm test && npm run build` → both pass. Commit `chore: scaffold Lift Log PWA`.

### Task 2: Engine basics — rounding, rules, block

**Files:** Create `src/engine/round.ts`, `rules.ts`, `block.ts`, `breaks.ts` + tests.

**Interfaces — Produces:**
- `roundTo(w: number, inc: number): number` — nearest multiple of `inc`, minimum `inc`.
- `defaultsFor(ex: Exercise): { repMin: number; repMax: number; sets: number; restSec: number }`
- `effectiveRir(s: SetLog): number` — `0` if `partialReps > 0`, else `s.rir`.
- `restFor(ex: Exercise, last: SetLog): number`
- `weekInBlock(sessionsInBlock: number): 1|2|3|4|5` — `floor(sessionsInBlock / 4) + 1`, capped 5.
- `isDeloadWeek(week: number): boolean`
- `targetRirLabel(week: number): string` — `'3 reps left'`, `'2 reps left'`, `'1–2 reps left'`, `'1 rep left'`, `'Deload: easy, 3+ left'`.
- `breakFactor(daysSinceLast: number | null): number` — `null`→1, `<10`→1, `10–20`→0.9, `≥21`→0.8.

- [ ] **Step 1: Failing tests** (table-driven):
  - `roundTo(41.3, 2.5)===42.5`, `roundTo(4.6, 2)===4`, `roundTo(0.5, 2.5)===2.5`.
  - `defaultsFor` H non-lower → `{6,10,3,180}`; C lower knee-sensitive → `{10,15,2,120}`; I upper → `{10,15,3,90}`; H lower not knee → `{6,10,2,180}`.
  - `restFor(C, {rir:2,partialReps:0})===120`; `restFor(C, {rir:2,partialReps:1})===150`; `restFor(I,{rir:0,…})===120`.
  - `weekInBlock(0)===1, (3)===1, (4)===2, (16)===5, (19)===5`.
  - `breakFactor(9)===1, (10)===0.9, (20)===0.9, (21)===0.8, (null)===1`.
- [ ] **Step 2:** Run `npx vitest run src/engine` → FAIL.
- [ ] **Step 3:** Implement the functions.
- [ ] **Step 4:** Run → PASS. Commit `feat(engine): rounding, rules, block, breaks`.

### Task 3: Progression + knee + stall

**Files:** Create `src/engine/progression.ts`, `knee.ts`, `stall.ts` + tests.

**Interfaces:**
- Consumes: Task 2 functions.
- Produces:
  - `kneeAction(maxPain: number | null): 'normal' | 'noIncrease' | 'reduceAndSwap'` — ≤3 normal, 4–5 noIncrease, ≥6 reduceAndSwap.
  - `kneeRising(lowerSessionMaxPains: number[]): boolean` — newest first; true if `[0] > [1] && [1] > [2]` (higher on 2 consecutive sessions).
  - `isValidExposure(entry: ExerciseEntry): boolean`
  - `isStalled(validHistory: ExerciseEntry[]): boolean` — newest first; needs ≥4 entries; true if none of the 3 newest improved on the one before it (higher top weight, or same weight and more total full reps).
  - `nextPrescription(ex: Exercise, history: ExerciseEntry[], ctx: { week: number; daysSinceLast: number | null; sets: number }): Prescription` — `history` newest first, all entries for this exercise; `ctx.sets` from `ProgramState.setsByExercise[ex.id] ?? defaultsFor(ex).sets`.

**Algorithm for `nextPrescription` (order matters):**
1. Drop deload entries. If none left → `needsCalibration: true, weight: null, why: 'First time: pick a weight you could do for {repMax} with ~2 reps left'`.
2. `valid = history.filter(isValidExposure)`. Invalid = any set `restSkipped`, or `doneOutOfOrder` and any set `fullReps < repMin`. If no valid entries, use the newest entry's top weight, hold, `why: 'Same weight: last session didn't count (rest skipped / out of order)'`.
3. `last = valid[0]`. Base weight = last top working weight.
   - All sets `fullReps ≥ repMax` and every `effectiveRir ≥ 1` → `+increment`, targets all `repMin`, `why: '+{inc} kg: hit {reps joined "/"} last time'`.
   - Any set `fullReps < repMin` with `effectiveRir === 0` → hold; if `valid[1]` met the same condition → weight × 0.925, `why: '−7.5%: missed bottom of range twice'`; else `why: 'Same weight: missed {repMin} last time'`.
   - Else → hold; targets = last reps with the lowest set +1 (capped `repMax`), `why: 'Same weight: aim {n} reps on set {k}'`.
4. Knee (lower exercises only, using max `kneePain` of last entry): `noIncrease` cancels a step-3 increase (`why: 'Held: knee pain {p} last time'`); `reduceAndSwap` → weight × 0.9, `suggestSwap: true`, `why: '−10% + try a swap: knee pain {p}'`.
5. `breakFactor(ctx.daysSinceLast) < 1` → multiply, prefix why `'−10%: back after {d} days. '` / `'−20%: …'`.
6. `isDeloadWeek(ctx.week)` → sets `ceil(sets/2)`, weight × 0.9, why `'Deload week: lighter, easy reps'`.
7. `isStalled(valid)` → `suggestSwap: true`, append `' Stalled 3 sessions — consider a swap.'`.
8. Round weight with `roundTo(w, ex.increment)`; `targetRir = targetRirLabel(week)`; `restSec = defaultsFor(ex).restSec`.

- [ ] **Step 1: Failing tests** — one per rule, using a helper `entry(weight, reps[], rir[], opts)`:
  - no history → `needsCalibration` true, weight null.
  - bench (H, inc 2.5) 60 kg ×10/10/10 RIR 1 → 62.5, targets `[6,6,6]`, why starts `'+2.5 kg'`.
  - 60 × 10/10/9 → 60, targets `[10,10,10]`.
  - 60 × 5/6/6 with RIR 0 once → 60 'missed'; twice in a row → `roundTo(55.5, 2.5) === 55`.
  - partial: 60 × 10/10/(9 full + 1 partial, rir 2) → hold (partial forces RIR 0, fullReps 9 < 10).
  - restSkipped newest + older valid entry → prescription built from older entry.
  - leg press (lower, knee) 100 × 15/15 rir 1, knee 5 → 100 held, why contains 'knee'; knee 6 → 90, `suggestSwap`.
  - daysSinceLast 12 → ×0.9; 25 → ×0.8.
  - week 5 → sets halved (3→2), ×0.9.
  - 5 kg dumbbell (inc 2) double miss → 4 (never below 2).
  - stall: 4 identical entries → `suggestSwap` true; improving series → false.
  - `kneeRising([5,4,3])` true, `([5,5,3])` false, `([5])` false.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(engine): progression, knee guard, stall detection`.

### Task 4: Volume + check-in

**Files:** Create `src/engine/volume.ts`, `checkin.ts` + tests.

**Interfaces:**
- `weeklySets(sessions: Session[], lib: Record<string, Exercise>): Record<Muscle, number>` — counts working sets in the given sessions (caller passes the current week's sessions); primary 1, secondary 0.5; deload entries included.
- `rampLegSets(state: ProgramState, weekKneeMax: number | null, poorRecovery: boolean, lib: Record<string, Exercise>, lowerIds: string[]): { state: ProgramState; change: string | null }` — if `weekKneeMax ≤ 3` (or null) and not poorRecovery: add +1 set to the lower exercise in `lowerIds` with the fewest sets that is not kneeSensitive (fallback: any), unless any of its primary muscles' `weeklySets` target would exceed 20. Updates `volumeTargets` for its primary muscles +1. Called once per completed week (every 4 sessions, not in deload).
- `applyCheckIn(state: ProgramState, a: CheckInAnswers, pctProgressed: number, lib: Record<string, Exercise>, templates: Record<SlotId, string[]>): { state: ProgramState; templates: Record<SlotId, string[]>; changes: string[] }` — rules from spec §6.5:
  - recovery `rarely` && pct ≥ 60 → upper muscle targets +2 (cap 20) and +1 set on the first C exercise of each upper slot; change `'More upper volume: +2 sets/muscle'`.
  - recovery `often` → all targets −2 (floor 4), −1 set on the exercise with most sets per slot (floor 2).
  - knee `worse` → replace every kneeSensitive id in lower templates with its first non-knee-sensitive, non-avoid alternative; change `'Knee: swapped {name} → {name}'`; set `legRampFrozen = true` (otherwise `false`) so `rampLegSets` is skipped next block.
  - each `swapIds` id → first non-avoid alternative not already in that template.
  - motivation `low` → swap the last 2 isolation exercises across all templates to alternatives.
  - Always returns `changes` (empty array allowed → UI shows 'No changes — keep going').

- [ ] **Step 1: Failing tests:** two Upper A sessions of bench 3 sets → `chest 6`, `triceps 3`, `frontDelt 3`; ramp with knee 2 adds a set to hip thrust (not leg extension); knee 5 → no change; check-in rarely+70% → chest target 12; often → 8; knee worse → `legExtension` removed from lowerA; swapIds bench → `dbBench` in upperA.
- [ ] **Step 2–4:** fail → implement → pass. Commit `feat(engine): volume ramp and block check-in`.

### Task 5: Exercise library + templates

**Files:** Create `src/data/library.ts`, `src/data/library.test.ts`.

**Interfaces — Produces:** `EXERCISES: Exercise[]`, `TEMPLATES: Record<SlotId, string[]>`, `SLOT_ORDER: SlotId[] = ['upperA','lowerA','upperB','lowerB']`, `SLOT_NAMES: Record<SlotId,string>` (`'Upper A — Push'`, `'Lower A — Quads & Glutes'`, `'Upper B — Pull'`, `'Lower B — Hamstrings & Glutes'`), `initialProgramState(): ProgramState` (upper muscles target 10, leg muscles 6, `setsByExercise` empty, `legRampFrozen` false).

- [ ] **Step 1:** Encode the four templates and exercises from spec §4 verbatim (types, muscles, knee flags). Increments: barbell 2.5, dumbbell 2, machine/cable 2.5, all `lower` exercises 2.5. Add ≥2 alternatives per template exercise (spec §4 examples plus sensible same-primary-muscle picks), each alternative itself defined in `EXERCISES`.
- [ ] **Step 2: Tests:** every template id exists; every alternative id exists and shares ≥1 primary muscle; every template exercise has ≥2 alternatives; `kneeSensitive` true for leg press, leg extension, hack squat, goblet box squat, and only for `lower` exercises.
- [ ] **Step 3:** Run → PASS. Commit `feat(data): exercise library and templates`.

### Task 6: Database + backup

**Files:** Create `src/db/db.ts`, `src/db/backup.ts` + tests (use `fake-indexeddb/auto`).

**Interfaces — Produces:**
- `db` (Dexie) tables: `exercises('id')`, `templates('slot')` rows `{slot, ids: string[]}`, `sessions('++id, startedAt, finishedAt')`, `checkIns('++id, blockNumber')`, `programState('id')`, `settings('id')`.
- `ensureSeeded(): Promise<void>` — on empty DB writes EXERCISES, TEMPLATES, initialProgramState, settings; calls `navigator.storage?.persist?.()`.
- `exportBackup(): Promise<{ filename: string; json: string }>` — filename `workout-backup-YYYY-MM-DD.json`; payload `{ schemaVersion, exportedAt, exercises, templates, sessions, checkIns, programState, settings }`; sets `settings.lastBackupAt`.
- `importBackup(json: string): Promise<{ ok: true } | { ok: false; error: string }>` — validates parse, `schemaVersion === SCHEMA_VERSION`, all keys present and arrays/objects of the right kind; on success replaces all tables in one transaction.

- [ ] **Step 1: Failing tests:** seed then export then clear then import → identical sessions; import `'{'` → `ok:false`, error contains 'not a valid backup'; import with `schemaVersion: 99` → `ok:false`, 'newer version'; failed import leaves existing sessions count unchanged.
- [ ] **Step 2–4:** fail → implement → pass. Commit `feat(db): storage and backup`.

### Task 7: Session state

**Files:** Create `src/state/session.ts`, `src/state/progress.ts` + tests.

**Interfaces — Produces:**
- `getActiveSession(): Promise<Session | null>` (unfinished session, newest).
- `startNextSession(now: number): Promise<Session>` — slot = `SLOT_ORDER[nextSlotIndex]`; week = `weekInBlock(sessionsInBlock)`; for each template id (skipping `avoid`) builds `nextPrescription` from all finished entries of that exercise (newest first) and `daysSinceLast` from the last finished session.
- `validateSet(s: Partial<SetLog>): string | null` — error if weight blank/≤0, fullReps < 0, partialReps < 0, both reps 0, rir outside 0–5, kneePain outside 0–10.
- `logSet(sessionId: number, exerciseId: string, set: SetLog, now: number): Promise<Session>` — rejects invalid sets; marks `doneOutOfOrder` if this exercise's first set is logged while an earlier entry in the list has 0 sets; sets `restEndsAt = now + restFor(ex, set)*1000`; persists immediately.
- `skipRest(sessionId, now)` — clears `restEndsAt`, marks the last logged set `restSkipped: true`.
- `swapExercise(sessionId, fromId, toId)` — replaces entry with a fresh prescription for `toId`.
- `finishSession(sessionId, now): Promise<{ checkInDue: boolean }>` — sets `finishedAt`; advances `nextSlotIndex` mod 4; `sessionsInBlock++`; if a non-deload week just completed (sessionsInBlock % 4 === 0 and week < 5) and `!legRampFrozen` → `rampLegSets`; if `sessionsInBlock === 20` → `checkInDue: true`.
- `submitCheckIn(answers): Promise<string[]>` — computes `pctProgressed` (exercises whose top weight or reps rose between first and last valid exposure in the block), calls `applyCheckIn`, saves state/templates/checkIn, resets `sessionsInBlock = 0`, `blockNumber++`, `legRampFrozen = answers.knee === 'worse'`.
- `progress.ts`: `exerciseHistory(id): Promise<{date:number; topWeight:number; e1rm:number}[]>` (e1rm = Epley `w*(1+reps/30)`), `currentWeekSets(): Promise<{muscle, done, target}[]>`, `kneeTrend(): Promise<{date, max}[]>`, `backupOverdue(now): Promise<boolean>` (>7 days or never with ≥1 session).

- [ ] **Step 1: Failing tests:** full flow — start → log 3 sets → finish → next slot is lowerA; restart DB (re-open) mid-session → `getActiveSession` returns it with logged sets and `restEndsAt`; `validateSet({weight:0,…})` error; `{fullReps:0, partialReps:1}` ok; 20 finished sessions → `checkInDue` true; out-of-order logging sets flag.
- [ ] **Step 2–4:** fail → implement → pass. Commit `feat(state): session flow and progress queries`.

### Task 8: UI — Home, Workout, Rest timer

**Files:** `src/ui/App.tsx` (simple tab/state router: home, workout, progress, settings, checkin), `screens/Home.tsx`, `screens/Workout.tsx`, `components/ExerciseCard.tsx`, `components/SetRow.tsx`, `components/RestTimer.tsx`, `components/SwapSheet.tsx`, `src/ui/styles.css`. Load the `frontend-design` skill before styling: dark, high-contrast, gym-readable, big numbers.

- [ ] **Step 1:** Home per spec §6.1 (next slot name, `Block n · Week w · {targetRir}`, Start / Resume, last session summary, backup banner from `backupOverdue`, knee banner from `kneeRising`).
- [ ] **Step 2:** Workout per §6.2: cards in template order; tapping a card expands it; card shows `weight × reps × sets`, `why`, set rows with steppers for weight (± increment), full reps, partial reps, RIR chips 0/1/2/3+, knee pain chips 0–10 for `lower` exercises (default = previous value); calibration input when `needsCalibration`; Swap button opens SwapSheet (alternatives, non-avoid); `suggestSwap` shows a highlighted swap hint; Finish button (confirm if any card has 0 sets).
- [ ] **Step 3:** RestTimer per §6.3: full-screen overlay while `restEndsAt > now`; remaining = `restEndsAt − Date.now()` recomputed every 250 ms and on `visibilitychange`; set-log button disabled while running; long-press (600 ms) "Skip rest" calls `skipRest`; at zero plays a short Web Audio beep (create AudioContext on first user tap).
- [ ] **Step 4: Tests** (@testing-library/react): RestTimer shows `2:00` for a 120 s end time and the log button is disabled; after mocking time past end it's enabled; SetRow rejects 0 weight with visible error.
- [ ] **Step 5:** `npm test && npm run build` pass; run `npm run dev` and check at 375 px width. Commit `feat(ui): home, workout, rest timer`.

### Task 9: UI — Progress, Check-in, Settings

**Files:** `screens/Progress.tsx`, `screens/CheckIn.tsx`, `screens/Settings.tsx`.

- [ ] **Step 1:** Progress §6.4: exercise picker + Recharts line (top weight, e1RM); weekly sets bar list `done / target` per muscle; knee pain line.
- [ ] **Step 2:** CheckIn §6.5: four questions, shows `pctProgressed`, submit → shows returned `changes` (or 'No changes — keep going') then returns Home. Opened automatically after `finishSession` returns `checkInDue`.
- [ ] **Step 3:** Settings §6.6: Export (create Blob, trigger download via `<a download>`; on iOS this opens the share/save sheet), Import (file input `accept="application/json"`, confirm dialog "This replaces all your data"), library list with Avoid toggle and Add custom exercise form (name, type, primary muscle, equipment, lower, kneeSensitive), template editor (move up/down, replace via alternatives), increment editor per exercise.
- [ ] **Step 4: Tests:** CheckIn submit renders changes list; Import with bad file shows error text.
- [ ] **Step 5:** `npm test && npm run build`. Commit `feat(ui): progress, check-in, settings`.

### Task 10: Deploy + iPhone verification

- [ ] **Step 1:** Push to GitHub repo `lift-log`; enable Pages → Source: GitHub Actions. Workflow green.
- [ ] **Step 2:** Open `https://<user>.github.io/lift-log/` in desktop browser: Lighthouse PWA installable, works offline after reload with network disabled.
- [ ] **Step 3:** Owner on iPhone: Safari → Share → Add to Home Screen; open from icon; log a set; force-close app mid-rest and reopen → timer resumes; airplane mode → still works; Export backup → save to Files.
- [ ] **Step 4:** Commit any fixes; tag `v1.0.0`.
