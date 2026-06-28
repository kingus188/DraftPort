import type { FileItem, TreeItem } from "../store/fileTypes";

export interface DesktopFileItem {
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  size?: number;
  title?: string;
  themeName?: string;
  isDirectory?: boolean;
  children?: DesktopFileItem[];
}

export interface DesktopAPI {
  fs: {
    selectWorkspace: () => Promise<{
      success: boolean;
      path?: string;
      canceled?: boolean;
    }>;
    setWorkspace: (dir: string) => Promise<{ success: boolean; path?: string }>;
    listFiles: (
      dir?: string,
    ) => Promise<{ success: boolean; files?: DesktopFileItem[] }>;
    readFile: (
      path: string,
    ) => Promise<{ success: boolean; content?: string; error?: string }>;
    openFile?: (
      path: string,
    ) => Promise<{ success: boolean; content?: string; error?: string }>;
    createFile: (payload: {
      filename?: string;
      content?: string;
    }) => Promise<{ success: boolean; filePath?: string; filename?: string }>;
    saveFile: (payload: {
      filePath: string;
      content: string;
    }) => Promise<{ success: boolean; error?: string }>;
    renameFile: (payload: {
      oldPath: string;
      newName: string;
    }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    deleteFile: (path: string) => Promise<{ success: boolean; error?: string }>;
    revealInFinder: (path: string) => Promise<void>;
    createFolder: (folderName: string) => Promise<{
      success: boolean;
      path?: string;
      name?: string;
      error?: string;
    }>;
    moveFile: (payload: {
      filePath: string;
      targetFolder: string;
    }) => Promise<{ success: boolean; newPath?: string; error?: string }>;
    inspectFolder: (
      folderPath: string,
    ) => Promise<{ success: boolean; entries?: string[]; error?: string }>;
    deleteFolder: (
      payload: string | { folderPath: string; recursive?: boolean },
    ) => Promise<{ success: boolean; error?: string }>;
    renameFolder: (payload: {
      folderPath: string;
      newName: string;
    }) => Promise<{ success: boolean; newPath?: string; error?: string }>;
    moveFolder: (payload: {
      folderPath: string;
      targetFolder: string;
    }) => Promise<{ success: boolean; newPath?: string; error?: string }>;
    onRefresh: (cb: () => void) => unknown;
    removeRefreshListener: (handler: unknown) => void;
    onMenuNewFile: (cb: () => void) => unknown;
    onMenuSave: (cb: () => void) => unknown;
    onMenuSwitchWorkspace: (cb: () => void) => unknown;
    onMenuOpenRecentItem: (cb: (item: RecentItemRecord) => void) => unknown;
    removeAllListeners: () => void;
  };
  recentItems?: {
    list: (limit?: number) => Promise<{
      success: boolean;
      items?: RecentItemRecord[];
      error?: string;
    }>;
    recordOpen: (payload: {
      itemPath: string;
      itemType: "file" | "folder";
      title?: string;
      themeName?: string;
    }) => Promise<{
      success: boolean;
      item?: RecentItemRecord;
      error?: string;
    }>;
    remove: (itemPath: string) => Promise<{ success: boolean; error?: string }>;
    clear: () => Promise<{ success: boolean; error?: string }>;
    renamePath: (payload: {
      oldPath: string;
      newPath: string;
    }) => Promise<{ success: boolean; error?: string }>;
  };
  workspaceOrder?: {
    get: () => Promise<{
      success: boolean;
      order?: WorkspaceOrderConfig;
      error?: string;
    }>;
    save: (payload: WorkspaceOrderConfig) => Promise<{
      success: boolean;
      order?: WorkspaceOrderConfig;
      error?: string;
    }>;
  };
}

/** Project-local manual tree order keyed by parent folder path. */
export interface WorkspaceOrderConfig {
  version: 1;
  folders: Record<string, string[]>;
}

export interface RecentItemRecord {
  workspacePath: string;
  itemPath: string;
  itemType: "file" | "folder";
  title: string | null;
  themeName: string | null;
  openedAt: string;
  mtime: number | null;
  size: number | null;
  missing: boolean;
}

export const WORKSPACE_KEY = "draftport-workspace-path";
export const LAST_FILE_KEY = "draftport-last-file-path";

export const getDesktopBridge = (): DesktopAPI | null => {
  return window.desktop as unknown as DesktopAPI | null;
};

export function convertToTreeItems(items: DesktopFileItem[]): TreeItem[] {
  return items.map((entry) => {
    if (entry.isDirectory && entry.children) {
      return {
        name: entry.name,
        path: entry.path,
        createdAt: new Date(entry.createdAt),
        updatedAt: new Date(entry.updatedAt),
        isDirectory: true as const,
        children: convertToTreeItems(entry.children),
      };
    }
    return {
      name: entry.name,
      path: entry.path,
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt),
      size: entry.size ?? 0,
      title: entry.title,
      themeName: entry.themeName,
      isDirectory: false as const,
    };
  });
}

