// Locks the Typora-like editor contract at the app shell level.
// The app should edit rendered Markdown by default and expose source editing via Ctrl+/.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import type { FileItem } from "../../store/fileTypes";

const fileStoreState = vi.hoisted(
  (): { currentFile: FileItem | null; isLoading: boolean } => ({
    currentFile: {
      name: "first.md",
      path: "/workspace/first.md",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      size: 10,
    },
    isLoading: false,
  }),
);

const activeFile = (): FileItem => ({
  name: "first.md",
  path: "/workspace/first.md",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  size: 10,
});

const wysiwygMountState = vi.hoisted(() => ({
  mountCount: 0,
}));

const editorStoreState = vi.hoisted(() => ({
  markdown: "# Safe document",
  currentFilePath: undefined as string | undefined,
  copyToWechat: vi.fn(),
  copyToZhihu: vi.fn(),
  copyToJuejin: vi.fn(),
  copyAsHtml: vi.fn(),
}));

vi.mock("../../components/Header/Header", () => ({
  Header: () => <div data-testid="header" />,
}));

vi.mock("../../components/Sidebar/FileSidebar", () => ({
  FileSidebar: () => <div data-testid="file-sidebar" />,
}));

vi.mock("../../components/Editor/MarkdownEditor", () => ({
  MarkdownEditor: () => <div data-testid="markdown-source-editor" />,
}));

vi.mock("../../components/Editor/WysiwygMarkdownEditor", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    canUseWysiwygMarkdown: (markdown: string) =>
      !markdown.includes("$E=mc^2$") && !markdown.includes("```mermaid"),
    WysiwygMarkdownEditor: () => {
      React.useState(() => {
        wysiwygMountState.mountCount += 1;
        return null;
      });

      return <div data-testid="wysiwyg-markdown-editor" />;
    },
  };
});

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
  useFileStore: (selector: (state: typeof fileStoreState) => unknown) =>
    selector(fileStoreState),
}));

vi.mock("../../store/editorStore", () => {
  return {
    useEditorStore: (selector: (state: typeof editorStoreState) => unknown) =>
      selector(editorStoreState),
  };
});

describe("App Typora-like WYSIWYG editing mode", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
    fileStoreState.currentFile = activeFile();
    wysiwygMountState.mountCount = 0;
    editorStoreState.markdown = "# Safe document";
    editorStoreState.currentFilePath = undefined;
  });

  it("uses the rendered WYSIWYG editor as the default desktop editing surface", () => {
    render(<App />);

    expect(screen.getByTestId("wysiwyg-markdown-editor")).toBeInTheDocument();
    expect(
      screen.queryByTestId("markdown-source-editor"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("markdown-preview")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("separator", { name: "调整预览面板宽度" }),
    ).not.toBeInTheDocument();
  });

  it("toggles between WYSIWYG and Markdown source editing with Ctrl+/", () => {
    render(<App />);

    fireEvent.keyDown(document, { key: "/", ctrlKey: true });

    expect(screen.getByTestId("markdown-source-editor")).toBeInTheDocument();
    expect(
      screen.queryByTestId("wysiwyg-markdown-editor"),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "/", ctrlKey: true });

    expect(screen.getByTestId("wysiwyg-markdown-editor")).toBeInTheDocument();
    expect(
      screen.queryByTestId("markdown-source-editor"),
    ).not.toBeInTheDocument();
  });

  it("remounts the WYSIWYG editor when the active file changes", () => {
    const { rerender } = render(<App />);

    expect(wysiwygMountState.mountCount).toBe(1);

    fileStoreState.currentFile = {
      name: "second.md",
      path: "/workspace/second.md",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      size: 20,
    };

    rerender(<App />);

    expect(wysiwygMountState.mountCount).toBe(2);
  });

  it("does not expose publish preview from the desktop editing surface", () => {
    render(<App />);

    expect(
      screen.queryByRole("button", { name: "发布预览" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("markdown-preview")).not.toBeInTheDocument();
    expect(screen.getByTestId("wysiwyg-markdown-editor")).toBeInTheDocument();
  });

  it("keeps mobile editing in the WYSIWYG surface without a preview switch", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 500,
    });

    render(<App />);

    expect(screen.getByTestId("mobile-toolbar")).toBeInTheDocument();
    expect(screen.queryByTestId("markdown-preview")).not.toBeInTheDocument();
    expect(screen.getByTestId("wysiwyg-markdown-editor")).toBeInTheDocument();
  });

  it("uses source editing by default for Markdown that WYSIWYG cannot safely round trip", () => {
    editorStoreState.markdown =
      "Inline math $E=mc^2$\n\n```mermaid\ngraph TD\nA-->B\n```";

    render(<App />);

    expect(screen.getByTestId("markdown-source-editor")).toBeInTheDocument();
    expect(
      screen.queryByTestId("wysiwyg-markdown-editor"),
    ).not.toBeInTheDocument();
  });

  it("shows an empty selection state when a file workspace has no Markdown file selected", () => {
    fileStoreState.currentFile = null;
    editorStoreState.markdown = "";

    render(<App />);

    expect(screen.getByText("无选择文件")).toBeInTheDocument();
    expect(
      screen.queryByTestId("wysiwyg-markdown-editor"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("markdown-source-editor"),
    ).not.toBeInTheDocument();
  });
});
