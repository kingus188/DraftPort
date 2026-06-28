import type { SyntheticEvent } from "react";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useFileSystem } from "../../hooks/useFileSystem";
import { getDesktopBridge } from "../../hooks/useFileSystemHelpers";
import toast from "react-hot-toast";
import type { FileItem, FolderItem } from "../../store/fileTypes";
import {
  type FolderSortModes,
  type ManualOrderFolders,
  type SortMode,
  getSortMode,
  saveSortMode,
} from "./sortUtils";
import {
  buildFilteredItems,
  collectDirectChildPaths,
  collectAllFolders,
  expandAncestorFolders,
  FILE_DRAG_TYPE,
  findFolderByPath,
  FOLDER_DRAG_TYPE,
  formatRelativeTime,
  getBaseName,
  getCollapsedState,
  isDescendantPath,
  remapPath,
  reorderSiblingPaths,
  resolveOrderParentPath,
  resolveParentFolderPath,
  ROOT_DROP_TARGET,
  saveCollapsedState,
} from "./sidebarStateHelpers";

export { ROOT_DROP_TARGET, FILE_DRAG_TYPE, FOLDER_DRAG_TYPE, getBaseName };

/**
 * Builds the interaction state and file-system actions needed by the file tree sidebar.
 */
export function useSidebarState() {
  const desktop = getDesktopBridge();
  const {
    files,
    currentFile,
    openFile,
    createFile,
    updateFileTitle,
    deleteFile,
    selectWorkspace,
    workspacePath,
    createFolder,
    moveToFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    inspectFolder,
    refreshFiles,
    flattenFiles,
  } = useFileSystem();

  const [filter, setFilter] = useState("");
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [collapsedFolders, setCollapsedFolders] =
    useState<Set<string>>(getCollapsedState);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [menuTarget, setMenuTarget] = useState<FileItem | null>(null);
  const [menuTargetFolder, setMenuTargetFolder] = useState<FolderItem | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] =
    useState<FolderItem | null>(null);
  const [deleteFolderExtras, setDeleteFolderExtras] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [showContextSortMenu, setShowContextSortMenu] = useState(false);
  const [contextMenuFolderPath, setContextMenuFolderPath] = useState<
    string | null
  >(null);
  const [newFolderParentPath, setNewFolderParentPath] = useState<string | null>(
    null,
  );
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const [renameFolderTarget, setRenameFolderTarget] =
    useState<FolderItem | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState("");
  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
  const [sortMode, setSortModeState] = useState<SortMode>(getSortMode);
  const [recentItems, setRecentItems] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [manualOrderFolders, setManualOrderFolders] =
    useState<ManualOrderFolders>({});
  const [folderSortModes, setFolderSortModes] = useState<FolderSortModes>({});
  const workspaceOrderMutationRef = useRef(0);

  const isDragEnabled = !filter;

  const allFolders = useMemo(() => collectAllFolders(files), [files]);

  const refreshRecentItems = useCallback(async () => {
    if (!desktop?.recentItems) {
      setRecentItems(new Map());
      return;
    }
    try {
      const result = await desktop.recentItems.list();
      if (!result.success || !result.items) {
        setRecentItems(new Map());
        return;
      }
      setRecentItems(
        new Map(result.items.map((item) => [item.itemPath, item.openedAt])),
      );
    } catch (error) {
      console.error("[RecentItems] load failed", error);
      setRecentItems(new Map());
    }
  }, [desktop]);

  useEffect(() => {
    void refreshRecentItems();
  }, [refreshRecentItems, workspacePath]);

  /** Loads the project-local manual order for the currently active workspace. */
  const refreshWorkspaceOrder = useCallback(async () => {
    if (!desktop?.workspaceOrder || !workspacePath) {
      setManualOrderFolders({});
      setFolderSortModes({});
      return;
    }
    const loadRevision = workspaceOrderMutationRef.current;
    try {
      const result = await desktop.workspaceOrder.get();
      if (workspaceOrderMutationRef.current !== loadRevision) {
        return;
      }
      if (!result.success || !result.order) {
        setManualOrderFolders({});
        setFolderSortModes({});
        return;
      }
      setManualOrderFolders(result.order.folders ?? {});
      setFolderSortModes(result.order.sortModes ?? {});
    } catch (error) {
      if (workspaceOrderMutationRef.current !== loadRevision) {
        return;
      }
      console.error("[WorkspaceOrder] load failed", error);
      setManualOrderFolders({});
      setFolderSortModes({});
    }
  }, [desktop, workspacePath]);

  useEffect(() => {
    void refreshWorkspaceOrder();
  }, [refreshWorkspaceOrder]);

  useEffect(() => {
    const handleRecentFolder = (event: Event) => {
      const detail = (event as CustomEvent<{ itemPath?: string }>).detail;
      if (!detail?.itemPath) return;
      const folderPath = detail.itemPath;
      setActiveFolder(folderPath === workspacePath ? null : folderPath);
      setCollapsedFolders((prev) => {
        const next = expandAncestorFolders(prev, folderPath, workspacePath);
        saveCollapsedState(next);
        return next;
      });
      void refreshRecentItems();
    };
    window.addEventListener("draftport:open-recent-folder", handleRecentFolder);
    return () => {
      window.removeEventListener(
        "draftport:open-recent-folder",
        handleRecentFolder,
      );
    };
  }, [refreshRecentItems, workspacePath]);

  const recordFolderOpen = useCallback(
    async (folderPath: string | null) => {
      if (!desktop?.recentItems || !workspacePath) return;
      const targetPath = folderPath ?? workspacePath;
      try {
        const result = await desktop.recentItems.recordOpen({
          itemPath: targetPath,
          itemType: "folder",
        });
        if (result.success) {
          await refreshRecentItems();
        }
      } catch (error) {
        console.error("[RecentItems] record folder failed", error);
      }
    },
    [desktop, refreshRecentItems, workspacePath],
  );

  const filteredItems = useMemo(
    () =>
      buildFilteredItems(
        files,
        filter,
        flattenFiles,
        sortMode,
        recentItems,
        manualOrderFolders,
        workspacePath,
        folderSortModes,
      ),
    [
      files,
      filter,
      flattenFiles,
      sortMode,
      recentItems,
      manualOrderFolders,
      workspacePath,
      folderSortModes,
    ],
  );

  const activeSortTarget = activeFolder ?? workspacePath;
  const activeSortMode = activeSortTarget
    ? (folderSortModes[activeSortTarget] ?? sortMode)
    : sortMode;

  /** Resolves the sort mode for a concrete folder path without changing state. */
  const getSortModeForPath = useCallback(
    (folderPath: string | null | undefined): SortMode => {
      if (!folderPath) return sortMode;
      return folderSortModes[folderPath] ?? sortMode;
    },
    [folderSortModes, sortMode],
  );

  const handleSetSortMode = useCallback(
    async (mode: SortMode, explicitTargetPath?: string | null) => {
      const targetPath =
        explicitTargetPath !== undefined
          ? explicitTargetPath
          : (activeFolder ?? workspacePath);
      if (!targetPath) {
        setSortModeState(mode);
        saveSortMode(mode);
        return;
      }

      const previousSortMode = sortMode;
      const previousFolderSortModes = folderSortModes;
      const nextFolderSortModes = {
        ...folderSortModes,
        [targetPath]: mode,
      };

      workspaceOrderMutationRef.current += 1;
      setFolderSortModes(nextFolderSortModes);
      if (targetPath === workspacePath) {
        setSortModeState(mode);
        saveSortMode(mode);
      }

      try {
        const result = await desktop?.workspaceOrder?.save({
          version: 1,
          folders: manualOrderFolders,
          sortModes: nextFolderSortModes,
        });
        if (desktop?.workspaceOrder && !result?.success) {
          throw new Error(result?.error || "排序保存失败");
        }
      } catch (error) {
        console.error("[WorkspaceOrder] save sort mode failed", error);
        setFolderSortModes(previousFolderSortModes);
        if (targetPath === workspacePath) {
          setSortModeState(previousSortMode);
          saveSortMode(previousSortMode);
        }
        toast.error("排序保存失败");
      }
    },
    [
      activeFolder,
      desktop,
      folderSortModes,
      manualOrderFolders,
      sortMode,
      workspacePath,
    ],
  );

  const getDisplayTitle = useCallback(
    (file: FileItem) => file.title?.trim() || file.name.replace(/\.md$/i, ""),
    [],
  );

  const getContextMenuFolderPath = useCallback(
    () => contextMenuFolderPath ?? menuTargetFolder?.path ?? activeFolder,
    [activeFolder, contextMenuFolderPath, menuTargetFolder],
  );

  const contextSortTarget = getContextMenuFolderPath() ?? workspacePath;
  const contextSortMode = getSortModeForPath(contextSortTarget);

  /** Opens the new-folder modal with an explicit target parent folder. */
  const startCreateFolder = useCallback((parentPath?: string | null) => {
    setNewFolderParentPath(parentPath ?? null);
    setShowNewFolderModal(true);
  }, []);

  /** Closes the new-folder modal and clears any context-menu parent target. */
  const closeNewFolderModal = useCallback(() => {
    setShowNewFolderModal(false);
    setNewFolderParentPath(null);
  }, []);

  const toggleFolder = useCallback(
    (folderPath: string) => {
      void recordFolderOpen(folderPath);
      setCollapsedFolders((prev) => {
        const next = new Set(prev);
        if (next.has(folderPath)) {
          next.delete(folderPath);
          setActiveFolder(folderPath);
        } else {
          next.add(folderPath);
          setActiveFolder((current) =>
            current === folderPath ? null : current,
          );
        }
        saveCollapsedState(next);
        return next;
      });
    },
    [recordFolderOpen],
  );

  const updateFolderPathState = useCallback(
    (oldPath: string, newPath: string) => {
      setActiveFolder((current) => {
        if (!current) return current;
        return remapPath(current, oldPath, newPath) ?? current;
      });

      setCollapsedFolders((prev) => {
        const next = new Set<string>();
        for (const entry of prev) {
          next.add(remapPath(entry, oldPath, newPath) ?? entry);
        }
        saveCollapsedState(next);
        return next;
      });
    },
    [],
  );

  const getFolderMoveTargets = useCallback(
    (folder: FolderItem) => {
      return allFolders.filter((item) => {
        if (item.path === folder.path) return false;
        return !isDescendantPath(folder.path, item.path);
      });
    },
    [allFolders],
  );

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuTarget(null);
    setMenuTargetFolder(null);
    setContextMenuFolderPath(null);
    setShowMoveMenu(false);
    setShowContextSortMenu(false);
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, file: FileItem) => {
      e.preventDefault();
      e.stopPropagation();
      setMenuTarget(file);
      setMenuTargetFolder(null);
      setContextMenuFolderPath(null);
      setMenuPos({ x: e.clientX, y: e.clientY });
      setMenuOpen(true);
      setShowMoveMenu(false);
      setShowContextSortMenu(false);
    },
    [],
  );

  /** Opens a folder menu and makes that folder the active sort/create target. */
  const handleFolderContextMenu = useCallback(
    (e: React.MouseEvent, folder: FolderItem) => {
      e.preventDefault();
      e.stopPropagation();
      setActiveFolder(folder.path);
      setContextMenuFolderPath(folder.path);
      setMenuTargetFolder(folder);
      setMenuTarget(null);
      setMenuPos({ x: e.clientX, y: e.clientY });
      setMenuOpen(true);
      setShowMoveMenu(false);
      setShowContextSortMenu(false);
    },
    [],
  );

  const handleEmptyContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setMenuTarget(null);
      setMenuTargetFolder(null);
      setContextMenuFolderPath(activeFolder ?? workspacePath ?? null);
      setMenuPos({ x: e.clientX, y: e.clientY });
      setMenuOpen(true);
      setShowMoveMenu(false);
      setShowContextSortMenu(false);
    },
    [activeFolder, workspacePath],
  );

  const startRename = useCallback(
    (file: FileItem) => {
      setRenamingPath(file.path);
      setRenameValue(getDisplayTitle(file));
      closeMenu();
    },
    [closeMenu, getDisplayTitle],
  );

  const copyTitle = useCallback(
    async (file: FileItem) => {
      try {
        const title = getDisplayTitle(file);
        await navigator.clipboard.writeText(title);
        toast.success("标题已复制");
      } catch {
        toast.error("复制失败");
      }
      closeMenu();
    },
    [closeMenu, getDisplayTitle],
  );

  const submitRename = useCallback(async () => {
    if (renamingPath && renameValue) {
      const flatFiles = flattenFiles(files);
      const file = flatFiles.find((f) => f.path === renamingPath);
      if (file) {
        await updateFileTitle(file, renameValue);
      }
    }
    setRenamingPath(null);
  }, [renamingPath, renameValue, files, flattenFiles, updateFileTitle]);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) {
      toast.error("请输入文件夹名称");
      return;
    }
    const parentPath = newFolderParentPath ?? activeFolder;
    await createFolder(newFolderName.trim(), parentPath || undefined);
    setNewFolderName("");
    closeNewFolderModal();
  }, [
    newFolderName,
    newFolderParentPath,
    activeFolder,
    createFolder,
    closeNewFolderModal,
  ]);

  const handleCreateFileFromContextMenu = useCallback(async () => {
    await createFile(getContextMenuFolderPath() || undefined);
    closeMenu();
  }, [closeMenu, createFile, getContextMenuFolderPath]);

  const handleStartCreateFolderFromContextMenu = useCallback(() => {
    startCreateFolder(getContextMenuFolderPath());
    closeMenu();
  }, [closeMenu, getContextMenuFolderPath, startCreateFolder]);

  const handleSetContextSortMode = useCallback(
    async (mode: SortMode) => {
      await handleSetSortMode(
        mode,
        getContextMenuFolderPath() ?? workspacePath,
      );
      closeMenu();
    },
    [closeMenu, getContextMenuFolderPath, handleSetSortMode, workspacePath],
  );

  const handleMoveToFolder = useCallback(
    async (targetFolder: string) => {
      if (menuTarget) {
        await moveToFolder(menuTarget, targetFolder);
      }
      closeMenu();
    },
    [menuTarget, moveToFolder, closeMenu],
  );

  const handleMoveFolder = useCallback(
    async (targetFolder: string) => {
      if (!menuTargetFolder) return;
      const res = await moveFolder(menuTargetFolder, targetFolder);
      if (res.success && res.newPath) {
        updateFolderPathState(menuTargetFolder.path, res.newPath);
      }
      closeMenu();
    },
    [menuTargetFolder, moveFolder, updateFolderPathState, closeMenu],
  );

  const handleRenameFolder = useCallback(async () => {
    if (!renameFolderTarget) return;
    const nextName = renameFolderValue.trim();
    if (!nextName) {
      toast.error("请输入文件夹名称");
      return;
    }
    const res = await renameFolder(renameFolderTarget, nextName);
    if (res.success && res.newPath) {
      updateFolderPathState(renameFolderTarget.path, res.newPath);
    }
    setShowRenameFolderModal(false);
    setRenameFolderTarget(null);
    setRenameFolderValue("");
  }, [
    renameFolderTarget,
    renameFolderValue,
    renameFolder,
    updateFolderPathState,
  ]);

  const closeRenameFolderModal = useCallback(() => {
    setShowRenameFolderModal(false);
    setRenameFolderTarget(null);
    setRenameFolderValue("");
  }, []);

  const prepareDeleteFolder = useCallback(
    async (folder: FolderItem) => {
      setDeleteFolderTarget(folder);
      setDeleteFolderExtras([]);
      const extras = await inspectFolder(folder.path);
      setDeleteFolderExtras(extras);
    },
    [inspectFolder],
  );

  const showTooltipFn = useCallback((e: SyntheticEvent, text: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ text, x: rect.left + rect.width / 2, y: rect.bottom + 8 });
  }, []);

  const hideTooltip = useCallback(() => setTooltip(null), []);

  const findFileByPath = useCallback(
    (path: string) => flattenFiles(files).find((item) => item.path === path),
    [files, flattenFiles],
  );

  /** Reorders a dragged item path within the same parent without moving it on disk. */
  const reorderDraggedPath = useCallback(
    async (
      draggedPath: string,
      targetPath: string,
      position: "before" | "after",
    ) => {
      if (!isDragEnabled || !workspacePath) return;
      if (!draggedPath || draggedPath === targetPath) return;

      const draggedParent = resolveOrderParentPath(draggedPath, workspacePath);
      const targetParent = resolveOrderParentPath(targetPath, workspacePath);
      if (!draggedParent || draggedParent !== targetParent) {
        setDragOverTarget(null);
        return;
      }

      const currentPaths = collectDirectChildPaths(
        filteredItems,
        draggedParent,
        workspacePath,
      );
      const nextPaths = reorderSiblingPaths(
        currentPaths,
        draggedPath,
        targetPath,
        position,
      );
      if (nextPaths.join("\n") === currentPaths.join("\n")) {
        setDragOverTarget(null);
        return;
      }

      const previousFolders = manualOrderFolders;
      const previousFolderSortModes = folderSortModes;
      const previousSortMode = sortMode;
      const nextFolders = {
        ...manualOrderFolders,
        [draggedParent]: nextPaths,
      };
      const nextFolderSortModes = {
        ...folderSortModes,
        [draggedParent]: "manual" as SortMode,
      };
      workspaceOrderMutationRef.current += 1;
      setManualOrderFolders(nextFolders);
      setFolderSortModes(nextFolderSortModes);
      if (draggedParent === workspacePath && sortMode !== "manual") {
        setSortModeState("manual");
        saveSortMode("manual");
      }
      setDragOverTarget(null);
      try {
        const result = await desktop?.workspaceOrder?.save({
          version: 1,
          folders: nextFolders,
          sortModes: nextFolderSortModes,
        });
        if (!result?.success) {
          throw new Error(result?.error || "排序保存失败");
        }
      } catch (error) {
        console.error("[WorkspaceOrder] save failed", error);
        setManualOrderFolders(previousFolders);
        setFolderSortModes(previousFolderSortModes);
        if (draggedParent === workspacePath) {
          setSortModeState(previousSortMode);
          saveSortMode(previousSortMode);
        }
        toast.error("排序保存失败");
      }
    },
    [
      desktop,
      filteredItems,
      isDragEnabled,
      folderSortModes,
      manualOrderFolders,
      sortMode,
      workspacePath,
    ],
  );

  /** Moves a dragged tree item path to a folder using the existing file-system actions. */
  const moveDraggedPathToFolder = useCallback(
    async (draggedPath: string, targetFolder: string) => {
      if (!isDragEnabled || !draggedPath) return;
      const folder = findFolderByPath(files, draggedPath);
      if (folder) {
        if (targetFolder && isDescendantPath(draggedPath, targetFolder)) {
          setDragOverTarget(null);
          return;
        }
        const res = await moveFolder(folder, targetFolder);
        if (res.success && res.newPath) {
          updateFolderPathState(folder.path, res.newPath);
        }
        setDragOverTarget(null);
        return;
      }

      const file = findFileByPath(draggedPath);
      if (!file) return;
      await moveToFolder(file, targetFolder);
      setDragOverTarget(null);
    },
    [
      files,
      findFileByPath,
      isDragEnabled,
      moveFolder,
      moveToFolder,
      updateFolderPathState,
    ],
  );

  /** Finishes a drag using an explicit insertion or folder intent. */
  const finishDraggedPathWithIntent = useCallback(
    async (draggedPath: string, intent: string | null) => {
      if (!draggedPath || !intent) {
        setDragOverTarget(null);
        return;
      }

      if (intent === ROOT_DROP_TARGET) {
        await moveDraggedPathToFolder(draggedPath, "");
        return;
      }

      const beforeSuffix = ":before";
      const afterSuffix = ":after";
      if (intent.endsWith(beforeSuffix)) {
        await reorderDraggedPath(
          draggedPath,
          intent.slice(0, -beforeSuffix.length),
          "before",
        );
        return;
      }
      if (intent.endsWith(afterSuffix)) {
        await reorderDraggedPath(
          draggedPath,
          intent.slice(0, -afterSuffix.length),
          "after",
        );
        return;
      }

      await moveDraggedPathToFolder(draggedPath, intent);
    },
    [moveDraggedPathToFolder, reorderDraggedPath, setDragOverTarget],
  );

  const handleFileClick = useCallback(
    async (file: FileItem) => {
      await openFile(file);
      // file_open records recent history in Tauri; defer reloading that sort input
      // so selecting a file does not reshuffle the visible tree immediately.
      const parentPath = resolveParentFolderPath(file.path, workspacePath);
      setActiveFolder(parentPath);

      if (parentPath) {
        setCollapsedFolders((prev) => {
          const next = expandAncestorFolders(prev, file.path, workspacePath);
          saveCollapsedState(next);
          return next;
        });
      }
    },
    [openFile, workspacePath],
  );

  const handleRootFolderClick = useCallback(() => {
    setActiveFolder(null);
    void recordFolderOpen(null);
  }, [recordFolderOpen]);

  const formatTime = useCallback((date: Date) => formatRelativeTime(date), []);

  return {
    files,
    currentFile,
    createFile,
    deleteFile,
    deleteFolder,
    refreshFiles,
    selectWorkspace,
    workspacePath,
    flattenFiles,

    allFolders,
    filteredItems,
    isDragEnabled,

    filter,
    setFilter,
    renamingPath,
    setRenamingPath,
    renameValue,
    setRenameValue,
    collapsedFolders,
    menuOpen,
    menuPos,
    menuTarget,
    menuTargetFolder,
    deleteTarget,
    setDeleteTarget,
    deleteFolderTarget,
    setDeleteFolderTarget,
    deleteFolderExtras,
    setDeleteFolderExtras,
    deleting,
    setDeleting,
    showNewFolderModal,
    setShowNewFolderModal,
    newFolderName,
    setNewFolderName,
    activeFolder,
    setActiveFolder,
    showMoveMenu,
    setShowMoveMenu,
    showContextSortMenu,
    setShowContextSortMenu,
    dragOverTarget,
    setDragOverTarget,
    tooltip,
    renameFolderTarget,
    setRenameFolderTarget,
    renameFolderValue,
    setRenameFolderValue,
    showRenameFolderModal,
    setShowRenameFolderModal,
    sortMode,
    activeSortMode,
    contextSortMode,
    getSortModeForPath,
    handleSetSortMode,

    toggleFolder,
    getFolderMoveTargets,
    closeMenu,
    handleContextMenu,
    handleFolderContextMenu,
    handleEmptyContextMenu,
    startRename,
    copyTitle,
    submitRename,
    startCreateFolder,
    closeNewFolderModal,
    handleCreateFolder,
    handleCreateFileFromContextMenu,
    handleStartCreateFolderFromContextMenu,
    handleSetContextSortMode,
    handleMoveToFolder,
    handleMoveFolder,
    handleRenameFolder,
    closeRenameFolderModal,
    prepareDeleteFolder,
    showTooltip: showTooltipFn,
    hideTooltip,
    reorderDraggedPath,
    moveDraggedPathToFolder,
    finishDraggedPathWithIntent,
    handleFileClick,
    handleRootFolderClick,
    formatTime,
  };
}
