import {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  useDeferredValue,
} from "react";
import mermaid from "mermaid";
import { createMarkdownParser, processHtml } from "@draftport/core";
import { useEditorStore } from "../../store/editorStore";
import { useThemeStore } from "../../store/themeStore";
import { useUITheme } from "../../hooks/useUITheme";
import { hasMathFormula, renderMathInElement } from "../../utils/katexRenderer";
import { convertLinksToFootnotes } from "../../utils/linkFootnote";
import {
  getLinkToFootnoteEnabled,
  LINK_TO_FOOTNOTE_EVENT,
} from "../Editor/ToolbarState";
import {
  getMermaidConfig,
  getThemedMermaidDiagram,
} from "../../utils/mermaidConfig";
import { useFileStore } from "../../store/fileStore";
import { materializePreviewImageSources } from "../../utils/previewImageSources";
import "./MarkdownPreview.css";

const SYNC_SCROLL_EVENT = "draftport-sync-scroll";
const LARGE_MARKDOWN_PREVIEW_CHAR_LIMIT = 200_000;

interface SyncScrollDetail {
  source: "editor" | "preview";
  ratio: number;
}

/**
 * Classifies Markdown documents that should avoid the expensive rich-preview
 * pipeline, matching VS Code's habit of disabling costly features on large files.
 */
function isLargeMarkdownPreview(markdown: string): boolean {
  return markdown.length > LARGE_MARKDOWN_PREVIEW_CHAR_LIMIT;
}

/**
 * Renders the WeChat-styled static preview used by non-editing surfaces while
 * keeping Markdown rendering, math, Mermaid, table images, and link handling in one place.
 */
