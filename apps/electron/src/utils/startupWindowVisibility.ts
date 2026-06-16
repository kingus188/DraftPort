/**
 * Owns the Electron startup reveal policy for the main application window.
 * It keeps perceived startup time independent from renderer readiness.
 */

/** BrowserWindow subset needed to reveal the app shell during startup. */
export interface StartupWindow {
    /** Registers the renderer-ready fallback without requiring a concrete Electron import. */
    once(eventName: 'ready-to-show', handler: () => void): void;
    /** Applies the existing startup window sizing policy before the shell is shown. */
    maximize(): void;
    /** Makes the app shell visible to the user. */
    show(): void;
    /** Guards against revealing a window that closed before the fallback event fired. */
    isDestroyed?: () => boolean;
}

/**
 * Shows the startup window as soon as loading has been requested, while keeping
 * `ready-to-show` as a fallback for future call sites that install the policy early.
 */
export function installStartupWindowVisibility(window: StartupWindow): void {
    let revealed = false;

    const reveal = () => {
        if (revealed) return;
        if (window.isDestroyed?.()) return;
        revealed = true;
        window.maximize();
        window.show();
    };

    window.once('ready-to-show', reveal);
    reveal();
}
