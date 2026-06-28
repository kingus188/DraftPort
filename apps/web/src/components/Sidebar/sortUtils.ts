import type { FileItem, FolderItem, TreeItem } from "../../store/fileTypes";

const SORT_MODE_KEY = "draftport-file-sort-mode";

export type SortMode =
  | "opened-desc"
  | "updated-desc"
  | "name-asc"
  | "name-desc"
  | "manual";
export type RecentItemMap = Map<string, string>;
export type ManualOrderFolders = Record<string, string[]>;
export type FolderSortModes = Record<string, SortMode>;

const nameCollator = new Intl.Collator("zh-Hans", {
  numeric: true,
  sensitivity: "base",
});

export function getSortMode(): SortMode {
  try {
    const saved = localStorage.getItem(SORT_MODE_KEY);
    if (saved === "recent") return "updated-desc";
    if (
      saved === "opened-desc" ||
      saved === "updated-desc" ||
      saved === "name-asc" ||
      saved === "name-desc" ||
      saved === "manual"
    )
      return saved;
  } catch {
    /* ignore */
  }
  return "opened-desc";
}

export function saveSortMode(mode: SortMode) {
  localStorage.setItem(SORT_MODE_KEY, mode);
}

/**
 * Compares file rows for sidebar ordering, keeping "name" modes aligned with
 * the filename shown in the file tree instead of document frontmatter titles.
 */
export function compareFiles(
  a: FileItem,
  b: FileItem,
  mode: SortMode,
  recentItems?: RecentItemMap,
): number {
  switch (mode) {
    case "opened-desc":
      return compareRecentItems(a, b, recentItems);
    case "updated-desc":
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    case "name-asc":
      return nameCollator.compare(a.name, b.name);
    case "name-desc":
      return nameCollator.compare(b.name, a.name);
    case "manual":
      return nameCollator.compare(a.name, b.name);
  }
}

/**
 * Sorts each tree level with that parent folder's configured mode, falling
 * back to the legacy root mode when no folder-specific setting exists.
 */
export function sortTreeItems(
  items: TreeItem[],
  mode: SortMode,
  recentItems?: RecentItemMap,
  manualOrderFolders?: ManualOrderFolders,
  parentPath = "/",
  folderSortModes?: FolderSortModes,
): TreeItem[] {
  const effectiveMode = folderSortModes?.[parentPath] ?? mode;
  const itemsWithSortedChildren = items.map((item) =>
    item.isDirectory
      ? {
          ...item,
          children: sortTreeItems(
            item.children,
            mode,
            recentItems,
            manualOrderFolders,
            item.path,
            folderSortModes,
          ),
        }
      : item,
  );

  if (effectiveMode === "manual") {
    return sortManualTreeLevelItems(
      itemsWithSortedChildren,
      manualOrderFolders,
      parentPath,
    );
  }

  if (effectiveMode === "opened-desc") {
    return [...itemsWithSortedChildren].sort((a, b) =>
      compareTreeItems(a, b, effectiveMode, recentItems),
    );
  }

  const folders: FolderItem[] = [];
  const files: FileItem[] = [];
  for (const item of itemsWithSortedChildren) {
    if (item.isDirectory) {
      folders.push(item);
    } else {
      files.push(item);
    }
  }
  folders.sort((a, b) => nameCollator.compare(a.name, b.name));
  files.sort((a, b) => compareFiles(a, b, effectiveMode, recentItems));
  return [...folders, ...files];
}

/** Applies project-local manual order to one already-sorted tree level. */
function sortManualTreeLevelItems(
  items: TreeItem[],
  manualOrderFolders: ManualOrderFolders | undefined,
  parentPath: string,
): TreeItem[] {
  const orderedPaths = manualOrderFolders?.[parentPath] ?? [];
  const orderIndex = new Map(orderedPaths.map((path, index) => [path, index]));
  return [...items].sort((left, right) => {
    const leftIndex = orderIndex.get(left.path);
    const rightIndex = orderIndex.get(right.path);
    if (leftIndex !== undefined && rightIndex !== undefined) {
      return leftIndex - rightIndex;
    }
    if (leftIndex !== undefined) return -1;
    if (rightIndex !== undefined) return 1;
    return 0;
  });
}

function compareTreeItems(
  a: TreeItem,
  b: TreeItem,
  mode: SortMode,
  recentItems?: RecentItemMap,
) {
  if (!a.isDirectory && !b.isDirectory) {
    return compareFiles(a, b, mode, recentItems);
  }
  if (mode === "opened-desc") {
    const recentComparison = compareRecentItems(a, b, recentItems);
    if (recentComparison !== 0) return recentComparison;
  }
  if (a.isDirectory && !b.isDirectory) return -1;
  if (!a.isDirectory && b.isDirectory) return 1;
  if (a.isDirectory && b.isDirectory) {
    return nameCollator.compare(a.name, b.name);
  }
  return 0;
}

function compareRecentItems(
  a: Pick<TreeItem, "path" | "updatedAt" | "name">,
  b: Pick<TreeItem, "path" | "updatedAt" | "name">,
  recentItems?: RecentItemMap,
) {
  const openedA = recentItems?.get(a.path);
  const openedB = recentItems?.get(b.path);
  if (openedA && openedB) {
    const diff = new Date(openedB).getTime() - new Date(openedA).getTime();
    if (diff !== 0) return diff;
    return nameCollator.compare(a.name, b.name);
  }
  if (openedA) return -1;
  if (openedB) return 1;
  const updatedDiff =
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  if (updatedDiff !== 0) return updatedDiff;
  return nameCollator.compare(a.name, b.name);
}
