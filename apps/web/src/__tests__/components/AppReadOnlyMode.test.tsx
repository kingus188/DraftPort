// Verifies that the desktop read-only workspace mode removes editing chrome from the app shell.
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App";

vi.mock("../../components/Header/Header", () => ({
  Header: () => <div data-testid="header" />,
}));

vi.mock("../../components/Sidebar/FileSidebar", () => ({
  FileSidebar: () => <div data-testid="file-sidebar" />,
}));

vi.mock("../../components/Editor/MarkdownEditor", () => ({
  MarkdownEditor: () => <div data-testid="markdown-editor" />,
}));

vi.mock("../../components/Editor/WysiwygMarkdownEditor", () => ({
  canUseWysiwygMarkdown: () => true,
  WysiwygMarkdownEditor: () => <div data-testid="wysiwyg-markdown-editor" />,
}));

vi.mock("../../components/Preview/MarkdownPreview", () => ({
  MarkdownPreview: () => <div data-testid="markdown-preview" />,
}));

vi.mock("../../components/common/MobileToolbar", () => ({
  MobileToolbar: () => <div data-testid="mobile-toolbar" />,
}));

vi.mock("../../components/Theme/MobileThemeSelector", () => ({
  MobileThemeSelector: () => <div data-testid="mobile-theme-selector" />,
}));

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    workspacePath: "/workspace",
    saveFile: vi.fn(),
  }),
}));

vi.mock("../../store/fileStore", () => ({
  useFileStore: (
    selector: (state: {
      isLoading: boolean;
      currentFile: { path: string };
    }) => unknown,
  ) =>
    selector({
      isLoading: false,
      currentFile: { path: "/workspace/first.md" },
    }),
}));

vi.mock("../../store/editorStore", () => {
  const editorState = {
    copyToWechat: vi.fn(),
    copyToZhihu: vi.fn(),
    copyToJuejin: vi.fn(),
    copyAsHtml: vi.fn(),
  };

  return {
    useEditorStore: (selector: (state: typeof editorState) => unknown) =>
      selector(editorState),
  };
});

describe("App read-only workspace mode", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
  });

  it("uses WYSIWYG editing without a permanent preview in the balanced desktop layout", () => {
    render(<App />, { wrapper: MemoryRouter });

    expect(screen.getByTestId("wysiwyg-markdown-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("markdown-editor")).not.toBeInTheDocument();
    expect(screen.queryByTestId("markdown-preview")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("separator", { name: "调整预览面板宽度" }),
    ).not.toBeInTheDocument();
  });

  it("ignores restored read-only layout and keeps WYSIWYG editing", () => {
    localStorage.setItem("draftport-preview-layout-mode", "preview");

    render(<App />, { wrapper: MemoryRouter });

    expect(screen.getByTestId("wysiwyg-markdown-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("markdown-editor")).not.toBeInTheDocument();
    expect(screen.queryByTestId("markdown-preview")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("separator", { name: "调整预览面板宽度" }),
    ).not.toBeInTheDocument();
  });

  it("ignores restored read-only layout on narrow viewports", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 500,
    });
    localStorage.setItem("draftport-preview-layout-mode", "preview");

    render(<App />, { wrapper: MemoryRouter });

    expect(screen.getByTestId("wysiwyg-markdown-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("markdown-editor")).not.toBeInTheDocument();
    expect(screen.queryByTestId("markdown-preview")).not.toBeInTheDocument();
  });
});
