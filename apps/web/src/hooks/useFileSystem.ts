import { useCallback, useRef } from "react";
import { useFileStore } from "../store/fileStore";
import { useEditorStore } from "../store/editorStore";
import { useThemeStore } from "../store/themeStore";
import type { FileItem } from "../store/fileTypes";
import toast from "react-hot-toast";
import {
  applyMarkdownFileMeta,
  buildMarkdownFileContent,
  parseMarkdownFileContent,
  stripMarkdownExtension,
} from "../utils/markdownFileMeta";
import { resolveNewArticleThemeSnapshot } from "../utils/newArticleTheme";
import {
  convertToTreeItems,
  findDefaultMarkdownFile,
  flattenFiles,
  getDesktopBridge,
  joinPath,
  LAST_FILE_KEY,
  WORKSPACE_KEY,
} from "./useFileSystemHelpers";
import { useFileSystemFolderActions } from "./useFileSystemFolderActions";
import { useFileSystemEffects } from "./useFileSystemEffects";

interface UseFileSystemOptions {
  enableEffects?: boolean;
}

/**
 * Coordinates the Tauri desktop file backend with editor state and file-tree
 * mutations.
 */
export function useFileSystem(options: UseFileSystemOptions = {}) {
  const { enableEffects = false } = options;
  const desktop = getDesktopBridge();
  const {
    workspacePath,
    files,
    currentFile,
    isLoading,
    isSaving,
    lastSavedContent,
    isDirty,
    isRestoring,
    setWorkspacePath,
    setFiles,
    setCurrentFile,
    setLoading,
    setSaving,
    setLastSavedContent,
    setLastSavedAt,
    setIsDirty,
    setIsRestoring,
  } = useFileStore();
  const { setMarkdown, markdown } = useEditorStore();
  const { themeId: theme, themeName } = useThemeStore();
  const isCreating = useRef<boolean>(false);

  const refreshFiles = useCallback(
    async (dir?: string) => {
      if (!desktop) return [];
      const target = dir || workspacePath;
      if (!target) return [];

      const res = await desktop.fs.listFiles(target);
      if (res.success && res.files) {
        const nextFiles = convertToTreeItems(res.files);
        setFiles(nextFiles);
        return nextFiles;
      }
      return [];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspacePath, desktop],
  );

  const openFile = useCallback(
    async (file: FileItem) => {
      if (!desktop) return;
      setIsRestoring(true);

      const currentIsDirty = useFileStore.getState().isDirty;
      const activeFile = useFileStore.getState().currentFile;

      if (activeFile && currentIsDirty) {
        const { markdown: currentMarkdown } = useEditorStore.getState();
        const { themeId: currentTheme, themeName: currentThemeName } =
          useThemeStore.getState();
        const baseContent = useFileStore.getState().lastSavedContent;
        const fullContent = applyMarkdownFileMeta(baseContent, {
          body: currentMarkdown,
          theme: currentTheme,
          themeName: currentThemeName,
          title: activeFile.title || stripMarkdownExtension(activeFile.name),
        });

        try {
          const res = await desktop.fs.saveFile({
            filePath: activeFile.path,
            content: fullContent,
          });
          if (res.success) {
            setIsDirty(false);
            setLastSavedContent(fullContent);
            setLastSavedAt(new Date());
            // 切换前保存只改内容、不改文件树结构，无需全量重列目录。
          } else {
            console.error("切换前保存失败:", res.error);
          }
        } catch (error) {
          console.error("切换前保存失败:", error);
        }
      }

      let content = "";
      let success = false;

      const res = desktop.fs.openFile
        ? await desktop.fs.openFile(file.path)
        : await desktop.fs.readFile(file.path);
      if (res.success && typeof res.content === "string") {
        content = res.content;
        success = true;
      }

      if (success) {
        const parsed = parseMarkdownFileContent(content);
        const resolvedTitle =
          parsed.title?.trim() ||
          file.title?.trim() ||
          stripMarkdownExtension(file.name);

        setCurrentFile({ ...file, title: resolvedTitle });
        setMarkdown(parsed.body);
        useThemeStore.getState().selectTheme(parsed.theme);
        setLastSavedContent(content);
        setIsDirty(false);
      } else {
        toast.error("无法读取文件");
      }

      setTimeout(() => {
        setIsRestoring(false);
      }, 100);

      localStorage.setItem(LAST_FILE_KEY, file.path);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setMarkdown, desktop],
  );

  const loadWorkspace = useCallback(
    async (path: string) => {
      if (!desktop) return;
      setLoading(true);
      try {
        const res = await desktop.fs.setWorkspace(path);
        if (res.success) {
          setWorkspacePath(path);
          localStorage.setItem(WORKSPACE_KEY, path);
          const nextFiles = await refreshFiles(path);
          const hasActiveFile = Boolean(useFileStore.getState().currentFile);
          if (!hasActiveFile) {
            const target = findDefaultMarkdownFile(
              nextFiles,
              localStorage.getItem(LAST_FILE_KEY),
            );
            if (target) {
              await openFile(target);
            } else {
              localStorage.removeItem(LAST_FILE_KEY);
              setCurrentFile(null);
              setMarkdown("");
              setIsDirty(false);
              setLastSavedContent("");
            }
          }
        } else {
          setWorkspacePath(null);
          localStorage.removeItem(WORKSPACE_KEY);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    [
      desktop,
      openFile,
      refreshFiles,
      setCurrentFile,
      setIsDirty,
      setLastSavedContent,
      setMarkdown,
      setLoading,
      setWorkspacePath,
    ],
  );

  const selectWorkspace = useCallback(async () => {
    if (!desktop) return;
    const res = await desktop.fs.selectWorkspace();
    if (res.success && res.path) {
      await loadWorkspace(res.path);
    }
  }, [loadWorkspace, desktop]);

  const createFile = useCallback(
    async (folderPath?: string) => {
      if (!desktop || isCreating.current) return;
      isCreating.current = true;

      const initialTitle = "新文章";
      const themeState = useThemeStore.getState();
      const targetTheme = resolveNewArticleThemeSnapshot(
        themeState,
        themeState.getAllThemes(),
      );
      const initialContent = buildMarkdownFileContent({
        body: "# 新文章\n\n",
        theme: targetTheme.themeId,
        themeName: targetTheme.themeName,
        title: initialTitle,
      });

      try {
        const filename = `未命名文章-${Date.now()}.md`;
        const targetPath = joinPath(folderPath, filename);

        if (!workspacePath) return;
        const res = await desktop.fs.createFile({
          filename: targetPath,
          content: initialContent,
        });
        if (res.success && res.filePath) {
          await refreshFiles();
          const newFile = {
            name: res.filename!,
            path: res.filePath!,
            createdAt: new Date(),
            updatedAt: new Date(),
            size: 0,
            title: initialTitle,
            themeName: targetTheme.themeName,
          };
          await openFile(newFile);
          toast.success("已创建新文章");
        }
      } catch {
        toast.error("创建失败");
      } finally {
        isCreating.current = false;
      }
    },
    [workspacePath, refreshFiles, openFile, desktop],
  );

  const saveFile = useCallback(
    async (showToast = false) => {
      if (!desktop || !currentFile) return;
      setSaving(true);

      const { markdown: latestMarkdown } = useEditorStore.getState();
      const { themeId: currentTheme, themeName: currentThemeName } =
        useThemeStore.getState();

      const baseContent = useFileStore.getState().lastSavedContent;
      const fullContent = applyMarkdownFileMeta(baseContent, {
        body: latestMarkdown,
        theme: currentTheme,
        themeName: currentThemeName,
        title: currentFile.title || stripMarkdownExtension(currentFile.name),
      });

      if (fullContent === useFileStore.getState().lastSavedContent) {
        setSaving(false);
        if (showToast) toast.success("内容无变化");
        return;
      }

      const res = await desktop.fs.saveFile({
        filePath: currentFile.path,
        content: fullContent,
      });
      const success = res.success;
      const errorMsg = res.success ? "" : res.error || "Unknown error";

      setSaving(false);

      if (success) {
        setLastSavedContent(fullContent);
        setLastSavedAt(new Date());
        setIsDirty(false);
        if (showToast) toast.success("已保存");
      } else {
        toast.error("保存失败: " + errorMsg);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentFile, desktop],
  );

  const updateFileTitle = useCallback(
    async (file: FileItem, newName: string) => {
      const nextTitle = newName.trim();
      if (!nextTitle) {
        toast.error("标题不能为空");
        return;
      }
      if (!desktop) {
        toast.error("当前模式不支持此操作");
        return;
      }

      const readRes = await desktop.fs.readFile(file.path);
      if (!readRes.success || typeof readRes.content !== "string") {
        toast.error(readRes.error || "读取文件失败");
        return;
      }
      const content = readRes.content;

      const parsed = parseMarkdownFileContent(content);
      const fullContent = applyMarkdownFileMeta(content, {
        body: parsed.body,
        theme: parsed.theme,
        themeName: parsed.themeName,
        title: nextTitle,
      });

      const saveRes = await desktop.fs.saveFile({
        filePath: file.path,
        content: fullContent,
      });
      if (!saveRes.success) {
        toast.error(saveRes.error || "更新标题失败");
        return;
      }

      if (currentFile && currentFile.path === file.path) {
        setCurrentFile({ ...currentFile, title: nextTitle });
        const currentState = useFileStore.getState();
        if (!currentState.isDirty) {
          setLastSavedContent(fullContent);
        }
      }

      toast.success("标题已更新");
      await refreshFiles();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshFiles, currentFile, desktop],
  );

  const deleteFile = useCallback(
    async (file: FileItem) => {
      if (!desktop) return;
      const res = await desktop.fs.deleteFile(file.path);
      if (res.success) {
        toast.success("已删除");
        await refreshFiles();
        if (currentFile && currentFile.path === file.path) {
          setCurrentFile(null);
          setMarkdown("");
          setIsDirty(false);
          setLastSavedContent("");
        }
      } else {
        toast.error("删除失败");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshFiles, currentFile, setMarkdown, desktop],
  );

  const folderActions = useFileSystemFolderActions({
    desktop,
    refreshFiles,
    currentFile,
    setCurrentFile,
    setMarkdown,
    setIsDirty,
    setLastSavedContent,
  });

  useFileSystemEffects({
    enabled: enableEffects,
    desktop,
    currentFile,
    markdown,
    theme,
    themeName,
    isRestoring,
    isDirty,
    lastSavedContent,
    loadWorkspace,
    refreshFiles,
    openFile,
    createFile,
    saveFile,
    selectWorkspace,
    setCurrentFile,
    setMarkdown,
    setIsDirty,
    setLastSavedContent,
    setLoading,
    setWorkspacePath,
  });

  return {
    workspacePath,
    files,
    currentFile,
    isLoading,
    isSaving,
    refreshFiles,
    loadWorkspace,
    selectWorkspace,
    openFile,
    createFile,
    saveFile,
    updateFileTitle,
    renameFile: updateFileTitle,
    deleteFile,
    ...folderActions,
    flattenFiles,
  };
}
