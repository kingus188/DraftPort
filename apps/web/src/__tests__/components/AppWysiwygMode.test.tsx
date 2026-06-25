// Locks the Typora-like editor contract at the app shell level.
// The app should edit rendered Markdown by default and expose source editing via Ctrl+/.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import type { WorkspacePreviewLayoutMode } from "../../hooks/useWorkspacePreviewLayout";

const fileStoreState = vi.hoisted(() => ({
  currentFile: {
    name: "first.md",
    path: "/workspace/first.md",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    size: 10,
  },
  isLoading: false,
}));

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
  MarkdownPreview: ({
    layoutMode,
  }: {
    layoutMode?: WorkspacePreviewLayoutMode;
  }) => <div data-testid="markdown-preview" data-layout-mode={layoutMode} />,
}));

vi.mock("../../components/common/MobileToolbar", () => ({
  MobileToolbar: ({
    onViewChange,
  }: {
    onViewChange: (view: "editor" | "preview") => void;
  }) => (
    <button type="button" onClick={() => onViewChange("preview")}>
      移动预览
    </button>
  ),
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

vi.mock("../../storage/StorageContext", () => ({
  useStorageContext: () => ({
    type: "filesystem",
    ready: true,
  }),
}));

vi.mock("../../store/historyStore", () => ({
  useHistoryStore: (selector: (state: { loading: boolean }) => unknown) =>
    selector({ loading: false }),
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
    fileStoreState.currentFile = {
      name: "first.md",
      path: "/workspace/first.md",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      size: 10,
    };
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

  it("opens publish preview from the desktop editing surface", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "发布预览" }));

    expect(screen.getByTestId("markdown-preview")).toHaveAttribute(
      "data-layout-mode",
      "preview",
    );
    expect(
      screen.queryByTestId("wysiwyg-markdown-editor"),
    ).not.toBeInTheDocument();
  });

  it("opens a real preview pane when mobile preview is selected", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 500,
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "移动预览" }));

    expect(screen.getByTestId("markdown-preview")).toHaveAttribute(
      "data-layout-mode",
      "preview",
    );
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
});
