// Verifies the desktop workspace preview width persistence and clamp contract.
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PREVIEW_PANE_PERCENT,
  MAX_PREVIEW_PANE_PERCENT,
  MIN_PREVIEW_PANE_PERCENT,
  loadPreviewPanePercent,
  loadWorkspacePreviewLayoutMode,
  normalizePreviewPanePercent,
  savePreviewPanePercent,
  saveWorkspacePreviewLayoutMode,
} from "../../hooks/useWorkspacePreviewLayout";

const createStorage = (initial: Record<string, string | null> = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
};

describe("workspace preview layout persistence", () => {
  it("uses a 42 percent preview pane by default", () => {
    expect(normalizePreviewPanePercent(undefined)).toBe(
      DEFAULT_PREVIEW_PANE_PERCENT,
    );
  });

  it("restores a saved legal preview pane percent", () => {
    const storage = createStorage({
      "draftport-preview-pane-percent": "52",
    });

    expect(loadPreviewPanePercent(storage)).toBe(52);
  });

  it("clamps preview pane percent to the supported range", () => {
    expect(normalizePreviewPanePercent(10)).toBe(MIN_PREVIEW_PANE_PERCENT);
    expect(normalizePreviewPanePercent(90)).toBe(MAX_PREVIEW_PANE_PERCENT);
  });

  it("falls back to the default percent for invalid storage values", () => {
    const storage = createStorage({
      "draftport-preview-pane-percent": "not-a-number",
    });

    expect(loadPreviewPanePercent(storage)).toBe(DEFAULT_PREVIEW_PANE_PERCENT);
  });

  it("persists normalized percent values", () => {
    const storage = createStorage();

    savePreviewPanePercent(90, storage);

    expect(storage.setItem).toHaveBeenCalledWith(
      "draftport-preview-pane-percent",
      String(MAX_PREVIEW_PANE_PERCENT),
    );
  });

  it("loads and saves the preview layout mode", () => {
    const storage = createStorage({
      "draftport-preview-layout-mode": "preview",
    });

    expect(loadWorkspacePreviewLayoutMode(storage)).toBe("preview");
    saveWorkspacePreviewLayoutMode("balanced", storage);

    expect(storage.setItem).toHaveBeenCalledWith(
      "draftport-preview-layout-mode",
      "balanced",
    );
  });

  it("loads and saves the editor-priority preview layout mode", () => {
    const storage = createStorage({
      "draftport-preview-layout-mode": "editor",
    });

    expect(loadWorkspacePreviewLayoutMode(storage)).toBe("editor");
    saveWorkspacePreviewLayoutMode("editor", storage);

    expect(storage.setItem).toHaveBeenCalledWith(
      "draftport-preview-layout-mode",
      "editor",
    );
  });
});
