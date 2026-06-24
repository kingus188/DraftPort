// Verifies that the desktop read-only workspace mode removes editing chrome from the app shell.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import type { WorkspacePreviewLayoutMode } from "../../hooks/useWorkspacePreviewLayout";

vi.mock("../../components/Header/Header", () => ({
  Header: () => <div data-testid="header" />,
}));

vi.mock("../../components/Sidebar/FileSidebar", () => ({
  FileSidebar: () => <div data-testid="file-sidebar" />,
}));

vi.mock("../../components/Editor/MarkdownEditor", () => ({
  MarkdownEditor: () => <div data-testid="markdown-editor" />,
}));

vi.mock("../../components/Preview/MarkdownPreview", () => ({
  MarkdownPreview: ({
    layoutMode,
  }: {
    layoutMode?: WorkspacePreviewLayoutMode;
  }) => <div data-testid="markdown-preview" data-layout-mode={layoutMode} />,
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
  useFileStore: (selector: (state: { isLoading: boolean }) => unknown) =>
    selector({ isLoading: false }),
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

  it("keeps the editor visible in the balanced desktop layout", () => {
    render(<App />);

    expect(screen.getByTestId("markdown-editor")).toBeInTheDocument();
    expect(screen.getByTestId("markdown-preview")).toHaveAttribute(
      "data-layout-mode",
      "balanced",
    );
    expect(
      screen.getByRole("separator", { name: "调整预览面板宽度" }),
    ).toBeInTheDocument();
  });

  it("renders only the markdown preview when read-only layout is restored", () => {
    localStorage.setItem("draftport-preview-layout-mode", "preview");

    render(<App />);

    expect(screen.queryByTestId("markdown-editor")).not.toBeInTheDocument();
    expect(screen.getByTestId("markdown-preview")).toHaveAttribute(
      "data-layout-mode",
      "preview",
    );
    expect(
      screen.queryByRole("separator", { name: "调整预览面板宽度" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the restored read-only layout on narrow viewports", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 500,
    });
    localStorage.setItem("draftport-preview-layout-mode", "preview");

    render(<App />);

    expect(screen.queryByTestId("markdown-editor")).not.toBeInTheDocument();
    expect(screen.getByTestId("markdown-preview")).toHaveAttribute(
      "data-layout-mode",
      "preview",
    );
  });
});
