import type { OutlineItem } from "./types";

const ATX_HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;

/**
 * 行扫描器:逐行识别 ATX 标题,跳过围栏代码块内的 #。
 * ponytail: 只解析 ATX 标题,setext/引用块内标题不计入,与 ProseMirror 标题计数在这些边界可能漂移;升级路径是改用 markdown-it token 流。
 */
export function parseOutline(markdown: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  let inFence = false;
  const lines = markdown.split("\n");

  for (let line = 0; line < lines.length; line++) {
    if (FENCE.test(lines[line])) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = ATX_HEADING.exec(lines[line]);
    if (!match) continue;

    items.push({
      level: match[1].length,
      text: match[2].trim(),
      index: items.length,
      line,
    });
  }

  return items;
}
