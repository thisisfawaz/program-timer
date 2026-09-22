export interface ProgramItem {
  id: string;
  name: string;
  /** "HH:MM" 24h. Original planned start. */
  startTime: string;
  /** Original planned duration in minutes. */
  durationMin: number;
  /** Runtime accumulator. Starts at 0. */
  addedMin: number;
}

export type Recurrence = "none" | "daily" | "weekly" | "biweekly" | "monthly";

export interface Program {
  id: string;
  name: string;
  /** Fixed GMT offset in hours (-12..+14). */
  tzOffset: number;
  items: ProgramItem[];
  /** Epoch ms. */
  createdAt: number;
  /** Anchor date YYYY-MM-DD (in the program's offset). */
  anchorDate?: string;
  /** Anchor time HH:MM (in the program's offset). */
  anchorTime?: string;
  /** Recurrence of this program. */
  recurrence?: Recurrence;
}

export interface EffectiveItem extends ProgramItem {
  /** Minutes since midnight in program tz. */
  effectiveStartMin: number;
  /** durationMin + addedMin */
  effectiveDurationMin: number;
  /** effectiveStartMin + effectiveDurationMin */
  endsAtMin: number;
}

export interface LiveState {
  /** Index of running item, or null. */
  itemIndex: number | null;
  /** Seconds remaining (can go negative). */
  remainingSec: number;
  /** Whether the countdown is ticking. */
  running: boolean;
  /** Epoch ms of last publish. */
  updatedAt: number;
}
