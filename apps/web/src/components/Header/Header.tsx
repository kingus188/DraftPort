import { useState, useEffect, lazy, Suspense } from "react";
import { useEditorStore } from "../../store/editorStore";
import "./Header.css";

const ThemePanel = lazy(() =>
  import("../Theme/ThemePanel").then((m) => ({ default: m.ThemePanel })),
);
const StorageModeSelector = lazy(() =>
  import("../StorageModeSelector/StorageModeSelector").then((m) => ({
    default: m.StorageModeSelector,
  })),
);
import {
  Layers,
  Palette,
  Send,
  Code,
  BookOpenText,
  Gem,
  Sun,
  Moon,
  ChevronsUp,
  ChevronsDown,
} from "lucide-react";
import { useUITheme } from "../../hooks/useUITheme";
import { useWindowControls } from "../../hooks/useWindowControls";
import { resolveAppAssetPath } from "../../utils/assetPath";
import { Modal, FloatingToolbarButton } from "../common";

/** Renders the current app logo from public assets so header branding tracks favicon updates. */
const HeaderLogoMark = ({ isDarkTheme }: { isDarkTheme: boolean }) => (
  <img
    src={resolveAppAssetPath(
      isDarkTheme ? "favicon-light.svg" : "favicon-dark.svg",
    )}
    alt="DraftPort Logo"
    width={40}
    height={40}
    style={{ display: "block" }}
  />
);

const WindowControls = ({ fixed = false }: { fixed?: boolean }) => {
  const { minimize, maximize, close } = useWindowControls();

  return (
    <div className={fixed ? "window-controls-fixed" : "window-controls"}>
      <button
        className="win-btn win-minimize"
        onClick={() => minimize?.()}
        aria-label="最小化"
      >
        <svg width="10" height="1" viewBox="0 0 10 1">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button
        className="win-btn win-maximize"
        onClick={() => maximize?.()}
        aria-label="最大化"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <rect
            width="9"
            height="9"
            x="0.5"
            y="0.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </svg>
      </button>
      <button
        className="win-btn win-close"
        onClick={() => close?.()}
        aria-label="关闭"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path
            d="M0,0 L10,10 M10,0 L0,10"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      </button>
    </div>
  );
};

/**
 * Renders the desktop title bar, global actions, and modal entry points while
 * preserving Electron window drag regions.
 */
