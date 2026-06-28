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

    expect(headerRule).toContain("padding: 10px 12px 2px;");
  });

  it("shows the workspace root only in the header", () => {
    render(<FileSidebar />);

    expect(screen.getAllByText("second-me")).toHaveLength(1);
    expect(screen.queryByText("根目录")).toBeNull();
  });

  it("uses medium compact tree density similar to Typora", () => {
    const sidebarStyles = readFileSync(
      "src/components/Sidebar/FileSidebar.css",
      "utf8",
    );

    const listRule = sidebarStyles.match(/\.fs-list\s*{[^}]+}/)?.[0] ?? "";
    const titleRule = sidebarStyles.match(/^\.fs-title\s*{[^}]+}/m)?.[0] ?? "";

    expect(listRule).toContain("padding: 2px 10px 12px;");
    expect(listRule).toContain("gap: 1px;");
    expect(sidebarStyles).toContain("padding: 5px 8px;");
    expect(titleRule).toContain("font-size: 12.5px;");
    expect(titleRule).toContain("line-height: 1.25;");
    expect(titleRule).toContain("font-weight: 550;");
    expect(titleRule).toContain("color: var(--sidebar-file-title);");
    expect(sidebarStyles).not.toContain(".fs-time");
    expect(sidebarStyles).not.toContain(".fs-theme-info");
    expect(sidebarStyles).not.toContain(".fs-meta-row");
    expect(sidebarStyles).toContain(
      "padding-left: calc(8px + var(--tree-indent-offset, 0px));",
    );
    expect(sidebarStyles).toContain(
      "padding-left: calc(30px + var(--tree-indent-offset, 0px));",
    );
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
      "padding-left: calc(8px + var(--tree-indent-offset, 0px));",
    );
    expect(sidebarStyles).toContain(
      "padding-left: calc(30px + var(--tree-indent-offset, 0px));",
    );
  });

  it("uses the publishing queue selection treatment for active files", () => {
    const sidebarStyles = readFileSync(
      "src/components/Sidebar/FileSidebar.css",
      "utf8",
    );
    const componentSource = readFileSync(
      "src/components/Sidebar/FileSidebar.tsx",
      "utf8",
    );

    const fileActiveRule =
      sidebarStyles.match(/\.fs-item\.active\s*{[^}]+}/)?.[0] ?? "";
    const fileTitleRule =
      sidebarStyles.match(/\.fs-item\.active \.fs-title\s*{[^}]+}/)?.[0] ?? "";
    const statusDotRule =
      sidebarStyles.match(/\.fs-status-dot\s*{[^}]+}/)?.[0] ?? "";
    const fileIconRule =
      sidebarStyles.match(/^\.fs-file-icon\s*{[^}]+}/m)?.[0] ?? "";
    const activeFileIconRule =
      sidebarStyles.match(/\.fs-item\.active \.fs-file-icon\s*{[^}]+}/)?.[0] ??
      "";

    expect(componentSource).toContain("FileText");
    expect(componentSource).toContain('className="fs-status-dot"');
    expect(fileIconRule).toContain("color: var(--sidebar-file-icon)");
    expect(activeFileIconRule).toContain("var(--sidebar-file-title-active)");
    expect(fileActiveRule).toContain("background: var(--tree-selection-bg);");
    expect(fileActiveRule).toContain(
      "border-color: var(--tree-selection-border);",
    );
    expect(fileActiveRule).toContain("box-shadow: none;");
    expect(fileTitleRule).toContain("var(--sidebar-file-title-active)");
    expect(statusDotRule).toContain("background: var(--accent-primary)");
  });

  it("renders file rows with icons and active status dots", () => {
    const activeFile = makeFile("06-专题创作计划.md", "/workspace/06.md");
    const inactiveFile = makeFile("05-路线图.md", "/workspace/05.md");

    mockUseSidebarState.mockReturnValue({
      ...mockUseSidebarState(),
      currentFile: activeFile,
      filteredItems: [activeFile, inactiveFile],
    });

    render(<FileSidebar />);

    const activeRow = screen.getByText("06-专题创作计划").closest(".fs-item");
    const inactiveRow = screen.getByText("05-路线图").closest(".fs-item");

    expect(activeRow).toHaveClass("active");
    expect(activeRow?.querySelector(".fs-file-icon")).not.toBeNull();
    expect(activeRow?.querySelector(".fs-status-dot")).not.toBeNull();
    expect(activeRow?.querySelector(".fs-meta-row")).toBeNull();
    expect(inactiveRow?.querySelector(".fs-file-icon")).not.toBeNull();
    expect(inactiveRow?.querySelector(".fs-status-dot")).toBeNull();
    expect(inactiveRow?.querySelector(".fs-meta-row")).toBeNull();
    expect(screen.queryByText("刚刚")).toBeNull();
    expect(screen.queryByText("默认主题")).toBeNull();
  });
});
