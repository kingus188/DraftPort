/**
 * Owns copying the current Markdown document as Juejin-oriented rich text.
 * This service only writes clipboard data; it does not automate login, draft
 * creation, image upload, or publishing.
 */

import { createMarkdownParser } from "@draftport/core";
import { normalizeJuejinHtml } from "./juejinCopyNormalizer";
import { copyRichHtmlToClipboard } from "./richTextClipboard";

/**
 * Converts Markdown to Juejin-oriented semantic HTML and writes it to the clipboard.
 * Throws when every available clipboard strategy fails so callers can surface errors.
 */
export async function copyToJuejin(markdown: string): Promise<void> {
  const parser = createMarkdownParser({ showMacBar: false });
  const html = normalizeJuejinHtml(parser.render(markdown));
  await copyRichHtmlToClipboard(html, {
    success: "已复制，可以直接粘贴至掘金",
    failurePrefix: "复制到掘金失败",
  });
}
