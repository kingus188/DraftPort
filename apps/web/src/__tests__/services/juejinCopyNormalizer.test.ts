// Verifies the Juejin paste sanitizer mirrors Markdown2Html's platform-specific formula and code handling.
import { describe, expect, it } from "vitest";
import { normalizeJuejinHtml } from "../../services/juejinCopyNormalizer";

describe("normalizeJuejinHtml", () => {
  it("keeps semantic content and safe styles while removing editor metadata", () => {
    const input =
      '<section id="draftport" data-tool="DraftPort"><h2 class="title" style="color:red; margin:24px;"><span class="content">标题</span></h2><p style="text-align:center; box-shadow:0 0 4px #000;">正文</p></section>';

    expect(normalizeJuejinHtml(input)).toBe(
      '<h2 style="color: red">标题</h2><p style="text-align: center">正文</p>',
    );
  });

  it("converts equations into Juejin equation images", () => {
    const input =
      '<p>行内 <span class="inline-equation" data-latex="a+b">KaTeX</span></p><section class="block-equation" data-latex="E=mc^2">KaTeX</section>';

    expect(normalizeJuejinHtml(input)).toBe(
      '<p>行内 <span><img class="equation" src="https://juejin.im/equation?tex=a%2Bb" alt="" style="display: inline"></span></p><figure><img class="equation" src="https://juejin.im/equation?tex=E%3Dmc%5E2" alt=""></figure>',
    );
  });

  it("flattens highlighted code spans and preserves source line breaks", () => {
    const input =
      '<pre class="custom" style="display:-webkit-box;"><code><span class="keyword">const</span> a = 1;<br><span>console.log(a)</span></code></pre>';

    expect(normalizeJuejinHtml(input)).toBe(
      "<pre><code>const a = 1;\nconsole.log(a)</code></pre>",
    );
  });

  it("downgrades non-public images and keeps public images", () => {
    const input =
      '<p><img src="blob:https://example.com/1" alt="本地图"><img src="https://img.example.com/ok.png" alt="远程图" style="width:100px"></p>';

    expect(normalizeJuejinHtml(input)).toBe(
      '<p>[图片: 本地图]<img src="https://img.example.com/ok.png" alt="远程图"></p>',
    );
  });
});
