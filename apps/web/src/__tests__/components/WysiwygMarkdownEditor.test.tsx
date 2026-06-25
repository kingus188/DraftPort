// Verifies the WYSIWYG editor bridge between Milkdown and DraftPort's Markdown store.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canUseWysiwygMarkdown,
  WysiwygMarkdownEditor,
} from "../../components/Editor/WysiwygMarkdownEditor";

const mocks = vi.hoisted(() => {
  const editorUseMock = vi.fn();
  const editorConfigMock = vi.fn(function editorConfig(
    this: { use: ReturnType<typeof vi.fn>; config: ReturnType<typeof vi.fn> },
    configure: (ctx: {
      set: ReturnType<typeof vi.fn>;
      get: ReturnType<typeof vi.fn>;
    }) => void,
  ) {
    const listenerManager = {
      markdownUpdated: vi.fn(
        (callback: (_ctx: unknown, markdown: string) => void) => {
          callback({}, "## Edited in WYSIWYG");
        },
      ),
    };
    configure({
      set: mocks.ctxSetMock,
      get: vi.fn(() => listenerManager),
    });
    return this;
  });
  const editorInstance = {
    config: editorConfigMock,
    use: vi.fn(function editorUse(this: unknown) {
      return this;
    }),
  };

  return {
    ctxSetMock: vi.fn(),
    editorConfigMock,
    editorInstance,
    editorUseMock,
    markdown: "# Draft",
    setMarkdownMock: vi.fn(),
    useEditorMock: vi.fn((factory: (root: HTMLElement) => unknown) => {
      const root = document.createElement("div");
      factory(root);
      return { loading: false, get: vi.fn() };
    }),
  };
});

vi.mock("@milkdown/core", () => ({
  Editor: {
    make: () => mocks.editorInstance,
  },
  defaultValueCtx: Symbol("defaultValueCtx"),
  rootCtx: Symbol("rootCtx"),
}));

vi.mock("@milkdown/react", () => ({
  Milkdown: () => <div data-testid="milkdown-root" />,
  MilkdownProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useEditor: mocks.useEditorMock,
}));

vi.mock("@milkdown/preset-commonmark", () => ({
  commonmark: ["commonmark"],
}));

vi.mock("@milkdown/preset-gfm", () => ({
  gfm: ["gfm"],
}));

vi.mock("@milkdown/plugin-history", () => ({
  history: ["history"],
}));

vi.mock("@milkdown/plugin-clipboard", () => ({
  clipboard: "clipboard",
}));

vi.mock("@milkdown/plugin-listener", () => ({
  listener: "listener",
  listenerCtx: Symbol("listenerCtx"),
}));

vi.mock("@milkdown/theme-nord", () => ({
  nord: vi.fn(),
}));

vi.mock("../../store/editorStore", () => ({
  useEditorStore: (selector: (state: unknown) => unknown) =>
    selector({
      markdown: mocks.markdown,
      setMarkdown: mocks.setMarkdownMock,
    }),
}));

vi.mock("../../store/themeStore", () => ({
  useThemeStore: (selector: (state: unknown) => unknown) =>
    selector({
      themeId: "wechat-theme",
      customCSS: "#draftport p { color: rgb(7, 193, 96); }",
      getThemeCSS: vi.fn(
        (themeId: string, darkMode?: boolean) =>
          `/* ${themeId}:${darkMode ? "dark" : "light"} */ #draftport p { color: rgb(7, 193, 96); }`,
      ),
    }),
}));

vi.mock("../../hooks/useUITheme", () => ({
  useUITheme: (selector: (state: unknown) => unknown) =>
    selector({ theme: "default" }),
}));

describe("WysiwygMarkdownEditor", () => {
  beforeEach(() => {
    mocks.ctxSetMock.mockClear();
    mocks.editorConfigMock.mockClear();
    mocks.editorInstance.use.mockClear();
    mocks.setMarkdownMock.mockClear();
    mocks.useEditorMock.mockClear();
    mocks.markdown = "# Draft";
  });

  it("mounts Milkdown with the current Markdown and writes serialized changes back", () => {
    render(<WysiwygMarkdownEditor />);

    expect(screen.getByTestId("wysiwyg-markdown-editor")).toBeInTheDocument();
    expect(screen.getByTestId("milkdown-root")).toBeInTheDocument();
    expect(mocks.ctxSetMock).toHaveBeenCalledWith(
      expect.any(Symbol),
      "# Draft",
    );
    expect(mocks.setMarkdownMock).toHaveBeenCalledWith("## Edited in WYSIWYG");
  });

  it("applies the current WeChat theme CSS to the editable WYSIWYG surface", () => {
    render(<WysiwygMarkdownEditor />);

    expect(screen.getByTestId("wysiwyg-theme-scope")).toHaveAttribute(
      "id",
      "draftport",
    );
    expect(screen.getByTestId("wysiwyg-theme-style")).toHaveTextContent(
      "#draftport p { color: rgb(7, 193, 96); }",
    );
  });
});

describe("canUseWysiwygMarkdown", () => {
  it("allows plain CommonMark and GFM content", () => {
    expect(
      canUseWysiwygMarkdown(
        "# Title\n\n- [x] ship tests\n\n| A | B |\n| - | - |",
      ),
    ).toBe(true);
  });

  it("rejects DraftPort-specific Markdown that should stay in source mode", () => {
    expect(canUseWysiwygMarkdown("Inline math $E=mc^2$")).toBe(false);
    expect(canUseWysiwygMarkdown("```mermaid\ngraph TD\nA-->B\n```")).toBe(
      false,
    );
    expect(canUseWysiwygMarkdown("> [!WARNING]\n> be careful")).toBe(false);
    expect(canUseWysiwygMarkdown("H~2~O and ==highlight==")).toBe(false);
  });
});
