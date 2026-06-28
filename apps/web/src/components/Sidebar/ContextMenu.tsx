import { createPortal } from "react-dom";
import {
  Trash2,
  Edit2,
  Copy,
  ChevronRight,
  MoveRight,
  FolderPlus,
  FilePlus,
  ArrowUpDown,
  Check,
} from "lucide-react";
import type { FileItem, FolderItem } from "../../store/fileTypes";
import type { SortMode } from "./sortUtils";

interface FolderOption {
  name: string;
  path: string;
}

interface ContextMenuProps {
  position: { x: number; y: number };
  menuTarget: FileItem | null;
  menuTargetFolder: FolderItem | null;
  showMoveMenu: boolean;
  showSortMenu: boolean;
  contextSortMode: SortMode;
  allFolders: FolderOption[];
  folderMoveTargets: FolderOption[];
  onClose: () => void;
  onCopyTitle: () => void;
  onStartRename: () => void;
  onToggleMoveMenu: () => void;
  onToggleSortMenu: () => void;
  onMoveToFolder: (path: string) => void;
  onMoveFolder: (path: string) => void;
  onCreateFile: () => void;
  onDeleteFile: () => void;
  onDeleteFolder: () => void;
  onStartRenameFolder: () => void;
  onNewFolder: () => void;
  onSetSortMode: (mode: SortMode) => void;
}

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "manual", label: "手动排序" },
  { value: "opened-desc", label: "最近打开" },
  { value: "updated-desc", label: "最近编辑" },
  { value: "name-asc", label: "名称升序" },
  { value: "name-desc", label: "名称降序" },
];

export function ContextMenu({
  position,
  menuTarget,
  menuTargetFolder,
  showMoveMenu,
  showSortMenu,
  contextSortMode,
  allFolders,
  folderMoveTargets,
  onClose,
  onCopyTitle,
  onStartRename,
  onToggleMoveMenu,
  onToggleSortMenu,
  onMoveToFolder,
  onMoveFolder,
  onCreateFile,
  onDeleteFile,
  onDeleteFolder,
  onStartRenameFolder,
  onNewFolder,
  onSetSortMode,
}: ContextMenuProps) {
  const renderCreationAndSortActions = () => (
    <>
      <button onClick={onCreateFile}>
        <FilePlus size={14} /> 新建文章
      </button>
      <button onClick={onNewFolder}>
        <FolderPlus size={14} /> 新建文件夹
      </button>
      <button onClick={onToggleSortMenu} className="has-submenu">
        <ArrowUpDown size={14} /> 排序方式
        <ChevronRight size={12} className="submenu-arrow" />
      </button>
      {showSortMenu && (
        <div className="fs-submenu">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`fs-sort-option ${contextSortMode === option.value ? "active" : ""}`}
              onClick={() => onSetSortMode(option.value)}
            >
              <span>{option.label}</span>
              {contextSortMode === option.value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </>
  );

  return createPortal(
    <div className="fs-context-menu-overlay" onClick={onClose}>
      <div
        className="fs-context-menu"
        style={{ top: position.y, left: position.x }}
        onClick={(e) => e.stopPropagation()}
      >
        {menuTarget && (
          <>
            <button onClick={onCopyTitle}>
              <Copy size={14} /> 复制标题
            </button>
            <button onClick={onStartRename}>
              <Edit2 size={14} /> 重命名
            </button>
            <button onClick={onToggleMoveMenu} className="has-submenu">
              <MoveRight size={14} /> 移动到...
              <ChevronRight size={12} className="submenu-arrow" />
            </button>
            {showMoveMenu && (
              <div className="fs-submenu">
                <button onClick={() => onMoveToFolder("")}>📁 根目录</button>
                {allFolders.map((f) => (
                  <button key={f.path} onClick={() => onMoveToFolder(f.path)}>
                    📁 {f.name}
                  </button>
                ))}
              </div>
            )}
            <button className="danger" onClick={onDeleteFile}>
              <Trash2 size={14} /> 删除
            </button>
          </>
        )}
        {menuTargetFolder && (
          <>
            {renderCreationAndSortActions()}
            <button onClick={onStartRenameFolder}>
              <Edit2 size={14} /> 重命名
            </button>
            <button onClick={onToggleMoveMenu} className="has-submenu">
              <MoveRight size={14} /> 移动到...
              <ChevronRight size={12} className="submenu-arrow" />
            </button>
            {showMoveMenu && (
              <div className="fs-submenu">
                <button onClick={() => onMoveFolder("")}>📁 根目录</button>
                {folderMoveTargets.map((f) => (
                  <button key={f.path} onClick={() => onMoveFolder(f.path)}>
                    📁 {f.name}
                  </button>
                ))}
              </div>
            )}
            <button className="danger" onClick={onDeleteFolder}>
              <Trash2 size={14} /> 删除文件夹
            </button>
          </>
        )}
        {!menuTarget && !menuTargetFolder && renderCreationAndSortActions()}
      </div>
    </div>,
    document.body,
  );
}
