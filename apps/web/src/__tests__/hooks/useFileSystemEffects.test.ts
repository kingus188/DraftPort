import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { DesktopAPI } from "../../hooks/useFileSystemHelpers";
import { useFileSystemEffects } from "../../hooks/useFileSystemEffects";
import { useFileStore } from "../../store/fileStore";

const buildDesktopMock = () => {
  let refreshCallback: (() => void) | undefined;
  let menuNewFileCallback: (() => void) | undefined;
  let menuOpenRecentItemCallback:
    | ((item: {
        workspacePath: string;
        itemPath: string;
        itemType: "file" | "folder";
        title: string | null;
        themeName: string | null;
        mtime: number | null;
        size: number | null;
      }) => void)
    | undefined;

  const onRefresh = vi.fn((callback: () => void) => {
    refreshCallback = callback;
    return "refresh-handler";
  });

  const onMenuNewFile = vi.fn((callback: () => void) => {
    menuNewFileCallback = callback;
    return "menu-new-file-handler";
  });

  const fs = {
    selectWorkspace: vi.fn(async () => ({ success: true as const })),
    setWorkspace: vi.fn(async () => ({ success: true as const })),
    listFiles: vi.fn(async () => ({ success: true as const, files: [] })),
    readFile: vi.fn(async () => ({ success: true as const, content: "" })),
    createFile: vi.fn(async () => ({ success: true as const })),
    saveFile: vi.fn(async () => ({ success: true as const })),
    renameFile: vi.fn(async () => ({ success: true as const })),
    deleteFile: vi.fn(async () => ({ success: true as const })),
    revealInFinder: vi.fn(async () => {}),
    createFolder: vi.fn(async () => ({ success: true as const })),
    moveFile: vi.fn(async () => ({ success: true as const })),
    inspectFolder: vi.fn(async () => ({ success: true as const, entries: [] })),
    deleteFolder: vi.fn(async () => ({ success: true as const })),
    renameFolder: vi.fn(async () => ({ success: true as const })),
    moveFolder: vi.fn(async () => ({ success: true as const })),
    onRefresh,
    removeRefreshListener: vi.fn(),
    onMenuNewFile,
    onMenuSave: vi.fn(() => "menu-save-handler"),
    onMenuSwitchWorkspace: vi.fn(() => "menu-switch-workspace-handler"),
    onMenuOpenRecentItem: vi.fn((callback) => {
      menuOpenRecentItemCallback = callback;
      return "menu-open-recent-handler";
    }),
    removeAllListeners: vi.fn(),
  };

  return {
    desktop: { fs },
    fs,
    getRefreshCallback: () => refreshCallback,
    getMenuNewFileCallback: () => menuNewFileCallback,
    getMenuOpenRecentItemCallback: () => menuOpenRecentItemCallback,
  };
};

