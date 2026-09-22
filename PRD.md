# Countdown Timer Platform — PRD

Version: 1.0
Status: MVP spec
Stack: Next.js (App Router) + TypeScript + Tailwind CSS
Storage (MVP): Browser localStorage
Storage (post-MVP): Hosted database (TBD — Supabase or similar)

---

## 1. Overview

A web platform for running timed programs (services, events, shows) where each program is a named schedule of items, each item has a start time and a duration, and a live countdown drives the run. Inspired by Planning Center's timer feature, but scoped to only the schedule and timer.

Multiple programs can exist independently. Each program has its own stable link. Each program can be opened in two views: a Control view for running and editing, and a Live view for fullscreen projection.

---

## 2. Goals

- Let a user define one or more programs, each with its own schedule.
- Let a user run a program with a live countdown per item.
- Show accurate current time for a selected fixed GMT offset.
- Make it obvious when an item has run out of time (red state) and offer a one-click restart.
- Make it easy to add time to an item while running, and have that time cascade to later items (extending the overall program).
- Provide a fullscreen live view showing the current item with previous and next items as context.
- Keep the MVP local-first. No accounts, no server, no auth. Move to a hosted DB only after the local product is validated.

## 3. Non-Goals (for this version)

- User accounts, login, teams, permissions.
- Real-time sync across devices (deferred until DB migration).
- Named timezones with DST (using fixed GMT offsets only).
- Notifications, emails, integrations.
- Analytics, reporting, history.
- Mobile apps (web only, but should be responsive enough to control from a phone on the same device).

---

## 4. Terminology

- Program — a named schedule. Has a timezone offset and a list of items. Identified by a stable ID. Has its own links.
- Item — a single entry in a program. Has a name, an original start time, an original duration, and an accumulated addedMin (extra minutes added at runtime).
- Effective schedule — the computed version of the program's items after applying all addedMin cascades. What the user actually sees and runs.
- Control view — the main page for a program (/p/[id]). Edit schedule, pick current item, run timer, add time, restart.
- Live view — the fullscreen projection page (/p/[id]/live). Big countdown, previous/current/next items, clock.
- Timezone offset — a fixed GMT offset (e.g. GMT, GMT+1, GMT-3, up to GMT+14 and down to GMT-12).

---

## 5. Functional Requirements

### 5.1 Program management

- FR-1 The user can create a program from the home page. A program requires a name and a timezone offset. A unique ID is generated.
- FR-2 The home page lists all programs saved on this browser, showing name, timezone offset, and item count.
- FR-3 Each program in the list exposes: Control link, Live link, and Delete.
- FR-4 Programs persist across page reloads and browser restarts (localStorage).
- FR-5 A program's ID is stable. The same program always uses the same Control and Live links. Users can bookmark and reuse them.
- FR-6 The user can delete a program from the home page. Deletion is immediate.

### 5.2 Schedule editing

- FR-7 Within a program, the user can add items. Each item has: name (string), original start time (HH:MM, 24-hour), original duration in minutes (positive integer), addedMin (runtime accumulator, starts at 0).
- FR-8 The user can edit any item's name, start time, and duration at any time.
- FR-9 The user can delete any item.
- FR-10 When a new item is added, its default start time is the effective end time of the previous item (accounting for accumulated addedMin). If there is no previous item, default to 09:00.
- FR-11 The schedule editor shows, for each item: original start time and duration (editable), effective start and end times (read-only, computed), effective duration (original + added), any accumulated added minutes with a reset action, inline controls to add +1 min, +5 min, or a custom number of minutes to that item.

### 5.3 Timezone and clock

- FR-12 Each program has a fixed GMT offset selected from a dropdown, ranging from GMT-12 to GMT+14 in whole hours.
- FR-13 A live clock is displayed on the Control view and the Live view, showing HH:MM:SS in the selected offset plus the offset label (e.g. GMT+1).
- FR-14 The clock ticks independently of the timer and is always accurate for the selected offset.

### 5.4 Running a program

- FR-15 A dropdown on the Control view lets the user pick the current item. Selecting an item starts its countdown immediately, using its effective duration.
- FR-16 The user can also start any item from the schedule editor via a play button.
- FR-17 Starting an item always begins from the beginning of its effective duration. Countdown does not depend on wall-clock time.
- FR-18 The timer shows remaining time as MM:SS or HH:MM:SS (when over an hour). It counts down in real time.
- FR-19 The user can pause and resume the running timer.
- FR-20 The user can stop the timer entirely, clearing the current item.

### 5.5 Overtime (item finished)