export function flattenFiles(items: TreeItem[]): FileItem[] {
  const result: FileItem[] = [];
  for (const item of items) {
    if (item.isDirectory) {
      result.push(...flattenFiles(item.children));
    } else {
      result.push(item as FileItem);
    }
  }
  return result;
}

/** Returns whether a file tree item is a Markdown document DraftPort can open. */
export function isMarkdownFile(file: FileItem): boolean {
  return file.name.toLowerCase().endsWith(".md");
}

/**
 * Chooses the restored Markdown file, preferring a valid persisted path before
 * falling back to the first Markdown file in the current tree order.
 */
export function findDefaultMarkdownFile(
  items: TreeItem[],
  lastPath?: string | null,
): FileItem | null {
  const markdownFiles = flattenFiles(items).filter(isMarkdownFile);
  if (!markdownFiles.length) return null;
  if (!lastPath) return markdownFiles[0];
  return (
    markdownFiles.find((file) => file.path === lastPath) ?? markdownFiles[0]
  );
}

export function splitPath(filePath: string): { dir: string; sep: string } {
  const lastSlash = Math.max(
    filePath.lastIndexOf("/"),
    filePath.lastIndexOf("\\"),
  );
  if (lastSlash === -1) {
    return { dir: "", sep: "/" };
  }
  return { dir: filePath.slice(0, lastSlash), sep: filePath[lastSlash] };
}

export function joinPath(base: string | undefined, name: string): string {
  if (!base) return name;
  const sep = base.includes("\\") ? "\\" : "/";
  const trimmed = base.replace(/[\\/]+$/, "");
  return `${trimmed}${sep}${name}`;
}

export function normalizePath(input: string): string {
  return input.replace(/\\/g, "/");
}

export function replacePathPrefix(
  filePath: string,
  oldPrefix: string,
  newPrefix: string,
): string | null {
  const normalizedPath = normalizePath(filePath);
  const normalizedOld = normalizePath(oldPrefix);
  const normalizedNew = normalizePath(newPrefix);

  if (normalizedPath === normalizedOld) {
    const output = normalizedNew;
    return newPrefix.includes("\\") ? output.replace(/\//g, "\\") : output;
  }

  if (!normalizedPath.startsWith(`${normalizedOld}/`)) return null;
  const suffix = normalizedPath.slice(normalizedOld.length);
  const output = normalizedNew + suffix;
  return newPrefix.includes("\\") ? output.replace(/\//g, "\\") : output;
}

export function isPathWithinFolder(
  filePath: string,
  folderPath: string,
): boolean {
  const normalizedFile = normalizePath(filePath);
  const normalizedFolder = normalizePath(folderPath);
  return (
    normalizedFile === normalizedFolder ||
    normalizedFile.startsWith(`${normalizedFolder}/`)
  );
}
