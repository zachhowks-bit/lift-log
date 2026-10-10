# Workout Tracker ("Hevy for one") — Design Spec

Date: 2026-10-11
Status: Approved in chat by owner (owner delegated remaining design decisions)

## 1. Purpose

A personal workout app for one person (the owner), installed on an iPhone home screen.
It tells the owner what to do each session — exercise, weight, reps, sets, rest — and
adjusts using simple, transparent rules based on logged results. No AI, no server, no cost.

### Owner context (drives the rules)
- Intermediate lifter, ~2 years, previously push/pull/legs.
- Trains ~4 days/week, but legs were trained only ~once a month. Legs are the weak point.
- Has pain beside the knee under heavy leg load (cause unknown; owner is getting it checked).
- Trains in a busy commercial gym: often has to change exercise order or swap equipment.
- Sometimes ends a set with a partial (half) rep.
- iPhone user. Not a professional developer.

### Success criteria
- Owner never has to decide what to lift: open app → see next session → follow it.
- Weights/reps progress over weeks on most exercises (visible on charts).
- Legs trained 2×/week with knee pain tracked and never pushed through.
- Data survives (weekly backup habit; restore works).

### Explicitly out of scope
Social/community/chat, accounts/login, cloud sync, AI analysis, nutrition, bodyweight
tracking, Apple Health, native iOS app, multiple users.

## 2. Platform & tech

- **Progressive Web App (PWA)**, installed via Safari → Share → Add to Home Screen.
- **Vite + React + TypeScript.**
- **Dexie** (IndexedDB wrapper) for local storage. Call `navigator.storage.persist()` on first run.
- **vite-plugin-pwa** for offline support (service worker, manifest, icons).
- **Recharts** for progress charts.
- **Vitest** for unit tests.
- **Hosting:** GitHub Pages, deployed by GitHub Actions on push to `main`. Free.
- Units: kg only.

Known iPhone limits (accepted):
- Rest-timer alerts while the phone is locked are unreliable → timer is designed for in-app use.
- No vibration API on iOS → timer finish uses on-screen state + sound (Web Audio).
- Local data can be lost if the app icon is deleted or iOS clears storage → weekly backup reminder + export/import.

## 3. Architecture

Units, each with one job:

| Unit | Job | Depends on |
|---|---|---|
| `engine/` | Pure functions: prescription, progression, stall detection, volume, knee guard, block/week math, break detection, rest duration, "why" text. No React, no DB. | `types` only |
| `data/library.ts` | Seed exercise library + the 4 session templates. | `types` |
| `db/` | Dexie schema, read/write helpers, export/import with schema version. | `types` |
| `state/` | Glue: loads history from `db`, calls `engine`, saves results. | `engine`, `db` |
| `ui/` | Screens and components. Reads/writes via `state` only. | `state` |

The engine is the heart. It is fully unit-tested with table-driven cases and never touches storage or UI.

## 4. Program structure

### Split: Upper/Lower ×2, sequence-based
Order rotates: **Upper A → Lower A → Upper B → Lower B → repeat.**
Next session = next in sequence, regardless of calendar. Missed days skip nothing.

- **Week** = 4 completed sessions.
- **Block** = 5 weeks = 20 sessions: weeks 1–4 build, week 5 deload.
- A check-in runs after the last deload session of each block.

### Session templates (starting point; owner can edit/swap)

Exercise types: H = heavy compound, C = other compound, I = isolation. K = knee-sensitive.

**Upper A (push-heavy)**
1. Barbell bench press — H — chest, triceps, front delt
2. Incline dumbbell press — C — upper chest, front delt
3. Lat pulldown — C — lats, biceps
4. Seated cable row — C — mid back, lats
5. Dumbbell lateral raise — I — side delt
6. Cable triceps pushdown — I — triceps

**Lower A (quads/glutes, knee-friendly)**
1. Leg press (feet mid-high on platform) — C, K — quads, glutes
2. Hip thrust — C — glutes
3. Leg extension (light) — I, K — quads
4. Seated leg curl — I — hamstrings
5. Standing calf raise — I — calves