describe("useFileSystemEffects", () => {
  afterEach(() => {
    vi.clearAllMocks();
    useFileStore.setState({
      workspacePath: null,
      files: [],
      currentFile: null,
      isLoading: false,
      isSaving: false,
      lastSavedContent: "",
      lastSavedAt: null,
      isDirty: false,
      isRestoring: false,
    });
    if (
      typeof window !== "undefined" &&
      window.localStorage &&
      typeof window.localStorage.clear === "function"
    ) {
      window.localStorage.clear();
    }
  });

  it("单实例下正确注册并清理 Desktop 监听器", async () => {
    const {
      desktop,
      fs,
      getRefreshCallback,
      getMenuNewFileCallback,
      getMenuOpenRecentItemCallback,
    } = buildDesktopMock();

    const refreshFiles = vi.fn(async () => {});
    const createFile = vi.fn(async () => {});
    const openFile = vi.fn(async () => {});

    const params = {
      enabled: true,
      desktop: desktop as DesktopAPI,
      currentFile: null,
      markdown: "",
      theme: "default",
      themeName: "默认主题",
      isRestoring: false,
      isDirty: false,
      lastSavedContent: "",
      loadWorkspace: vi.fn(async () => {}),
      refreshFiles,
      reloadCurrentFileFromDisk: vi.fn(async () => {}),
      openFile,
      createFile,
      saveFile: vi.fn(async () => {}),
      selectWorkspace: vi.fn(async () => {}),
      setIsDirty: vi.fn(),
    };

    const mounted = renderHook(() => useFileSystemEffects(params));

    await waitFor(() => {
      expect(fs.onRefresh).toHaveBeenCalledTimes(1);
      expect(fs.onMenuNewFile).toHaveBeenCalledTimes(1);
      expect(fs.onMenuSave).toHaveBeenCalledTimes(1);
      expect(fs.onMenuSwitchWorkspace).toHaveBeenCalledTimes(1);
      expect(fs.onMenuOpenRecentItem).toHaveBeenCalledTimes(1);
    });

    getRefreshCallback()?.();
    await waitFor(() => {
      expect(refreshFiles).toHaveBeenCalledTimes(1);
    });

    getMenuNewFileCallback()?.();
    await waitFor(() => {
      expect(createFile).toHaveBeenCalledTimes(1);
    });

    getMenuOpenRecentItemCallback()?.({
      workspacePath: "/workspace",
      itemPath: "/workspace/article.md",
      itemType: "file",
      title: "Article",
      themeName: "默认主题",
      mtime: 1760000000000,
      size: 12,
    });
    await waitFor(() => {
      expect(params.loadWorkspace).toHaveBeenCalledWith("/workspace");
      expect(openFile).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/workspace/article.md",
          name: "article.md",
          title: "Article",
          themeName: "默认主题",
          size: 12,
        }),
      );
    });

    mounted.unmount();

    expect(fs.removeRefreshListener).toHaveBeenCalledTimes(1);
    expect(fs.removeRefreshListener).toHaveBeenCalledWith("refresh-handler");
    expect(fs.removeAllListeners).toHaveBeenCalledTimes(1);
  });

  it("刷新事件会在当前文件无本地修改时重载磁盘内容", async () => {
    const { desktop, getRefreshCallback } = buildDesktopMock();
    const refreshFiles = vi.fn(async () => {});
    const reloadCurrentFileFromDisk = vi.fn(async () => {});
    const currentFile = {
      name: "article.md",
      path: "/workspace/article.md",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      size: 12,
      isDirectory: false as const,
    };
    useFileStore.setState({ currentFile, isDirty: false, isRestoring: false });

    renderHook(() =>
      useFileSystemEffects({
        enabled: true,
        desktop: desktop as DesktopAPI,
        currentFile,
        markdown: "# Article\n",
        theme: "default",
        themeName: "默认主题",
        isRestoring: false,
        isDirty: false,
        lastSavedContent: "# Article\n",
        loadWorkspace: vi.fn(async () => {}),
        refreshFiles,
        reloadCurrentFileFromDisk,
        openFile: vi.fn(async () => {}),
        createFile: vi.fn(async () => {}),
        saveFile: vi.fn(async () => {}),
        selectWorkspace: vi.fn(async () => {}),
        setIsDirty: vi.fn(),
      }),
    );

    getRefreshCallback()?.();

    await waitFor(() => {
      expect(refreshFiles).toHaveBeenCalledTimes(1);
      expect(reloadCurrentFileFromDisk).toHaveBeenCalledTimes(1);
    });
  });

  it("刷新事件不会覆盖已有本地未保存修改", async () => {
    const { desktop, getRefreshCallback } = buildDesktopMock();
    const refreshFiles = vi.fn(async () => {});
    const reloadCurrentFileFromDisk = vi.fn(async () => {});
    const currentFile = {
      name: "article.md",
      path: "/workspace/article.md",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      size: 12,
      isDirectory: false as const,
    };
    useFileStore.setState({ currentFile, isDirty: true, isRestoring: false });

    renderHook(() =>
      useFileSystemEffects({
        enabled: true,
        desktop: desktop as DesktopAPI,
        currentFile,
        markdown: "# Local draft\n",
        theme: "default",
        themeName: "默认主题",
        isRestoring: false,
        isDirty: true,
        lastSavedContent: "# Article\n",
        loadWorkspace: vi.fn(async () => {}),
        refreshFiles,
        reloadCurrentFileFromDisk,
        openFile: vi.fn(async () => {}),
        createFile: vi.fn(async () => {}),
        saveFile: vi.fn(async () => {}),
        selectWorkspace: vi.fn(async () => {}),
        setIsDirty: vi.fn(),
      }),
    );

    getRefreshCallback()?.();

    await waitFor(() => {
      expect(refreshFiles).toHaveBeenCalledTimes(1);
    });
    expect(reloadCurrentFileFromDisk).not.toHaveBeenCalled();
  });
});
