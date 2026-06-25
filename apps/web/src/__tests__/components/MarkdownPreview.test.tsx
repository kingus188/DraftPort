// Verifies the static preview render contract without exercising Markdown rendering internals.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownPreview } from "../../components/Preview/MarkdownPreview";

const mocks = vi.hoisted(() => {
  const themeState = {
    themeId: "default",
    customCSS: "",
    customThemes: [],
    getAllThemes: vi.fn(() => [{ id: "default", designerVariables: {} }]),
    getThemeCSS: vi.fn(() => "#draftport { color: #111827; }"),
  };
  const editorState = {
    markdown: "Preview body",
  };
  const renderMarkdownMock = vi.fn((markdown: string) => `<p>${markdown}</p>`);
  const createMarkdownParserMock = vi.fn(() => ({
    render: renderMarkdownMock,
  }));
  const processHtmlMock = vi.fn(
    (html: string) => `<section id="draftport">${html}</section>`,
  );

  return {
    createMarkdownParserMock,
    editorState,
    processHtmlMock,
    renderMarkdownMock,
    themeState,
  };
});

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async () => ({ svg: "<svg />" })),
  },
}));

vi.mock("@draftport/core", () => ({
  createMarkdownParser: mocks.createMarkdownParserMock,
  processHtml: mocks.processHtmlMock,
}));

vi.mock("../../store/editorStore", () => ({
  useEditorStore: () => mocks.editorState,
}));

vi.mock("../../store/themeStore", () => ({
  useThemeStore: (selector?: (state: typeof mocks.themeState) => unknown) =>
    selector ? selector(mocks.themeState) : mocks.themeState,
}));

vi.mock("../../hooks/useUITheme", () => ({
  useUITheme: (selector: (state: { theme: string }) => unknown) =>
    selector({ theme: "default" }),
}));

describe("MarkdownPreview render surface", () => {
  beforeEach(() => {
    mocks.editorState.markdown = "Preview body";
    mocks.createMarkdownParserMock.mockClear();
    mocks.renderMarkdownMock.mockClear();
    mocks.processHtmlMock.mockClear();
  });

  it("renders the preview surface without mode switching chrome", () => {
    const { container } = render(<MarkdownPreview />);

    expect(container.querySelector(".markdown-preview")).toHaveAttribute(
      "data-preview-mode",
      "mobile",
    );
    expect(
      screen.queryByRole("button", { name: "手机预览" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "桌面预览" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "只读模式" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "收起预览" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Preview body")).toBeInTheDocument();
  });

  it("renders large markdown through a reduced static path", () => {
    mocks.editorState.markdown = `${"# Large file\n\n"}${"body\n".repeat(
      50000,
    )}`;

    render(<MarkdownPreview />);

    expect(mocks.renderMarkdownMock).not.toHaveBeenCalled();
    expect(mocks.processHtmlMock).not.toHaveBeenCalled();
    expect(screen.getByText("大文件静态阅读模式")).toBeInTheDocument();
    expect(screen.getByText(/已关闭完整 Markdown 渲染/)).toBeInTheDocument();
  });
});