**Upper B (pull-heavy)**
1. Chest-supported row — H — mid back, lats, rear delt
2. Assisted pull-up (or neutral-grip pulldown) — C — lats, biceps
3. Machine chest press — C — chest, triceps
4. Seated dumbbell shoulder press — C — front delt, triceps
5. Face pull — I — rear delt, upper back
6. Dumbbell curl — I — biceps

**Lower B (hinge/hamstrings, easier on knee)**
1. Romanian deadlift — H — hamstrings, glutes, lower back
2. Hip thrust — C — glutes
3. Lying leg curl — I — hamstrings
4. Hip abduction machine — I — glute med
5. Seated calf raise — I — calves

### Exercise library fields
`id, name, type (H|C|I), primaryMuscles[], secondaryMuscles[], equipment, increment (kg),
kneeSensitive (bool), alternatives[] (ids, same primary muscle), avoid (bool)`.
Seed library includes the template exercises plus at least 2 alternatives per exercise
(e.g. bench ↔ dumbbell bench ↔ machine chest press; leg press ↔ hack squat ↔ goblet box squat;
RDL ↔ 45° back extension ↔ cable pull-through).
Exercises marked `avoid` are never prescribed or offered as swaps.

## 5. Prescription & progression rules (engine)

### Rep ranges, default sets, rest
| Type | Reps | Start sets | Rest |
|---|---|---|---|
| H | 6–10 | 3 | 180 s |
| C | 8–12 | 3 | 120 s |
| I | 10–15 | 3 | 90 s |
| Any lower-body exercise (until volume ramps) | as type, but K exercises use 10–15 | 2 | as type |

+30 s rest after any set logged at RIR 0 or with a partial rep.

### Set logging
Each set: `weight, fullReps, partialReps (0+), rir (0–3+), restTakenSec, restSkipped (bool), doneOutOfOrder (bool)`.
- Only `fullReps` count toward rep targets.
- `partialReps > 0` forces effective RIR = 0.

