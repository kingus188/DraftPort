import { useRef } from "react";
import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
  rootCtx,
} from "@milkdown/core";
import { history } from "@milkdown/plugin-history";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { nord } from "@milkdown/theme-nord";

interface MemoEditorProps {
  /** Receives serialized Markdown on every edit. */
  onChange: (markdown: string) => void;
  /** Markdown to seed the editor with; empty for composing a new memo. */
  initialContent?: string;
  /** Place the cursor in the editor once it mounts. */
  autoFocus?: boolean;
}

/**
 * Mounts a Milkdown WYSIWYG surface seeded with `initialContent`. The parent
 * remounts it (via a changing key) when switching documents or clearing after
 * a save, so this stays a simple uncontrolled editor that only reports its
 * Markdown.
 */
function MemoEditorInner({
  onChange,
  initialContent = "",
  autoFocus = false,
}: MemoEditorProps) {
  const latest = useRef(initialContent);

  useEditor(
    (root) =>
      Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, initialContent);
          ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
            if (markdown === latest.current) return;
            latest.current = markdown;
            onChange(markdown);
          });
          if (autoFocus) {
            ctx.get(listenerCtx).mounted((mountedCtx) => {
              mountedCtx.get(editorViewCtx).focus();
            });
          }
          nord(ctx);
        })
        .use(commonmark)
        .use(gfm)
        .use(history)
        .use(listener),
    [onChange, initialContent, autoFocus],
  );

  return <Milkdown />;
}

/** WYSIWYG Markdown composer for a single memo. */
export function MemoEditor({
  onChange,
  initialContent,
  autoFocus,
}: MemoEditorProps) {
  return (
    <MilkdownProvider>
      <MemoEditorInner
        onChange={onChange}
        initialContent={initialContent}
        autoFocus={autoFocus}
      />
    </MilkdownProvider>
  );
}