export function Header() {
  const { copyToWechat, copyToZhihu, copyToJuejin, copyAsHtml } =
    useEditorStore();
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const uiTheme = useUITheme((state) => state.theme);
  const setTheme = useUITheme((state) => state.setTheme);
  const isDarkTheme = uiTheme === "dark";

  const { isElectron, isWindows, platform } = useWindowControls();

  // 自动隐藏标题栏状态
  const [autoHide, setAutoHide] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return (
        window.localStorage.getItem("draftport-header-autohide") === "true"
      );
    } catch {
      return false;
    }
  });

  // 保存状态到 localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "draftport-header-autohide",
        String(autoHide),
      );
    } catch {
      // 忽略存储不可用的场景（如隐私模式）
    }
  }, [autoHide]);

  // 切换标题栏显示/隐藏
  const handleHideHeader = () => {
    setAutoHide(true);
  };

  // Mac 平台使用内联样式强制避让
  const headerStyle =
    platform === "darwin" ? { paddingLeft: "80px" } : undefined;

  return (
    <>
      {/* 隐藏状态下的持久化窗口控制 (Windows only) */}
      {autoHide && isWindows && <WindowControls fixed />}

      {/* 隐藏状态下的浮动工具栏 */}
      {autoHide && (
        <div
          className={`floating-toolbar ${isWindows ? "floating-toolbar-win" : ""}`}
        >
          <FloatingToolbarButton
            icon={<ChevronsUp size={18} strokeWidth={2} />}
            label="显示标题栏"
            onClick={() => setAutoHide(false)}
            highlight
          />
          <FloatingToolbarButton
            icon={
              uiTheme === "dark" ? (
                <Sun size={18} strokeWidth={2} />
              ) : (
                <Moon size={18} strokeWidth={2} />
              )
            }
            label={uiTheme === "dark" ? "亮色模式" : "暗色模式"}
            onClick={() => setTheme(uiTheme === "dark" ? "default" : "dark")}
          />
          {!isElectron && (
            <FloatingToolbarButton
              icon={<Layers size={18} strokeWidth={2} />}
              label="存储模式"
              onClick={() => setShowStorageModal(true)}
            />
          )}
          <FloatingToolbarButton
            icon={<Palette size={18} strokeWidth={2} />}
            label="主题管理"
            onClick={() => setShowThemePanel(true)}
          />
          <FloatingToolbarButton
            icon={<Code size={18} strokeWidth={2} />}
            label="复制 HTML"
            onClick={copyAsHtml}
          />
          <FloatingToolbarButton
            icon={<BookOpenText size={18} strokeWidth={2} />}
            label="复制到知乎"
            onClick={copyToZhihu}
          />
          <FloatingToolbarButton
            icon={<Gem size={18} strokeWidth={2} />}
            label="复制到掘金"
            onClick={copyToJuejin}
          />
          <FloatingToolbarButton
            icon={<Send size={18} strokeWidth={2} />}
            label="复制到公众号"
            onClick={copyToWechat}
            primary
          />
        </div>
      )}

      <header
        className={`app-header ${autoHide ? "header-auto-hide" : ""}`}
        style={headerStyle}
      >
        <div className="header-left">
          <div className="logo">
            <HeaderLogoMark isDarkTheme={isDarkTheme} />
            <div className="logo-info">
              <span className="logo-text">DraftPort</span>
              <span className="logo-subtitle">公众号 Markdown 排版编辑器</span>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <div className="header-right">
            <button
              className="btn-icon-only"
              onClick={() => setTheme(uiTheme === "dark" ? "default" : "dark")}
              aria-label={
                uiTheme === "dark" ? "切换到亮色模式" : "切换到暗色模式"
              }
              title={uiTheme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
            >
              {uiTheme === "dark" ? (
                <Sun size={18} strokeWidth={2} />
              ) : (
                <Moon size={18} strokeWidth={2} />
              )}
            </button>
            {!isElectron && (
              <button
                className="btn-secondary"
                onClick={() => setShowStorageModal(true)}
              >
                <Layers size={18} strokeWidth={2} />
                <span>存储模式</span>
              </button>
            )}
            <button
              className="btn-secondary"
              onClick={() => setShowThemePanel(true)}
              aria-label="主题"
            >
              <Palette size={18} strokeWidth={2} />
              <span>主题</span>
            </button>

            <button
              className="btn-secondary"
              onClick={copyAsHtml}
              aria-label="HTML"
            >
              <Code size={18} strokeWidth={2} />
              <span>HTML</span>
            </button>

            <button className="btn-secondary" onClick={copyToZhihu}>
              <BookOpenText size={18} strokeWidth={2} />
              <span>复制到知乎</span>
            </button>

            <button className="btn-secondary" onClick={copyToJuejin}>
              <Gem size={18} strokeWidth={2} />
              <span>复制到掘金</span>
            </button>

            <button className="btn-primary" onClick={copyToWechat}>
              <Send size={18} strokeWidth={2} />
              <span>复制到公众号</span>
            </button>

            <button
              className="btn-ghost"
              onClick={handleHideHeader}
              aria-label="隐藏标题栏"
              title="隐藏标题栏"
            >
              <ChevronsDown size={18} strokeWidth={2} />
            </button>
          </div>

          {/* Windows 自定义标题栏按钮 */}
          {isWindows && <WindowControls />}
        </div>
      </header>

      <Suspense fallback={null}>
        <ThemePanel
          open={showThemePanel}
          onClose={() => setShowThemePanel(false)}
        />
      </Suspense>

      <Modal
        open={showStorageModal}
        onClose={() => setShowStorageModal(false)}
        title="选择存储模式"
      >
        <Suspense
          fallback={
            <div style={{ padding: "20px", textAlign: "center" }}>
              loading...
            </div>
          }
        >
          <StorageModeSelector />
        </Suspense>
      </Modal>
    </>
  );
}
