import { useCallback } from "react";
import toast from "react-hot-toast";
import type { FileItem } from "../store/fileTypes";
import { useFileStore } from "../store/fileStore";
import { useThemeStore } from "../store/themeStore";
import {
  isPathWithinFolder,
  joinPath,
  LAST_FILE_KEY,
  replacePathPrefix,
  type DesktopAPI,
} from "./useFileSystemHelpers";

interface UseFileSystemFolderActionsParams {
  desktop: DesktopAPI | null;
  refreshFiles: () => Promise<unknown>;
  currentFile: FileItem | null;
  setCurrentFile: (file: FileItem | null) => void;
  setMarkdown: (value: string) => void;
  setIsDirty: (dirty: boolean) => void;
  setLastSavedContent: (content: string) => void;
}

export function useFileSystemFolderActions({
  desktop,
  refreshFiles,
  currentFile,
  setCurrentFile,
  setMarkdown,
  setIsDirty,
  setLastSavedContent,
}: UseFileSystemFolderActionsParams) {
  const updateCurrentFilePathForFolder = useCallback(
    (oldPath: string, newPath: string) => {
      const activeFile = useFileStore.getState().currentFile;
      if (!activeFile) return;

      const updatedPath = replacePathPrefix(activeFile.path, oldPath, newPath);
      if (updatedPath && updatedPath !== activeFile.path) {
        setCurrentFile({ ...activeFile, path: updatedPath });
        localStorage.setItem(LAST_FILE_KEY, updatedPath);
      }
    },
    [setCurrentFile],
  );

  const createFolder = useCallback(
    async (folderName: string, parentFolder?: string) => {
      if (!desktop) return null;
      const fullPath = joinPath(parentFolder, folderName);
      const res = await desktop.fs.createFolder(fullPath);
      if (res.success) {
        toast.success("文件夹已创建");
        await refreshFiles();
        return res.path;
      }
      toast.error(res.error || "创建失败");
      return null;
    },
    [desktop, refreshFiles],
  );

  const moveToFolder = useCallback(
    async (file: FileItem, targetFolder: string) => {
      if (!desktop) return false;
      const res = await desktop.fs.moveFile({
        filePath: file.path,
        targetFolder,
      });
      if (res.success) {
        toast.success("文件已移动");
        if (res.newPath) {
          useThemeStore.getState().moveFileThemePath(file.path, res.newPath);
        }
        await refreshFiles();
        if (currentFile && currentFile.path === file.path && res.newPath) {
          setCurrentFile({ ...currentFile, path: res.newPath });
          localStorage.setItem(LAST_FILE_KEY, res.newPath);
        }
        return true;
      }
      toast.error(res.error || "移动失败");
      return false;
    },
    [desktop, refreshFiles, currentFile, setCurrentFile],
  );

  const renameFolder = useCallback(
    async (folder: { path: string }, newName: string) => {
      const safeName = newName.trim();
      const safeBaseName = safeName.split(/[/\\]/).pop() || "";
      if (!safeBaseName) {
        toast.error("文件夹名称不能为空");
        return { success: false as const };
      }
      if (!desktop) return { success: false as const };

      const res = await desktop.fs.renameFolder({
        folderPath: folder.path,
        newName: safeBaseName,
      });
      if (res.success && res.newPath) {
        toast.success("文件夹已重命名");
        useThemeStore.getState().moveFileThemePath(folder.path, res.newPath);
        await refreshFiles();
        updateCurrentFilePathForFolder(folder.path, res.newPath);
        return { success: true as const, newPath: res.newPath };
      }
      toast.error(res.error || "重命名失败");
      return { success: false as const };
    },
    [desktop, refreshFiles, updateCurrentFilePathForFolder],
  );

  const moveFolder = useCallback(
    async (folder: { path: string }, targetFolder: string) => {
      if (!desktop) return { success: false as const };
      const res = await desktop.fs.moveFolder({
        folderPath: folder.path,
        targetFolder,
      });
      if (res.success && res.newPath) {
        toast.success("文件夹已移动");
        useThemeStore.getState().moveFileThemePath(folder.path, res.newPath);
        await refreshFiles();
        updateCurrentFilePathForFolder(folder.path, res.newPath);
        return { success: true as const, newPath: res.newPath };
      }
      toast.error(res.error || "移动失败");
      return { success: false as const };
    },
    [desktop, refreshFiles, updateCurrentFilePathForFolder],
  );

  const deleteFolder = useCallback(
    async (folderPath: string, options?: { recursive?: boolean }) => {
      if (!desktop) return false;
      const res = await desktop.fs.deleteFolder({
        folderPath,
        recursive: options?.recursive,
      });
      if (res.success) {
        toast.success("文件夹已删除");
        useThemeStore.getState().removeFileThemePath(folderPath);
        await refreshFiles();
        if (currentFile && isPathWithinFolder(currentFile.path, folderPath)) {
          setCurrentFile(null);
          setMarkdown("");
          setIsDirty(false);
          setLastSavedContent("");
        }
        return true;
      }
      toast.error(res.error || "删除失败");
      return false;
    },
    [
      desktop,
      refreshFiles,
      currentFile,
      setMarkdown,
      setCurrentFile,
      setIsDirty,
      setLastSavedContent,
    ],
  );

  const inspectFolder = useCallback(
    async (folderPath: string) => {
      if (!desktop) return [];
      const res = await desktop.fs.inspectFolder(folderPath);
      if (res.success && res.entries) return res.entries;
      return [];
    },
    [desktop],
  );

  return {
    createFolder,
    moveToFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    inspectFolder,
  };
}
