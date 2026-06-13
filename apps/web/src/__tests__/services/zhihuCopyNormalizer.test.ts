// Verifies the Zhihu paste sanitizer keeps semantic article structure while removing WeMD-specific markup.
import { describe, expect, it } from "vitest";
import { normalizeZhihuHtml } from "../../services/zhihuCopyNormalizer";

describe("normalizeZhihuHtml", () => {
  it("unwraps heading decoration spans, removes metadata, and keeps safe heading styles", () => {
    const input =
      '<section id="draftport" data-tool="DraftPort编辑器"><h1 class="title" style="color:red"><span class="prefix">#</span><span class="content">知乎标题</span><span class="suffix">!</span></h1></section>';

    expect(normalizeZhihuHtml(input)).toBe(
      '<h1 style="color: red">知乎标题</h1>',
    );
  });

  it("keeps supported semantic article elements", () => {
    const input =
      '<h2>小节</h2><p>段落 <strong>粗体</strong> <em>斜体</em> <s>删除</s> <a href="https://example.com" style="color:red">链接</a></p><blockquote>引用</blockquote><ul><li>项目</li></ul><ol><li>步骤</li></ol><table><thead><tr><th>A</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table><img src="https://img.example.com/a.png" alt="图" style="width:100px">';

    expect(normalizeZhihuHtml(input)).toBe(
      '<h2>小节</h2><p>段落 <strong>粗体</strong> <em>斜体</em> <s>删除</s> <a href="https://example.com" style="color: red">链接</a></p><blockquote>引用</blockquote><ul><li>项目</li></ul><ol><li>步骤</li></ol><table><thead><tr><th>A</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table><img src="https://img.example.com/a.png" alt="图">',
    );
  });

  it("keeps a limited style whitelist and removes layout-heavy styles", () => {
    const input =
      '<p class="theme" data-tool="x" style="color: #123456; background: rgb(245, 247, 250); text-align: center; font-size: 16px; line-height: 1.8; margin: 24px; position: absolute; box-shadow: 0 0 8px #000;">段落</p><table style="border-collapse: collapse; width: 100%;"><tbody><tr><td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">单元格</td></tr></tbody></table>';

    expect(normalizeZhihuHtml(input)).toBe(
      '<p style="color: #123456; background-color: rgb(245, 247, 250); text-align: center; font-size: 16px; line-height: 1.8">段落</p><table style="border-collapse: collapse"><tbody><tr><td style="border: 1px solid #ddd; padding: 8px; vertical-align: top">单元格</td></tr></tbody></table>',
    );
  });

  it("unwraps list item section wrappers and removes empty centers", () => {
    const input =
      "<center></center><ul><li><section>一</section></li><li><section>二</section></li></ul><center>保留</center>";

    expect(normalizeZhihuHtml(input)).toBe(
      "<ul><li>一</li><li>二</li></ul><center>保留</center>",
    );
  });

  it("converts checkbox inputs into text markers", () => {
    const input =
      '<p><input type="checkbox" checked> 已完成</p><p><input type="checkbox"> 未完成</p>';

    expect(normalizeZhihuHtml(input)).toBe("<p>✅  已完成</p><p>☐  未完成</p>");
  });

  it("downgrades non-public images and keeps public https images", () => {
    const input =
      '<p><img src="data:image/png;base64,abc" alt="本地图"><img src="blob:https://example.com/1" alt=""><img src=""><img src="https://img.example.com/ok.png" alt="远程图"></p>';

    expect(normalizeZhihuHtml(input)).toBe(
      '<p>[图片: 本地图][图片][图片]<img src="https://img.example.com/ok.png" alt="远程图"></p>',
    );
  });

  it("converts equation wrappers into Zhihu formula image placeholders", () => {
    const input =
      '<p>行内 <span class="inline-equation" data-latex="a+b">KaTeX</span></p><section class="block-equation" data-latex="E=mc^2">KaTeX</section>';

    expect(normalizeZhihuHtml(input)).toBe(
      '<p>行内 <img class="Formula-image" data-eeimg="true" src="" alt="a+b"></p><img class="Formula-image" data-eeimg="true" src="" alt="E=mc^2\\\\">',
    );
  });

  it("flattens highlighted code markup inside pre code blocks", () => {
    const input =
      '<pre class="custom" style="background:red"><code class="hljs language-ts" style="color:red"><span class="keyword">const</span> a = 1;</code></pre>';

    expect(normalizeZhihuHtml(input)).toBe(
      "<pre><code>const a = 1;</code></pre>",
    );
  });
});
