// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { installTauriDesktopBridge } from "../../desktop/tauriBridge";

type TestWindow = Window & {
  __TAURI_EVENT_PLUGIN_INTERNALS__?: unknown;
};

describe("installTauriDesktopBridge", () => {
  beforeEach(() => {
    const testWindow = window as TestWindow;
    delete testWindow.desktop;
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

    installTauriDesktopBridge();

    expect(window.desktop?.isDesktop).toBe(true);
    expect(window.desktop?.platform).toBe("darwin");

    await expect(window.desktop?.fs.listFiles()).resolves.toEqual({
      success: true,
    });
    expect(invoke).toHaveBeenCalledWith("file_list", { dir: undefined });
  });

  it("exposes workspace order commands for project-local manual sorting", async () => {
    const invoke = vi.fn(async () => ({ success: true }));
    window.__TAURI_INTERNALS__ = { invoke };

    installTauriDesktopBridge();

    expect(window.desktop?.workspaceOrder).toBeDefined();
    await window.desktop!.workspaceOrder!.get();
    await window.desktop!.workspaceOrder!.save({
      version: 1,
      folders: {
        "/workspace": ["/workspace/docs", "/workspace/a.md"],
      },
      sortModes: {
        "/workspace": "manual",
        "/workspace/docs": "name-asc",
      },
    });

    expect(invoke).toHaveBeenCalledWith("workspace_order_get", undefined);
    expect(invoke).toHaveBeenCalledWith("workspace_order_save", {
      payload: {
        version: 1,
        folders: {
          "/workspace": ["/workspace/docs", "/workspace/a.md"],
        },
        sortModes: {
          "/workspace": "manual",
          "/workspace/docs": "name-asc",
        },
      },
    });
  });

  it("wraps folder creation arguments for the Rust command payload", async () => {
    const invoke = vi.fn(async () => ({ success: true }));
    window.__TAURI_INTERNALS__ = { invoke };

    installTauriDesktopBridge();

    await window.desktop!.fs.createFolder("/workspace/docs/child");

    expect(invoke).toHaveBeenCalledWith("folder_create", {
      payload: { folderName: "/workspace/docs/child" },
    });
  });

  it("removes only listeners registered through the bridge", async () => {
    const callbacks: Array<() => void> = [];
    window.__TAURI_INTERNALS__ = {
      invoke: vi.fn(async () => "darwin"),
    };
    (window as TestWindow).__TAURI_EVENT_PLUGIN_INTERNALS__ = {};

    installTauriDesktopBridge({
      listen: (_event, callback) => {
        callbacks.push(callback as () => void);
        return Promise.resolve(() => callbacks.splice(0, callbacks.length));
      },
    });

    window.desktop?.fs.onRefresh(() => undefined);
    await Promise.resolve();
    expect(callbacks).toHaveLength(1);

    window.desktop?.fs.removeAllListeners();
    expect(callbacks).toHaveLength(0);
  });
});
