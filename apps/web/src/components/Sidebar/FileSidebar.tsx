import { useState, useRef, useEffect, useCallback } from "react";
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  Search,
  Plus,
  FolderOpen,
  FolderPlus,
  FileText,
  MoreHorizontal,
  ChevronRight,
  ArrowUpDown,
  Check,
  RefreshCw,
} from "lucide-react";
import {
  DeleteFileModal,
  DeleteFolderModal,
  RenameFolderModal,
  NewFolderModal,
  Tooltip,
} from "./SidebarModals";
import { ContextMenu } from "./ContextMenu";
import {
  useSidebarState,
  getBaseName,
  ROOT_DROP_TARGET,
} from "./useSidebarState";
import type { SortMode } from "./sortUtils";
import "./FileSidebar.css";

import type { FileItem, FolderItem, TreeItem } from "../../store/fileTypes";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "manual", label: "手动排序" },
  { value: "opened-desc", label: "最近打开" },
  { value: "updated-desc", label: "最近编辑" },
  { value: "name-asc", label: "名称升序" },
  { value: "name-desc", label: "名称降序" },
];

const TREE_INDENT_STEP_PX = 5.5;
const SIDEBAR_DROP_PATH_ATTR = "data-sidebar-drop-path";
const SIDEBAR_DROP_KIND_ATTR = "data-sidebar-drop-kind";
type DropPosition = "before" | "after";
type SidebarState = ReturnType<typeof useSidebarState>;

interface SidebarDragItem {
  path: string;
  itemType: "file" | "folder";
}

interface ActivePointerDrag extends SidebarDragItem {
  pointerId: number;
  startX: number;
  startY: number;
  isDragging: boolean;
  lastIntent: string | null;
}

/** Converts logical tree depth into the CSS offset used to indent each row. */
function getTreeDepthStyle(depth: number): CSSProperties {
  return {
    "--tree-indent-offset": `${depth * TREE_INDENT_STEP_PX}px`,
  } as CSSProperties;
}

/** Returns the insertion side for a client Y coordinate, preserving folder middle-drop moves. */
function getDropPositionFromClientY(
  element: HTMLElement,
  clientY: number,
  keepFolderMiddleForMove = false,
): DropPosition | null {
  const rect = element.getBoundingClientRect();
  const ratio = rect.height > 0 ? (clientY - rect.top) / rect.height : 0;
  if (keepFolderMiddleForMove && ratio > 0.25 && ratio < 0.75) return null;
  return ratio < 0.5 ? "before" : "after";
}

/** Formats the transient drag-over key used by rows to draw insertion lines. */
function getDropIntentKey(path: string, position: DropPosition): string {
  return `${path}:${position}`;
}

/** Finds the sidebar row under a global pointer coordinate. */
function getSidebarDropElement(clientOffset: { x: number; y: number }) {
  if (typeof document.elementFromPoint !== "function") return null;
  const element = document.elementFromPoint(clientOffset.x, clientOffset.y);
  return element?.closest<HTMLElement>(`[${SIDEBAR_DROP_PATH_ATTR}]`) ?? null;
}

/** Computes the visible insertion or folder target for a hovered sidebar row. */
function getDropIntentFromElement(element: HTMLElement, clientY: number) {
  const path = element.getAttribute(SIDEBAR_DROP_PATH_ATTR);
  if (!path) return null;
  const kind = element.getAttribute(SIDEBAR_DROP_KIND_ATTR);
  const isFolder = kind === "folder";
  const position = getDropPositionFromClientY(element, clientY, isFolder);
  if (!position && isFolder) return path;
  if (!position) return null;
  return getDropIntentKey(path, position);
}

/** Renders a concrete insertion marker so drag feedback is visible in the DOM. */
function DropInsertionIndicator({ position }: { position: DropPosition }) {
  return (
    <span
      className={`fs-drop-indicator ${position}`}
      aria-hidden="true"
      data-drop-position={position}
    />
  );
}

