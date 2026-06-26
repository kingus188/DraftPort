/**
 * Pure month-grid helpers for the schedule calendar. Dates are keyed in local
 * time to match the `yyyy-mm-dd` strings a native date input produces, so an
 * entry never lands on the wrong day across a UTC offset.
 */
export interface CalendarCell {
  date: Date;
  /** Local `yyyy-mm-dd` used to match schedule entries. */
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
}

/** Formats a date as local `yyyy-mm-dd` (not UTC). */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Builds a stable 6-row grid (42 cells) for the given month, padded with the
 * trailing/leading days of the neighbouring months. `weekStartsOn` is 1 for
 * Monday (default) or 0 for Sunday.
 */
export function buildCalendar(
  year: number,
  month: number,
  today: Date = new Date(),
  weekStartsOn: 0 | 1 = 1,
): CalendarCell[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() - weekStartsOn + 7) % 7;
  const todayKey = toDateKey(today);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(year, month, 1 - startOffset + i);
    cells.push({
      date,
      key: toDateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: toDateKey(date) === todayKey,
    });
  }
  return cells;
}
