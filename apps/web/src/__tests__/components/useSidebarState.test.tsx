import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSidebarState } from "../../components/Sidebar/useSidebarState";
import type { FileItem, TreeItem } from "../../store/fileTypes";

const mocks = vi.hoisted(() => {
  const recordOpen = vi.fn(async () => ({ success: true }));
  const list = vi.fn(async () => ({ success: true, items: [] }));
  const getOrder = vi.fn(
    async (): Promise<{
      success: boolean;
      order?: { version: 1; folders: Record<string, string[]> };
    }> => ({ success: true, order: undefined }),
  );
  const saveOrder = vi.fn(async () => ({ success: true }));
  const openFile = vi.fn(async () => undefined);
  const moveToFolder = vi.fn(async () => undefined);
  const bridge = {
    fs: {},
    recentItems: {
      list,
      recordOpen,
    },
    workspaceOrder: {
      get: getOrder,
      save: saveOrder,
    },
  };

  return {
    useFileSystem: vi.fn(),
    recordOpen,
    list,
    getOrder,
    saveOrder,
    openFile,
    moveToFolder,
    bridge,
  };
});

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: mocks.useFileSystem,
}));

vi.mock("../../hooks/useFileSystemHelpers", () => ({
  getDesktopBridge: () => mocks.bridge,
}));

