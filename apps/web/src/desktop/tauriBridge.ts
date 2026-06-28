/**
 * Exposes the `window.desktop` API backed by Tauri commands, giving the
 * renderer a single stable contract to reach the native shell.
 */

type TauriInvoke = (command: string, payload?: unknown) => Promise<unknown>;
type TauriUnlisten = () => void;
type TauriListen = (
  event: string,
  callback: (event: { payload?: unknown }) => void,
) => Promise<TauriUnlisten>;

interface TauriInternals {
  invoke?: TauriInvoke;
}

interface TauriGlobalApi {
  event?: {
    listen?: TauriListen;
  };
}

interface TauriBridgeOptions {
  listen?: TauriListen;
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

type WorkspaceOrderSortMode =
  | "opened-desc"
  | "updated-desc"
  | "name-asc"
  | "name-desc"
  | "manual";

interface WorkspaceOrderConfig {
  version: 1;
  folders: Record<string, string[]>;
  sortModes?: Record<string, WorkspaceOrderSortMode>;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriInternals;
    __TAURI__?: TauriGlobalApi;
  }
}

const COMMANDS = {
  selectWorkspace: "workspace_select",
  setWorkspace: "workspace_set",
  listFiles: "file_list",
  readFile: "file_read",
  openFile: "file_open",
  createFile: "file_create",
  saveFile: "file_save",
  renameFile: "file_rename",
  deleteFile: "file_delete",
  revealInFinder: "file_reveal",
  createFolder: "folder_create",
  moveFile: "folder_move_file",
  inspectFolder: "folder_inspect",
  deleteFolder: "folder_delete",
  renameFolder: "folder_rename",
  moveFolder: "folder_move_folder",
  recentItemsList: "recent_items_list",
  recentItemsRecordOpen: "recent_items_record_open",
  recentItemsRemove: "recent_items_remove",
  recentItemsClear: "recent_items_clear",
  recentItemsRenamePath: "recent_items_rename_path",
  workspaceOrderGet: "workspace_order_get",
  workspaceOrderSave: "workspace_order_save",
  windowMinimize: "window_minimize",
  windowMaximize: "window_maximize",
  windowClose: "window_close",
  windowIsMaximized: "window_is_maximized",
  shellOpenExternal: "shell_open_external",
  clipboardWriteHtml: "clipboard_write_html",
  clipboardWriteText: "clipboard_write_text",
} as const;

/**
 * Installs `window.desktop` only when Tauri injected IPC is available, and
 * never overwrites a bridge that was already set up.
 */
export function installTauriDesktopBridge(
  options: TauriBridgeOptions = {},
): void {
  if (window.desktop || !window.__TAURI_INTERNALS__?.invoke) return;

  const invoke = window.__TAURI_INTERNALS__.invoke;
  const listen = options.listen ?? window.__TAURI__?.event?.listen;
  const unlisteners: TauriUnlisten[] = [];

  const call = <T>(command: string, payload?: unknown) =>
    invoke(command, payload) as Promise<T>;

  const onDesktopEvent = (
    event: string,
    callback: (payload?: unknown) => void,
  ): unknown => {
    if (!listen) return undefined;
    const token = { event, callback };
    listen(event, ({ payload }) => callback(payload)).then((unlisten) => {
      unlisteners.push(unlisten);
    });
    return token;
  };

  const removeAllListeners = () => {
    while (unlisteners.length > 0) {
      unlisteners.pop()?.();
    }
  };

  window.desktop = {
    isDesktop: true,
    platform: detectPlatform(),
    fs: {
      selectWorkspace: () => call(COMMANDS.selectWorkspace),
      setWorkspace: (dir) => call(COMMANDS.setWorkspace, { dir }),
      listFiles: (dir) => call(COMMANDS.listFiles, { dir }),
      readFile: (filePath) => call(COMMANDS.readFile, { filePath }),
      openFile: (filePath) => call(COMMANDS.openFile, { filePath }),
      createFile: (payload) => call(COMMANDS.createFile, { payload }),
      saveFile: (payload) => call(COMMANDS.saveFile, { payload }),
      renameFile: (payload) => call(COMMANDS.renameFile, { payload }),
      deleteFile: (filePath) => call(COMMANDS.deleteFile, { filePath }),
      revealInFinder: (filePath) => call(COMMANDS.revealInFinder, { filePath }),
      createFolder: (folderName) => call(COMMANDS.createFolder, { folderName }),
      moveFile: (payload) => call(COMMANDS.moveFile, { payload }),
      inspectFolder: (folderPath) =>
        call(COMMANDS.inspectFolder, { folderPath }),
      deleteFolder: (payload) => call(COMMANDS.deleteFolder, { payload }),
      renameFolder: (payload) => call(COMMANDS.renameFolder, { payload }),
      moveFolder: (payload) => call(COMMANDS.moveFolder, { payload }),
      onRefresh: (callback) => onDesktopEvent("file:refresh", callback),
      removeRefreshListener: () => undefined,
      onMenuNewFile: (callback) => onDesktopEvent("menu:new-file", callback),
      onMenuSave: (callback) => onDesktopEvent("menu:save", callback),
      onMenuSwitchWorkspace: (callback) =>
        onDesktopEvent("menu:switch-workspace", callback),
      onMenuOpenRecentItem: (callback) =>
        onDesktopEvent("menu:open-recent-item", (payload) =>
          callback(payload as RecentItemRecord),
        ),
      removeAllListeners,
    },
    recentItems: {
      list: (limit) => call(COMMANDS.recentItemsList, { limit }),
      recordOpen: (payload) =>
        call(COMMANDS.recentItemsRecordOpen, { payload }),
      remove: (itemPath) => call(COMMANDS.recentItemsRemove, { itemPath }),
      clear: () => call(COMMANDS.recentItemsClear),
      renamePath: (payload) =>
        call(COMMANDS.recentItemsRenamePath, { payload }),
    },
    workspaceOrder: {
      get: () => call(COMMANDS.workspaceOrderGet),
      save: (payload: WorkspaceOrderConfig) =>
        call(COMMANDS.workspaceOrderSave, { payload }),
    },
    window: {
      minimize: () => call(COMMANDS.windowMinimize),
      maximize: () => call(COMMANDS.windowMaximize),
      close: () => call(COMMANDS.windowClose),
      isMaximized: () => call(COMMANDS.windowIsMaximized),
    },
    shell: {
      openExternal: (url) => call(COMMANDS.shellOpenExternal, { url }),
    },
    clipboard: {
      writeHTML: (payload) => call(COMMANDS.clipboardWriteHtml, { payload }),
      writeText: (text) => call(COMMANDS.clipboardWriteText, { text }),
    },
  };
}

/** Maps browser platform labels to the Node-style labels used by existing UI code. */
function detectPlatform(): string {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes("mac")) return "darwin";
  if (platform.includes("win")) return "win32";
  if (platform.includes("linux")) return "linux";
  return platform || "unknown";
}
