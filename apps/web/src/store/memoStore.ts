import { create } from "zustand";
import { readWorkspaceJson, writeWorkspaceJson } from "./workspaceJsonStore";
import { parseTags, type Memo } from "./memoTypes";

const MEMO_FILE = ".wemd-memos.json";

function newId(): string {
  return typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Keep only well-formed memos when loading a possibly hand-edited sidecar. */
function sanitize(raw: unknown): Memo[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is Memo =>
        !!item &&
        typeof item === "object" &&
        typeof (item as Memo).id === "string" &&
        typeof (item as Memo).content === "string",
    )
    .map((item) => ({
      id: item.id,
      content: item.content,
      tags: Array.isArray(item.tags) ? item.tags : parseTags(item.content),
      createdAt:
        typeof item.createdAt === "string"
          ? item.createdAt
          : new Date().toISOString(),
    }));
}

interface MemoStore {
  workspacePath: string | null;
  memos: Memo[];
  load: (workspacePath: string) => Promise<void>;
  add: (content: string) => Promise<void>;
  update: (id: string, content: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useMemoStore = create<MemoStore>((set, get) => ({
  workspacePath: null,
  memos: [],

  load: async (workspacePath) => {
    const raw = await readWorkspaceJson<unknown>(workspacePath, MEMO_FILE, []);
    set({ workspacePath, memos: sanitize(raw) });
  },

  add: async (content) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const { workspacePath, memos } = get();
    const memo: Memo = {
      id: newId(),
      content: trimmed,
      tags: parseTags(trimmed),
      createdAt: new Date().toISOString(),
    };
    const updated = [memo, ...memos];
    set({ memos: updated });
    if (workspacePath)
      await writeWorkspaceJson(workspacePath, MEMO_FILE, updated);
  },

  update: async (id, content) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const { workspacePath, memos } = get();
    const updated = memos.map((memo) =>
      memo.id === id
        ? { ...memo, content: trimmed, tags: parseTags(trimmed) }
        : memo,
    );
    set({ memos: updated });
    if (workspacePath)
      await writeWorkspaceJson(workspacePath, MEMO_FILE, updated);
  },

  remove: async (id) => {
    const { workspacePath, memos } = get();
    const updated = memos.filter((memo) => memo.id !== id);
    set({ memos: updated });
    if (workspacePath)
      await writeWorkspaceJson(workspacePath, MEMO_FILE, updated);
  },
}));