/** Renders one draggable Markdown document row and its reorder drop target. */
function FileTreeRow({
  file,
  depth,
  state,
  pointerDraggingPath,
  onPointerDragStart,
}: {
  file: FileItem;
  depth: number;
  state: SidebarState;
  pointerDraggingPath: string | null;
  onPointerDragStart: (
    item: SidebarDragItem,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
}) {
  const isCurrentFile = state.currentFile?.path === file.path;
  const isDragging = pointerDraggingPath === file.path;
  const dropBefore =
    state.dragOverTarget === getDropIntentKey(file.path, "before");
  const dropAfter =
    state.dragOverTarget === getDropIntentKey(file.path, "after");

  return (
    <div
      className={`fs-item ${isCurrentFile ? "active" : ""} ${isDragging ? "dragging" : ""} ${dropBefore ? "drop-before" : ""} ${dropAfter ? "drop-after" : ""}`}
      data-tree-depth={depth}
      data-sidebar-drop-path={file.path}
      data-sidebar-drop-kind="file"
      style={getTreeDepthStyle(depth)}
      onClick={() => state.handleFileClick(file)}
      onContextMenu={(e) => state.handleContextMenu(e, file)}
      onPointerDown={(e) =>
        onPointerDragStart({ path: file.path, itemType: "file" }, e)
      }
    >
      {dropBefore && <DropInsertionIndicator position="before" />}
      <div className="fs-item-main">
        <FileText size={16} className="fs-file-icon" aria-hidden="true" />
        <div className="fs-title-block">
          {state.renamingPath === file.path ? (
            <div className="fs-rename" onClick={(e) => e.stopPropagation()}>
              <input
                value={state.renameValue}
                onChange={(e) => state.setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") state.submitRename();
                  if (e.key === "Escape") state.setRenamingPath(null);
                }}
                autoFocus
              />
              <button onClick={() => state.submitRename()}>确认</button>
              <button onClick={() => state.setRenamingPath(null)}>取消</button>
            </div>
          ) : (
            <span
              className="fs-title"
              title={file.title || file.name.replace(/\.md$/, "")}
            >
              {file.title || file.name.replace(/\.md$/, "")}
            </span>
          )}
        </div>
        {isCurrentFile && <span className="fs-status-dot" aria-hidden="true" />}
        <button
          className="fs-action-trigger"
          onClick={(e) => {
            e.stopPropagation();
            state.handleContextMenu(e, file);
          }}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
      {dropAfter && <DropInsertionIndicator position="after" />}
    </div>
  );
}