- FR-21 When a running item's countdown reaches zero, it enters the overtime state: the timer panel background turns red, a prompt appears saying "Time is up. Restart this item?", and a Restart button appears that restarts the item from its full effective duration (original + added).
- FR-22 Overtime continues counting (negative), so the user can see how far over they are.
- FR-23 Restart always uses the item's effective duration (original + added minutes).

### 5.6 Schedule awareness (past-by-clock)

- FR-24 In the schedule editor, items whose effective end time has already passed according to the program's timezone clock are highlighted with a red border.
- FR-25 The current item, when running, is highlighted distinctly (indigo) and takes precedence over the past-by-clock styling.

### 5.7 Adding time (with cascade)

- FR-26 The user can add time to any item, either to the currently running item (via the timer panel buttons), or to any item in the schedule editor (via inline controls).
- FR-27 Adding N minutes to an item increases that item's addedMin by N, increases the item's effective duration by N, shifts every subsequent item later by N minutes, and extends the overall program's end time by N minutes.
- FR-28 If the item being extended is currently running, the live countdown extends by N minutes immediately.
- FR-29 The user can reset an item's added minutes to zero. Doing so pulls subsequent items and the program end time back accordingly.
- FR-30 Negative additions (subtractions) are supported via the custom input. They reduce addedMin and pull the schedule earlier.
- FR-31 The Control view displays program-level summary values: item count, total program length, and program end time. All are computed from the effective schedule.

### 5.8 Cascade computation rules

- FR-32 An item's effective start = original start + sum of addedMin of all items before it.
- FR-33 An item's effective duration = original duration + its own addedMin.
- FR-34 An item's effective end = effective start + effective duration.
- FR-35 The program's end time = the last item's effective end.
- FR-36 The program's total length = last item's effective end minus first item's effective start.

### 5.9 Live view

- FR-37 Each program has a dedicated Live view at /p/[id]/live, separate from the Control view.
- FR-38 The Live view is designed for fullscreen projection. It shows: the program name, a live clock in the program's timezone, the previous item's name (small, above), the current item's name (medium), the remaining time (very large, the dominant element), the next item's name (small, below), the timezone label at the bottom.
- FR-39 When the current item is in overtime, the entire Live view background turns red and a message says "Time is up — restart from the control screen."
- FR-40 The Live view reflects the Control view's running state in real time on the same browser. It reads the running state from a shared local channel and recomputes remaining time locally so both views stay smooth.
- FR-41 The Live view uses effective times for the past-by-clock detection at the bottom of the screen.

### 5.10 Restart behavior

- FR-42 Restarting an item (from the timer panel or from the overtime prompt) always restarts from the item's full effective duration (original + added).
- FR-43 Restart does not clear addedMin. Added minutes persist until the user resets them explicitly.

---

## 6. Data Model

### 6.1 Program

- id: string — Short random ID. Stable. Determines links.
- name: string — Display name.
- tzOffset: number — Fixed GMT offset in hours (-12..+14).
- items: ProgramItem[] — Ordered list.
- createdAt: number — Epoch ms.

### 6.2 ProgramItem

- id: string — Short random ID.
- name: string — Item name.
- startTime: string — "HH:MM" 24h. Original planned start.
- durationMin: number — Original planned duration in minutes.
- addedMin: number — Runtime accumulator. Starts at 0.

### 6.3 EffectiveItem (computed, not stored)

- All ProgramItem fields, plus:
- effectiveStartMin: number — Minutes since midnight in program tz.
- effectiveDurationMin: number — durationMin + addedMin.
- endsAtMin: number — effectiveStartMin + effectiveDurationMin.

### 6.4 Live state (transient, per-browser)

- itemIndex: number | null — Index of running item.
- remainingSec: number — Seconds remaining (can go negative).
- running: boolean — Whether the countdown is ticking.
- updatedAt: number — Epoch ms of last publish.

---

## 7. Persistence

- FR-44 Programs are stored in localStorage under a versioned key (timer_programs_v1).
- FR-45 On load, stored programs are normalized to the current schema (missing addedMin defaults to 0, etc.) so older saves don't break.
- FR-46 Live state is stored per program under timer_live_<programId> and is written by the Control view on every timer tick. The Live view reads it via polling (short interval) and storage events.
- FR-47 When the product moves to a hosted DB, lib/storage.ts and the live channel are the only modules that change. Nothing else in the app should need to know about storage.

---

## 8. User Flows

### 8.1 Create a program

1. Open /.
2. Enter a name, pick a timezone offset, click Create.
3. Program appears in the list with Control and Live links.

### 8.2 Build a schedule

1. Open the program's Control link.
2. Click Add item repeatedly.
3. Set each item's start time, name, and duration.
4. Effective times populate automatically. Program length and end time update in the summary.

### 8.3 Run a program

