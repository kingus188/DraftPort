// 主题状态管理
import { create } from "zustand";
import {
  builtInThemes,
  type CustomTheme,
  type DesignerVariables,
} from "./themes/builtInThemes";
import { convertCssToWeChatDarkMode } from "@draftport/core";
import { generateCSS } from "../components/Theme/ThemeDesigner/generateCSS";

// 深色模式 CSS 转换缓存
const darkCssCache = new Map<string, string>();
const DARK_MARK = "/* draftport-wechat-dark-converted */";

const hashCss = (css: string): string => {
  let hash = 0;
  for (let i = 0; i < css.length; i++) {
    hash = (hash << 5) - hash + css.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
};

const buildDarkCacheKey = (themeId: string, css: string) =>
  `${themeId}:${hashCss(css)}`;
const clearDarkCssCache = () => darkCssCache.clear();

// localStorage 键名
const CUSTOM_THEMES_KEY = "draftport-custom-themes";
const SELECTED_THEME_KEY = "draftport-selected-theme";
const FILE_THEME_ASSIGNMENTS_KEY = "draftport-file-theme-assignments";

export interface FileThemeAssignment {
  themeId: string;
  themeName: string;
}

const DEFAULT_THEME_ASSIGNMENT: FileThemeAssignment = {
  themeId: "default",
  themeName: "默认主题",
};

const getBrowserStorage = (): Storage | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const storage = window.localStorage as Partial<Storage>;
    if (
      typeof storage.getItem !== "function" ||
      typeof storage.setItem !== "function"
    ) {
      return null;
    }
    return storage as Storage;
  } catch {
    return null;
  }
};

const loadCustomThemes = (): CustomTheme[] => {
  const storage = getBrowserStorage();
  if (!storage) return [];
  try {
    const stored = storage.getItem(CUSTOM_THEMES_KEY);
    if (!stored) return [];
    const themes = JSON.parse(stored) as CustomTheme[];

    return themes.map((t) => {
      let newCss = t.css;
      const variables = t.designerVariables;

      if (variables) {
        if (!variables.underlineStyle) variables.underlineStyle = "solid";
        if (!variables.underlineColor)
          variables.underlineColor = "currentColor";
        newCss = generateCSS(variables);
      }

      const theme = {
        ...t,
        css: newCss,
        designerVariables: variables,
      };

      if (t.editorMode) {
        return theme;
      }

      return {
        ...theme,
        editorMode: t.designerVariables ? "visual" : "css",
      };
    });
  } catch (error) {
    console.error("加载自定义主题失败:", error);
    return [];
  }
};

// 保存自定义主题到 localStorage
const saveCustomThemes = (themes: CustomTheme[]): void => {
  const storage = getBrowserStorage();
  if (!storage) return;
  try {
    storage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
  } catch (error) {
    console.error("保存自定义主题失败:", error);
  }
};

const loadFileThemes = (): Record<string, FileThemeAssignment> => {
  const storage = getBrowserStorage();
  if (!storage) return {};
  try {
    const stored = storage.getItem(FILE_THEME_ASSIGNMENTS_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, FileThemeAssignment>;
    if (!parsed || typeof parsed !== "object") return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([filePath, value]) =>
          Boolean(filePath) &&
          value &&
          typeof value.themeId === "string" &&
          typeof value.themeName === "string",
      ),
    );
  } catch (error) {
    console.error("加载文件主题映射失败:", error);
    return {};
  }
};

const saveFileThemes = (themes: Record<string, FileThemeAssignment>): void => {
  const storage = getBrowserStorage();
  if (!storage) return;
  try {
    storage.setItem(FILE_THEME_ASSIGNMENTS_KEY, JSON.stringify(themes));
  } catch (error) {
    console.error("保存文件主题映射失败:", error);
  }
};

const resolveThemeById = (
  themeId: string,
  themes: CustomTheme[],
): CustomTheme | undefined => themes.find((theme) => theme.id === themeId);

const toThemeAssignment = (theme: CustomTheme): FileThemeAssignment => ({
  themeId: theme.id,
  themeName: theme.name,
});

const normalizeThemePath = (path: string): string => path.replace(/\\/g, "/");

