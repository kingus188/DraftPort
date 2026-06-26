import { useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarPlus,
  ChevronRight,
  FileText,
  Tag,
  Trash2,
} from "lucide-react";
import {
  PUBLISH_STATUSES,
  type PublishStatus,
  type ScheduleEntry,
} from "../../store/scheduleTypes";

const STATUS_LABEL: Record<PublishStatus, string> = {
  draft: "草稿",
  scheduled: "待发",
  published: "已发",
  archived: "归档",
};

/** What the user right-clicked: a scheduled entry, or an empty day cell. */
export type ScheduleMenu =
  | { kind: "entry"; entry: ScheduleEntry; x: number; y: number }
  | { kind: "day"; dayKey: string; x: number; y: number };

interface ScheduleContextMenuProps {
  menu: ScheduleMenu;
  /** Title of the draft currently open, schedulable onto a day. */
  currentTitle?: string;
  onClose: () => void;
  onOpen: (entry: ScheduleEntry) => void;
  onSetStatus: (entry: ScheduleEntry, status: PublishStatus) => void;
  onRemove: (entry: ScheduleEntry) => void;
  onScheduleCurrent: (dayKey: string) => void;
}

/** Right-click menu for the schedule calendar; reuses the file menu styling. */
export function ScheduleContextMenu({
  menu,
  currentTitle,
  onClose,
  onOpen,
  onSetStatus,
  onRemove,
  onScheduleCurrent,
}: ScheduleContextMenuProps) {
  const [showStatus, setShowStatus] = useState(false);

  return createPortal(
    <div className="fs-context-menu-overlay" onClick={onClose}>
      <div
        className="fs-context-menu"
        style={{ top: menu.y, left: menu.x }}
        onClick={(e) => e.stopPropagation()}
      >
        {menu.kind === "entry" ? (
          <>
            <button onClick={() => onOpen(menu.entry)}>
              <FileText size={14} /> 打开草稿
            </button>
            <button
              className="has-submenu"
              onClick={() => setShowStatus((v) => !v)}
            >
              <Tag size={14} /> 设为状态
              <ChevronRight size={12} className="submenu-arrow" />
            </button>
            {showStatus && (
              <div className="fs-submenu">
                {PUBLISH_STATUSES.map((status) => (
                  <button
                    key={status}
                    onClick={() => onSetStatus(menu.entry, status)}
                  >
                    {STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
            )}
            <button className="danger" onClick={() => onRemove(menu.entry)}>
              <Trash2 size={14} /> 移除排期
            </button>
          </>
        ) : currentTitle ? (
          <button onClick={() => onScheduleCurrent(menu.dayKey)}>
            <CalendarPlus size={14} /> 排入当前草稿「{currentTitle}」
          </button>
        ) : (
          <button disabled>先打开一篇草稿再排期</button>
        )}
      </div>
    </div>,
    document.body,
  );
}
