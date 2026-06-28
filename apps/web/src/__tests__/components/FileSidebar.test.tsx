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
      showContextSortMenu: false,
      setShowContextSortMenu: vi.fn(),
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
      activeSortMode: "updated-desc",
      contextSortMode: "updated-desc",
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
      handleCreateFileFromContextMenu: vi.fn(),
      handleStartCreateFolderFromContextMenu: vi.fn(),
      handleSetContextSortMode: vi.fn(),
      handleRenameFolder: vi.fn(),
      closeRenameFolderModal: vi.fn(),
      prepareDeleteFolder: vi.fn(),
      showTooltip: vi.fn(),
      hideTooltip: vi.fn(),
      reorderDraggedPath: vi.fn(),
      moveDraggedPathToFolder: vi.fn(),
      finishDraggedPathWithIntent: vi.fn(),
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

  it("offers manual sorting in the sort menu", () => {
    const { container } = render(<FileSidebar />);

    fireEvent.click(container.querySelector(".fs-sort-btn")!);

    expect(screen.getByText("手动排序")).toBeInTheDocument();
  });

  it("offers create and sort actions when right-clicking a folder", () => {
    const folder = makeFolder("docs", "/workspace/docs", []);
    const handleCreateFileFromContextMenu = vi.fn();
    const handleStartCreateFolderFromContextMenu = vi.fn();
    const setShowContextSortMenu = vi.fn();

    mockUseSidebarState.mockReturnValue({
      ...mockUseSidebarState(),
      menuOpen: true,
      menuTargetFolder: folder,
      showContextSortMenu: false,
      setShowContextSortMenu,
      handleCreateFileFromContextMenu,
      handleStartCreateFolderFromContextMenu,
    });

    render(<FileSidebar />);

    fireEvent.click(screen.getByRole("button", { name: /新建文章/ }));
    fireEvent.click(screen.getByRole("button", { name: /新建文件夹/ }));
    fireEvent.click(screen.getByRole("button", { name: /排序方式/ }));

    expect(handleCreateFileFromContextMenu).toHaveBeenCalledTimes(1);
    expect(handleStartCreateFolderFromContextMenu).toHaveBeenCalledTimes(1);
    expect(setShowContextSortMenu).toHaveBeenCalledWith(true);
  });

  it("sets the context menu folder sort mode from the sort submenu", () => {
    const folder = makeFolder("docs", "/workspace/docs", []);
    const handleSetContextSortMode = vi.fn();

    mockUseSidebarState.mockReturnValue({
      ...mockUseSidebarState(),
      menuOpen: true,
      menuTargetFolder: folder,
      showContextSortMenu: true,
      contextSortMode: "name-asc",
      handleSetContextSortMode,
    });

    render(<FileSidebar />);

    expect(screen.getByText("名称升序").closest(".fs-sort-option")).toHaveClass(
      "active",
    );
    fireEvent.click(screen.getByRole("button", { name: /名称降序/ }));

    expect(handleSetContextSortMode).toHaveBeenCalledWith("name-desc");
  });

  it("sorts the right-clicked folder's visible files from the context menu", () => {
    const alpha = makeFile("alpha.md", "/workspace/docs/alpha.md");
    const zeta = makeFile("zeta.md", "/workspace/docs/zeta.md");
    const folder = makeFolder("docs", "/workspace/docs", [zeta, alpha]);
    const sortedFolder = makeFolder("docs", "/workspace/docs", [alpha, zeta]);
    const handleSetContextSortMode = vi.fn(() => {
      mockUseSidebarState.mockReturnValue({
        ...mockUseSidebarState(),
        filteredItems: [sortedFolder],
        menuOpen: false,
        activeSortMode: "updated-desc",
        contextSortMode: "name-asc",
        handleSetContextSortMode,
      });
      rerender(<FileSidebar />);
    });

    mockUseSidebarState.mockReturnValue({
      ...mockUseSidebarState(),
      filteredItems: [folder],
      menuOpen: false,
      activeSortMode: "updated-desc",
      contextSortMode: "updated-desc",
      handleSetContextSortMode,
    });
    const { rerender } = render(<FileSidebar />);

    expect(
      screen
        .getByText("zeta")
        .compareDocumentPosition(screen.getByText("alpha")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    mockUseSidebarState.mockReturnValue({
      ...mockUseSidebarState(),
      filteredItems: [folder],
      menuOpen: true,
      menuTargetFolder: folder,
      showContextSortMenu: true,
      activeSortMode: "updated-desc",
      contextSortMode: "updated-desc",
      handleSetContextSortMode,
    });
    rerender(<FileSidebar />);

    fireEvent.click(screen.getByRole("button", { name: /名称升序/ }));

    expect(handleSetContextSortMode).toHaveBeenCalledWith("name-asc");
    expect(
      screen
        .getByText("alpha")
        .compareDocumentPosition(screen.getByText("zeta")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("offers create and sort actions from the empty area context menu", () => {
    mockUseSidebarState.mockReturnValue({
      ...mockUseSidebarState(),
      menuOpen: true,
      menuTarget: null,
      menuTargetFolder: null,
      showContextSortMenu: true,
      contextSortMode: "opened-desc",
    });

    render(<FileSidebar />);

    expect(
      screen.getByRole("button", { name: /新建文章/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /新建文件夹/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /排序方式/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("最近打开").closest(".fs-sort-option")).toHaveClass(
      "active",
    );
  });

  it("highlights the active folder's effective sort mode in the sort menu", () => {
    mockUseSidebarState.mockReturnValue({
      ...mockUseSidebarState(),
      sortMode: "updated-desc",
      activeSortMode: "name-asc",
    });
    const { container } = render(<FileSidebar />);

    fireEvent.click(container.querySelector(".fs-sort-btn")!);

    expect(screen.getByText("名称升序").closest(".fs-sort-option")).toHaveClass(
      "active",
    );
    expect(
      screen.getByText("最近编辑").closest(".fs-sort-option"),
    ).not.toHaveClass("active");
  });

  it("uses pointer events instead of HTML5 drag for desktop-safe tree sorting", () => {
    const componentSource = readFileSync(
      "src/components/Sidebar/FileSidebar.tsx",
      "utf8",
    );

    expect(componentSource).toContain("onPointerDown");
    expect(componentSource).toContain("pointermove");
    expect(componentSource).toContain("pointerup");
    expect(componentSource).not.toContain("react-dnd");
    expect(componentSource).not.toContain("dataTransfer");
    expect(componentSource).not.toContain("onDragOver");
    expect(componentSource).not.toContain("onDrop=");
  });

  it("shows insertion intent while pointer-dragging over another row", () => {
    const setDragOverTarget = vi.fn();
    const firstFile = makeFile("a.md", "/workspace/a.md");
    const secondFile = makeFile("b.md", "/workspace/b.md");

    mockUseSidebarState.mockReturnValue({
      ...mockUseSidebarState(),
      filteredItems: [firstFile, secondFile],
      setDragOverTarget,
    });

    render(<FileSidebar />);

    const source = screen.getByText("a").closest(".fs-item")!;
    const row = screen.getByText("b").closest(".fs-item")!;
    vi.spyOn(row, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 20,
      left: 0,
      right: 200,
      width: 200,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => row),
    });

    fireEvent.pointerDown(source, {
      pointerId: 1,
      button: 0,
      clientX: 10,
      clientY: 2,
    });
    fireEvent.pointerMove(window, {
      pointerId: 1,
      clientX: 12,
      clientY: 18,
    });

    expect(setDragOverTarget).toHaveBeenCalledWith("/workspace/b.md:after");
  });

  it("finishes pointer drag using the last insertion intent", () => {
    const setDragOverTarget = vi.fn();
    const finishDraggedPathWithIntent = vi.fn();
    const firstFile = makeFile("a.md", "/workspace/a.md");
    const secondFile = makeFile("b.md", "/workspace/b.md");

    mockUseSidebarState.mockReturnValue({
      ...mockUseSidebarState(),
      filteredItems: [firstFile, secondFile],
      setDragOverTarget,
      finishDraggedPathWithIntent,
    });

    render(<FileSidebar />);

    const source = screen.getByText("a").closest(".fs-item")!;
    const row = screen.getByText("b").closest(".fs-item")!;
    vi.spyOn(row, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 20,
      left: 0,
      right: 200,
      width: 200,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => row),
    });

    fireEvent.pointerDown(source, {
      pointerId: 7,
      button: 0,
      clientX: 10,
      clientY: 2,
    });
    fireEvent.pointerMove(window, {
      pointerId: 7,
      clientX: 12,
      clientY: 8,
    });
    fireEvent.pointerUp(window, {
      pointerId: 7,
      clientX: 12,
      clientY: 8,
    });

    expect(setDragOverTarget).toHaveBeenCalledWith("/workspace/b.md:before");
    expect(finishDraggedPathWithIntent).toHaveBeenCalledWith(
      "/workspace/a.md",
      "/workspace/b.md:before",
    );
  });

  it("does not open the file after a completed pointer drag", () => {
    const handleFileClick = vi.fn();
    const finishDraggedPathWithIntent = vi.fn();
    const firstFile = makeFile("a.md", "/workspace/a.md");
    const secondFile = makeFile("b.md", "/workspace/b.md");

    mockUseSidebarState.mockReturnValue({
      ...mockUseSidebarState(),
      filteredItems: [firstFile, secondFile],
      handleFileClick,
      finishDraggedPathWithIntent,
    });

    render(<FileSidebar />);

    const source = screen.getByText("a").closest(".fs-item")!;
    const row = screen.getByText("b").closest(".fs-item")!;
    vi.spyOn(row, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 20,
      left: 0,
      right: 200,
      width: 200,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => row),
    });

    fireEvent.pointerDown(source, {
      pointerId: 8,
      button: 0,
      clientX: 10,
      clientY: 2,
    });
    fireEvent.pointerMove(window, {
      pointerId: 8,
      clientX: 12,
      clientY: 18,
    });
    fireEvent.pointerUp(window, {
      pointerId: 8,
      clientX: 12,
      clientY: 18,
    });
    fireEvent.click(source);

    expect(handleFileClick).not.toHaveBeenCalled();
  });

  it("marks the active manual drop insertion position", () => {
    const firstFile = makeFile("a.md", "/workspace/a.md");

    mockUseSidebarState.mockReturnValue({
      ...mockUseSidebarState(),
      sortMode: "manual",
      filteredItems: [firstFile],
      dragOverTarget: "/workspace/a.md:before",
    });

    render(<FileSidebar />);

    const row = screen.getByText("a").closest(".fs-item")!;

    expect(row).toHaveClass("drop-before");
    expect(row.querySelector(".fs-drop-indicator.before")).not.toBeNull();
  });

  it("uses a visible DOM insertion indicator for manual drag ordering", () => {
    const sidebarStyles = readFileSync(
      "src/components/Sidebar/FileSidebar.css",
      "utf8",
    );

    expect(sidebarStyles).toContain(".fs-drop-indicator");
    expect(sidebarStyles).toContain("height: 3px;");
    expect(sidebarStyles).toMatch(/box-shadow:\s*0 0 0 1px/);
    expect(sidebarStyles).toContain("z-index: 5;");
  });
});