/** Renders one draggable folder row, preserving middle-drop folder moves. */
function FolderTreeRow({
  folder,
  depth,
  state,
  pointerDraggingPath,
  onPointerDragStart,
}: {
  folder: FolderItem;
  depth: number;
  state: SidebarState;
  pointerDraggingPath: string | null;
  onPointerDragStart: (
    item: SidebarDragItem,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
}) {
  const isCollapsed = state.collapsedFolders.has(folder.path);
  const isActive = state.activeFolder === folder.path;
  const isDragging = pointerDraggingPath === folder.path;
  const dropBefore =
    state.dragOverTarget === getDropIntentKey(folder.path, "before");
  const dropAfter =
    state.dragOverTarget === getDropIntentKey(folder.path, "after");

  return (
    <div key={folder.path} className="fs-folder-wrapper">
      <div
        className={`fs-folder ${isCollapsed ? "collapsed" : ""} ${isActive ? "active" : ""} ${state.dragOverTarget === folder.path ? "drop-target" : ""} ${isDragging ? "dragging" : ""} ${dropBefore ? "drop-before" : ""} ${dropAfter ? "drop-after" : ""}`}
        data-tree-depth={depth}
        data-sidebar-drop-path={folder.path}
        data-sidebar-drop-kind="folder"
        style={getTreeDepthStyle(depth)}
        onClick={() => state.toggleFolder(folder.path)}
        onContextMenu={(e) => state.handleFolderContextMenu(e, folder)}
        onPointerDown={(e) =>
          onPointerDragStart({ path: folder.path, itemType: "folder" }, e)
        }
      >
        {dropBefore && <DropInsertionIndicator position="before" />}
        <ChevronRight
          size={14}
          className={`fs-folder-icon ${isCollapsed ? "" : "expanded"}`}
        />
        <FolderOpen size={14} className="fs-folder-type-icon" />
        <span className="fs-folder-name">{folder.name}</span>
        <span className="fs-folder-count">{folder.children.length}</span>
        {dropAfter && <DropInsertionIndicator position="after" />}
      </div>
      {!isCollapsed && (
        <div className="fs-folder-children">
          {folder.children.map((child) =>
            child.isDirectory ? (
              <FolderTreeRow
                key={child.path}
                folder={child as FolderItem}
                depth={depth + 1}
                state={state}
                pointerDraggingPath={pointerDraggingPath}
                onPointerDragStart={onPointerDragStart}
              />
            ) : (
              <FileTreeRow
                key={child.path}
                file={child as FileItem}
                depth={depth + 1}
                state={state}
                pointerDraggingPath={pointerDraggingPath}
                onPointerDragStart={onPointerDragStart}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Renders the workspace file tree, folder controls, and file actions for local content navigation.
 */
export function FileSidebar() {
  return <FileSidebarInner />;
}

/**
 * Renders the sidebar and drives tree reordering from pointer events so the
 * insertion cursor works reliably inside desktop webviews.
 */
function FileSidebarInner() {
  const state = useSidebarState();
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [pointerDraggingPath, setPointerDraggingPath] = useState<string | null>(
    null,
  );
  const sortBtnRef = useRef<HTMLButtonElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const rootListRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(state);
  const activePointerDragRef = useRef<ActivePointerDrag | null>(null);
  const suppressNextClickRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /** Starts a possible tree drag while preserving normal clicks until movement crosses a threshold. */
  const handlePointerDragStart = useCallback(
    (item: SidebarDragItem, event: ReactPointerEvent<HTMLElement>) => {
      if (!stateRef.current.isDragEnabled) return;
      if (event.button !== 0) return;
      const interactive = (event.target as HTMLElement | null)?.closest(
        "button,input,textarea,select,a",
      );
      if (interactive) return;
      activePointerDragRef.current = {
        ...item,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        isDragging: false,
        lastIntent: null,
      };
    },
    [],
  );

  /** Stops the click that browsers dispatch after a completed pointer drag. */
  const handleClickCapture = useCallback((event: ReactMouseEvent) => {
    if (!suppressNextClickRef.current) return;
    suppressNextClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  useEffect(() => {
    const getPointerIntent = (event: PointerEvent) => {
      const row = getSidebarDropElement({
        x: event.clientX,
        y: event.clientY,
      });
      if (row) return getDropIntentFromElement(row, event.clientY);
      const root = rootListRef.current;
      const target = event.target as Node | null;
      if (root && target && root === target) return ROOT_DROP_TARGET;
      if (root && target && root.contains(target)) return null;
      return null;
    };

    const clearPointerDrag = () => {
      activePointerDragRef.current = null;
      setPointerDraggingPath(null);
      stateRef.current.setDragOverTarget(null);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const active = activePointerDragRef.current;
      if (!active || active.pointerId !== event.pointerId) return;
      const distance = Math.hypot(
        event.clientX - active.startX,
        event.clientY - active.startY,
      );
      if (!active.isDragging && distance < 4) return;
      event.preventDefault();
      if (!active.isDragging) {
        active.isDragging = true;
        setPointerDraggingPath(active.path);
      }
      const intent = getPointerIntent(event);
      if (!intent || intent === active.path) return;
      active.lastIntent = intent;
      stateRef.current.setDragOverTarget(intent);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const active = activePointerDragRef.current;
      if (!active || active.pointerId !== event.pointerId) return;
      if (!active.isDragging) {
        activePointerDragRef.current = null;
        return;
      }
      suppressNextClickRef.current = true;
      const intent = active.lastIntent;
      const draggedPath = active.path;
      activePointerDragRef.current = null;
      setPointerDraggingPath(null);
      void stateRef.current.finishDraggedPathWithIntent(draggedPath, intent);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      const active = activePointerDragRef.current;
      if (!active || active.pointerId !== event.pointerId) return;
      clearPointerDrag();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, []);

  // 右键菜单打开时关闭排序菜单
  useEffect(() => {
    if (state.menuOpen) setShowSortMenu(false);
  }, [state.menuOpen]);

  useEffect(() => {
    if (!showSortMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (
        sortMenuRef.current &&
        !sortMenuRef.current.contains(e.target as Node) &&
        sortBtnRef.current &&
        !sortBtnRef.current.contains(e.target as Node)
      ) {
        setShowSortMenu(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSortMenu(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showSortMenu]);

  /** Renders one document row with pointer-driven tree dragging. */
  const renderFileItem = (file: FileItem, depth: number) => {
    return (
      <FileTreeRow
        key={file.path}
        file={file}
        depth={depth}
        state={state}
        pointerDraggingPath={pointerDraggingPath}
        onPointerDragStart={handlePointerDragStart}
      />
    );
  };

  /** Renders one folder row with pointer-driven tree dragging. */
  const renderFolderItem = (folder: FolderItem, depth: number) => {
    return (
      <FolderTreeRow
        key={folder.path}
        folder={folder}
        depth={depth}
        state={state}
        pointerDraggingPath={pointerDraggingPath}
        onPointerDragStart={handlePointerDragStart}
      />
    );
  };

  const renderTreeItems = (items: TreeItem[], depth = 1) => {
    return items.map((item) =>
      item.isDirectory
        ? renderFolderItem(item as FolderItem, depth)
        : renderFileItem(item as FileItem, depth),
    );
  };

  return (
    <aside className="file-sidebar" onClickCapture={handleClickCapture}>
      <div className="fs-header">
        <div
          className="fs-workspace-info"
          onClick={state.selectWorkspace}
          title={state.workspacePath || "选择工作区"}
        >
          <FolderOpen size={14} />
          <span>
            {state.workspacePath
              ? getBaseName(state.workspacePath)
              : "选择工作区"}
          </span>
        </div>
        <div className="fs-actions">
          <button
            className="fs-btn-secondary fs-btn-icon-only"
            onClick={() => void state.refreshFiles()}
            aria-label="刷新文件夹"
            data-tooltip="刷新文件夹"
            onMouseEnter={(e) => state.showTooltip(e, "刷新文件夹")}
            onMouseLeave={state.hideTooltip}
            onFocus={(e) => state.showTooltip(e, "刷新文件夹")}
            onBlur={state.hideTooltip}
          >
            <RefreshCw size={16} />
          </button>
          <button
            className="fs-btn-secondary fs-btn-icon-only"
            onClick={() => state.startCreateFolder(state.activeFolder)}
            data-tooltip="新建文件夹"
            onMouseEnter={(e) => state.showTooltip(e, "新建文件夹")}
            onMouseLeave={state.hideTooltip}
            onFocus={(e) => state.showTooltip(e, "新建文件夹")}
            onBlur={state.hideTooltip}
          >
            <FolderPlus size={16} />
          </button>
          <button
            className="fs-btn-secondary fs-btn-icon-only"
            onClick={() => state.createFile(state.activeFolder || undefined)}
            data-tooltip={
              state.activeFolder
                ? `在 ${getBaseName(state.activeFolder)} 中新建`
                : "新建文章"
            }
            onMouseEnter={(e) =>
              state.showTooltip(
                e,
                state.activeFolder
                  ? `在 ${getBaseName(state.activeFolder)} 中新建`
                  : "新建文章",
              )
            }
            onMouseLeave={state.hideTooltip}
            onFocus={(e) =>
              state.showTooltip(
                e,
                state.activeFolder
                  ? `在 ${getBaseName(state.activeFolder)} 中新建`
                  : "新建文章",
              )
            }
            onBlur={state.hideTooltip}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="fs-search">
        <div className="fs-search-wrapper">
          <Search size={14} className="fs-search-icon" />
          <input
            type="text"
            placeholder="搜索文件..."
            value={state.filter}
            onChange={(e) => state.setFilter(e.target.value)}
          />
        </div>
        <div className="fs-sort-wrapper">
          <button
            ref={sortBtnRef}
            className="fs-btn-secondary fs-btn-icon-only fs-sort-btn"
            onClick={() => setShowSortMenu((v) => !v)}
            onMouseEnter={(e) => state.showTooltip(e, "排序方式")}
            onMouseLeave={state.hideTooltip}
          >
            <ArrowUpDown size={14} />
          </button>
          {showSortMenu && (
            <div ref={sortMenuRef} className="fs-sort-dropdown">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`fs-sort-option ${state.activeSortMode === opt.value ? "active" : ""}`}
                  onClick={() => {
                    void state.handleSetSortMode(opt.value);
                    setShowSortMenu(false);
                  }}
                >
                  <span>{opt.label}</span>
                  {state.activeSortMode === opt.value && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="fs-body">
        <div
          ref={rootListRef}
          className={`fs-list ${state.dragOverTarget === ROOT_DROP_TARGET ? "drop-target" : ""}`}
          onContextMenu={(e) => {
            if (e.target === e.currentTarget) state.handleEmptyContextMenu(e);
          }}
        >
          {state.filter
            ? (state.filteredItems as FileItem[]).map((file) =>
                renderFileItem(file, 0),
              )
            : renderTreeItems(state.filteredItems as TreeItem[])}
          {state.filteredItems.length === 0 && (
            <div className="fs-empty">暂无文件</div>
          )}
        </div>
      </div>

      {state.menuOpen && (
        <ContextMenu
          position={state.menuPos}
          menuTarget={state.menuTarget}
          menuTargetFolder={state.menuTargetFolder}
          showMoveMenu={state.showMoveMenu}
          showSortMenu={state.showContextSortMenu}
          contextSortMode={state.contextSortMode}
          allFolders={state.allFolders}
          folderMoveTargets={
            state.menuTargetFolder
              ? state.getFolderMoveTargets(state.menuTargetFolder)
              : []
          }
          onClose={state.closeMenu}
          onCopyTitle={() =>
            state.menuTarget && state.copyTitle(state.menuTarget)
          }
          onStartRename={() =>
            state.menuTarget && state.startRename(state.menuTarget)
          }
          onToggleMoveMenu={() => state.setShowMoveMenu(!state.showMoveMenu)}
          onToggleSortMenu={() =>
            state.setShowContextSortMenu(!state.showContextSortMenu)
          }
          onMoveToFolder={state.handleMoveToFolder}
          onMoveFolder={state.handleMoveFolder}
          onCreateFile={state.handleCreateFileFromContextMenu}
          onDeleteFile={() => {
            if (state.menuTarget) {
              state.setDeleteTarget(state.menuTarget);
              state.closeMenu();
            }
          }}
          onDeleteFolder={() => {
            if (state.menuTargetFolder) {
              state.prepareDeleteFolder(state.menuTargetFolder);
              state.closeMenu();
            }
          }}
          onStartRenameFolder={() => {
            if (state.menuTargetFolder) {
              state.setRenameFolderTarget(state.menuTargetFolder);
              state.setRenameFolderValue(state.menuTargetFolder.name);
              state.setShowRenameFolderModal(true);
              state.closeMenu();
            }
          }}
          onNewFolder={() => {
            state.handleStartCreateFolderFromContextMenu();
          }}
          onSetSortMode={state.handleSetContextSortMode}
        />
      )}

      {state.deleteTarget && (
        <DeleteFileModal
          target={state.deleteTarget}
          deleting={state.deleting}
          onConfirm={async () => {
            state.setDeleting(true);
            try {
              await state.deleteFile(state.deleteTarget!);
            } finally {
              state.setDeleting(false);
              state.setDeleteTarget(null);
            }
          }}
          onCancel={() => state.setDeleteTarget(null)}
        />
      )}

      {state.deleteFolderTarget && (
        <DeleteFolderModal
          target={state.deleteFolderTarget}
          extraItems={state.deleteFolderExtras}
          deleting={state.deleting}
          onConfirm={async () => {
            state.setDeleting(true);
            try {
              await state.deleteFolder(state.deleteFolderTarget!.path, {
                recursive:
                  state.deleteFolderTarget!.children.length > 0 ||
                  state.deleteFolderExtras.length > 0,
              });
            } finally {
              state.setDeleting(false);
              state.setDeleteFolderTarget(null);
              state.setDeleteFolderExtras([]);
            }
          }}
          onCancel={() => {
            state.setDeleteFolderTarget(null);
            state.setDeleteFolderExtras([]);
          }}
        />
      )}

      {state.showRenameFolderModal && (
        <RenameFolderModal
          value={state.renameFolderValue}
          onChange={state.setRenameFolderValue}
          onConfirm={state.handleRenameFolder}
          onCancel={state.closeRenameFolderModal}
        />
      )}

      {state.showNewFolderModal && (
        <NewFolderModal
          value={state.newFolderName}
          onChange={state.setNewFolderName}
          onConfirm={state.handleCreateFolder}
          onCancel={state.closeNewFolderModal}
        />
      )}

      {state.tooltip && (
        <Tooltip
          text={state.tooltip.text}
          x={state.tooltip.x}
          y={state.tooltip.y}
        />
      )}
    </aside>
  );
}
