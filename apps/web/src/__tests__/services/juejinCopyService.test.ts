// Covers the Juejin rich-text clipboard orchestration without depending on a live Juejin editor.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  parserRender: vi.fn(),
  createMarkdownParserMock: vi.fn(),
  clipboardWrite: vi.fn(),
  desktopClipboardWrite: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: mocked.toastSuccess,
    error: mocked.toastError,
  },
}));

vi.mock("@draftport/core", () => ({
  createMarkdownParser: mocked.createMarkdownParserMock.mockImplementation(
    () => ({ render: mocked.parserRender }),
  ),
}));

import { copyToJuejin } from "../../services/juejinCopyService";

type MockClipboardItemData = Record<
  string,
  string | Blob | PromiseLike<string | Blob>
>;

class MockClipboardItem {
  static supports(_type: string): boolean {
    return true;
  }

  readonly types: string[];
  readonly presentationStyle: PresentationStyle;

  constructor(
    private readonly data: MockClipboardItemData,
    _options?: ClipboardItemOptions,
  ) {
    this.types = Object.keys(data);
    this.presentationStyle = "unspecified";
  }

  async getType(type: string): Promise<Blob> {
    const value = this.data[type];
    if (!value) {
      throw new Error(`Clipboard item type not found: ${type}`);
    }
    const resolved = await value;
    return typeof resolved === "string" ? new Blob([resolved]) : resolved;
  }
}

async function readBlobText(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(blob);
  });
}

describe("copyToJuejin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.createMarkdownParserMock.mockImplementation(() => ({
      render: mocked.parserRender,
    }));
    mocked.parserRender.mockReturnValue(
      '<h1><span class="content">标题</span></h1><p>段落</p>',
    );

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        write: mocked.clipboardWrite,
      },
    });

    (
      window as unknown as { ClipboardItem: typeof ClipboardItem }
    ).ClipboardItem = MockClipboardItem as unknown as typeof ClipboardItem;
    (
      globalThis as unknown as { ClipboardItem: typeof ClipboardItem }
    ).ClipboardItem = (
      window as unknown as { ClipboardItem: typeof ClipboardItem }
    ).ClipboardItem;

    const doc = document as unknown as {
      execCommand?: (command: string) => boolean;
    };
    doc.execCommand = vi.fn(() => true);

    Object.defineProperty(window, "desktop", {
      configurable: true,
      value: undefined,
    });
  });

  it("renders markdown and writes Juejin-oriented HTML with plain text fallback", async () => {
    vi.spyOn(document, "execCommand").mockReturnValue(false);

    await copyToJuejin("# 标题");

    expect(mocked.createMarkdownParserMock).toHaveBeenCalledWith({
      showMacBar: false,
    });
    expect(mocked.parserRender).toHaveBeenCalledWith("# 标题");
    expect(mocked.clipboardWrite).toHaveBeenCalledTimes(1);

    const [[items]] = mocked.clipboardWrite.mock.calls;
    const clipboardItem = items[0] as MockClipboardItem;
    const html = await readBlobText(await clipboardItem.getType("text/html"));
    const text = await readBlobText(await clipboardItem.getType("text/plain"));

    expect(html).toBe("<h1>标题</h1><p>段落</p>");
    expect(text).toBe("标题段落");
    expect(mocked.toastSuccess).toHaveBeenCalledWith(
      "已复制，可以直接粘贴至掘金",
      { duration: 3000, icon: "✅" },
    );
  });

  it("prefers desktop HTML clipboard bridge in desktop runtime", async () => {
    Object.defineProperty(window, "desktop", {
      configurable: true,
      value: {
        isDesktop: true,
        clipboard: {
          writeHTML: mocked.desktopClipboardWrite.mockResolvedValue({
            success: true,
          }),
        },
      },
    });
    const execSpy = vi.spyOn(document, "execCommand").mockReturnValue(true);

    await copyToJuejin("# 标题");

    expect(mocked.desktopClipboardWrite).toHaveBeenCalledWith({
      html: "<h1>标题</h1><p>段落</p>",
      text: "标题段落",
    });
    expect(execSpy).not.toHaveBeenCalled();
    expect(mocked.clipboardWrite).not.toHaveBeenCalled();
  });

  it("toasts and throws when all clipboard paths fail", async () => {
    vi.spyOn(document, "execCommand").mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocked.clipboardWrite.mockRejectedValueOnce(new Error("denied"));

    await expect(copyToJuejin("# 标题")).rejects.toThrow(
      "浏览器剪贴板写入失败",
    );
    expect(mocked.toastError).toHaveBeenCalledWith(
      "复制到掘金失败: 浏览器剪贴板写入失败",
    );
    consoleErrorSpy.mockRestore();
  });
});
