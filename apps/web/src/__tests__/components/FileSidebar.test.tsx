// Verifies the file sidebar's workspace controls and macOS titlebar spacing contract.
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileSidebar } from "../../components/Sidebar/FileSidebar";
import type { FileItem, FolderItem } from "../../store/fileTypes";

const mockRefreshFiles = vi.fn(async () => undefined);
const mockUseSidebarState = vi.fn();

const makeFile = (name: string, path: string): FileItem => ({
  name,
  path,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  size: 100,
});

const makeFolder = (
  name: string,
  path: string,
  children: FolderItem["children"],
): FolderItem => ({
  name,
  path,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  isDirectory: true,
  children,
});

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

    expect(headerRule).toContain("padding: 16px 16px 4px;");
  });

  it("marks tree rows with depth so nested files and folders render indented", () => {
    const nestedFile = makeFile("note.md", "/workspace/docs/note.md");
    const nestedFolder = makeFolder("drafts", "/workspace/docs/drafts", []);
    const rootFile = makeFile("root.md", "/workspace/root.md");
    const rootFolder = makeFolder("docs", "/workspace/docs", [
      nestedFolder,
      nestedFile,
    ]);

    mockUseSidebarState.mockReturnValue({
      ...mockUseSidebarState(),
      filteredItems: [rootFolder, rootFile],
    });

    render(<FileSidebar />);

    expect(screen.getByText("docs").closest(".fs-folder")).toHaveAttribute(
      "data-tree-depth",
      "1",
    );
    expect(screen.getByText("root").closest(".fs-item")).toHaveAttribute(
      "data-tree-depth",
      "1",
    );
    expect(screen.getByText("drafts").closest(".fs-folder")).toHaveAttribute(
      "data-tree-depth",
      "2",
    );
    expect(screen.getByText("note").closest(".fs-item")).toHaveAttribute(
      "data-tree-depth",
      "2",
    );
  });

  it("keeps tree indentation compact while aligning same-depth titles", () => {
    const sidebarStyles = readFileSync(
      "src/components/Sidebar/FileSidebar.css",
      "utf8",
    );
    const componentSource = readFileSync(
      "src/components/Sidebar/FileSidebar.tsx",
      "utf8",
    );

    expect(componentSource).toContain("const TREE_INDENT_STEP_PX = 5.5;");
    expect(sidebarStyles).toContain(
      "padding-left: calc(12px + var(--tree-indent-offset, 0px));",
    );
    expect(sidebarStyles).toContain(
      "padding-left: calc(52px + var(--tree-indent-offset, 0px));",
    );
  });

  it("highlights active text without row backgrounds or shadows", () => {
    const sidebarStyles = readFileSync(
      "src/components/Sidebar/FileSidebar.css",
      "utf8",
    );

    const fileActiveRule =
      sidebarStyles.match(/\.fs-item\.active\s*{[^}]+}/)?.[0] ?? "";
    const folderActiveRule =
      sidebarStyles.match(/\.fs-folder\.active\s*{[^}]+}/)?.[0] ?? "";
    const fileTitleRule =
      sidebarStyles.match(/\.fs-item\.active \.fs-title\s*{[^}]+}/)?.[0] ?? "";
    const fileThemeRule =
      sidebarStyles.match(/\.fs-item\.active \.fs-theme-info\s*{[^}]+}/)?.[0] ??
      "";
    const folderCountRule =
      sidebarStyles.match(
        /\.fs-folder\.active \.fs-folder-count\s*{[^}]+}/,
      )?.[0] ?? "";

    expect(fileActiveRule).toContain("background: transparent;");
    expect(fileActiveRule).toContain("box-shadow: none;");
    expect(folderActiveRule).toContain("background: transparent;");
    expect(folderActiveRule).toContain("box-shadow: none;");
    expect(fileTitleRule).toContain("var(--tree-selection-fg)");
    expect(fileThemeRule).toContain("var(--tree-selection-fg)");
    expect(folderActiveRule).toContain("var(--tree-selection-fg)");
    expect(folderCountRule).toContain("color: var(--tree-selection-fg)");
    expect(folderCountRule).toContain("background: transparent;");
  });
});