describe("useSidebarState recent folders", () => {
  const files: TreeItem[] = [
    {
      name: "docs",
      path: "/workspace/docs",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      isDirectory: true,
      children: [
        {
          name: "drafts",
          path: "/workspace/docs/drafts",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
          isDirectory: true,
          children: [],
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem("draftport-file-sort-mode");
    mocks.useFileSystem.mockReturnValue({
      files,
      currentFile: null,
      openFile: mocks.openFile,
      createFile: vi.fn(),
      updateFileTitle: vi.fn(),
      deleteFile: vi.fn(),
      selectWorkspace: vi.fn(),
      workspacePath: "/workspace",
      createFolder: vi.fn(),
      moveToFolder: mocks.moveToFolder,
      renameFolder: vi.fn(),
      moveFolder: vi.fn(),
      deleteFolder: vi.fn(),
      inspectFolder: vi.fn(async () => []),
      refreshFiles: vi.fn(),
      flattenFiles: vi.fn(() => []),
    });
  });

  it("records the workspace root when the root folder is clicked", async () => {
    const { result } = renderHook(() => useSidebarState());

    act(() => {
      result.current.handleRootFolderClick();
    });

    await waitFor(() => {
      expect(mocks.recordOpen).toHaveBeenCalledWith({
        itemPath: "/workspace",
        itemType: "folder",
      });
    });
  });

  it("records a folder when it is toggled", async () => {
    const { result } = renderHook(() => useSidebarState());

    act(() => {
      result.current.toggleFolder("/workspace/docs");
    });

    await waitFor(() => {
      expect(mocks.recordOpen).toHaveBeenCalledWith({
        itemPath: "/workspace/docs",
        itemType: "folder",
      });
    });
  });

  it("focuses and expands a folder selected from the native recent menu", async () => {
    const { result } = renderHook(() => useSidebarState());

    act(() => {
      window.dispatchEvent(
        new CustomEvent("draftport:open-recent-folder", {
          detail: { itemPath: "/workspace/docs/drafts" },
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.activeFolder).toBe("/workspace/docs/drafts");
      expect(result.current.collapsedFolders.has("/workspace/docs")).toBe(
        false,
      );
    });
  });

  it("opens a file without refreshing recent items and reordering the current list", async () => {
    const file: FileItem = {
      name: "note.md",
      path: "/workspace/docs/note.md",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      size: 100,
    };
    mocks.useFileSystem.mockReturnValue({
      files: [file],
      currentFile: null,
      openFile: mocks.openFile,
      createFile: vi.fn(),
      updateFileTitle: vi.fn(),
      deleteFile: vi.fn(),
      selectWorkspace: vi.fn(),
      workspacePath: "/workspace",
      createFolder: vi.fn(),
      moveToFolder: mocks.moveToFolder,
      renameFolder: vi.fn(),
      moveFolder: vi.fn(),
      deleteFolder: vi.fn(),
      inspectFolder: vi.fn(async () => []),
      refreshFiles: vi.fn(),
      flattenFiles: vi.fn(() => [file]),
    });

    const { result } = renderHook(() => useSidebarState());

    await waitFor(() => {
      expect(mocks.list).toHaveBeenCalled();
    });
    mocks.list.mockClear();

    await act(async () => {
      await result.current.handleFileClick(file);
    });

    expect(mocks.openFile).toHaveBeenCalledWith(file);
    expect(result.current.activeFolder).toBe("/workspace/docs");
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("loads manual order config and applies it to the visible tree", async () => {
    localStorage.setItem("draftport-file-sort-mode", "manual");
    const aFile: FileItem = {
      name: "a.md",
      path: "/workspace/a.md",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      size: 100,
    };
    const bFile: FileItem = {
      name: "b.md",
      path: "/workspace/b.md",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      size: 100,
    };
    mocks.getOrder.mockResolvedValueOnce({
      success: true,
      order: {
        version: 1,
        folders: {
          "/workspace": ["/workspace/b.md", "/workspace/a.md"],
        },
      },
    });
    mocks.useFileSystem.mockReturnValue({
      files: [aFile, bFile],
      currentFile: null,
      openFile: mocks.openFile,
      createFile: vi.fn(),
      updateFileTitle: vi.fn(),
      deleteFile: vi.fn(),
      selectWorkspace: vi.fn(),
      workspacePath: "/workspace",
      createFolder: vi.fn(),
      moveToFolder: mocks.moveToFolder,
      renameFolder: vi.fn(),
      moveFolder: vi.fn(),
      deleteFolder: vi.fn(),
      inspectFolder: vi.fn(async () => []),
      refreshFiles: vi.fn(),
      flattenFiles: vi.fn(() => [aFile, bFile]),
    });

    const { result } = renderHook(() => useSidebarState());

    await waitFor(() => {
      expect(result.current.filteredItems.map((item) => item.path)).toEqual([
        "/workspace/b.md",
        "/workspace/a.md",
      ]);
    });
  });

  it("saves a same-parent manual reorder without moving files on disk", async () => {
    localStorage.setItem("draftport-file-sort-mode", "manual");
    const aFile: FileItem = {
      name: "a.md",
      path: "/workspace/a.md",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      size: 100,
    };
    const bFile: FileItem = {
      name: "b.md",
      path: "/workspace/b.md",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      size: 100,
    };
    mocks.useFileSystem.mockReturnValue({
      files: [aFile, bFile],
      currentFile: null,
      openFile: mocks.openFile,
      createFile: vi.fn(),
      updateFileTitle: vi.fn(),
      deleteFile: vi.fn(),
      selectWorkspace: vi.fn(),
      workspacePath: "/workspace",
      createFolder: vi.fn(),
      moveToFolder: mocks.moveToFolder,
      renameFolder: vi.fn(),
      moveFolder: vi.fn(),
      deleteFolder: vi.fn(),
      inspectFolder: vi.fn(async () => []),
      refreshFiles: vi.fn(),
      flattenFiles: vi.fn(() => [aFile, bFile]),
    });
    const { result } = renderHook(() => useSidebarState());

    await act(async () => {
      await result.current.reorderDraggedPath(
        "/workspace/a.md",
        "/workspace/b.md",
        "after",
      );
    });

    expect(mocks.saveOrder).toHaveBeenCalledWith({
      version: 1,
      folders: {
        "/workspace": ["/workspace/b.md", "/workspace/a.md"],
      },
    });
    expect(mocks.moveToFolder).not.toHaveBeenCalled();
  });

  it("switches to manual sort when a row reorder starts from another sort mode", async () => {
    const aFile: FileItem = {
      name: "a.md",
      path: "/workspace/a.md",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      size: 100,
    };
    const bFile: FileItem = {
      name: "b.md",
      path: "/workspace/b.md",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      size: 100,
    };
    mocks.useFileSystem.mockReturnValue({
      files: [aFile, bFile],
      currentFile: null,
      openFile: mocks.openFile,
      createFile: vi.fn(),
      updateFileTitle: vi.fn(),
      deleteFile: vi.fn(),
      selectWorkspace: vi.fn(),
      workspacePath: "/workspace",
      createFolder: vi.fn(),
      moveToFolder: mocks.moveToFolder,
      renameFolder: vi.fn(),
      moveFolder: vi.fn(),
      deleteFolder: vi.fn(),
      inspectFolder: vi.fn(async () => []),
      refreshFiles: vi.fn(),
      flattenFiles: vi.fn(() => [aFile, bFile]),
    });
    const { result } = renderHook(() => useSidebarState());

    expect(result.current.sortMode).toBe("opened-desc");

    await act(async () => {
      await result.current.reorderDraggedPath(
        "/workspace/a.md",
        "/workspace/b.md",
        "after",
      );
    });

    expect(result.current.sortMode).toBe("manual");
    expect(localStorage.getItem("draftport-file-sort-mode")).toBe("manual");
    expect(mocks.saveOrder).toHaveBeenCalledWith({
      version: 1,
      folders: {
        "/workspace": ["/workspace/b.md", "/workspace/a.md"],
      },
    });
  });

  it("keeps drag-to-folder moving files through the existing file-system action", async () => {
    const file: FileItem = {
      name: "note.md",
      path: "/workspace/note.md",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      size: 100,
    };
    mocks.useFileSystem.mockReturnValue({
      files: [file, files[0]],
      currentFile: null,
      openFile: mocks.openFile,
      createFile: vi.fn(),
      updateFileTitle: vi.fn(),
      deleteFile: vi.fn(),
      selectWorkspace: vi.fn(),
      workspacePath: "/workspace",
      createFolder: vi.fn(),
      moveToFolder: mocks.moveToFolder,
      renameFolder: vi.fn(),
      moveFolder: vi.fn(),
      deleteFolder: vi.fn(),
      inspectFolder: vi.fn(async () => []),
      refreshFiles: vi.fn(),
      flattenFiles: vi.fn(() => [file]),
    });
    const { result } = renderHook(() => useSidebarState());

    await act(async () => {
      await result.current.moveDraggedPathToFolder(
        "/workspace/note.md",
        "/workspace/docs",
      );
    });

    expect(mocks.moveToFolder).toHaveBeenCalledWith(file, "/workspace/docs");
  });
});
