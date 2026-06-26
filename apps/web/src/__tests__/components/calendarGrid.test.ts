import { describe, expect, it } from "vitest";
import {
  buildCalendar,
  toDateKey,
} from "../../components/WorkspaceViews/calendarGrid";

describe("toDateKey", () => {
  it("formats in local time, padding month and day", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("buildCalendar", () => {
  it("returns a stable 42-cell grid starting on Monday", () => {
    const cells = buildCalendar(2026, 5); // June 2026
    expect(cells).toHaveLength(42);
    // 2026-06-01 is a Monday, so the first cell is the 1st, in-month.
    expect(cells[0].key).toBe("2026-06-01");
    expect(cells[0].inMonth).toBe(true);
    // The last in-month day is the 30th; trailing cells spill into July.
    expect(cells[29].key).toBe("2026-06-30");
    expect(cells[30].inMonth).toBe(false);
  });

  it("pads leading days from the previous month", () => {
    const cells = buildCalendar(2026, 6); // July 2026, 1st is a Wednesday
    expect(cells[0].inMonth).toBe(false);
    expect(cells.find((c) => c.key === "2026-07-01")?.inMonth).toBe(true);
  });

  it("marks today", () => {
    const cells = buildCalendar(2026, 5, new Date(2026, 5, 15));
    expect(cells.find((c) => c.isToday)?.key).toBe("2026-06-15");
  });
});