### Calibration
First time an exercise is done, owner enters the starting weight (prompt: "weight you could do for
the top of the range with ~2 reps left"). Engine prescribes from the next exposure on.

### Next-exposure rule (per exercise, using the last valid exposure)
A set is **valid** for progression unless `restSkipped` or the exposure was `doneOutOfOrder`
and underperformed. Invalid results are logged and charted but never trigger a weight drop.

1. All working sets reached top of range with RIR ≥ 1 → **increase weight** by the exercise increment
   (defaults: barbell 2.5 kg, dumbbell 2 kg, machine/cable 1 step = 2.5 kg; all lower-body +2.5 kg).
   Reps reset to bottom of range.
2. Otherwise, all sets within range → **same weight, target +1 rep** on the lowest set.
3. Any set below bottom of range at effective RIR 0 → **hold**. If this happens on 2 consecutive
   valid exposures → **reduce weight 7.5%** (rounded to the increment).

### Weekly effort target (shown on screen, guides RIR)
Week 1: RIR 3 · Week 2: RIR 2 · Week 3: RIR 1–2 · Week 4: RIR 1 · Week 5 (deload): half sets, −10% weight, RIR 3+.
Deload results do not affect progression.

### Stall detection
No improvement (weight up, or more total full reps at the same weight) across 3 valid exposures →
suggest swap to an alternative (owner confirms; can dismiss).

### Volume (hard sets per muscle per week)
- Count = working sets where the muscle is primary (secondary counts 0.5).
- Starting targets: upper muscles ~10; leg muscles ~6.
- Legs ramp: +1 set on one lower exercise per week, only if knee pain ≤ 3 that week and owner didn't report poor recovery. Cap 20 for any muscle.
- Progress screen shows sets done vs target per muscle.

### Knee guard
After each set on a lower-body exercise, owner rates knee pain 0–10 (default = last value, one tap to confirm).
- Max pain ≤ 3 → normal rules.
- 4–5 → no weight increase on that exercise next time.
- ≥ 6 → next exposure −10% and swap to a non-knee-sensitive alternative is suggested.
- Max knee pain higher on 2 consecutive lower sessions → banner "Knee pain rising — see a physio."
- Knee pain history is charted.

### Return after a break
Days since last session: ≥ 10 → all prescribed weights −10%. ≥ 21 → −20%. Then normal progression.

### "Why" text
Every prescription carries a one-line reason, e.g. "+2.5 kg: hit 12/12/12 last time",
"Same weight: aim 9 reps on set 3", "Held: knee pain 5 last time", "−10%: back after 12 days".

## 6. Screens

1. **Home** — "Next: Upper B", week/block indicator ("Block 2 · Week 3 · aim 1–2 reps left"),
   Start button, last session summary, backup reminder banner if last backup > 7 days.
2. **Workout** — exercise cards in suggested order; tap any to do it next (marks `doneOutOfOrder`
   if not the first remaining). Card: target weight × reps × sets, "why" line, set rows
   (weight, full reps, partial reps, RIR picker), knee pain picker on lower exercises,
   Swap button (alternatives for same primary muscle, `avoid` excluded). Finish button.
3. **Rest timer** — auto-starts after each logged set; full-screen countdown; next set's log
   button locked until zero; long-press "Skip rest" records `restSkipped`. Timer stores an end
   timestamp so it stays correct after app switching; sound on finish when app is open.
4. **Progress** — per-exercise chart (top set weight and estimated 1RM over time), weekly sets per
   muscle vs target, knee pain trend.
5. **Block check-in** — after deload. Questions:
   a) Recovery: sore into the next session — rarely / sometimes / often
   b) Knee: better / same / worse
   c) Any exercises to swap? (multi-select)
   d) Motivation: high / ok / low
   App also shows its own stat: % of exercises that progressed this block.
   Adjustments for next block:
   - Recovery rarely + ≥ 60% progressed → upper targets +2 sets/muscle (cap 20).
   - Recovery often → all targets −2.
   - Knee worse → leg volume frozen, knee-sensitive exercises swapped out, physio banner.
   - Marked exercises swapped to alternatives.
   - Motivation low → swap 2 isolation exercises for variety.
   Summary of changes is shown before the new block starts.
6. **Settings** — export backup (JSON download → save to Files/iCloud Drive), import backup
   (validated, confirm before overwrite), exercise library (edit, mark avoid, add custom exercise),
   template editor (reorder/replace exercises), increments.

## 7. Data & backup

Dexie tables: `exercises`, `templates`, `sessions` (with nested exercise entries and sets),
`checkIns`, `programState` (next slot index, block number, sessions completed in block,
volume targets), `settings` (lastBackupAt, schemaVersion).

- Export: single JSON file `workout-backup-YYYY-MM-DD.json` with `schemaVersion`.
- Import: validate shape and version; refuse invalid files with a clear message; confirm before replacing data.
- Weekly reminder on Home when `lastBackupAt` is older than 7 days.

## 8. Error handling

- Storage write fails → visible error toast; in-progress workout kept in memory and retried on next action.
- In-progress workout is saved after every logged set (survives app close).
- Missing calibration weight → card asks for it instead of prescribing.
- Corrupt/unknown import → rejected, existing data untouched.

## 9. Testing

- Engine: table-driven Vitest tests for every rule in §5 (increase, hold, +1 rep, double-miss drop,
  partial = RIR 0, invalid sets ignored, stall, knee thresholds, rising-pain banner, break returns,
  deload, week/block counting, rest durations, volume counting with 0.5 secondary, check-in adjustments).
- db: export → import round-trip test.
- Manual check on iPhone: install to Home Screen, log a full session offline, close/reopen mid-workout, export and re-import.

## 10. Disclaimer

The app is not medical advice. Knee rules are conservative guards, and a physio's advice overrides them
(owner can mark exercises `avoid`).
