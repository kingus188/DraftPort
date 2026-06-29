import { useEffect, useMemo, useRef, useState } from "react";
import { EditorView, minimalSetup } from "codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { githubLight } from "@uiw/codemirror-theme-github";
import {
  wechatMarkdownHighlighting,
  wechatMarkdownHighlightingDark,
} from "./markdownTheme";
import { underlineExtension } from "./markdownUnderline";
import { useUITheme, type UITheme } from "../../hooks/useUITheme";
import { useEditorStore } from "../../store/editorStore";
import { countWords, countLines } from "../../utils/wordCount";
import { SearchPanel } from "./SearchPanel";
import { SaveIndicator } from "./SaveIndicator";
import "./MarkdownEditor.css";
import { customKeymap } from "./editorShortcuts";
import { paragraphSelectionStyle } from "./mouseSelectionStyle";

const SYNC_SCROLL_EVENT = "draftport-sync-scroll";

interface SyncScrollDetail {
  source: "editor" | "preview";
  ratio: number;
}

/**
 * Builds the CodeMirror extensions that are allowed to change when the app UI
 * theme changes, so the live EditorView can be reconfigured without remounting.
 */
function createCodeMirrorThemeExtensions(uiTheme: UITheme): Extension[] {
  const isDarkMode = uiTheme === "dark";

  return [
    isDarkMode ? wechatMarkdownHighlightingDark : wechatMarkdownHighlighting,
    githubLight,
    EditorView.theme({
      "&": {
        height: "100%",
        fontSize: "15px",
      },
      ".cm-scroller": {
        fontFamily:
          "'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace",
        lineHeight: "1.6",
      },
      ".cm-content": {
        padding: "16px",
      },
      ".cm-gutters": {
        backgroundColor: isDarkMode ? "var(--bg-secondary)" : "#f8f9fa",
        border: "none",
      },
    }),
  ];
}

/**
 * Hosts the CodeMirror Markdown surface, document metadata, and
 * editor-to-preview scroll synchronization.
 */
export function MarkdownEditor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { markdown: content, setMarkdown } = useEditorStore();
  const uiTheme = useUITheme((state) => state.theme);
  const initialContentRef = useRef(content);
  const initialUIThemeRef = useRef(uiTheme);
  const isSyncingRef = useRef(false);
  const isApplyingExternalContentRef = useRef(false);
  const themeCompartment = useMemo(() => new Compartment(), []);
  const mountedThemeRef = useRef<UITheme | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;

    const currentContent = viewRef.current
      ? viewRef.current.state.doc.toString()
      : initialContentRef.current;
    const initialTheme = initialUIThemeRef.current;

    const startState = EditorState.create({
      doc: currentContent,
      extensions: [
        minimalSetup,
        customKeymap,
        markdown({ base: markdownLanguage, extensions: [underlineExtension] }),
        EditorView.lineWrapping,
        paragraphSelectionStyle,
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          if (isApplyingExternalContentRef.current) return;

          const newContent = update.state.doc.toString();
          setMarkdown(newContent);
        }),
        themeCompartment.of(createCodeMirrorThemeExtensions(initialTheme)),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    const scrollDOM = view.scrollDOM;
    const handleEditorScroll = () => {
      if (isSyncingRef.current) {
        isSyncingRef.current = false;
        return;
      }
      const max = scrollDOM.scrollHeight - scrollDOM.clientHeight;
      if (max <= 0) return;
      const ratio = scrollDOM.scrollTop / max;
      window.dispatchEvent(
        new CustomEvent<SyncScrollDetail>(SYNC_SCROLL_EVENT, {
          detail: { source: "editor", ratio },
        }),
      );
    };

    const handleSync = (event: Event) => {
      const customEvent = event as CustomEvent<SyncScrollDetail>;
      const detail = customEvent.detail;
      if (!detail || detail.source === "editor") return;
      const max = scrollDOM.scrollHeight - scrollDOM.clientHeight;
      if (max <= 0) return;
      isSyncingRef.current = true;
      scrollDOM.scrollTo({ top: detail.ratio * max });
    };

    scrollDOM.addEventListener("scroll", handleEditorScroll);
    window.addEventListener(SYNC_SCROLL_EVENT, handleSync as EventListener);

    viewRef.current = view;
    mountedThemeRef.current = initialTheme;

    return () => {
      scrollDOM.removeEventListener("scroll", handleEditorScroll);
      window.removeEventListener(
        SYNC_SCROLL_EVENT,
        handleSync as EventListener,
      );
      view.destroy();
      viewRef.current = null;
    };
  }, [setMarkdown, themeCompartment]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (mountedThemeRef.current === uiTheme) return;
    mountedThemeRef.current = uiTheme;

    view.dispatch({
      effects: themeCompartment.reconfigure(
        createCodeMirrorThemeExtensions(uiTheme),
      ),
    });
  }, [themeCompartment, uiTheme]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc === content) return;
    isApplyingExternalContentRef.current = true;
    try {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
      });
    } finally {
      isApplyingExternalContentRef.current = false;
    }
  }, [content]);

  const { lineCount, wordCount } = useMemo(
    () => ({
      lineCount: countLines(content),
      wordCount: countWords(content),
    }),
    [content],
  );

  return (
    <div className="markdown-editor">
      {showSearch && viewRef.current && (
        <SearchPanel
          view={viewRef.current}
          onClose={() => setShowSearch(false)}
        />
      )}
      <div className="editor-body-wrapper">
        <div ref={editorRef} className="editor-container" />
      </div>
      <div className="editor-footer">
        <div className="editor-stats">
          <span className="editor-stat editor-stat-label">发布准备</span>
          <span className="editor-stat">行数: {lineCount}</span>
          <span className="editor-stat">字数: {wordCount}</span>
        </div>
        <SaveIndicator />
      </div>
    </div>
  );
}
