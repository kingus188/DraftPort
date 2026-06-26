import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { WorkspacePage } from "./WorkspacePage";
import { buildCalendar } from "./calendarGrid";
import { ScheduleContextMenu, type ScheduleMenu } from "./ScheduleContextMenu";
import { useFileStore } from "../../store/fileStore";
import { useFileSystem } from "../../hooks/useFileSystem";
import { useScheduleStore } from "../../store/scheduleStore";
import {
  type PublishStatus,
  type ScheduleEntry,
} from "../../store/scheduleTypes";
import type { FileItem } from "../../store/fileTypes";
import "./WorkspaceViews.css";

const STATUS_LABEL: Record<PublishStatus, string> = {
  draft: "草稿",
  scheduled: "待发",
  published: "已发",
  archived: "归档",
};

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function baseName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

/** Minimal FileItem so the editor can open a draft from a schedule entry. */
function toFileItem(entry: ScheduleEntry): FileItem {
  return {
    name: baseName(entry.docPath),
    path: entry.docPath,
    title: entry.title,
    createdAt: new Date(),
    updatedAt: new Date(),
    size: 0,
  };
}

/**
 * Publish-schedule calendar. Scheduled drafts sit on their planned day; every
 * action lives in a right-click menu — on a day cell to schedule the open
 * draft there, on an entry to open it, change its status, or remove it.
 */
export function SchedulePage() {
  const workspacePath = useFileStore((state) => state.workspacePath);
  const currentFile = useFileStore((state) => state.currentFile);
  const entries = useScheduleStore((state) => state.entries);
  const load = useScheduleStore((state) => state.load);
  const upsert = useScheduleStore((state) => state.upsert);
  const remove = useScheduleStore((state) => state.remove);
  const { openFile } = useFileSystem();
  const navigate = useNavigate();

  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));
  const [menu, setMenu] = useState<ScheduleMenu | null>(null);

  useEffect(() => {
    if (workspacePath) void load(workspacePath);
  }, [workspacePath, load]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>();
    for (const entry of Object.values(entries)) {
      if (!entry.scheduledAt) continue;
      const list = map.get(entry.scheduledAt) ?? [];
      list.push(entry);
      map.set(entry.scheduledAt, list);
    }
    return map;
  }, [entries]);

  const cells = useMemo(
    () => buildCalendar(month.year, month.month, today),
    [month, today],
  );

  const shiftMonth = (delta: number) =>
    setMonth(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  const openDraft = async (entry: ScheduleEntry) => {
    setMenu(null);
    await openFile(toFileItem(entry));
    navigate("/");
  };

  const openEntryMenu = (e: MouseEvent, entry: ScheduleEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ kind: "entry", entry, x: e.clientX, y: e.clientY });
  };

  const openDayMenu = (e: MouseEvent, dayKey: string) => {
    e.preventDefault();
    setMenu({ kind: "day", dayKey, x: e.clientX, y: e.clientY });
  };

  return (
    <WorkspacePage title="发布排期">
      <div className="calendar">
        <div className="calendar__nav">
          <button aria-label="上个月" onClick={() => shiftMonth(-1)}>
            <ChevronLeft size={16} />
          </button>
          <span className="calendar__label">
            {month.year} 年 {month.month + 1} 月
          </span>
          <button aria-label="下个月" onClick={() => shiftMonth(1)}>
            <ChevronRight size={16} />
          </button>
          <button
            className="calendar__today"
            onClick={() =>
              setMonth({ year: today.getFullYear(), month: today.getMonth() })
            }
          >
            今天
          </button>
        </div>

        <div className="calendar__grid">
          {WEEKDAYS.map((label) => (
            <div className="calendar__weekday" key={label}>
              {label}
            </div>
          ))}
          {cells.map((cell) => (
            <div
              className={`calendar__cell ${cell.inMonth ? "" : "is-outside"} ${
                cell.isToday ? "is-today" : ""
              }`}
              key={cell.key}
              onContextMenu={(e) => openDayMenu(e, cell.key)}
            >
              <span className="calendar__day">{cell.day}</span>
              <div className="calendar__chips">
                {(entriesByDate.get(cell.key) ?? []).map((entry) => (
                  <button
                    key={entry.docPath}
                    className={`calendar__chip status-${entry.status}`}
                    title={`${entry.title || baseName(entry.docPath)} · ${STATUS_LABEL[entry.status]}`}
                    onClick={() => void openDraft(entry)}
                    onContextMenu={(e) => openEntryMenu(e, entry)}
                  >
                    {entry.title || baseName(entry.docPath)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="calendar__hint">
          右键日期把当前草稿排上去,右键条目可改状态或移除。
        </p>
      </div>

      {menu && (
        <ScheduleContextMenu
          menu={menu}
          currentTitle={
            currentFile ? currentFile.title || currentFile.name : undefined
          }
          onClose={() => setMenu(null)}
          onOpen={(entry) => void openDraft(entry)}
          onSetStatus={(entry, status) => {
            void upsert(entry.docPath, { status });
            setMenu(null);
          }}
          onRemove={(entry) => {
            void remove(entry.docPath);
            setMenu(null);
          }}
          onScheduleCurrent={(dayKey) => {
            if (currentFile) {
              void upsert(currentFile.path, {
                status: "scheduled",
                scheduledAt: dayKey,
                title: currentFile.title || currentFile.name,
              });
            }
            setMenu(null);
          }}
        />
      )}
    </WorkspacePage>
  );
}
