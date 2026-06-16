// Verifies the live preview device mode contract without exercising Markdown rendering internals.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownPreview } from "../../components/Preview/MarkdownPreview";

const mocks = vi.hoisted(() => {
  const themeState = {
    themeId: "default",
    customCSS: "",
    customThemes: [],
    getAllThemes: vi.fn(() => [{ id: "default", designerVariables: {} }]),
    getThemeCSS: vi.fn(() => "#draftport { color: #111827; }"),
  };

  return { themeState };
});

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async () => ({ svg: "<svg />" })),
  },
}));

vi.mock("@draftport/core", () => ({
  createMarkdownParser: () => ({
    render: (markdown: string) => `<p>${markdown}</p>`,
  }),
  processHtml: (html: string) => `<section id="draftport">${html}</section>`,
}));

vi.mock("../../store/editorStore", () => ({
  useEditorStore: () => ({ markdown: "Preview body" }),
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

    expect(readOnlyButton).toHaveTextContent("只读");
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

    expect(readOnlyButton).toHaveTextContent("退出只读");
    expect(readOnlyButton).toHaveAttribute("aria-pressed", "true");
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
