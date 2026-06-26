// Verifies the theme live-preview renderer stays structurally aligned with MarkdownPreview.
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeLivePreview } from "../../components/Theme/ThemeLivePreview";

const mocks = vi.hoisted(() => ({
  parserRender: vi.fn(() => '<h2><span class="content">今日要点</span></h2>'),
  createMarkdownParser: vi.fn(() => ({
    render: mocks.parserRender,
  })),
  processHtml: vi.fn(
    (html: string) => `<section id="draftport">${html}</section>`,
  ),
}));

vi.mock("@draftport/core", () => ({
  createMarkdownParser: mocks.createMarkdownParser,
  processHtml: mocks.processHtml,
  convertCssToWeChatDarkMode: vi.fn((css: string) => `${css}\n/* dark */`),
}));

vi.mock("../../hooks/useUITheme", () => ({
  useUITheme: (selector: (state: unknown) => unknown) =>
    selector({ theme: "default" }),
}));

vi.mock("../../store/editorStore", () => ({
  useEditorStore: (selector: (state: unknown) => unknown) =>
    selector({ markdown: "## 当前文章" }),
}));

vi.mock("../../utils/mermaidConfig", () => ({
  getMermaidConfig: vi.fn(() => ({})),
  getThemedMermaidDiagram: vi.fn((diagram: string) => diagram),
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(),
  },
}));

describe("ThemeLivePreview", () => {
  beforeEach(() => {
    mocks.parserRender.mockClear();
    mocks.createMarkdownParser.mockClear();
    mocks.processHtml.mockClear();
  });

  it("uses the same non-inline theme pipeline as the actual Markdown preview", () => {
    render(
      <ThemeLivePreview css="#draftport h2 .content { display: block; }" />,
    );

    expect(mocks.processHtml).toHaveBeenCalledWith(
      '<h2><span class="content">今日要点</span></h2>',
      "#draftport h2 .content { display: block; }",
      false,
    );
  });
});
