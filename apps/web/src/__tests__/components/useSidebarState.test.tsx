import { act, renderHook, waitFor } from "@testing-library/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSidebarState } from "../../components/Sidebar/useSidebarState";
import type { FileItem, FolderItem, TreeItem } from "../../store/fileTypes";

const mocks = vi.hoisted(() => {
  const recordOpen = vi.fn(async () => ({ success: true }));
  const list = vi.fn(async () => ({ success: true, items: [] }));
  const getOrder = vi.fn(
    async (): Promise<{
      success: boolean;
      order?: {
        version: 1;
        folders: Record<string, string[]>;
        sortModes?: Record<string, string>;
      };
    }> => ({ success: true, order: undefined }),
  );
  const saveOrder = vi.fn(async () => ({ success: true }));
  const openFile = vi.fn(async () => undefined);
  const createFile = vi.fn(async () => undefined);
  const createFolder = vi.fn(async () => undefined);
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
    createFile,
    createFolder,
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
      createFile: mocks.createFile,
      updateFileTitle: vi.fn(),
      deleteFile: vi.fn(),
      selectWorkspace: vi.fn(),
      workspacePath: "/workspace",
      createFolder: mocks.createFolder,
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

  it("loads per-folder sort modes and applies them to the visible tree", async () => {
    const docs: TreeItem = {
      name: "docs",
      path: "/workspace/docs",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      isDirectory: true,
      children: [
        {
          name: "zeta.md",
          path: "/workspace/docs/zeta.md",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-03"),
          size: 100,
        },
        {
          name: "alpha.md",
          path: "/workspace/docs/alpha.md",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
          size: 100,
        },
      ],
    };
    mocks.getOrder.mockResolvedValueOnce({
      success: true,
      order: {
        version: 1,
        folders: {},
        sortModes: {
          "/workspace/docs": "name-asc",
        },
      },
    });
    mocks.useFileSystem.mockReturnValue({
      files: [docs],
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

    const { result } = renderHook(() => useSidebarState());

    await waitFor(() => {
      const sortedDocs = result.current.filteredItems[0] as TreeItem & {
        children: TreeItem[];
      };
      expect(sortedDocs.children.map((item) => item.path)).toEqual([
        "/workspace/docs/alpha.md",
        "/workspace/docs/zeta.md",
      ]);
    });
  });

  it("saves sort mode changes only for the active folder", async () => {
    const docs = files[0];
    mocks.getOrder.mockResolvedValueOnce({
      success: true,
      order: {
        version: 1,
        folders: {},
        sortModes: {
          "/workspace": "opened-desc",
          "/workspace/ideas": "updated-desc",
        },
      },
    });
    mocks.useFileSystem.mockReturnValue({
      files: [docs],
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
    const { result } = renderHook(() => useSidebarState());

    await waitFor(() => {
      expect(result.current.activeSortMode).toBe("opened-desc");
    });

    act(() => {
      result.current.setActiveFolder("/workspace/docs");
    });

    await act(async () => {
      await result.current.handleSetSortMode("name-asc");
    });

    expect(result.current.activeSortMode).toBe("name-asc");
    expect(mocks.saveOrder).toHaveBeenLastCalledWith({
      version: 1,
      folders: {},
      sortModes: {
        "/workspace": "opened-desc",
        "/workspace/ideas": "updated-desc",
        "/workspace/docs": "name-asc",
      },
    });
  });

  it("saves context sort mode changes for the right-clicked folder", async () => {
    const docs = files[0];
    mocks.useFileSystem.mockReturnValue({
      files: [docs],
      currentFile: null,
      openFile: mocks.openFile,
      createFile: mocks.createFile,
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
    const { result } = renderHook(() => useSidebarState());

    act(() => {
      result.current.handleFolderContextMenu(
        {
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientX: 0,
          clientY: 0,
        } as unknown as ReactMouseEvent,
        docs as FolderItem,
      );
    });

    await act(async () => {
      await result.current.handleSetContextSortMode("name-desc");
    });

    expect(mocks.saveOrder).toHaveBeenLastCalledWith({
      version: 1,
      folders: {},
      sortModes: {
        "/workspace/docs": "name-desc",
      },
    });
  });

  it("keeps the right-clicked parent folder as the sort target when a child folder is active", async () => {
    const parent = files[0] as FolderItem;
    const child = parent.children[0] as FolderItem;
    const { result } = renderHook(() => useSidebarState());

    act(() => {
      window.dispatchEvent(
        new CustomEvent("draftport:open-recent-folder", {
          detail: { itemPath: child.path },
        }),
      );
    });
    await waitFor(() => {
      expect(result.current.activeFolder).toBe(child.path);
    });

    act(() => {
      result.current.handleFolderContextMenu(
        {
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientX: 0,
          clientY: 0,
        } as unknown as ReactMouseEvent,
        parent,
      );
    });
    expect(result.current.activeFolder).toBe(parent.path);
    await act(async () => {
      await result.current.handleSetContextSortMode("name-asc");
    });

    expect(mocks.saveOrder).toHaveBeenLastCalledWith({
      version: 1,
      folders: {},
      sortModes: {
        [parent.path]: "name-asc",
      },
    });
  });

  it("sorts the right-clicked parent folder's direct files when a nested child folder is active", async () => {
    const dataFolder: FolderItem = {
      name: "数据",
      path: "/workspace/知乎/数据",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      isDirectory: true,
      children: [
        {
          name: "运营计划.md",
          path: "/workspace/知乎/数据/运营计划.md",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-02"),
          size: 100,
        },
        {
          name: "知乎回答写作模板.md",
          path: "/workspace/知乎/数据/知乎回答写作模板.md",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
          size: 100,
        },
      ],
    };
    const zhihu: FolderItem = {
      name: "知乎",
      path: "/workspace/知乎",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      isDirectory: true,
      children: [
        dataFolder,
        {
          name: "06-专题创作计划.md",
          path: "/workspace/知乎/06-专题创作计划.md",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-06"),
          size: 100,
        },
        {
          name: "04-发布与时间计划.md",
          path: "/workspace/知乎/04-发布与时间计划.md",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-04"),
          size: 100,
        },
        {
          name: "01-定位与读者.md",
          path: "/workspace/知乎/01-定位与读者.md",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
          size: 100,
        },
      ],
    };
    mocks.useFileSystem.mockReturnValue({
      files: [zhihu],
      currentFile: null,
      openFile: mocks.openFile,
      createFile: mocks.createFile,
      updateFileTitle: vi.fn(),
      deleteFile: vi.fn(),
      selectWorkspace: vi.fn(),
      workspacePath: "/workspace",
      createFolder: mocks.createFolder,
      moveToFolder: mocks.moveToFolder,
      renameFolder: vi.fn(),
      moveFolder: vi.fn(),
      deleteFolder: vi.fn(),
      inspectFolder: vi.fn(async () => []),
      refreshFiles: vi.fn(),
      flattenFiles: vi.fn(() => []),
    });
    const { result } = renderHook(() => useSidebarState());

    act(() => {
      window.dispatchEvent(
        new CustomEvent("draftport:open-recent-folder", {
          detail: { itemPath: dataFolder.path },
        }),
      );
    });
    await waitFor(() => {
      expect(result.current.activeFolder).toBe(dataFolder.path);
    });

    act(() => {
      result.current.handleFolderContextMenu(
        {
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientX: 0,
          clientY: 0,
        } as unknown as ReactMouseEvent,
        zhihu,
      );
    });
    await act(async () => {
      await result.current.handleSetContextSortMode("name-asc");
    });

    const sortedZhihu = result.current.filteredItems[0] as FolderItem;
    expect(sortedZhihu.children.map((item) => item.path)).toEqual([
      "/workspace/知乎/数据",
      "/workspace/知乎/01-定位与读者.md",
      "/workspace/知乎/04-发布与时间计划.md",
      "/workspace/知乎/06-专题创作计划.md",
    ]);
  });

  it("freezes the context-menu sort target when the menu opens", async () => {
    const parent = files[0] as FolderItem;
    const child = parent.children[0] as FolderItem;
    const { result } = renderHook(() => useSidebarState());

    act(() => {
      window.dispatchEvent(
        new CustomEvent("draftport:open-recent-folder", {
          detail: { itemPath: child.path },
        }),
      );
    });
    await waitFor(() => {
      expect(result.current.activeFolder).toBe(child.path);
    });

    act(() => {
      result.current.handleEmptyContextMenu({
        preventDefault: vi.fn(),
        clientX: 0,
        clientY: 0,
      } as unknown as ReactMouseEvent);
      result.current.setActiveFolder(parent.path);
    });
    await act(async () => {
      await result.current.handleSetContextSortMode("name-desc");
    });

    expect(mocks.saveOrder).toHaveBeenLastCalledWith({
      version: 1,
      folders: {},
      sortModes: {
        [child.path]: "name-desc",
      },
    });
  });

  it("applies context sort mode changes to the right-clicked folder's visible files", async () => {
    const docs: FolderItem = {
      name: "docs",
      path: "/workspace/docs",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      isDirectory: true,
      children: [
        {
          name: "zeta.md",
          path: "/workspace/docs/zeta.md",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-03"),
          size: 100,
        },
        {
          name: "alpha.md",
          path: "/workspace/docs/alpha.md",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
          size: 100,
        },
      ],
    };
    mocks.useFileSystem.mockReturnValue({
      files: [docs],
      currentFile: null,
      openFile: mocks.openFile,
      createFile: mocks.createFile,
      updateFileTitle: vi.fn(),
      deleteFile: vi.fn(),
      selectWorkspace: vi.fn(),
      workspacePath: "/workspace",
      createFolder: mocks.createFolder,
      moveToFolder: mocks.moveToFolder,
      renameFolder: vi.fn(),
      moveFolder: vi.fn(),
      deleteFolder: vi.fn(),
      inspectFolder: vi.fn(async () => []),
      refreshFiles: vi.fn(),
      flattenFiles: vi.fn(() => docs.children as FileItem[]),
    });
    const { result } = renderHook(() => useSidebarState());

    await waitFor(() => {
      expect(mocks.getOrder).toHaveBeenCalled();
    });

    expect(
      (
        (result.current.filteredItems[0] as FolderItem).children as FileItem[]
      ).map((file) => file.path),
    ).toEqual(["/workspace/docs/zeta.md", "/workspace/docs/alpha.md"]);

    act(() => {
      result.current.handleFolderContextMenu(
        {
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientX: 0,
          clientY: 0,
        } as unknown as ReactMouseEvent,
        docs,
      );
    });
    await act(async () => {
      await result.current.handleSetContextSortMode("name-asc");
    });

    await waitFor(() => {
      expect(
        (
          (result.current.filteredItems[0] as FolderItem).children as FileItem[]
        ).map((file) => file.path),
      ).toEqual(["/workspace/docs/alpha.md", "/workspace/docs/zeta.md"]);
    });
  });

  it("keeps a context sort mode change when the initial order load resolves later", async () => {
    let resolveOrder: (
      value: Awaited<ReturnType<typeof mocks.getOrder>>,
    ) => void = () => undefined;
    mocks.getOrder.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOrder = resolve;
        }),
    );
    const docs: FolderItem = {
      name: "docs",
      path: "/workspace/docs",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      isDirectory: true,
      children: [
        {
          name: "zeta.md",
          path: "/workspace/docs/zeta.md",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-03"),
          size: 100,
        },
        {
          name: "alpha.md",
          path: "/workspace/docs/alpha.md",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
          size: 100,
        },
      ],
    };
    mocks.useFileSystem.mockReturnValue({
      files: [docs],
      currentFile: null,
      openFile: mocks.openFile,
      createFile: mocks.createFile,
      updateFileTitle: vi.fn(),
      deleteFile: vi.fn(),
      selectWorkspace: vi.fn(),
      workspacePath: "/workspace",
      createFolder: mocks.createFolder,
      moveToFolder: mocks.moveToFolder,
      renameFolder: vi.fn(),
      moveFolder: vi.fn(),
      deleteFolder: vi.fn(),
      inspectFolder: vi.fn(async () => []),
      refreshFiles: vi.fn(),
      flattenFiles: vi.fn(() => docs.children as FileItem[]),
    });
    const { result } = renderHook(() => useSidebarState());

    act(() => {
      result.current.handleFolderContextMenu(
        {
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientX: 0,
          clientY: 0,
        } as unknown as ReactMouseEvent,
        docs,
      );
    });
    await act(async () => {
      await result.current.handleSetContextSortMode("name-asc");
    });
    await act(async () => {
      resolveOrder({ success: true, order: undefined });
    });

    await waitFor(() => {
      expect(
        (
          (result.current.filteredItems[0] as FolderItem).children as FileItem[]
        ).map((file) => file.path),
      ).toEqual(["/workspace/docs/alpha.md", "/workspace/docs/zeta.md"]);
    });
  });

  it("creates files inside the right-clicked folder from the context menu", async () => {
    const docs = files[0];
    mocks.useFileSystem.mockReturnValue({
      files: [docs],
      currentFile: null,
      openFile: mocks.openFile,
      createFile: mocks.createFile,
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
    const { result } = renderHook(() => useSidebarState());

    act(() => {
      result.current.handleFolderContextMenu(
        {
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientX: 0,
          clientY: 0,
        } as unknown as ReactMouseEvent,
        docs as FolderItem,
      );
    });
    await act(async () => {
      await result.current.handleCreateFileFromContextMenu();
    });

    expect(mocks.createFile).toHaveBeenCalledWith("/workspace/docs");
  });

  it("creates folders inside the right-clicked folder from the context menu", async () => {
    const docs = files[0];
    mocks.useFileSystem.mockReturnValue({
      files: [docs],
      currentFile: null,
      openFile: mocks.openFile,
      createFile: mocks.createFile,
      updateFileTitle: vi.fn(),
      deleteFile: vi.fn(),
      selectWorkspace: vi.fn(),
      workspacePath: "/workspace",
      createFolder: mocks.createFolder,
      moveToFolder: mocks.moveToFolder,
      renameFolder: vi.fn(),
      moveFolder: vi.fn(),
      deleteFolder: vi.fn(),
      inspectFolder: vi.fn(async () => []),
      refreshFiles: vi.fn(),
      flattenFiles: vi.fn(() => []),
    });
    const { result } = renderHook(() => useSidebarState());

    act(() => {
      result.current.handleFolderContextMenu(
        {
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientX: 0,
          clientY: 0,
        } as unknown as ReactMouseEvent,
        docs as FolderItem,
      );
    });
    act(() => {
      result.current.handleStartCreateFolderFromContextMenu();
      result.current.setNewFolderName("child");
    });
    await act(async () => {
      await result.current.handleCreateFolder();
    });

    expect(mocks.createFolder).toHaveBeenCalledWith("child", "/workspace/docs");
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
      sortModes: {
        "/workspace": "manual",
      },
    });
    expect(mocks.moveToFolder).not.toHaveBeenCalled();
  });

  it("switches only the reordered parent folder to manual sort", async () => {
    const aFile: FileItem = {
      name: "a.md",
      path: "/workspace/docs/a.md",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      size: 100,
    };
    const bFile: FileItem = {
      name: "b.md",
      path: "/workspace/docs/b.md",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      size: 100,
    };
    const docs: TreeItem = {
      name: "docs",
      path: "/workspace/docs",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      isDirectory: true,
      children: [aFile, bFile],
    };
    mocks.getOrder.mockResolvedValueOnce({
      success: true,
      order: {
        version: 1,
        folders: {},
        sortModes: {
          "/workspace": "opened-desc",
        },
      },
    });
    mocks.useFileSystem.mockReturnValue({
      files: [docs],
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
      expect(result.current.activeSortMode).toBe("opened-desc");
    });

    await act(async () => {
      await result.current.reorderDraggedPath(
        "/workspace/docs/a.md",
        "/workspace/docs/b.md",
        "after",
      );
    });

    expect(result.current.activeSortMode).toBe("opened-desc");
    expect(mocks.saveOrder).toHaveBeenCalledWith({
      version: 1,
      folders: {
        "/workspace/docs": ["/workspace/docs/b.md", "/workspace/docs/a.md"],
      },
      sortModes: {
        "/workspace": "opened-desc",
        "/workspace/docs": "manual",
      },
    });
  });

  it("rolls back the root sort mode when saving a manual reorder fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
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
    mocks.saveOrder.mockRejectedValueOnce(new Error("disk full"));
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

    expect(result.current.sortMode).toBe("opened-desc");
    expect(result.current.activeSortMode).toBe("opened-desc");
    expect(localStorage.getItem("draftport-file-sort-mode")).toBe(
      "opened-desc",
    );
    consoleError.mockRestore();
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
