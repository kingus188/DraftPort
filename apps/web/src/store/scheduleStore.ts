import { create } from "zustand";
import { readWorkspaceJson, writeWorkspaceJson } from "./workspaceJsonStore";
import {
  PUBLISH_STATUSES,
  type PublishStatus,
  type ScheduleEntry,
  type ScheduleMap,
} from "./scheduleTypes";

const SCHEDULE_FILE = ".wemd-schedule.json";

/** Keep only well-formed entries when loading a possibly hand-edited sidecar. */
function sanitize(raw: unknown): ScheduleMap {
  if (!raw || typeof raw !== "object") return {};
  const result: ScheduleMap = {};
  for (const [docPath, value] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    if (!value || typeof value !== "object") continue;
    const entry = value as Partial<ScheduleEntry>;
    if (!PUBLISH_STATUSES.includes(entry.status as PublishStatus)) continue;
    result[docPath] = {
      docPath,
      title: typeof entry.title === "string" ? entry.title : undefined,
      status: entry.status as PublishStatus,
      scheduledAt:
        typeof entry.scheduledAt === "string" ? entry.scheduledAt : undefined,
      updatedAt:
        typeof entry.updatedAt === "string"
          ? entry.updatedAt
          : new Date().toISOString(),
    };
  }
  return result;
}

interface ScheduleStore {
  workspacePath: string | null;
  entries: ScheduleMap;
  load: (workspacePath: string) => Promise<void>;
  upsert: (
    docPath: string,
    patch: { status?: PublishStatus; scheduledAt?: string; title?: string },
  ) => Promise<void>;
  remove: (docPath: string) => Promise<void>;
}

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  workspacePath: null,
  entries: {},

  load: async (workspacePath) => {
    const raw = await readWorkspaceJson<unknown>(
      workspacePath,
      SCHEDULE_FILE,
      {},
    );
    set({ workspacePath, entries: sanitize(raw) });
  },

  upsert: async (docPath, patch) => {
    const { workspacePath, entries } = get();
    const previous = entries[docPath];
    const next: ScheduleEntry = {
      docPath,
      title: patch.title ?? previous?.title,
      status: patch.status ?? previous?.status ?? "draft",
      scheduledAt:
        "scheduledAt" in patch ? patch.scheduledAt : previous?.scheduledAt,
      updatedAt: new Date().toISOString(),
    };
    const updated = { ...entries, [docPath]: next };
    set({ entries: updated });
    if (workspacePath)
      await writeWorkspaceJson(workspacePath, SCHEDULE_FILE, updated);
  },

  remove: async (docPath) => {
    const { workspacePath, entries } = get();
    const updated = { ...entries };
    delete updated[docPath];
    set({ entries: updated });
    if (workspacePath)
      await writeWorkspaceJson(workspacePath, SCHEDULE_FILE, updated);
  },
}));
