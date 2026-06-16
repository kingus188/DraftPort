/**
 * Verifies the startup window reveal policy without launching a real renderer.
 * The tests protect the perceived startup path from waiting on renderer readiness.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installStartupWindowVisibility } from './startupWindowVisibility';

/** Minimal BrowserWindow-like double used by startup visibility tests. */
class TestStartupWindow {
    public maximizeCalls = 0;
    public showCalls = 0;
    public readonly onceHandlers = new Map<string, () => void>();

    once(eventName: string, handler: () => void): void {
        this.onceHandlers.set(eventName, handler);
    }

    maximize(): void {
        this.maximizeCalls += 1;
    }

    show(): void {
        this.showCalls += 1;
    }
}

test('installStartupWindowVisibility shows the window before ready-to-show', () => {
    const window = new TestStartupWindow();

    installStartupWindowVisibility(window);

    assert.equal(window.maximizeCalls, 1);
    assert.equal(window.showCalls, 1);
});

test('installStartupWindowVisibility does not show the window twice after ready-to-show', () => {
    const window = new TestStartupWindow();

    installStartupWindowVisibility(window);
    window.onceHandlers.get('ready-to-show')?.();

    assert.equal(window.maximizeCalls, 1);
    assert.equal(window.showCalls, 1);
});
