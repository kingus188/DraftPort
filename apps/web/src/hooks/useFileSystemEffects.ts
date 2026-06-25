import { useEffect, useRef } from "react";
import { useFileStore } from "../store/fileStore";
import { useThemeStore } from "../store/themeStore";
import {
  applyMarkdownFileMeta,
  stripMarkdownExtension,
} from "../utils/markdownFileMeta";
import {
  WORKSPACE_KEY,
  type DesktopAPI,
  type RecentItemRecord,
} from "./useFileSystemHelpers";
import {
  createAutosaveScheduler,
  type AutosaveScheduler,
} from "./autosaveScheduler";

interface UseFileSystemEffectsParams {
  enabled: boolean;
  desktop: DesktopAPI | null;
  currentFile: ReturnType<typeof useFileStore.getState>["currentFile"];
  markdown: string;
  theme: string;
  themeName: string;
  isRestoring: boolean;
  isDirty: boolean;
  lastSavedContent: string;
  loadWorkspace: (path: string) => Promise<void>;
  refreshFiles: (dir?: string) => Promise<unknown>;
  openFile: (
    file: NonNullable<ReturnType<typeof useFileStore.getState>["currentFile"]>,
  ) => Promise<void>;
  createFile: (folderPath?: string) => Promise<void>;
  saveFile: (showToast?: boolean) => Promise<void>;
  selectWorkspace: () => Promise<void>;
  setIsDirty: ReturnType<typeof useFileStore.getState>["setIsDirty"];
}

const getBrowserStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage as Partial<Storage> | null;
    if (!storage) return null;
    if (typeof storage.getItem !== "function") return null;
    if (typeof storage.setItem !== "function") return null;
    if (typeof storage.removeItem !== "function") return null;
    return storage as Storage;
  } catch {
    return null;
  }
};

const RECENT_FOLDER_EVENT = "draftport:open-recent-folder";

function getBaseName(rawPath: string) {
  const last = Math.max(rawPath.lastIndexOf("/"), rawPath.lastIndexOf("\\"));
  return last >= 0 ? rawPath.slice(last + 1) : rawPath;
}

function toFileItem(item: RecentItemRecord) {
  const updatedAt = item.mtime ? new Date(item.mtime) : new Date();
  return {
    name: getBaseName(item.itemPath),
    path: item.itemPath,
    createdAt: updatedAt,
    updatedAt,
    size: item.size ?? 0,
    title: item.title ?? undefined,
    themeName: item.themeName ?? undefined,
    isDirectory: false as const,
  };
}

export function useFileSystemEffects({
  enabled,
  desktop,
  currentFile,
  markdown,
  theme,
  themeName,
  isRestoring,
  isDirty,
  lastSavedContent,
  loadWorkspace,
  refreshFiles,
  openFile,
  createFile,
  saveFile,
  selectWorkspace,
  setIsDirty,
}: UseFileSystemEffectsParams) {
  const createFileRef = useRef(createFile);
  const saveFileRef = useRef(saveFile);
  const selectWorkspaceRef = useRef(selectWorkspace);
  const openFileRef = useRef(openFile);
  const loadWorkspaceRef = useRef(loadWorkspace);

  // One scheduler for the document's lifetime; onSave reads the latest store
  // state so it never writes a stale file or fights the restore guard.
  const schedulerRef = useRef<AutosaveScheduler | null>(null);
  if (schedulerRef.current === null) {
    schedulerRef.current = createAutosaveScheduler({
      onSave: () => {
        const { isDirty: dirty, isRestoring: restoring } =
          useFileStore.getState();
        if (dirty && !restoring) void saveFileRef.current();
      },
    });
  }

  useEffect(() => {
    createFileRef.current = createFile;
  }, [createFile]);

  useEffect(() => {
    saveFileRef.current = saveFile;
  }, [saveFile]);

  useEffect(() => {
    selectWorkspaceRef.current = selectWorkspace;
  }, [selectWorkspace]);

  useEffect(() => {
    openFileRef.current = openFile;
  }, [openFile]);

  useEffect(() => {
    loadWorkspaceRef.current = loadWorkspace;
  }, [loadWorkspace]);

  useEffect(() => {
    if (!enabled) return;
    if (!desktop) return;
    const storage = getBrowserStorage();
    const saved = storage?.getItem?.(WORKSPACE_KEY);
    if (saved) {
      void loadWorkspace(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, desktop]);

  useEffect(() => {
    if (!enabled) return;
    if (!desktop) return;
    const handler = desktop.fs.onRefresh(() => {
      void refreshFiles();
    });
    return () => {
      desktop.fs.removeRefreshListener(handler);
    };
  }, [enabled, refreshFiles, desktop]);

  useEffect(() => {
    if (!enabled) return;
    if (!desktop) return;
    desktop.fs.onMenuNewFile(() => {
      void createFileRef.current();
    });
    desktop.fs.onMenuSave(() => {
      void saveFileRef.current();
    });
    desktop.fs.onMenuSwitchWorkspace(() => {
      void selectWorkspaceRef.current();
    });
    desktop.fs.onMenuOpenRecentItem((item) => {
      void (async () => {
        await loadWorkspaceRef.current(item.workspacePath);
        if (item.itemType === "file") {
          await openFileRef.current(toFileItem(item));
          return;
        }
        window.dispatchEvent(
          new CustomEvent(RECENT_FOLDER_EVENT, { detail: item }),
        );
      })();
    });

    return () => {
      desktop.fs.removeAllListeners();
    };
  }, [enabled, desktop]);

  useEffect(() => {
    if (!enabled) return;
    if (!currentFile || !markdown) return;
    if (isRestoring) return;

    // Only the first edit after a save needs the full-content rebuild to flip
    // the dirty flag. Dirty is monotonic until the next save/open resets it, so
    // once dirty we skip the expensive reconstruction and just keep the
    // autosave timer armed — this is the per-keystroke hot path.
    if (!isDirty) {
      const { themeId: currentTheme, themeName: currentThemeName } =
        useThemeStore.getState();
      const fullContent = applyMarkdownFileMeta(lastSavedContent, {
        body: markdown,
        theme: currentTheme,
        themeName: currentThemeName,
        title: currentFile.title || stripMarkdownExtension(currentFile.name),
      });
      if (fullContent === lastSavedContent) return;
      setIsDirty(true);
    }

    schedulerRef.current?.schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    markdown,
    theme,
    themeName,
    currentFile,
    isRestoring,
    isDirty,
    lastSavedContent,
    enabled,
  ]);

  // Force-flush pending writes on lifecycle boundaries so nothing is lost when
  // the window loses focus, the tab is hidden, or the page is being unloaded.
  useEffect(() => {
    if (!enabled) return;
    const flush = () => schedulerRef.current?.flush();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("blur", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      schedulerRef.current?.cancel();
    };
  }, [enabled]);

  // Switching files: the open flow persists the outgoing file itself, so drop
  // any pending autosave to avoid a redundant late write.
  useEffect(() => {
    schedulerRef.current?.cancel();
  }, [currentFile?.path]);
}
