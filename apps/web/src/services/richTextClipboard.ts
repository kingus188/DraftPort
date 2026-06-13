/**
 * Owns the shared HTML clipboard write strategy for external publishing platforms.
 * It writes both rich HTML and rendered plain text while keeping platform services
 * focused on Markdown rendering and HTML normalization.
 */

import toast from "react-hot-toast";

interface RichTextClipboardMessages {
  success: string;
  failurePrefix: string;
}

/** Copies the visible contents of a hidden rich-text container through the browser selection pipeline. */
const copyViaNativeExecCommand = (container: HTMLElement): boolean => {
  if (typeof document.execCommand !== "function") return false;
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(container);
  selection?.removeAllRanges();
  selection?.addRange(range);
  try {
    return document.execCommand("copy");
  } finally {
    selection?.removeAllRanges();
  }
};

/** Reads text from the rendered DOM so plain-text clipboard data mirrors the rich HTML. */
const getRenderedPlainText = (container: HTMLElement): string => {
  const innerText = container.innerText;
  if (typeof innerText === "string" && innerText.trim().length > 0) {
    return innerText;
  }
  return container.textContent || "";
};

/** Writes HTML through the Electron bridge when the desktop shell exposes it. */
const copyViaElectronClipboard = async (
  container: HTMLElement,
): Promise<{ success: boolean; error?: string } | null> => {
  const writeHTML = window.electron?.clipboard?.writeHTML;
  if (!window.electron?.isElectron || !writeHTML) return null;

  return writeHTML({
    html: container.innerHTML,
    text: getRenderedPlainText(container),
  });
};

/** Writes both HTML and plain text through the modern async Clipboard API. */
const copyViaClipboardApi = async (
  container: HTMLElement,
): Promise<boolean> => {
  if (!navigator.clipboard || !window.ClipboardItem) return false;

  const htmlBlob = new Blob([container.innerHTML], { type: "text/html" });
  const textBlob = new Blob([getRenderedPlainText(container)], {
    type: "text/plain",
  });
  await navigator.clipboard.write([
    new ClipboardItem({
      "text/html": htmlBlob,
      "text/plain": textBlob,
    }),
  ]);
  return true;
};

/** Creates the hidden DOM fragment used by browser selection copy fallbacks. */
const createCopyContainer = (html: string): HTMLElement => {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "0";
  container.style.width = "760px";
  container.style.opacity = "0";
  container.style.pointerEvents = "none";
  container.style.zIndex = "-1";
  container.style.contain = "layout style paint";
  container.style.colorScheme = "light";
  container.innerHTML = html;
  return container;
};

/**
 * Writes normalized platform HTML to the clipboard.
 * Throws when every available clipboard strategy fails so callers can surface errors.
 */
export async function copyRichHtmlToClipboard(
  html: string,
  messages: RichTextClipboardMessages,
): Promise<void> {
  const container = createCopyContainer(html);
  document.body.appendChild(container);

  try {
    let copied = false;

    try {
      const electronResult = await copyViaElectronClipboard(container);
      if (electronResult) {
        copied = electronResult.success;
      }
    } catch (error) {
      console.error("Electron 剪贴板写入失败，降级为浏览器复制链路", error);
    }

    if (!copied) {
      copied = copyViaNativeExecCommand(container);
    }

    if (!copied) {
      try {
        copied = await copyViaClipboardApi(container);
      } catch (error) {
        console.error("Clipboard API 写入失败", error);
      }
    }

    if (!copied) {
      throw new Error("浏览器剪贴板写入失败");
    }

    toast.success(messages.success, {
      duration: 3000,
      icon: "✅",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    toast.error(`${messages.failurePrefix}: ${errorMessage}`);
    throw error;
  } finally {
    document.body.removeChild(container);
  }
}