const isThemePathAtOrInside = (
  filePath: string,
  targetPath: string,
): boolean => {
  const normalizedFilePath = normalizeThemePath(filePath);
  const normalizedTargetPath = normalizeThemePath(targetPath);
  return (
    normalizedFilePath === normalizedTargetPath ||
    normalizedFilePath.startsWith(`${normalizedTargetPath}/`)
  );
};

const replaceThemePathPrefix = (
  filePath: string,
  oldPath: string,
  newPath: string,
): string | null => {
  if (!isThemePathAtOrInside(filePath, oldPath)) return null;
  const suffix = normalizeThemePath(filePath).slice(
    normalizeThemePath(oldPath).length,
  );
  return `${normalizeThemePath(newPath)}${suffix}`;
};

// 保存选中主题到 localStorage
const saveSelectedTheme = (themeId: string, themeName: string): void => {
  const storage = getBrowserStorage();
  if (!storage) return;
  try {
    storage.setItem(
      SELECTED_THEME_KEY,
      JSON.stringify({ id: themeId, name: themeName }),
    );
  } catch (error) {
    console.error("保存选中主题失败:", error);
  }
};

// 从 localStorage 加载选中主题
const loadSelectedTheme = (): { id: string; name: string } | null => {
  const storage = getBrowserStorage();
  if (!storage) return null;
  try {
    const stored = storage.getItem(SELECTED_THEME_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error("加载选中主题失败:", error);
    return null;
  }
};

// 初始化选中的主题（验证存在性）
const initialSelectedTheme = (() => {
  const saved = loadSelectedTheme();
  if (!saved) return null;
  const allThemes = [...builtInThemes, ...loadCustomThemes()];
  const exists = allThemes.some((t) => t.id === saved.id);
  return exists ? saved : null;
})();

/**
 * 主题 Store 接口
 */
interface ThemeStore {
  // 当前主题
  themeId: string;
  themeName: string;
  customCSS: string;

  // 自定义主题列表
  customThemes: CustomTheme[];
  fileThemes: Record<string, FileThemeAssignment>;

  // 主题操作
  /** Activates a theme for rendering without changing any file assignment. */
  activateTheme: (themeId: string) => void;
  /** Applies a theme and optionally stores it as the selected file's theme. */
  selectTheme: (themeId: string, filePath?: string) => void;
  setCustomCSS: (css: string) => void;
  /** Returns the stored theme assignment for one file when it still exists. */
  getFileTheme: (filePath: string) => FileThemeAssignment | null;
  /** Resolves the file theme, preferring client assignment before frontmatter. */
  resolveFileTheme: (
    filePath: string,
    fallback: FileThemeAssignment,
  ) => FileThemeAssignment;
  /** Moves exact and nested file theme assignments after file or folder moves. */
  moveFileThemePath: (oldPath: string, newPath: string) => void;
  /** Removes exact and nested file theme assignments after file or folder deletion. */
  removeFileThemePath: (path: string) => void;
  getThemeCSS: (themeId: string, darkMode?: boolean) => string;

  getAllThemes: () => CustomTheme[];

  // 主题 CRUD
  createTheme: (
    name: string,
    editorMode: "visual" | "css",
    css?: string,
    designerVariables?: DesignerVariables,
  ) => CustomTheme;
  updateTheme: (
    id: string,
    updates: Partial<Pick<CustomTheme, "name" | "css" | "designerVariables">>,
  ) => void;
  deleteTheme: (id: string) => void;
  duplicateTheme: (id: string, newName: string) => CustomTheme;

  // 导入导出
  /** 导出主题为 JSON 文件（含 designerVariables，可再次导入编辑） */
  exportTheme: (id: string) => void;
  /** 导出主题为 CSS 文件（纯样式代码） */
  exportThemeCSS: (id: string) => void;
  /** 从 JSON 文件导入主题 */
  importTheme: (file: File) => Promise<boolean>;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  themeId: initialSelectedTheme?.id ?? "default",
  themeName: initialSelectedTheme?.name ?? "默认主题",
  customCSS: "",
  customThemes: loadCustomThemes(),
  fileThemes: loadFileThemes(),

  activateTheme: (themeId: string) => {
    const theme = resolveThemeById(themeId, get().getAllThemes());
    if (!theme) return;

    clearDarkCssCache();
    set({
      themeId: theme.id,
      themeName: theme.name,
      customCSS: theme.css,
    });
    saveSelectedTheme(theme.id, theme.name);
  },

  selectTheme: (themeId: string, filePath?: string) => {
    const theme = resolveThemeById(themeId, get().getAllThemes());
    if (!theme) return;

    const assignment = toThemeAssignment(theme);
    const nextFileThemes = filePath
      ? { ...get().fileThemes, [filePath]: assignment }
      : get().fileThemes;

    clearDarkCssCache();
    set({
      themeId: theme.id,
      themeName: theme.name,
      customCSS: theme.css,
      fileThemes: nextFileThemes,
    });
    if (filePath) saveFileThemes(nextFileThemes);
    saveSelectedTheme(theme.id, theme.name);
  },

  setCustomCSS: (css: string) => {
    clearDarkCssCache();
    set({ customCSS: css });
  },

  getFileTheme: (filePath: string) => {
    const assignment = get().fileThemes[filePath];
    if (!assignment) return null;
    const theme = resolveThemeById(assignment.themeId, get().getAllThemes());
    return theme ? toThemeAssignment(theme) : null;
  },

  resolveFileTheme: (filePath: string, fallback: FileThemeAssignment) => {
    const storedTheme = get().getFileTheme(filePath);
    if (storedTheme) return storedTheme;

    const fallbackTheme = resolveThemeById(
      fallback.themeId,
      get().getAllThemes(),
    );
    if (fallbackTheme) return toThemeAssignment(fallbackTheme);

    const defaultTheme = resolveThemeById(
      DEFAULT_THEME_ASSIGNMENT.themeId,
      get().getAllThemes(),
    );
    return defaultTheme
      ? toThemeAssignment(defaultTheme)
      : DEFAULT_THEME_ASSIGNMENT;
  },

  moveFileThemePath: (oldPath: string, newPath: string) => {
    const nextFileThemes = Object.fromEntries(
      Object.entries(get().fileThemes).map(([filePath, assignment]) => {
        const movedPath = replaceThemePathPrefix(filePath, oldPath, newPath);
        return [movedPath ?? filePath, assignment];
      }),
    );
    saveFileThemes(nextFileThemes);
    set({ fileThemes: nextFileThemes });
  },

  removeFileThemePath: (path: string) => {
    const nextFileThemes = Object.fromEntries(
      Object.entries(get().fileThemes).filter(
        ([filePath]) => !isThemePathAtOrInside(filePath, path),
      ),
    );
    saveFileThemes(nextFileThemes);
    set({ fileThemes: nextFileThemes });
  },

  getThemeCSS: (themeId: string, darkMode?: boolean) => {
    const state = get();

    // 先查找内置主题
    const builtIn = builtInThemes.find((t) => t.id === themeId);
    let css = builtIn ? builtIn.css : "";

    // 再查找自定义主题
    if (!css) {
      const custom = state.customThemes.find((t) => t.id === themeId);
      css = custom ? custom.css : builtInThemes[0].css;
    }

    // 深色模式下：使用微信颜色转换算法
    if (darkMode) {
      const cacheKey = buildDarkCacheKey(themeId, css);
      if (darkCssCache.has(cacheKey)) {
        return darkCssCache.get(cacheKey) as string;
      }
      const converted = css.includes(DARK_MARK)
        ? css
        : convertCssToWeChatDarkMode(css);
      darkCssCache.set(cacheKey, converted);
      return converted;
    }

    return css;
  },

  getAllThemes: () => {
    const state = get();
    return [...builtInThemes, ...state.customThemes];
  },

  createTheme: (
    name: string,
    editorMode: "visual" | "css",
    css?: string,
    designerVariables?: DesignerVariables,
  ) => {
    const state = get();
    const trimmedName = name.trim() || "未命名主题";
    const themeCSS = css || state.customCSS || state.getThemeCSS(state.themeId);

    const newTheme: CustomTheme = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name: trimmedName,
      css: themeCSS,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      editorMode,
      designerVariables:
        editorMode === "visual" ? designerVariables : undefined,
    };

    const nextCustomThemes = [...state.customThemes, newTheme];
    saveCustomThemes(nextCustomThemes);
    clearDarkCssCache();
    set({ customThemes: nextCustomThemes });

    return newTheme;
  },

  updateTheme: (
    id: string,
    updates: Partial<Pick<CustomTheme, "name" | "css" | "designerVariables">>,
  ) => {
    const state = get();
    const themeIndex = state.customThemes.findIndex((t) => t.id === id);

    if (themeIndex === -1) {
      console.warn(`主题 ${id} 未找到或为内置主题`);
      return;
    }

    const existingTheme = state.customThemes[themeIndex];
    const updatedTheme: CustomTheme = {
      ...existingTheme,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const nextCustomThemes = [
      ...state.customThemes.slice(0, themeIndex),
      updatedTheme,
      ...state.customThemes.slice(themeIndex + 1),
    ];

    const nextFileThemes = Object.fromEntries(
      Object.entries(state.fileThemes).map(([filePath, assignment]) => [
        filePath,
        assignment.themeId === id
          ? toThemeAssignment(updatedTheme)
          : assignment,
      ]),
    );

    saveCustomThemes(nextCustomThemes);
    saveFileThemes(nextFileThemes);
    clearDarkCssCache();
    set({ customThemes: nextCustomThemes, fileThemes: nextFileThemes });

    // 当前主题更新后要同步刷新运行态 CSS，WYSIWYG 编辑器订阅 customCSS 来重算主题样式。
    if (state.themeId === id) {
      set({ themeName: updatedTheme.name, customCSS: updatedTheme.css });
      saveSelectedTheme(updatedTheme.id, updatedTheme.name);
    }
  },

  deleteTheme: (id: string) => {
    const state = get();
    const theme = state.customThemes.find((t) => t.id === id);

    if (!theme) {
      console.warn(`主题 ${id} 未找到或为内置主题`);
      return;
    }

    const nextCustomThemes = state.customThemes.filter((t) => t.id !== id);
    const nextFileThemes = Object.fromEntries(
      Object.entries(state.fileThemes).filter(
        ([, assignment]) => assignment.themeId !== id,
      ),
    );
    saveCustomThemes(nextCustomThemes);
    saveFileThemes(nextFileThemes);
    clearDarkCssCache();
    set({ customThemes: nextCustomThemes, fileThemes: nextFileThemes });

    // 如果删除的是当前主题，切换到默认
    if (state.themeId === id) {
      set({
        themeId: "default",
        themeName: "默认主题",
        customCSS: "",
      });
      saveSelectedTheme("default", "默认主题");
    }
  },

  duplicateTheme: (id: string, newName: string) => {
    const state = get();
    const allThemes = state.getAllThemes();
    const sourceTheme = allThemes.find((t) => t.id === id);

    if (!sourceTheme) {
      throw new Error(`主题 ${id} 未找到`);
    }

    // 复制时保留源主题的编辑模式和变量
    const editorMode = sourceTheme.editorMode || "css";
    return state.createTheme(
      newName,
      editorMode,
      sourceTheme.css,
      sourceTheme.designerVariables,
    );
  },

  exportTheme: (id: string) => {
    const state = get();
    const theme = state.customThemes.find((t) => t.id === id);
    if (!theme || theme.editorMode !== "visual" || !theme.designerVariables) {
      console.warn("只能导出可视化编辑的主题");
      return;
    }

    const exportData = {
      version: 1,
      name: theme.name,
      editorMode: "visual",
      designerVariables: theme.designerVariables,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${theme.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * 导出主题为 CSS 文件
   * @param id - 主题 ID
   */
  exportThemeCSS: (id: string) => {
    const state = get();
    const theme = state.customThemes.find((t) => t.id === id);
    if (!theme) {
      console.warn("主题未找到");
      return;
    }

    const blob = new Blob([theme.css], {
      type: "text/css",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${theme.name}.css`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importTheme: async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // 验证必要字段
      if (
        typeof data.version !== "number" ||
        typeof data.name !== "string" ||
        !data.designerVariables
      ) {
        console.error("无效的主题文件格式：缺少必要字段");
        return false;
      }

      // 检查重名并添加后缀
      const existingNames = get().customThemes.map((t) => t.name);
      let finalName = data.name;
      if (existingNames.includes(finalName)) {
        let suffix = 1;
        while (existingNames.includes(`${data.name} (${suffix})`)) {
          suffix++;
        }
        finalName = `${data.name} (${suffix})`;
      }

      const css = generateCSS(data.designerVariables);
      get().createTheme(finalName, "visual", css, data.designerVariables);
      return true;
    } catch (error) {
      console.error("导入主题失败:", error);
      return false;
    }
  },
}));

// 导出内置主题供其他模块使用
export { builtInThemes };
export type { CustomTheme };
