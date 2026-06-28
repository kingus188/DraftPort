import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { useEditorStore } from "../../store/editorStore";
import "./Header.css";

const ThemePanel = lazy(() =>
  import("../Theme/ThemePanel").then((m) => ({ default: m.ThemePanel })),
);
import {
  Brush,
  Send,
  Code,
  BookOpenText,
  Gem,
  Sun,
  Moon,
  ChevronDown,
  FileText,
} from "lucide-react";

import { useUITheme } from "../../hooks/useUITheme";
import { useWindowControls } from "../../hooks/useWindowControls";
import { resolveAppAssetPath } from "../../utils/assetPath";
import { useFileStore } from "../../store/fileStore";

/** Returns the visible final path segment for workspace and document labels. */
function getPathBaseName(path?: string | null) {
  if (!path) return null;
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  return normalized.split("/").pop() || normalized;
}

/** Renders native-style Windows controls when the desktop shell owns the title bar. */
const WindowControls = () => {
  const { minimize, maximize, close } = useWindowControls();

  return (
    <div className="window-controls">
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
 * Renders the editor header, active document context, publishing actions, and
 * modal entry points while preserving Desktop window drag regions.
 */
export function Header() {
  const { copyToWechat, copyToZhihu, copyToJuejin, copyAsHtml } =
    useEditorStore();
  const workspacePath = useFileStore((state) => state.workspacePath);
  const currentFile = useFileStore((state) => state.currentFile);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement>(null);
  // 关闭下拉:点击菜单外部。
  useEffect(() => {
    if (!copyMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!copyMenuRef.current?.contains(event.target as Node)) {
        setCopyMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [copyMenuOpen]);
  const uiTheme = useUITheme((state) => state.theme);
  const setTheme = useUITheme((state) => state.setTheme);
  const logoSrc = resolveAppAssetPath(
    uiTheme === "dark" ? "favicon-light.svg" : "favicon-dark.svg",
  );

  const { isWindows } = useWindowControls();
  const workspaceName = getPathBaseName(workspacePath);
  const documentName = currentFile?.name ?? null;
  const headerContext =
    workspaceName && documentName ? `${workspaceName} / ${documentName}` : null;

  return (
    <>
      <header className="app-header app-header--compact">
        <div className="header-actions">
          <div className="header-left">
            <div className="header-brand" aria-label="DraftPort">
              <img src={logoSrc} alt="DraftPort Logo" className="header-logo" />
              <span className="header-name">DraftPort</span>
            </div>

            {headerContext && (
              <div
                className="header-context"
                aria-label="当前文档"
                title={headerContext}
              >
                <FileText size={18} strokeWidth={2} />
                <span className="header-context__workspace">
                  {workspaceName}
                </span>
                <span className="header-context__separator"> / </span>
                <span className="header-context__file">{documentName}</span>
              </div>
            )}
          </div>

          <div className="header-right">
            <div className="header-utility-group">
              <button
                className="btn-icon-only"
                onClick={() =>
                  setTheme(uiTheme === "dark" ? "default" : "dark")
                }
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
              <button
                className="btn-secondary btn-theme-entry"
                onClick={() => setShowThemePanel(true)}
                aria-label="主题"
                title="主题"
              >
                <Brush
                  className="btn-theme-entry__icon"
                  size={18}
                  strokeWidth={2}
                />
              </button>
            </div>

            <span className="header-action-divider" aria-hidden="true" />

            <div className="copy-group" ref={copyMenuRef}>
              <button className="btn-primary" onClick={copyToWechat}>
                <Send size={18} strokeWidth={2} />
                <span>复制到公众号</span>
              </button>
              <button
                className="btn-icon-only copy-menu-toggle"
                onClick={() => setCopyMenuOpen((open) => !open)}
                aria-label="更多复制方式"
                aria-expanded={copyMenuOpen}
              >
                <ChevronDown size={18} strokeWidth={2} />
              </button>

              {copyMenuOpen && (
                <div className="copy-menu" role="menu">
                  <button
                    className="copy-menu__item"
                    onClick={() => {
                      copyAsHtml();
                      setCopyMenuOpen(false);
                    }}
                    aria-label="HTML"
                  >
                    <Code size={18} strokeWidth={2} />
                    <span>HTML</span>
                  </button>
                  <button
                    className="copy-menu__item"
                    onClick={() => {
                      copyToZhihu();
                      setCopyMenuOpen(false);
                    }}
                  >
                    <BookOpenText size={18} strokeWidth={2} />
                    <span>复制到知乎</span>
                  </button>
                  <button
                    className="copy-menu__item"
                    onClick={() => {
                      copyToJuejin();
                      setCopyMenuOpen(false);
                    }}
                  >
                    <Gem size={18} strokeWidth={2} />
                    <span>复制到掘金</span>
                  </button>
                </div>
              )}
            </div>
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
    </>
  );
}
