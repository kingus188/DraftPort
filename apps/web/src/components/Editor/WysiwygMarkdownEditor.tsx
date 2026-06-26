// Owns the Typora-like rendered Markdown editing surface.
// The component keeps Markdown as DraftPort's storage format while Milkdown owns rendered editing.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultValueCtx, Editor, rootCtx } from "@milkdown/core";
import { clipboard } from "@milkdown/plugin-clipboard";
import { diagram } from "@milkdown/plugin-diagram";
import { emoji } from "@milkdown/plugin-emoji";
import { history } from "@milkdown/plugin-history";
import { math } from "@milkdown/plugin-math";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { nord } from "@milkdown/theme-nord";
import { replaceAll } from "@milkdown/utils";
import { useUITheme } from "../../hooks/useUITheme";
import { useEditorStore } from "../../store/editorStore";
import { useThemeStore } from "../../store/themeStore";
import { onOutlineJump } from "../../outline/outlineBus";
import { useHeadingScrollSpy } from "../../outline/useHeadingScrollSpy";
import "./WysiwygMarkdownEditor.css";

const UNSAFE_WYSIWYG_MARKDOWN_PATTERNS: RegExp[] = [
  /(^|\n)>\s*\[!(TIP|NOTE|IMPORTANT|WARNING|CAUTION)\]/i,
  /==[^=\n]+==/,
  /(^|[^~])~[^~\n]+~/,
  /\^[^^\n]+\^/,
  /\+\+[^+\n]+\+\+/,
  /^\[toc\]$/im,
];

/**
 * Returns whether Milkdown can be the default editor without risking loss of
 * DraftPort-specific Markdown extensions during serialization.
 */
export function canUseWysiwygMarkdown(markdown: string): boolean {
  return !UNSAFE_WYSIWYG_MARKDOWN_PATTERNS.some((pattern) =>
    pattern.test(markdown),
  );
}

interface MilkdownEditorInnerProps {
  /** Markdown snapshot used to initialize the rendered editor document. */
  initialMarkdown: string;
  /** Receives serialized Markdown whenever Milkdown changes the document. */
  onMarkdownChange: (markdown: string) => void;
}

const DRAFTPORT_SELECTOR_PATTERN = /#draftport(?![\w-])/;
const DRAFTPORT_SELECTOR_REPLACE_PATTERN = /#draftport(?![\w-])/g;
const HEADING_CONTENT_SELECTOR_PATTERN =
  /(\.ProseMirror\s+h[1-6])\s+\.content(?=[:\s.#>[+~]|$)/g;
const HEADING_CONTENT_SOURCE_PATTERN =
  /#draftport\s+h[1-6]\s+\.content(?=[:\s.#>[+~]|$)/;
const CSS_RULE_PATTERN = /([^{}]+)\{([^{}]*)\}/g;

/**
 * Converts a preview selector into the equivalent Milkdown selector.
 *
 * The preview renderer wraps heading text with `.content`, but Milkdown keeps
 * heading text directly inside `h1`-`h6`. Content wrapper rules therefore map
 * to the heading node itself so visual heading themes remain visible while editing.
 */
function adaptSelectorForWysiwyg(selector: string): string | null {
  if (
    !DRAFTPORT_SELECTOR_PATTERN.test(selector) ||
    selector.includes("#draftport .ProseMirror")
  ) {
    return null;
  }

  return selector
    .replace(DRAFTPORT_SELECTOR_REPLACE_PATTERN, "#draftport .ProseMirror")
    .replace(HEADING_CONTENT_SELECTOR_PATTERN, "$1");
}

/**
 * Removes flow-changing declarations when a preview heading `.content` rule is
 * applied to the Milkdown heading element itself.
 */
function adaptRuleBodyForWysiwyg(selectorText: string, body: string): string {
  if (!HEADING_CONTENT_SOURCE_PATTERN.test(selectorText)) {
    return body;
  }

  const declarations = body
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const displayMatch = declaration.match(/^display\s*:\s*(.+)$/i);
      if (!displayMatch) return declaration;
      return displayMatch[1].trim().toLowerCase() === "inline-block"
        ? "display: table"
        : null;
    })
    .filter((declaration): declaration is string => Boolean(declaration));

  return declarations.length > 0 ? `${declarations.join("; ")};` : "";
}

/**
 * Mirrors preview-scoped theme selectors onto Milkdown's editable ProseMirror tree.
 *
 * DraftPort themes are authored for preview HTML where content elements sit
 * directly under `#draftport`. Milkdown inserts `.ProseMirror` between that
 * scope and the editable Markdown nodes, so the editor needs matching selector
 * copies while preserving the original CSS for preview and copy flows.
 */
