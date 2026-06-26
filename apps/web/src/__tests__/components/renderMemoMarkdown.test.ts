import { describe, expect, it } from "vitest";
import { renderMemoMarkdown } from "../../components/WorkspaceViews/renderMemoMarkdown";

describe("renderMemoMarkdown", () => {
  it("highlights inline #tags as chips", () => {
    const html = renderMemoMarkdown("记一笔 #灵感 和 #idea");
    expect(html).toContain('<span class="memo-inline-tag">#灵感</span>');
    expect(html).toContain('<span class="memo-inline-tag">#idea</span>');
  });

  it("does not touch # inside link attributes", () => {
    const html = renderMemoMarkdown("[锚](http://x.com/a#frag)");
    expect(html).toContain('href="http://x.com/a#frag"');
    expect(html).not.toContain('memo-inline-tag">#frag');
  });
});
