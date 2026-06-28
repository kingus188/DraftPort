import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFileSystem } from "../../hooks/useFileSystem";
import { useEditorStore } from "../../store/editorStore";
import type { DesktopAPI } from "../../hooks/useFileSystemHelpers";
import { useFileStore } from "../../store/fileStore";
import type { FileItem } from "../../store/fileTypes";
import { useThemeStore } from "../../store/themeStore";

function buildFile(path: string): FileItem {
  return {
    name: path.split("/").pop() || "article.md",
    path,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    size: 12,
    title: path.includes("a.md") ? "A" : "B",
    themeName: "默认主题",
    isDirectory: false,
  };
}

async function flushRestoreTimer() {
  await act(async () => {
    vi.runOnlyPendingTimers();
  });
}

function buildDesktopMock(contents: Record<string, string>): DesktopAPI {
  return {
    fs: {
      selectWorkspace: vi.fn(async () => ({ success: true })),
      setWorkspace: vi.fn(async () => ({ success: true })),
      listFiles: vi.fn(async () => ({ success: true, files: [] })),
      readFile: vi.fn(async (path: string) => ({
        success: true,
        content: contents[path] ?? "",
      })),
      openFile: vi.fn(async (path: string) => ({
        success: true,
        content: contents[path] ?? "",
      })),
      createFile: vi.fn(async () => ({ success: true })),
      saveFile: vi.fn(async () => ({ success: true })),
      renameFile: vi.fn(async () => ({ success: true })),
      deleteFile: vi.fn(async () => ({ success: true })),
      revealInFinder: vi.fn(async () => {}),
      createFolder: vi.fn(async () => ({ success: true })),
      moveFile: vi.fn(async () => ({ success: true })),
      inspectFolder: vi.fn(async () => ({ success: true, entries: [] })),
      deleteFolder: vi.fn(async () => ({ success: true })),
      renameFolder: vi.fn(async () => ({ success: true })),
      moveFolder: vi.fn(async () => ({ success: true })),
      onRefresh: vi.fn(() => "refresh-handler"),
      removeRefreshListener: vi.fn(),
      onMenuNewFile: vi.fn(() => "menu-new-file-handler"),
      onMenuSave: vi.fn(() => "menu-save-handler"),
      onMenuSwitchWorkspace: vi.fn(() => "menu-switch-workspace-handler"),
      onMenuOpenRecentItem: vi.fn(() => "menu-open-recent-handler"),
      removeAllListeners: vi.fn(),
    },
  };
}

describe("useFileSystem file theme assignments", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    const desktop = buildDesktopMock({
      "/workspace/a.md": `---
theme: default
themeName: "默认主题"
title: "A"
---

# A
`,
      "/workspace/b.md": `---
theme: default
themeName: "默认主题"
title: "B"
---

# B
`,
    });
    Object.defineProperty(window, "desktop", {
      configurable: true,
      value: desktop,
    });
    useFileStore.setState({
      workspacePath: "/workspace",
      files: [],
      currentFile: null,
      isLoading: false,
      isSaving: false,
      lastSavedContent: "",
      lastSavedAt: null,
      isDirty: false,
      isRestoring: false,
    });
    useThemeStore.setState({
      themeId: "default",
      themeName: "默认主题",
      customCSS: "",
      customThemes: [],
      fileThemes: {},
    });
    useEditorStore.setState({
      markdown: "",
      lastAutoSavedAt: null,
      isEditing: false,
      currentFilePath: undefined,
      workspaceDir: undefined,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens each file with its client-side theme assignment before frontmatter", async () => {
    useThemeStore.getState().selectTheme("receipt", "/workspace/a.md");
    useThemeStore.getState().activateTheme("default");

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFile(buildFile("/workspace/a.md"));
    });
    await flushRestoreTimer();
    expect(useThemeStore.getState().themeId).toBe("receipt");

    await act(async () => {
      await result.current.openFile(buildFile("/workspace/b.md"));
    });
    await flushRestoreTimer();
    expect(useThemeStore.getState().themeId).toBe("default");
  });

  it("saves document edits without rewriting frontmatter theme from client assignment", async () => {
    useThemeStore.getState().selectTheme("receipt", "/workspace/a.md");
    useThemeStore.getState().activateTheme("default");

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.openFile(buildFile("/workspace/a.md"));
    });
    await flushRestoreTimer();
    act(() => {
      useEditorStore.getState().setMarkdown("# A changed\n");
    });

    await act(async () => {
      await result.current.saveFile();
    });

    const desktop = window.desktop as unknown as DesktopAPI;
    expect(desktop.fs.saveFile).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: "/workspace/a.md",
        content: expect.stringContaining("theme: default"),
      }),
    );
    expect(desktop.fs.saveFile).toHaveBeenCalledWith(
      expect.not.objectContaining({
        content: expect.stringContaining("theme: receipt"),
      }),
    );
  });
});
