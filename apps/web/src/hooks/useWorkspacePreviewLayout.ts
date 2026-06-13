// Owns desktop workspace preview pane layout persistence and clamping.
// This hook is UI-shell scoped; it does not affect Markdown rendering or copy output.
import { useCallback, useState } from "react";

export type WorkspacePreviewLayoutMode = "balanced" | "preview";

type PreviewLayoutStorage = Pick<Storage, "getItem" | "setItem">;

export const PREVIEW_PANE_PERCENT_STORAGE_KEY =
  "draftport-preview-pane-percent";
export const PREVIEW_LAYOUT_MODE_STORAGE_KEY = "draftport-preview-layout-mode";
export const DEFAULT_PREVIEW_PANE_PERCENT = 42;
export const MIN_PREVIEW_PANE_PERCENT = 32;
export const MAX_PREVIEW_PANE_PERCENT = 68;

const getBrowserStorage = (): PreviewLayoutStorage | null => {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage as Partial<Storage>;
    if (
      typeof storage.getItem !== "function" ||
      typeof storage.setItem !== "function"
    ) {
      return null;
    }
    return storage as PreviewLayoutStorage;
  } catch {
    return null;
  }
};

/**
 * Normalizes a proposed preview pane percentage into the desktop layout's safe range.
 */
export function normalizePreviewPanePercent(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) return DEFAULT_PREVIEW_PANE_PERCENT;

  const rounded = Math.round(parsed);
  return Math.min(
    MAX_PREVIEW_PANE_PERCENT,
    Math.max(MIN_PREVIEW_PANE_PERCENT, rounded),
  );
}

/**
 * Reads the persisted preview pane percentage, falling back to the default when absent or invalid.
 */
export function loadPreviewPanePercent(
  storage: PreviewLayoutStorage | null = getBrowserStorage(),
): number {
  return normalizePreviewPanePercent(
    storage?.getItem(PREVIEW_PANE_PERCENT_STORAGE_KEY),
  );
}

/**
 * Persists a normalized preview pane percentage for future desktop sessions.
 */
export function savePreviewPanePercent(
  value: number,
  storage: PreviewLayoutStorage | null = getBrowserStorage(),
): void {
  storage?.setItem(
    PREVIEW_PANE_PERCENT_STORAGE_KEY,
    String(normalizePreviewPanePercent(value)),
  );
}

/**
 * Reads the workspace preview layout mode while rejecting unknown persisted values.
 */
export function loadWorkspacePreviewLayoutMode(
  storage: PreviewLayoutStorage | null = getBrowserStorage(),
): WorkspacePreviewLayoutMode {
  return storage?.getItem(PREVIEW_LAYOUT_MODE_STORAGE_KEY) === "preview"
    ? "preview"
    : "balanced";
}

/**
 * Persists the workspace preview layout mode for the next app launch.
 */
export function saveWorkspacePreviewLayoutMode(
  mode: WorkspacePreviewLayoutMode,
  storage: PreviewLayoutStorage | null = getBrowserStorage(),
): void {
  storage?.setItem(PREVIEW_LAYOUT_MODE_STORAGE_KEY, mode);
}

/**
 * Coordinates preview pane width and preview-priority layout state for the app shell.
 */
export function useWorkspacePreviewLayout() {
  const [previewPanePercent, setPreviewPanePercentState] = useState(() =>
    loadPreviewPanePercent(),
  );
  const [layoutMode, setLayoutModeState] = useState<WorkspacePreviewLayoutMode>(
    () => loadWorkspacePreviewLayoutMode(),
  );

  const setPreviewPanePercent = useCallback((nextPercent: number) => {
    const normalized = normalizePreviewPanePercent(nextPercent);
    setPreviewPanePercentState(normalized);
    savePreviewPanePercent(normalized);
  }, []);

  const setLayoutMode = useCallback((nextMode: WorkspacePreviewLayoutMode) => {
    setLayoutModeState(nextMode);
    saveWorkspacePreviewLayoutMode(nextMode);
  }, []);

  const toggleLayoutMode = useCallback(() => {
    setLayoutModeState((current) => {
      const next = current === "preview" ? "balanced" : "preview";
      saveWorkspacePreviewLayoutMode(next);
      return next;
    });
  }, []);

  return {
    layoutMode,
    previewPanePercent,
    setLayoutMode,
    setPreviewPanePercent,
    toggleLayoutMode,
  };
}