export function MarkdownPreview() {
  const { markdown } = useEditorStore();
  // Keystrokes update `markdown` instantly; the heavy parse/render pipeline
  // follows this deferred value so typing never blocks on rendering.
  const deferredMarkdown = useDeferredValue(markdown);
  const currentFilePath = useFileStore((state) => state.currentFile?.path);
  const { themeId: theme, customCSS, getThemeCSS } = useThemeStore();
  const uiTheme = useUITheme((state) => state.theme);
  const [html, setHtml] = useState("");
  const [linkToFootnoteEnabled, setLinkToFootnoteEnabledState] = useState(() =>
    getLinkToFootnoteEnabled(),
  );
  const previewRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);
  const mermaidRenderIdRef = useRef(0);
  const isLargePreview = isLargeMarkdownPreview(markdown);

  // 获取当前主题对象（注意与 line 25 的 themeId 区分）
  const currentTheme = useThemeStore(
    (state) =>
      state.customThemes.find((t) => t.id === state.themeId) ||
      state.getAllThemes().find((t) => t.id === state.themeId),
  );
  const designerVars = currentTheme?.designerVariables;
  const showMacBar = designerVars?.showMacBar ?? false;

  // 缓存 parser 实例，避免每次渲染都创建新实例
  const parser = useMemo(
    () => (isLargePreview ? null : createMarkdownParser({ showMacBar })),
    [isLargePreview, showMacBar],
  );

  useEffect(() => {
    if (isLargePreview || !parser) {
      setHtml("");
      return;
    }

    const rawHtml = parser.render(deferredMarkdown);
    const htmlWithLocalImages = materializePreviewImageSources(
      rawHtml,
      currentFilePath,
    );
    const previewHtml = linkToFootnoteEnabled
      ? convertLinksToFootnotes(htmlWithLocalImages)
      : htmlWithLocalImages;

    // 使用 store 中的 getThemeCSS 方法，根据 UI 主题决定是否追加深色模式覆盖
    const isDarkMode = uiTheme === "dark";
    const css = getThemeCSS(theme, isDarkMode);
    // 预览模式不使用内联样式，直接注入 style 标签，大幅降低内存占用
    const styledHtml = processHtml(previewHtml, css, false);

    setHtml(styledHtml);
  }, [
    deferredMarkdown,
    theme,
    customCSS,
    getThemeCSS,
    parser,
    uiTheme,
    linkToFootnoteEnabled,
    currentFilePath,
    isLargePreview,
  ]);

  // KaTeX 渲染：轻量级、快速，解决内存问题
  // MathJax 仅在复制到微信时使用
  useEffect(() => {
    if (isLargePreview || !previewRef.current || !html) {
      return;
    }

    // 检测是否包含数学公式
    if (!hasMathFormula(deferredMarkdown)) {
      return; // 无公式，跳过渲染
    }

    // 延迟渲染，避免频繁触发
    const timer = setTimeout(() => {
      if (previewRef.current) {
        renderMathInElement(previewRef.current);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [html, isLargePreview, deferredMarkdown]);

  const mermaidTheme = designerVars?.mermaidTheme || "base";
  const mermaidConfigKey = useMemo(() => mermaidTheme, [mermaidTheme]);

  useEffect(() => {
    try {
      mermaid.initialize({ startOnLoad: false });
    } catch (e) {
      console.error("Mermaid initialization failed:", e);
    }
  }, []);

  useEffect(() => {
    if (isLargePreview || !previewRef.current || !html) return;

    const mermaidBlocks = Array.from(
      previewRef.current.querySelectorAll<HTMLElement>(".mermaid"),
    );
    if (mermaidBlocks.length === 0) return;
    const renderToken = ++mermaidRenderIdRef.current;

    // 延迟渲染以确保 DOM 更新完成
    const timer = setTimeout(() => {
      const initConfig = getMermaidConfig(designerVars);

      mermaidBlocks.forEach((block, index) => {
        if (!block.dataset.mermaidRaw) {
          block.dataset.mermaidRaw = block.textContent ?? "";
        }
        const diagram = block.dataset.mermaidRaw ?? "";
        if (!diagram.trim()) return;

        const themedDiagram = getThemedMermaidDiagram(diagram, initConfig);

        mermaid
          .render(`preview-${renderToken}-${index}`, themedDiagram)
          .then(({ svg }) => {
            if (mermaidRenderIdRef.current !== renderToken) return;
            block.innerHTML = svg;
          })
          .catch((e) => {
            console.error("Mermaid render error:", e);
          });
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [html, isLargePreview, mermaidConfigKey, designerVars]);

  // 处理预览栏滚动事件
  const handlePreviewScroll = useCallback(() => {
    if (isSyncingRef.current || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight - container.clientHeight;

    if (scrollHeight <= 0) return;

    const ratio = scrollTop / scrollHeight;

    // 发送同步事件给编辑器
    const event = new CustomEvent<SyncScrollDetail>(SYNC_SCROLL_EVENT, {
      detail: { source: "preview", ratio },
    });
    window.dispatchEvent(event);
  }, []);

  // 接收编辑器的同步事件
  const handleSync = useCallback((event: Event) => {
    const customEvent = event as CustomEvent<SyncScrollDetail>;
    const { source, ratio } = customEvent.detail;

    if (source === "preview" || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollHeight = container.scrollHeight - container.clientHeight;

    if (scrollHeight <= 0) return;

    isSyncingRef.current = true;
    container.scrollTop = scrollHeight * ratio;

    setTimeout(() => {
      isSyncingRef.current = false;
    }, 100);
  }, []);

  // 添加滚动事件监听
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // 监听预览栏滚动
    container.addEventListener("scroll", handlePreviewScroll);

    // 监听编辑器的同步事件
    window.addEventListener(SYNC_SCROLL_EVENT, handleSync as EventListener);

    return () => {
      container.removeEventListener("scroll", handlePreviewScroll);
      window.removeEventListener(
        SYNC_SCROLL_EVENT,
        handleSync as EventListener,
      );
    };
  }, [handlePreviewScroll, handleSync]);

  useEffect(() => {
    const handleLinkToFootnoteChange = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      setLinkToFootnoteEnabledState(customEvent.detail);
    };

    window.addEventListener(
      LINK_TO_FOOTNOTE_EVENT,
      handleLinkToFootnoteChange as EventListener,
    );
    return () => {
      window.removeEventListener(
        LINK_TO_FOOTNOTE_EVENT,
        handleLinkToFootnoteChange as EventListener,
      );
    };
  }, []);

  return (
    <div className="markdown-preview" data-preview-mode="mobile">
      <div
        className="preview-container"
        ref={scrollContainerRef}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const link = target.closest("a");
          if (link && link.href && window.desktop?.shell?.openExternal) {
            e.preventDefault();
            window.desktop.shell.openExternal(link.href);
          }
        }}
      >
        <div className="preview-content">
          <style
            dangerouslySetInnerHTML={{
              __html: getThemeCSS(theme, uiTheme === "dark"),
            }}
          />
          {isLargePreview ? (
            <div className="large-preview-mode" role="note">
              <div className="large-preview-mode__banner">
                <strong>大文件静态阅读模式</strong>
                <span>
                  已关闭完整 Markdown
                  渲染、图表和表格后处理，保留纯文本阅读以降低内存占用。
                </span>
              </div>
              <pre className="large-preview-mode__text">{markdown}</pre>
            </div>
          ) : (
            <div ref={previewRef} dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </div>
      </div>
    </div>
  );
}
// MathJax 类型已在 mathJaxLoader.ts 中声明
