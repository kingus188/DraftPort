/**
 * 平台检测 - 桌面运行环境与操作系统识别
 */

// 基础环境检测（避免 SSR 环境报错）
const hasWindow = () => typeof window !== "undefined";

export const platform = {
  /** 是否运行在桌面（Tauri）环境 */
  get isDesktop(): boolean {
    return hasWindow() && !!window.desktop?.isDesktop;
  },

  /** 是否为 macOS 平台 */
  get isMac(): boolean {
    return hasWindow() && window.desktop?.platform === "darwin";
  },

  /** 是否为 Windows 平台 */
  get isWindows(): boolean {
    return hasWindow() && window.desktop?.platform === "win32";
  },

  /** 原始平台字符串 */
  get name(): string | undefined {
    return hasWindow() ? window.desktop?.platform : undefined;
  },
};
