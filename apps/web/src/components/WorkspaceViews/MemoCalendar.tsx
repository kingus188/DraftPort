import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildCalendar, toDateKey } from "./calendarGrid";
import type { Memo } from "../../store/memoTypes";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

interface MemoCalendarProps {
  memos: Memo[];
  /** Currently filtered day (local `yyyy-mm-dd`), or null for no filter. */
  selectedDate: string | null;
  onSelectDate: (dateKey: string | null) => void;
}

/** Compact month calendar marking days that have memos; click a day to filter. */
export function MemoCalendar({
  memos,
  selectedDate,
  onSelectDate,
}: MemoCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));

  const activity = useMemo(() => {
    const set = new Set<string>();
    for (const memo of memos) set.add(toDateKey(new Date(memo.createdAt)));
    return set;
  }, [memos]);

  const cells = useMemo(
    () => buildCalendar(month.year, month.month, today, 0),
    [month, today],
  );

  const shiftMonth = (delta: number) =>
    setMonth(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  return (
    <div className="memo-cal">
      <div className="memo-cal__nav">
        <span className="memo-cal__label">
          {month.year} 年 {month.month + 1} 月
        </span>
        <div className="memo-cal__arrows">
          <button aria-label="上个月" onClick={() => shiftMonth(-1)}>
            <ChevronLeft size={14} />
          </button>
          <button aria-label="下个月" onClick={() => shiftMonth(1)}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="memo-cal__grid">
        {WEEKDAYS.map((label) => (
          <span className="memo-cal__weekday" key={label}>
            {label}
          </span>
        ))}
        {cells.map((cell) => {
          const hasMemos = activity.has(cell.key);
          const classes = [
            "memo-cal__day",
            cell.inMonth ? "" : "is-outside",
            cell.isToday ? "is-today" : "",
            selectedDate === cell.key ? "is-selected" : "",
            hasMemos ? "has-memos" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={cell.key}
              className={classes}
              onClick={() =>
                onSelectDate(selectedDate === cell.key ? null : cell.key)
              }
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
