// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { installTauriElectronBridge } from "../../desktop/tauriBridge";

type TestWindow = Window & {
  __TAURI_EVENT_PLUGIN_INTERNALS__?: unknown;
};

describe("installTauriElectronBridge", () => {
  beforeEach(() => {
    const testWindow = window as TestWindow;
    delete testWindow.electron;
    delete testWindow.__TAURI_INTERNALS__;
    delete testWindow.__TAURI_EVENT_PLUGIN_INTERNALS__;
    Object.defineProperty(navigator, "platform", {
      configurable: true,
      value: "MacIntel",
    });
  });

  it("exposes the existing desktop contract when Tauri internals are present", async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command === "desktop_platform") return "darwin";
      return { success: true };
    });
    window.__TAURI_INTERNALS__ = { invoke };
    (window as TestWindow).__TAURI_EVENT_PLUGIN_INTERNALS__ = {};

    installTauriElectronBridge();

    expect(window.electron?.isElectron).toBe(true);
    expect(window.electron?.platform).toBe("darwin");

    await expect(window.electron?.fs.listFiles()).resolves.toEqual({
      success: true,
    });
    expect(invoke).toHaveBeenCalledWith("file_list", { dir: undefined });
  });

  it("removes only listeners registered through the bridge", async () => {
    const callbacks: Array<() => void> = [];
    window.__TAURI_INTERNALS__ = {
      invoke: vi.fn(async () => "darwin"),
    };
    (window as TestWindow).__TAURI_EVENT_PLUGIN_INTERNALS__ = {};

    installTauriElectronBridge({
      listen: (_event, callback) => {
        callbacks.push(callback as () => void);
        return Promise.resolve(() => callbacks.splice(0, callbacks.length));
      },
    });

    window.electron?.fs.onRefresh(() => undefined);
    await Promise.resolve();
    expect(callbacks).toHaveLength(1);

    window.electron?.fs.removeAllListeners();
    expect(callbacks).toHaveLength(0);
  });
});
