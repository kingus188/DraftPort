interface DesktopAPI {
  isDesktop: boolean;
  platform: string;
  fs: {
    selectWorkspace: () => Promise<{
      success: boolean;
      path?: string;
      canceled?: boolean;
    }>;
    setWorkspace: (
      dir: string,
    ) => Promise<{ success: boolean; path?: string; error?: string }>;
    listFiles: (
      dir?: string,
    ) => Promise<{ success: boolean; files?: unknown[]; error?: string }>;
    readFile: (
      filePath: string,
    ) => Promise<{ success: boolean; content?: string; error?: string }>;
    openFile: (
      filePath: string,
    ) => Promise<{ success: boolean; content?: string; error?: string }>;
    createFile: (payload: { filename?: string; content?: string }) => Promise<{
      success: boolean;
      filePath?: string;
      filename?: string;
      error?: string;
    }>;
    saveFile: (payload: {
      filePath: string;
      content: string;
    }) => Promise<{ success: boolean; error?: string }>;
    renameFile: (payload: {
      oldPath: string;
      newName: string;
    }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    deleteFile: (
      filePath: string,
    ) => Promise<{ success: boolean; error?: string }>;
    revealInFinder: (filePath: string) => Promise<void>;
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
    onRefresh: (callback: () => void) => unknown;
    removeRefreshListener: (handler: unknown) => void;
    onMenuNewFile: (callback: () => void) => unknown;
    onMenuSave: (callback: () => void) => unknown;
    onMenuSwitchWorkspace: (callback: () => void) => unknown;
    onMenuOpenRecentItem: (
      callback: (item: RecentItemRecord) => void,
    ) => unknown;
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
  window?: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };
  shell?: {
    openExternal: (url: string) => Promise<void>;
  };
  clipboard?: {
    writeHTML: (payload: {
      html: string;
      text: string;
    }) => Promise<{ success: boolean; error?: string }>;
    writeText: (text: string) => Promise<{ success: boolean; error?: string }>;
  };
}

interface RecentItemRecord {
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

declare global {
  interface Window {
    desktop?: DesktopAPI;
  }
}

export {};