1. Open the Control link. Confirm the clock shows the right timezone.
2. From the dropdown, pick the current item. It starts counting down.
3. Optional: open the Live link on the projection screen.
4. When an item finishes, the timer goes red. Click Restart, or pick the next item from the dropdown.
5. Need more time? Click +1, +5, or +custom on the running item. Later items shift, program ends later.

### 8.4 Reuse a program

1. From /, open the saved program's Control or Live link.
2. Everything is where it was left. addedMin persists until reset.

### 8.5 Reset an item's adds

1. In the schedule editor, find the item with +Nm added.
2. Click reset next to it. The item's adds clear and subsequent items pull back.

---

## 9. UI Requirements

### 9.1 Home page (/)

- Dark theme, centered layout.
- Section to create a program: name input, offset dropdown, Create button.
- List of saved programs. Each row shows name, offset, item count, and Control / Live / Delete actions.
- Empty state message when there are no programs.

### 9.2 Control view (/p/[id])

- Header: program name, live clock, Open Live link.
- Program summary: item count, program length, end time, timezone.
- Timer panel: large countdown. Background indigo normally, red on overtime. Current item name above the countdown. Buttons: Pause/Resume, Restart item, +1 min, +5 min, + custom, Stop.
- Overtime prompt inside the timer panel with a Restart button.
- Item picker: dropdown of all items showing effective start time, name, effective duration, and any added minutes.
- Schedule editor: one row per item with start time, name, duration inputs; play and delete buttons; effective time summary line; added-minutes badge with reset; +1m / +5m / +custom inline controls.
- Timezone selector at the bottom of the schedule editor.

### 9.3 Live view (/p/[id]/live)

- Full-screen dark background (red when overtime).
- Top bar: program name (left), live clock (right).
- Center stack (top to bottom): previous item name (small, muted, uppercase), current item name (medium), countdown (very large, monospaced, tabular numerals, the dominant element), overtime message when applicable, next item name (small, muted, uppercase).
- Bottom bar: timezone label, plus "item past its scheduled time" note when applicable.

### 9.4 Visual language

- Dark background (neutral-950), light text.
- Indigo as the primary accent for the timer in normal state.
- Red (red-600 / red-700) for overtime and past-by-clock items.
- Amber for added minutes indicators.
- Monospaced tabular numerals for all clocks and countdowns so digits don't jump.

---

## 10. Technical Constraints

- FR-48 Next.js App Router with TypeScript.
- FR-49 Tailwind CSS for styling.
- FR-50 No authentication, no backend, no external services in the MVP.
- FR-51 All state derives from localStorage on load. The app must render correctly with zero programs and with malformed legacy data (normalize or ignore).
- FR-52 The Control and Live views must stay in sync on the same browser without a page refresh, even when one is on a separate monitor or window.
- FR-53 Timer accuracy: countdown ticks at ~250 ms and computes remaining from a wall-clock end time, so it does not drift even if the interval is throttled.
- FR-54 Time formatting: use tabular numerals and monospace to prevent layout jitter.

---

## 11. Deferred / Future Work

- DB migration — replace lib/storage.ts and the live channel with a hosted DB so programs and running state work across devices.
- Real-time cross-device control — control the timer from a phone while the Live view runs on a laptop/projector.
- Shareable public live links — Live view readable by anyone without local storage.
- Named timezones with DST — replace fixed offsets with Intl timezone identifiers.
- Multiple programs running simultaneously on one screen — a wall of live timers.
- Undo/redo for schedule edits.
- Import/export a program as JSON for backup and transfer.
- Audio/visual cues — chime, flashing, countdown-to-zero alert.
- Template programs — clone a program as a starting point.
- Print/PDF of the schedule.

---

## 12. Acceptance Criteria (MVP)

1. I can create multiple named programs, each with its own Control and Live link, and open either independently.
2. I can add, edit, and delete items in a program. Each item has a name, start time, and duration.
3. Each program remembers its timezone offset, and the live clock always shows the correct time for that offset.
4. Starting an item begins a countdown from its effective duration, independent of wall clock.
5. When the countdown reaches zero, the panel turns red and a Restart button appears. Restart uses the item's effective duration.
6. Items whose effective end time has already passed (per the program clock) are marked red in the schedule editor.
7. Adding N minutes to an item extends its effective duration by N, shifts all subsequent items later by N, and pushes the program's end time later by N. The running countdown (if it's the active item) extends by N immediately.
8. I can reset an item's added minutes, and the schedule and program end time pull back accordingly.
9. The Live view shows the program name, a live clock, previous/current/next items, and a large countdown that mirrors the Control view's running state on the same browser.
10. The Live view goes red in overtime with the restart-from-control-screen message.
11. Everything survives a page refresh.
12. The app runs with npm run dev on a fresh clone with only Next.js, TypeScript, and Tailwind installed.
