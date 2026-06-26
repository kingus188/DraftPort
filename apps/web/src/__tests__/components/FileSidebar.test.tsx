// Verifies the file sidebar's workspace controls and macOS titlebar spacing contract.
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileSidebar } from "../../components/Sidebar/FileSidebar";

const mockRefreshFiles = vi.fn(async () => undefined);
const mockUseSidebarState = vi.fn();

vi.mock("../../components/Sidebar/useSidebarState", () => ({
  FILE_DRAG_TYPE: "application/x-draftport-file",
  FOLDER_DRAG_TYPE: "application/x-draftport-folder",
  ROOT_DROP_TARGET: "__root__",
  getBaseName: (path: string) =>
    path.split(/[\\/]/).filter(Boolean).pop() || path,
  useSidebarState: () => mockUseSidebarState(),
}));

describe("FileSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSidebarState.mockReturnValue({
      files: [],
      currentFile: null,
      createFile: vi.fn(),
      deleteFile: vi.fn(),
      deleteFolder: vi.fn(),
      refreshFiles: mockRefreshFiles,
      selectWorkspace: vi.fn(),
      workspacePath: "/Users/haifeng/Documents/Obsidian/second-me",
      flattenFiles: vi.fn(() => []),
      allFolders: [],
      filteredItems: [],
      isDragEnabled: true,
      filter: "",
      setFilter: vi.fn(),
      renamingPath: null,
      setRenamingPath: vi.fn(),
      renameValue: "",
      setRenameValue: vi.fn(),
      collapsedFolders: new Set<string>(),
      menuOpen: false,
      menuPos: { x: 0, y: 0 },
      menuTarget: null,
      menuTargetFolder: null,
      deleteTarget: null,
      setDeleteTarget: vi.fn(),
      deleteFolderTarget: null,
      setDeleteFolderTarget: vi.fn(),
      deleteFolderExtras: [],
      setDeleteFolderExtras: vi.fn(),
      deleting: false,
      setDeleting: vi.fn(),
      showNewFolderModal: false,
      setShowNewFolderModal: vi.fn(),
      newFolderName: "",
      setNewFolderName: vi.fn(),
      activeFolder: null,
      setActiveFolder: vi.fn(),
      showMoveMenu: false,
      setShowMoveMenu: vi.fn(),
      draggingPath: null,
      setDraggingPath: vi.fn(),
      draggingFolderPath: null,
      setDraggingFolderPath: vi.fn(),
      dragOverTarget: null,
      setDragOverTarget: vi.fn(),
      tooltip: null,
      renameFolderTarget: null,
      setRenameFolderTarget: vi.fn(),
      renameFolderValue: "",
      setRenameFolderValue: vi.fn(),
      showRenameFolderModal: false,
      setShowRenameFolderModal: vi.fn(),
      sortMode: "updated-desc",
      handleSetSortMode: vi.fn(),
      toggleFolder: vi.fn(),
      getFolderMoveTargets: vi.fn(() => []),
      closeMenu: vi.fn(),
      handleContextMenu: vi.fn(),
      handleFolderContextMenu: vi.fn(),
      handleEmptyContextMenu: vi.fn(),
      startRename: vi.fn(),
      copyTitle: vi.fn(),
      submitRename: vi.fn(),
      handleCreateFolder: vi.fn(),
      handleMoveToFolder: vi.fn(),
      handleMoveFolder: vi.fn(),
      handleRenameFolder: vi.fn(),
      closeRenameFolderModal: vi.fn(),
      prepareDeleteFolder: vi.fn(),
      showTooltip: vi.fn(),
      hideTooltip: vi.fn(),
      handleDropToFolder: vi.fn(),
      handleDropToRoot: vi.fn(),
      handleDragLeave: vi.fn(),
      handleFileClick: vi.fn(),
      handleRootFolderClick: vi.fn(),
      formatTime: vi.fn(() => "刚刚"),
    });
  });

  it("refreshes the folder list from the sidebar header", () => {
    render(<FileSidebar />);

    fireEvent.click(screen.getByRole("button", { name: "刷新文件夹" }));

    expect(mockRefreshFiles).toHaveBeenCalledTimes(1);
  });

  it("uses compact workspace header spacing", () => {
    const sidebarStyles = readFileSync(
      "src/components/Sidebar/FileSidebar.css",
      "utf8",
    );
    const headerRule = sidebarStyles.match(/\.fs-header\s*{[^}]+}/)?.[0] ?? "";

    expect(headerRule).toContain("padding: 44px 24px 8px;");
  });
});
