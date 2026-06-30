// Verifies the App source-editing path uses the real MarkdownEditor bridge.
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import type { FileItem } from "../../store/fileTypes";

const fileStoreState = vi.hoisted(
  (): { currentFile: FileItem | null; isLoading: boolean } => ({
    currentFile: {
      name: "source.md",
      path: "/workspace/source.md",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      size: 128,
    },
    isLoading: false,
  }),
);

const editorStoreState = vi.hoisted(() => ({
  markdown: "# 源码模式\n\n初始内容",
  currentFilePath: "/workspace/source.md" as string | undefined,
  copyToWechat: vi.fn(),
  copyToZhihu: vi.fn(),
  copyToJuejin: vi.fn(),
  copyAsHtml: vi.fn(),
  setMarkdown: vi.fn((markdown: string) => {
    editorStoreState.markdown = markdown;
  }),
}));

const codeMirrorMocks = vi.hoisted(() => {
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
    };
    simulateUserEdit: (markdown: string) => void;
  }> = [];

  return {
    editorViewThemeMock: vi.fn((spec: unknown) => ({
      extension: "theme",
      spec,
    })),
    lineWrapping: { extension: "lineWrapping" },
    updateListener: {
      of: vi.fn((listener: unknown) => ({
        extension: "updateListener",
        listener,
      })),
    },
    viewInstances,
  };
});

const activeFile = (): FileItem => ({
  name: "source.md",
  path: "/workspace/source.md",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  size: 128,
});

const countMarkdownLines = (markdown: string) => markdown.split("\n").length;

const typoraSourceFixture = () =>
  [
    "# 源码模式深度测试",
    "",
    "中文段落包含 **加粗**、*斜体*、行内代码 `const value = 1` 和链接 [DraftPort](https://example.com)。",
    "",
    "> 引用块保留 Markdown 源码，不把下一行挤歪。",
    "> 第二行引用继续保持源码行。",
    "",
    "1. 第一项",
    "2. 第二项含中文标点：，。；",
    "   - 嵌套项目不会变成乱码",
    "",
    "| 字段 | 值 |",
    "| --- | --- |",
    "| 中文 | 正常显示 |",
    "",
    "$",
    "E = mc^2",
    "$",
    "",
    "```mermaid",
    "graph TD",
    "A[中文节点] --> B{判断}",
    "```",
    "",
    "```ts",
    'const message = "中文源码不乱码";',
    "console.log(message);",
    "```",
    "",
    "## 收尾",
    "最后一行。",
  ].join("\n");

const editedTyporaSourceFixture = () =>
  [
    "# 源码模式深度测试 - 已编辑",
    "",
    "新增中文段落：源码编辑模式要精确保留 Markdown 字符、中文标点和 emoji :sparkles:。",
    "",
    "> 引用块第一行",
    "> 引用块第二行，不能错行。",
    "",
    "- [x] 已完成源码输入",
    "- [ ] 保留待办项源码",
    "",
    "| 场景 | 结果 |",
    "| --- | --- |",
    "| 表格中文 | 不乱码 |",
    "| 管道符 | a \\| b |",
    "",
    "~~~json",
    '{ "title": "中文 JSON", "ok": true }',
    "~~~",
    "",
    "```mermaid",
    "sequenceDiagram",
    "用户->>DraftPort: 输入中文源码",
    "DraftPort-->>用户: 保持行号稳定",
    "```",
    "",
    "## 结束",
    "最终行用于验证行数更新。",
  ].join("\n");

const renderApp = () =>
  render(<App />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter>{children}</MemoryRouter>
    ),
  });

