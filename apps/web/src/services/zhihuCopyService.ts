/**
 * Owns copying the current Markdown document as Zhihu-oriented rich text.
 * This service only writes clipboard data; it does not automate Zhihu login,
 * draft creation, image upload, or publishing.
 */

import { createMarkdownParser } from "@draftport/core";
import { normalizeZhihuHtml } from "./zhihuCopyNormalizer";
import { copyRichHtmlToClipboard } from "./richTextClipboard";

/**
 * Converts Markdown to Zhihu-oriented semantic HTML and writes it to the clipboard.
 * Throws when every available clipboard strategy fails so callers can surface errors.
 */
export async function copyToZhihu(markdown: string): Promise<void> {
  const parser = createMarkdownParser({ showMacBar: false });
  const html = normalizeZhihuHtml(parser.render(markdown));
  await copyRichHtmlToClipboard(html, {
    success: "已复制，可以直接粘贴至知乎",
    failurePrefix: "复制到知乎失败",
  });
}
