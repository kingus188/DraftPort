import { useCallback, useEffect, useState } from "react";
import { FileText, FolderOpen } from "lucide-react";
import { useFileSystem } from "../../hooks/useFileSystem";
import {
  getElectron,
  type RecentItemRecord,
} from "../../hooks/useFileSystemHelpers";
import "./Welcome.css";

const STARTUP_RECENT_LIMIT = 8;
const RECENT_FOLDER_EVENT = "draftport:open-recent-folder";

/**
 * Converts persisted recent metadata into the file shape expected by the editor open flow.
 */
function toRecentFileItem(item: RecentItemRecord) {
  const updatedAt = item.mtime ? new Date(item.mtime) : new Date();
  return {
    name: getBaseName(item.itemPath),
    path: item.itemPath,
    createdAt: updatedAt,
    updatedAt,
    size: item.size ?? 0,
    title: item.title ?? undefined,
    themeName: item.themeName ?? undefined,
  };
}

/**
 * Extracts the display name from POSIX or Windows paths persisted in SQLite.
 */
function getBaseName(rawPath: string) {
  const last = Math.max(rawPath.lastIndexOf("/"), rawPath.lastIndexOf("\\"));
  return last >= 0 ? rawPath.slice(last + 1) : rawPath;
}

/**
 * Renders the Electron startup screen and lets users resume from persisted recent items.
 */
export function Welcome() {
  const { selectWorkspace, loadWorkspace, openFile } = useFileSystem();
  const [recentItems, setRecentItems] = useState<RecentItemRecord[]>([]);
  const electron = getElectron();

  useEffect(() => {
    let cancelled = false;
    if (!electron?.recentItems) return;

    void (async () => {
      const result = await electron.recentItems?.list(STARTUP_RECENT_LIMIT);
      if (!cancelled && result?.success && result.items) {
        setRecentItems(result.items);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [electron]);

  const handleRecentClick = useCallback(
    async (item: RecentItemRecord) => {
      await loadWorkspace(item.workspacePath);
      if (item.itemType === "file") {
        await openFile(toRecentFileItem(item));
        return;
      }

      // The sidebar mounts after workspace restore, so dispatch on the next task.
      window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent(RECENT_FOLDER_EVENT, { detail: item }),
        );
      }, 0);
    },
    [loadWorkspace, openFile],
  );

  return (
    <div className="welcome-container">
      <div className="welcome-content">
        <img
          src="./favicon-dark.svg"
          alt="DraftPort Logo"
          className="welcome-logo"
        />
        <h1>欢迎使用 DraftPort</h1>
        <p>请选择一个文件夹作为工作区以开始写作</p>
        <button className="btn-primary" onClick={selectWorkspace}>
          <FolderOpen size={20} />
          选择工作区文件夹
        </button>

        {recentItems.length > 0 && (
          <section className="welcome-recent" aria-label="最近打开">
            <div className="welcome-recent-header">最近打开</div>
            <div className="welcome-recent-list">
              {recentItems.map((item) => (
                <button
                  key={`${item.workspacePath}:${item.itemType}:${item.itemPath}`}
                  className="welcome-recent-item"
                  onClick={() => void handleRecentClick(item)}
                >
                  {item.itemType === "folder" ? (
                    <FolderOpen size={16} />
                  ) : (
                    <FileText size={16} />
                  )}
                  <span className="welcome-recent-title">
                    {item.title?.trim() || getBaseName(item.itemPath)}
                  </span>
                  <span className="welcome-recent-kind">
                    {item.itemType === "folder" ? "文件夹" : "Markdown"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