vi.mock("codemirror", () => {
  class MockEditorView {
    static lineWrapping = codeMirrorMocks.lineWrapping;
    static updateListener = codeMirrorMocks.updateListener;
    static theme = codeMirrorMocks.editorViewThemeMock;

    destroy = vi.fn();
    dispatch = vi.fn(
      (transaction?: {
        changes?: { from: number; to: number; insert: string };
        effects?: unknown;
      }) => {
        if (!transaction?.changes) return;
        const nextMarkdown = transaction.changes.insert;
        this.state = {
          doc: {
            length: nextMarkdown.length,
            toString: () => nextMarkdown,
          },
        };
        this.updateListener?.({ docChanged: true, state: this.state });
      },
    );
    scrollDOM = document.createElement("div");
    state;
    updateListener?: (update: { docChanged: boolean; state: unknown }) => void;

    constructor(options: {
      state: { doc: { toString: () => string }; extensions?: unknown[] };
      parent: HTMLElement;
    }) {
      this.state = {
        doc: {
          length: options.state.doc.toString().length,
          toString: options.state.doc.toString,
        },
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
      options.parent.appendChild(this.scrollDOM);
      codeMirrorMocks.viewInstances.push(this);
    }

    /** Simulates a CodeMirror user edit so the App-level source mode can be tested without a browser engine. */
    simulateUserEdit(markdown: string) {
      this.state = {
        doc: {
          length: markdown.length,
          toString: () => markdown,
        },
      };
      this.updateListener?.({ docChanged: true, state: this.state });
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
    EditorSelection: {
      range: vi.fn((from: number, to: number) => ({ from, to })),
      create: vi.fn((ranges: unknown[]) => ({ ranges })),
    },
    Prec: {
      highest: vi.fn((extension: unknown) => extension),
    },
  };
});

vi.mock("@codemirror/lang-markdown", () => ({
  markdown: vi.fn(() => ({ extension: "markdown" })),
  markdownLanguage: { name: "markdownLanguage" },
}));

vi.mock("@codemirror/view", () => ({
  keymap: {
    of: vi.fn((bindings: unknown) => ({ extension: "keymap", bindings })),
  },
  EditorView: {
    mouseSelectionStyle: {
      of: vi.fn((factory: unknown) => ({
        extension: "mouseSelectionStyle",
        factory,
      })),
    },
  },
}));

vi.mock("@codemirror/commands", () => ({
  indentWithTab: { key: "Tab", run: vi.fn() },
}));

vi.mock("@codemirror/language", () => ({
  HighlightStyle: {
    define: vi.fn((spec: unknown) => ({ spec })),
  },
  syntaxHighlighting: vi.fn((style: unknown) => ({
    extension: "syntaxHighlighting",
    style,
  })),
}));

vi.mock("@lezer/highlight", () => ({
  Tag: {
    define: vi.fn((tag: unknown) => ({ definedTag: tag })),
  },
  tags: new Proxy(
    {
      special: (tag: unknown) => ({ special: tag }),
    },
    {
      get(target, property) {
        if (property in target) {
          return target[property as keyof typeof target];
        }
        return String(property);
      },
    },
  ),
}));

vi.mock("@uiw/codemirror-theme-github", () => ({
  githubLight: { extension: "githubLight" },
}));

vi.mock("../../components/Header/Header", () => ({
  Header: () => <div data-testid="header" />,
}));

vi.mock("../../components/Sidebar/FileSidebar", () => ({
  FileSidebar: () => <div data-testid="file-sidebar" />,
}));

vi.mock("../../components/Editor/WysiwygMarkdownEditor", () => ({
  canUseWysiwygMarkdown: () => true,
  WysiwygMarkdownEditor: () => <div data-testid="wysiwyg-markdown-editor" />,
}));

vi.mock("../../components/Editor/SearchPanel", () => ({
  SearchPanel: () => <div data-testid="search-panel" />,
}));

vi.mock("../../components/Editor/SaveIndicator", () => ({
  SaveIndicator: () => <div data-testid="save-indicator" />,
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

vi.mock("../../hooks/useUITheme", () => ({
  useUITheme: (selector: (state: { theme: "default" }) => unknown) =>
    selector({ theme: "default" }),
}));

vi.mock("../../store/fileStore", () => ({
  useFileStore: (selector: (state: typeof fileStoreState) => unknown) =>
    selector(fileStoreState),
}));

vi.mock("../../store/editorStore", () => ({
  useEditorStore: (
    selector?: (state: typeof editorStoreState) => unknown,
  ): unknown => {
    if (typeof selector === "function") return selector(editorStoreState);
    return editorStoreState;
  },
}));

describe("App source Markdown editing mode", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
    fileStoreState.currentFile = activeFile();
    fileStoreState.isLoading = false;
    editorStoreState.markdown = "# 源码模式\n\n初始内容";
    editorStoreState.currentFilePath = "/workspace/source.md";
    editorStoreState.setMarkdown.mockClear();
    codeMirrorMocks.viewInstances.length = 0;
    codeMirrorMocks.updateListener.of.mockClear();
    codeMirrorMocks.editorViewThemeMock.mockClear();
  });

  it("round-trips a complex Typora-style source document through the real source editor", () => {
    const initialMarkdown = typoraSourceFixture();
    editorStoreState.markdown = initialMarkdown;

    const { rerender } = renderApp();
    fireEvent.keyDown(document, { key: "/", ctrlKey: true });

    const sourceView = codeMirrorMocks.viewInstances[0];
    expect(
      screen.getByText(`行数: ${countMarkdownLines(initialMarkdown)}`),
    ).toBeVisible();
    expect(sourceView?.state.doc.toString()).toBe(initialMarkdown);

    const editedMarkdown = editedTyporaSourceFixture();
    sourceView?.simulateUserEdit(editedMarkdown);

    expect(editorStoreState.setMarkdown).toHaveBeenLastCalledWith(
      editedMarkdown,
    );
    expect(editorStoreState.markdown).toBe(editedMarkdown);
    expect(editorStoreState.markdown).toContain(
      "用户->>DraftPort: 输入中文源码",
    );
    expect(editorStoreState.markdown).toContain(
      '{ "title": "中文 JSON", "ok": true }',
    );

    rerender(<App />);

    expect(
      screen.getByText(`行数: ${countMarkdownLines(editedMarkdown)}`),
    ).toBeVisible();
  });

  it("syncs a complex external source replacement without echoing it as a user edit", () => {
    const initialMarkdown = typoraSourceFixture();
    const replacementMarkdown = editedTyporaSourceFixture();
    editorStoreState.markdown = initialMarkdown;

    const { rerender } = renderApp();
    fireEvent.keyDown(document, { key: "/", ctrlKey: true });

    const sourceView = codeMirrorMocks.viewInstances[0];
    sourceView?.dispatch.mockClear();
    editorStoreState.setMarkdown.mockClear();

    editorStoreState.markdown = replacementMarkdown;
    rerender(<App />);

    expect(sourceView?.dispatch).toHaveBeenCalledWith({
      changes: {
        from: 0,
        to: initialMarkdown.length,
        insert: replacementMarkdown,
      },
    });
    expect(sourceView?.state.doc.toString()).toBe(replacementMarkdown);
    expect(editorStoreState.setMarkdown).not.toHaveBeenCalled();
  });

  it("keeps one source editor instance across mode toggles after deep source edits", () => {
    editorStoreState.markdown = typoraSourceFixture();

    renderApp();
    fireEvent.keyDown(document, { key: "/", ctrlKey: true });

    const sourceView = codeMirrorMocks.viewInstances[0];
    const editedMarkdown = editedTyporaSourceFixture();
    sourceView?.simulateUserEdit(editedMarkdown);

    fireEvent.keyDown(document, { key: "/", ctrlKey: true });
    expect(screen.getByTestId("wysiwyg-markdown-editor")).toBeVisible();

    fireEvent.keyDown(document, { key: "/", ctrlKey: true });

    expect(codeMirrorMocks.viewInstances).toHaveLength(1);
    expect(sourceView?.state.doc.toString()).toBe(editedMarkdown);
    expect(editorStoreState.markdown).toBe(editedMarkdown);
  });
});
