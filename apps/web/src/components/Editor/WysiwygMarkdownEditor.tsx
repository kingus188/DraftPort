// Owns the Typora-like rendered Markdown editing surface.
// The component keeps Markdown as DraftPort's storage format while Milkdown owns rendered editing.

import { useMemo, useRef } from "react";
import { defaultValueCtx, Editor, rootCtx } from "@milkdown/core";
import { clipboard } from "@milkdown/plugin-clipboard";
import { history } from "@milkdown/plugin-history";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { nord } from "@milkdown/theme-nord";
import { useUITheme } from "../../hooks/useUITheme";
import { useEditorStore } from "../../store/editorStore";
import { useThemeStore } from "../../store/themeStore";
import "./WysiwygMarkdownEditor.css";

const UNSAFE_WYSIWYG_MARKDOWN_PATTERNS: RegExp[] = [
  /(^|\n)```mermaid[\s\S]*?```/i,
  /(^|\n)\$\$[\s\S]*?\$\$/,
  /(^|[^\\])\$[^$\n]+\$/,
  /(^|\n)>\s*\[!(TIP|NOTE|IMPORTANT|WARNING|CAUTION)\]/i,
  /==[^=\n]+==/,
  /(^|[^~])~[^~\n]+~/,
  /\^[^^\n]+\^/,
  /\+\+[^+\n]+\+\+/,
  /(^|\s):[a-z0-9_+-]+:(?=\s|$)/i,
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

/**
 * Mounts Milkdown inside its provider and wires document changes back to Markdown.
 */
function MilkdownEditorInner({
  initialMarkdown,
  onMarkdownChange,
}: MilkdownEditorInnerProps) {
  const latestMarkdownRef = useRef(initialMarkdown);

  useEditor(
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
        .use(history)
        .use(clipboard)
        .use(listener);

      return editor;
    },
    [onMarkdownChange],
  );

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
  const themeCss = useMemo(
    () => getThemeCSS(themeId, uiTheme === "dark") || customCSS,
    [customCSS, getThemeCSS, themeId, uiTheme],
  );

  return (
    <div
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
