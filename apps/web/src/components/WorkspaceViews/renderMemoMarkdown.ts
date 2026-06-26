import { createMarkdownParser } from "@draftport/core";
import { TAG_TOKEN } from "../../store/memoTypes";

// One parser instance is enough; memos are short, local, single-user notes.
const parser = createMarkdownParser();

/**
 * Wraps inline `#tag` tokens in a highlight span. Only rewrites text between
 * tags (`>...<`), so HTML attributes and links — markdown-it escapes `<`/`>`
 * in body text — are left untouched.
 */
function highlightTags(html: string): string {
  return html.replace(/>([^<]+)</g, (_match, text: string) => {
    const highlighted = text.replace(
      TAG_TOKEN,
      '<span class="memo-inline-tag">#$1</span>',
    );
    return `>${highlighted}<`;
  });
}

/** Renders memo Markdown to HTML for display in a card. */
export function renderMemoMarkdown(content: string): string {
  return highlightTags(parser.render(content));
}
