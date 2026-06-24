// Verifies the live preview device mode contract without exercising Markdown rendering internals.
import { fireEvent, render, screen } from "@testing-library/react";
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

describe("MarkdownPreview device modes", () => {
  beforeEach(() => {
    mocks.editorState.markdown = "Preview body";
    mocks.createMarkdownParserMock.mockClear();
    mocks.renderMarkdownMock.mockClear();
    mocks.processHtmlMock.mockClear();
  });

  it("renders mobile preview mode by default", () => {
    const { container } = render(<MarkdownPreview />);
    const subtitle = container.querySelector(".preview-subtitle");

    expect(container.querySelector(".markdown-preview")).toHaveAttribute(
      "data-preview-mode",
      "mobile",
    );
    expect(screen.getByRole("button", { name: "手机预览" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(subtitle).toHaveTextContent("手机宽度");
  });

  it("switches between desktop and mobile preview modes", () => {
    const { container } = render(<MarkdownPreview />);
    const subtitle = () => container.querySelector(".preview-subtitle");

    fireEvent.click(screen.getByRole("button", { name: "桌面预览" }));

    expect(container.querySelector(".markdown-preview")).toHaveAttribute(
      "data-preview-mode",
      "desktop",
    );
    expect(screen.getByRole("button", { name: "桌面预览" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(subtitle()).toHaveTextContent("桌面宽度");

    fireEvent.click(screen.getByRole("button", { name: "手机预览" }));

    expect(container.querySelector(".markdown-preview")).toHaveAttribute(
      "data-preview-mode",
      "mobile",
    );
    expect(screen.getByRole("button", { name: "手机预览" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(subtitle()).toHaveTextContent("手机宽度");
  });

  it("calls layout toggle from the read-only mode button", () => {
    const onToggleLayoutMode = vi.fn();

    render(
      <MarkdownPreview
        layoutMode="balanced"
        onToggleLayoutMode={onToggleLayoutMode}
      />,
    );

    const readOnlyButton = screen.getByRole("button", { name: "只读模式" });

    expect(readOnlyButton.textContent).toBe("");
    expect(readOnlyButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(readOnlyButton);

    expect(onToggleLayoutMode).toHaveBeenCalledTimes(1);
  });

  it("shows restore editing action in read-only mode", () => {
    render(
      <MarkdownPreview layoutMode="preview" onToggleLayoutMode={vi.fn()} />,
    );

    const readOnlyButton = screen.getByRole("button", {
      name: "退出只读模式",
    });

    expect(readOnlyButton.textContent).toBe("");
    expect(readOnlyButton).toHaveAttribute("aria-pressed", "true");
  });

  it("uses a full-container preview without device width choices in read-only mode", () => {
    const { container } = render(
      <MarkdownPreview layoutMode="preview" onToggleLayoutMode={vi.fn()} />,
    );

    expect(container.querySelector(".markdown-preview")).toHaveAttribute(
      "data-layout-mode",
      "preview",
    );
    expect(container.querySelector(".preview-subtitle")).toHaveTextContent(
      "全宽阅读",
    );
    expect(
      screen.queryByRole("button", { name: "手机预览" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "桌面预览" }),
    ).not.toBeInTheDocument();
  });

  it("renders large markdown through a reduced read-only path", () => {
    mocks.editorState.markdown = `${"# Large file\n\n"}${"body\n".repeat(
      50000,
    )}`;

    render(<MarkdownPreview layoutMode="preview" />);

    expect(mocks.renderMarkdownMock).not.toHaveBeenCalled();
    expect(mocks.processHtmlMock).not.toHaveBeenCalled();
    expect(screen.getByText("大文件只读优化模式")).toBeInTheDocument();
    expect(screen.getByText(/已关闭完整 Markdown 渲染/)).toBeInTheDocument();
  });

  it("calls preview collapse toggle from the collapse action", () => {
    const onTogglePreviewCollapsed = vi.fn();

    render(
      <MarkdownPreview
        layoutMode="balanced"
        onTogglePreviewCollapsed={onTogglePreviewCollapsed}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "收起预览" }));

    expect(onTogglePreviewCollapsed).toHaveBeenCalledTimes(1);
  });

  it("shows restore preview action in editor priority mode", () => {
    render(
      <MarkdownPreview
        layoutMode="editor"
        onTogglePreviewCollapsed={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "显示预览" }),
    ).toBeInTheDocument();
  });
});
