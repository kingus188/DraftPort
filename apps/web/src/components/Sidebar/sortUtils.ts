import type { FileItem, FolderItem, TreeItem } from "../../store/fileTypes";

const SORT_MODE_KEY = "draftport-file-sort-mode";

export type SortMode =
  | "opened-desc"
  | "updated-desc"
  | "name-asc"
  | "name-desc";
export type RecentItemMap = Map<string, string>;

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
      saved === "name-desc"
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
      return nameCollator.compare(a.title || a.name, b.title || b.name);
    case "name-desc":
      return nameCollator.compare(b.title || b.name, a.title || a.name);
  }
}

export function sortTreeItems(
  items: TreeItem[],
  mode: SortMode,
  recentItems?: RecentItemMap,
): TreeItem[] {
  if (mode === "opened-desc") {
    return [...items]
      .map((item) =>
        item.isDirectory
          ? {
              ...item,
              children: sortTreeItems(item.children, mode, recentItems),
            }
          : item,
      )
      .sort((a, b) => compareTreeItems(a, b, mode, recentItems));
  }

  const folders: FolderItem[] = [];
  const files: FileItem[] = [];
  for (const item of items) {
    if (item.isDirectory) {
      folders.push({
        ...item,
        children: sortTreeItems(item.children, mode, recentItems),
      });
    } else {
      files.push(item);
    }
  }
  folders.sort((a, b) => nameCollator.compare(a.name, b.name));
  files.sort((a, b) => compareFiles(a, b, mode, recentItems));
  return [...folders, ...files];
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
