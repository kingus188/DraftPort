import { create } from "zustand";
import type {
  DocumentVersion,
  VersionContent,
  VersionKind,
  VersionRepository,
} from "./versionTypes";
import { isSameVersionContent } from "./versionPolicy";
import { DiskVersionRepository } from "./diskVersionRepository";

/** How many automatic versions to keep per document; milestones are unbounded. */
const KEEP_AUTO_VERSIONS = 50;

let repository: VersionRepository | null = null;

/** Override the backing repository (used by tests; bootstrap can also set it). */
export function setVersionRepository(next: VersionRepository | null): void {
  repository = next;
}

function getRepository(): VersionRepository | null {
  if (repository) return repository;
  const fs = window.desktop?.fs;
  if (!fs) return null;
  repository = new DiskVersionRepository(fs);
  return repository;
}

function createVersion(input: {
  docKey: string;
  content: VersionContent;
  kind: VersionKind;
  label?: string;
}): DocumentVersion {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    ...input.content,
    id,
    docKey: input.docKey,
    kind: input.kind,
    label: input.label,
    createdAt: new Date().toISOString(),
  };
}

interface CutInput {
  docKey: string;
  content: VersionContent;
  kind: VersionKind;
  label?: string;
}

interface VersionStore {
  /** Versions of the document currently loaded into the timeline. */
  versions: DocumentVersion[];
  docKey: string | null;
  load: (docKey: string) => Promise<void>;
  cut: (input: CutInput) => Promise<DocumentVersion | null>;
  remove: (id: string) => Promise<void>;
}

export const useVersionStore = create<VersionStore>((set, get) => ({
  versions: [],
  docKey: null,

  load: async (docKey) => {
    const repo = getRepository();
    const versions = repo ? await repo.list(docKey) : [];
    set({ docKey, versions });
  },

  cut: async (input) => {
    const repo = getRepository();
    if (!repo) return null;

    const known =
      get().docKey === input.docKey
        ? get().versions
        : await repo.list(input.docKey);

    // Skip a redundant auto-cut when nothing changed; milestones always record.
    if (
      input.kind === "auto" &&
      isSameVersionContent(known[0], input.content)
    ) {
      return null;
    }

    const version = createVersion(input);
    await repo.append(version);
    await repo.prune(input.docKey, KEEP_AUTO_VERSIONS);
    const versions = await repo.list(input.docKey);
    set({ docKey: input.docKey, versions });
    return version;
  },

  remove: async (id) => {
    const repo = getRepository();
    const docKey = get().docKey;
    if (!repo || !docKey) return;
    await repo.remove(docKey, id);
    set({ versions: get().versions.filter((version) => version.id !== id) });
  },
}));
