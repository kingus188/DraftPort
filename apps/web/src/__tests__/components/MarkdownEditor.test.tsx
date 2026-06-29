// Verifies the CodeMirror editor bridge keeps editor state stable across UI theme changes.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownEditor } from "../../components/Editor/MarkdownEditor";

const mocks = vi.hoisted(() => {
  const viewInstances: Array<{
    destroy: ReturnType<typeof vi.fn>;
    dispatch: ReturnType<typeof vi.fn>;
    scrollDOM: HTMLDivElement;
    updateListener?: (update: { docChanged: boolean; state: unknown }) => void;
    state: {
      doc: {
        length: number;
        toString: () => string;
      };
      selection: {
        main: {
          from: number;
          to: number;
        };
      };
    };
  }> = [];

  return {
    content: "# Draft",
    editorViewConstructorMock: vi.fn(),
    editorViewThemeMock: vi.fn((spec: unknown) => ({
      extension: "theme",
      spec,
    })),
    lineWrapping: { extension: "lineWrapping" },
    setMarkdownMock: vi.fn(),
    theme: "default" as "default" | "dark",
    updateListener: {
      of: vi.fn((listener: unknown) => ({
        extension: "updateListener",
        listener,
      })),
    },
    viewInstances,
  };
});

vi.mock("codemirror", () => {
  class MockEditorView {
    static lineWrapping = mocks.lineWrapping;
    static updateListener = mocks.updateListener;
    static theme = mocks.editorViewThemeMock;

    destroy = vi.fn();
    dispatch = vi.fn((transaction?: { changes?: { insert: string } }) => {
      if (!transaction?.changes) return;
      this.state = {
        ...this.state,
        doc: {
          length: transaction.changes.insert.length,
          toString: () => transaction.changes?.insert ?? "",
        },
      };
      this.updateListener?.({ docChanged: true, state: this.state });
    });
    scrollDOM = document.createElement("div");
    state;
    updateListener?: (update: { docChanged: boolean; state: unknown }) => void;

    constructor(options: {
      state: { doc: { toString: () => string }; extensions?: unknown[] };
    }) {
      mocks.editorViewConstructorMock(options);
      this.state = {
        doc: {
          length: options.state.doc.toString().length,
          toString: options.state.doc.toString,
        },
        selection: { main: { from: 0, to: 0 } },
      };
      this.updateListener = options.state.extensions?.find(
        (
          extension,
        ): extension is {
          extension: string;
          listener: (update: { docChanged: boolean; state: unknown }) => void;
        } =>
          Boolean(
            extension &&
              typeof extension === "object" &&
              "extension" in extension &&
              extension.extension === "updateListener",
          ),
      )?.listener;
      mocks.viewInstances.push(this);
    }
  }

  return {
    EditorView: MockEditorView,
    minimalSetup: { extension: "minimalSetup" },
  };
});

vi.mock("@codemirror/state", () => {
  class MockCompartment {
    of(content: unknown) {
      return { compartment: this, content };
    }

    reconfigure(content: unknown) {
      return { type: "reconfigure", compartment: this, content };
    }
  }

  return {
    Compartment: MockCompartment,
    EditorState: {
      create: (options: { doc: string; extensions?: unknown[] }) => ({
        doc: {
          length: options.doc.length,
          toString: () => options.doc,
        },
        extensions: options.extensions,
      }),
    },
  };
});

vi.mock("@codemirror/lang-markdown", () => ({
  markdown: vi.fn(() => ({ extension: "markdown" })),
  markdownLanguage: { name: "markdownLanguage" },
}));

vi.mock("@uiw/codemirror-theme-github", () => ({
  githubLight: { extension: "githubLight" },
}));

vi.mock("../../components/Editor/markdownTheme", () => ({
  wechatMarkdownHighlighting: { extension: "wechatMarkdownHighlighting" },
  wechatMarkdownHighlightingDark: {
    extension: "wechatMarkdownHighlightingDark",
  },
}));

vi.mock("../../components/Editor/markdownUnderline", () => ({
  underlineExtension: { extension: "underlineExtension" },
}));

vi.mock("../../components/Editor/editorShortcuts", () => ({
  customKeymap: { extension: "customKeymap" },
}));

vi.mock("../../components/Editor/mouseSelectionStyle", () => ({
  paragraphSelectionStyle: { extension: "paragraphSelectionStyle" },
}));

vi.mock("../../components/Editor/SearchPanel", () => ({
  SearchPanel: () => <div data-testid="search-panel" />,
}));

vi.mock("../../components/Editor/SaveIndicator", () => ({
  SaveIndicator: () => <div data-testid="save-indicator" />,
}));

vi.mock("../../hooks/useUITheme", () => ({
  useUITheme: (selector: (state: { theme: "default" | "dark" }) => unknown) =>
    selector({ theme: mocks.theme }),
}));

vi.mock("../../store/editorStore", () => ({
  useEditorStore: () => ({
    markdown: mocks.content,
    setMarkdown: mocks.setMarkdownMock,
  }),
}));

describe("MarkdownEditor", () => {
  beforeEach(() => {
    mocks.content = "# Draft";
    mocks.theme = "default";
    mocks.editorViewConstructorMock.mockClear();
    mocks.editorViewThemeMock.mockClear();
    mocks.setMarkdownMock.mockClear();
    mocks.updateListener.of.mockClear();
    mocks.viewInstances.length = 0;
  });

  it("does not write back while syncing external Markdown into CodeMirror", () => {
    const { rerender } = render(<MarkdownEditor />);
    mocks.setMarkdownMock.mockClear();

    mocks.content = "# Loaded from file";
    rerender(<MarkdownEditor />);

    expect(mocks.viewInstances[0]?.dispatch).toHaveBeenCalledWith({
      changes: { from: 0, to: "# Draft".length, insert: "# Loaded from file" },
    });
    expect(mocks.setMarkdownMock).not.toHaveBeenCalled();
  });

  it("does not render the Markdown formatting toolbar", () => {
    render(<MarkdownEditor />);

    expect(screen.queryByTestId("toolbar")).not.toBeInTheDocument();
  });

  it("reconfigures CodeMirror theme without destroying the editor view", () => {
    const { rerender } = render(<MarkdownEditor />);

    expect(mocks.editorViewConstructorMock).toHaveBeenCalledTimes(1);

    mocks.theme = "dark";
    rerender(<MarkdownEditor />);

    expect(mocks.editorViewConstructorMock).toHaveBeenCalledTimes(1);
    expect(mocks.viewInstances[0]?.destroy).not.toHaveBeenCalled();
    expect(mocks.viewInstances[0]?.dispatch).toHaveBeenCalledWith({
      effects: expect.objectContaining({ type: "reconfigure" }),
    });
  });
});
