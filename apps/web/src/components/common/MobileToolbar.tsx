import {
  Copy,
  MoreHorizontal,
  Palette,
  Code,
  BookOpenText,
  Gem,
  X,
} from "lucide-react";
import { useState } from "react";
import "./MobileToolbar.css";

interface MobileToolbarProps {
  /** Copies the current Markdown document as WeChat-ready rich content. */
  onCopyToWechat: () => void;
  /** Copies the current Markdown document as Zhihu-compatible rich content. */
  onCopyToZhihu: () => void;
  /** Copies the current Markdown document as Juejin-compatible rich content. */
  onCopyToJuejin: () => void;
  /** Copies the current Markdown document as generic HTML. */
  onCopyAsHtml: () => void;
  /** Opens the theme management surface from the mobile overflow menu. */
  onOpenTheme: () => void;
}

/**
 * Renders mobile publishing actions without editor/preview view switching.
 */
export function MobileToolbar({
  onCopyToWechat,
  onCopyToZhihu,
  onCopyToJuejin,
  onCopyAsHtml,
  onOpenTheme,
}: MobileToolbarProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      {/* 更多菜单弹窗 */}
      {showMenu && (
        <div className="mobile-menu-overlay" onClick={() => setShowMenu(false)}>
          <div
            className="mobile-menu-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-menu-header">
              <span>更多功能</span>
              <button
                className="mobile-menu-close"
                onClick={() => setShowMenu(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="mobile-menu-list">
              <button
                className="mobile-menu-item"
                onClick={() => {
                  onCopyAsHtml();
                  setShowMenu(false);
                }}
              >
                <Code size={20} />
                <span>复制 HTML</span>
              </button>
              <button
                className="mobile-menu-item"
                onClick={() => {
                  onCopyToZhihu();
                  setShowMenu(false);
                }}
              >
                <BookOpenText size={20} />
                <span>复制到知乎</span>
              </button>
              <button
                className="mobile-menu-item"
                onClick={() => {
                  onCopyToJuejin();
                  setShowMenu(false);
                }}
              >
                <Gem size={20} />
                <span>复制到掘金</span>
              </button>
              <button
                className="mobile-menu-item"
                onClick={() => {
                  onOpenTheme();
                  setShowMenu(false);
                }}
              >
                <Palette size={20} />
                <span>主题管理</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 底部工具栏 */}
      <div className="mobile-toolbar">
        <div className="mobile-toolbar-actions">
          <button
            className="mobile-action-btn primary"
            aria-label="复制到公众号"
            onClick={onCopyToWechat}
          >
            <Copy size={18} />
          </button>
          <button
            className="mobile-action-btn"
            aria-label="更多功能"
            onClick={() => setShowMenu(true)}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
