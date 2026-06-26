import { useState, lazy, Suspense } from "react";
import { useEditorStore } from "../../store/editorStore";
import "./Header.css";

const ThemePanel = lazy(() =>
  import("../Theme/ThemePanel").then((m) => ({ default: m.ThemePanel })),
);
import {
  Palette,
  History,
  CalendarClock,
  StickyNote,
  Send,
  Code,
  BookOpenText,
  Gem,
  Sun,
  Moon,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUITheme } from "../../hooks/useUITheme";
import { useWindowControls } from "../../hooks/useWindowControls";
import { resolveAppAssetPath } from "../../utils/assetPath";

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
 * Renders the compact publishing toolbar and modal entry points while
 * preserving Desktop window drag regions.
 */
export function Header() {
  const { copyToWechat, copyToZhihu, copyToJuejin, copyAsHtml } =
    useEditorStore();
  const [showThemePanel, setShowThemePanel] = useState(false);
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  // Each nav target toggles: clicking the active one returns to the editor.
  const go = (path: string) => navigate(pathname === path ? "/" : path);
  const uiTheme = useUITheme((state) => state.theme);
  const setTheme = useUITheme((state) => state.setTheme);
  const logoSrc = resolveAppAssetPath(
    uiTheme === "dark" ? "favicon-light.svg" : "favicon-dark.svg",
  );

  const { isWindows } = useWindowControls();

  return (
    <>
      <header className="app-header app-header--compact">
        <div className="header-actions">
          <div className="header-brand" aria-label="DraftPort">
            <img src={logoSrc} alt="DraftPort Logo" className="header-logo" />
            <span className="header-name">DraftPort</span>
          </div>
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
            <button
              className={`btn-secondary ${pathname === "/history" ? "is-active" : ""}`}
              onClick={() => go("/history")}
              aria-pressed={pathname === "/history"}
              aria-label="版本时间线"
            >
              <History size={18} strokeWidth={2} />
              <span>版本</span>
            </button>
            <button
              className={`btn-secondary ${pathname === "/schedule" ? "is-active" : ""}`}
              onClick={() => go("/schedule")}
              aria-pressed={pathname === "/schedule"}
              aria-label="发布排期"
            >
              <CalendarClock size={18} strokeWidth={2} />
              <span>排期</span>
            </button>
            <button
              className={`btn-secondary ${pathname === "/memos" ? "is-active" : ""}`}
              onClick={() => go("/memos")}
              aria-pressed={pathname === "/memos"}
              aria-label="素材收集"
            >
              <StickyNote size={18} strokeWidth={2} />
              <span>素材</span>
            </button>
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
