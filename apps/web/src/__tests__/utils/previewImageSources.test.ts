import { describe, expect, it } from "vitest";
import { materializePreviewImageSources } from "../../utils/previewImageSources";

describe("materializePreviewImageSources", () => {
  it("resolves relative image sources against the current markdown file", () => {
    const html = '<p><img src="imgs/cover-agent-boundary.png" alt="cover"></p>';

    const result = materializePreviewImageSources(
      html,
      "/workspace/articles/post.md",
      (filePath) => `draftport-asset://local/${encodeURIComponent(filePath)}`,
    );

    expect(result).toContain(
      'src="draftport-asset://local/%2Fworkspace%2Farticles%2Fimgs%2Fcover-agent-boundary.png"',
    );
  });

  it("preserves remote, data, blob, hash, protocol-relative, and absolute sources", () => {
    const html = [
      '<img src="https://example.com/a.png">',
      '<img src="data:image/png;base64,abc">',
      '<img src="blob:https://example.com/asset">',
      '<img src="#inline-svg">',
      '<img src="//cdn.example.com/a.png">',
      '<img src="/static/a.png">',
    ].join("");

    const result = materializePreviewImageSources(
      html,
      "/workspace/articles/post.md",
      (filePath) => `draftport-asset://local/${encodeURIComponent(filePath)}`,
    );

    expect(result).toBe(html);
  });

  it("encodes local paths with spaces and non-ascii characters", () => {
    const result = materializePreviewImageSources(
      '<img src="../图片/封面 图.png">',
      "/Users/example/文章/草稿/post.md",
      (filePath) => `draftport-asset://local/${encodeURIComponent(filePath)}`,
    );

    expect(result).toContain(
      "draftport-asset://local/%2FUsers%2Fexample%2F%E6%96%87%E7%AB%A0%2F%E5%9B%BE%E7%89%87%2F%E5%B0%81%E9%9D%A2%20%E5%9B%BE.png",
    );
  });
});
