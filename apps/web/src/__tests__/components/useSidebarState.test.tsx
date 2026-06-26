import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSidebarState } from "../../components/Sidebar/useSidebarState";
import type { FileItem, TreeItem } from "../../store/fileTypes";

const mocks = vi.hoisted(() => {
  const recordOpen = vi.fn(async () => ({ success: true }));
  const list = vi.fn(async () => ({ success: true, items: [] }));
  const openFile = vi.fn(async () => undefined);
  const bridge = {
    fs: {},
    recentItems: {
      list,
      recordOpen,
    },
  };

  return {
    useFileSystem: vi.fn(),
    recordOpen,
    list,
    openFile,
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
      moveToFolder: vi.fn(),
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
      moveToFolder: vi.fn(),
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
});
