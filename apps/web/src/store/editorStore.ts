// 编辑器状态管理（主题相关功能已迁移到 themeStore.ts）
import { create } from "zustand";
import { useThemeStore } from "./themeStore";
import { copyToWechat as execCopyToWechat } from "../services/wechatCopyService";
import { copyAsHtml as execCopyAsHtml } from "../services/htmlCopyService";
import { copyToZhihu as execCopyToZhihu } from "../services/zhihuCopyService";
import { copyToJuejin as execCopyToJuejin } from "../services/juejinCopyService";

export interface ResetOptions {
  markdown?: string;
  theme?: string;
  customCSS?: string;
  themeName?: string;
}

interface EditorStore {
  markdown: string;
  setMarkdown: (markdown: string) => void;

  lastAutoSavedAt: Date | null;
  isEditing: boolean;
  setLastAutoSavedAt: (time: Date | null) => void;
  setIsEditing: (editing: boolean) => void;

  currentFilePath?: string;
  workspaceDir?: string;
  setFilePath: (path?: string) => void;
  setWorkspaceDir: (dir?: string) => void;

  resetDocument: (options?: ResetOptions) => void;
  copyToWechat: () => void;
  copyToZhihu: () => void;
  copyToJuejin: () => void;
  copyAsHtml: () => void;
}

/** Empty startup content; real documents are loaded from the selected workspace. */
export const defaultMarkdown = "";

export const useEditorStore = create<EditorStore>((set, get) => ({
  markdown: defaultMarkdown,
  setMarkdown: (markdown) => set({ markdown, isEditing: true }),

  // 编辑状态跟踪
  lastAutoSavedAt: null,
  isEditing: false,
  setLastAutoSavedAt: (time) =>
    set({ lastAutoSavedAt: time, isEditing: false }),
  setIsEditing: (editing) => set({ isEditing: editing }),

  currentFilePath: undefined,
  workspaceDir: undefined,
  setFilePath: (path) => set({ currentFilePath: path }),
  setWorkspaceDir: (dir) => set({ workspaceDir: dir }),

  resetDocument: (options) => {
    const themeStore = useThemeStore.getState();
    const allThemes = themeStore.getAllThemes();

    // 验证主题是否存在
    let targetTheme = options?.theme ?? "default";

    const themeExists = allThemes.some((t) => t.id === targetTheme);
    if (!themeExists) {
      console.warn(`Theme ${targetTheme} not found, falling back to default`);
      targetTheme = "default";
    }

    // 重置编辑器内容
    set({ markdown: options?.markdown ?? defaultMarkdown });

    // 重置主题（通过 themeStore）
    themeStore.selectTheme(targetTheme);
    if (options?.customCSS) {
      themeStore.setCustomCSS(options.customCSS);
    }
  },

  copyToWechat: async () => {
    const { markdown } = get();
    const themeStore = useThemeStore.getState();
    const css = themeStore.getThemeCSS(themeStore.themeId);
    const currentTheme =
      themeStore.customThemes.find((t) => t.id === themeStore.themeId) ||
      themeStore.getAllThemes().find((t) => t.id === themeStore.themeId);
    const showMacBar = currentTheme?.designerVariables?.showMacBar ?? false;

    try {
      await execCopyToWechat(markdown, css, { showMacBar });
    } catch (error) {
      console.error("复制失败:", error);
    }
  },

  copyToZhihu: async () => {
    const { markdown } = get();

    try {
      await execCopyToZhihu(markdown);
    } catch (error) {
      console.error("复制到知乎失败:", error);
    }
  },

  copyToJuejin: async () => {
    const { markdown } = get();

    try {
      await execCopyToJuejin(markdown);
    } catch (error) {
      console.error("复制到掘金失败:", error);
    }
  },

  copyAsHtml: async () => {
    const { markdown } = get();
    await execCopyAsHtml(markdown);
  },
}));