function adaptThemeCssForWysiwyg(themeCss: string): string {
  const adaptedRules: string[] = [];

  themeCss.replace(
    CSS_RULE_PATTERN,
    (rule, selectorText: string, body: string) => {
      const trimmedSelector = selectorText.trim();
      if (!trimmedSelector || trimmedSelector.startsWith("@")) {
        return rule;
      }

      const adaptedSelectors = selectorText
        .split(",")
        .map((selector) => adaptSelectorForWysiwyg(selector))
        .filter((selector): selector is string => Boolean(selector));

      if (adaptedSelectors.length > 0) {
        const adaptedBody = adaptRuleBodyForWysiwyg(selectorText, body).trim();
        adaptedRules.push(`${adaptedSelectors.join(",")} { ${adaptedBody} }`);
      }

      return rule;
    },
  );

  if (adaptedRules.length === 0) {
    return themeCss;
  }

  return `${themeCss}\n/* WYSIWYG theme adapter: mirror #draftport rules into Milkdown content. */\n${adaptedRules.join("\n")}`;
}

/**
 * Mounts Milkdown inside its provider and wires document changes back to Markdown.
 */
function MilkdownEditorInner({
  initialMarkdown,
  onMarkdownChange,
}: MilkdownEditorInnerProps) {
  const latestMarkdownRef = useRef(initialMarkdown);

  const editorHandle = useEditor(
    (root) => {
      const editor = Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, latestMarkdownRef.current);
          ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
            if (markdown === latestMarkdownRef.current) return;
            latestMarkdownRef.current = markdown;
            onMarkdownChange(markdown);
          });
          nord(ctx);
        })
        .use(commonmark)
        .use(gfm)
        .use(math)
        .use(diagram)
        .use(emoji)
        .use(history)
        .use(clipboard)
        .use(listener);

      return editor;
    },
    [onMarkdownChange],
  );

  useEffect(() => {
    const editor = editorHandle.get();
    if (!editor) return;
    if (initialMarkdown === latestMarkdownRef.current) return;

    latestMarkdownRef.current = initialMarkdown;
    editor.action(replaceAll(initialMarkdown));
  }, [editorHandle, initialMarkdown]);

  return <Milkdown />;
}

/**
 * Renders the primary WYSIWYG Markdown editor surface.
 *
 * The editor is initialized from the current Markdown store value and writes
 * Milkdown's serialized Markdown back into the same store so file saving and
 * publishing flows continue to use Markdown as the source of truth.
 */
export function WysiwygMarkdownEditor() {
  const markdown = useEditorStore((state) => state.markdown);
  const setMarkdown = useEditorStore((state) => state.setMarkdown);
  const themeId = useThemeStore((state) => state.themeId);
  const customCSS = useThemeStore((state) => state.customCSS);
  const getThemeCSS = useThemeStore((state) => state.getThemeCSS);
  const uiTheme = useUITheme((state) => state.theme);
  const themeCss = useMemo(() => {
    const activeThemeCss =
      getThemeCSS(themeId, uiTheme === "dark") || customCSS;
    return adaptThemeCssForWysiwyg(activeThemeCss);
  }, [customCSS, getThemeCSS, themeId, uiTheme]);

  // 大纲适配器:用回调 ref 取表面元素,确保挂载后 hook 拿到非空容器。
  const [surfaceEl, setSurfaceEl] = useState<HTMLDivElement | null>(null);
  const getHeadings = useCallback(
    () =>
      Array.from(
        surfaceEl?.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6") ??
          [],
      ),
    [surfaceEl],
  );

  // 点击大纲 → 滚到第 index 个标题节点。
  useEffect(
    () =>
      onOutlineJump((index) => {
        getHeadings()[index]?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }),
    [getHeadings],
  );

  // 滚动 WYSIWYG → 上报当前标题给大纲高亮。
  useHeadingScrollSpy(surfaceEl, getHeadings);

  return (
    <div
      ref={setSurfaceEl}
      className="wysiwyg-markdown-editor"
      data-testid="wysiwyg-markdown-editor"
    >
      <style
        data-testid="wysiwyg-theme-style"
        dangerouslySetInnerHTML={{ __html: themeCss }}
      />
      <div
        id="draftport"
        className="wysiwyg-markdown-editor__surface"
        data-testid="wysiwyg-theme-scope"
      >
        <MilkdownProvider>
          <MilkdownEditorInner
            initialMarkdown={markdown ?? ""}
            onMarkdownChange={setMarkdown}
          />
        </MilkdownProvider>
      </div>
    </div>
  );
}
