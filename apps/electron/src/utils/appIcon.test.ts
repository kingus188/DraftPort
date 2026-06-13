/**
 * Verifies Electron icon path resolution and Dock icon application behavior.
 * These tests keep runtime icon handling stable without launching Electron.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAppIconPath, applyDockIcon } from './appIcon';
import type { AppIconImage } from './appIcon';

/** Test-only icon shape that preserves the loaded path for assertions. */
interface TestIcon extends AppIconImage {
    path: string;
}

test('resolveAppIconPath prefers the compiled assets directory', () => {
    const exists = (candidate: string) => candidate.endsWith('/dist/assets/icon.png');

    assert.equal(resolveAppIconPath('/app/dist', exists), '/app/dist/assets/icon.png');
});

test('resolveAppIconPath falls back to the source assets directory', () => {
    const exists = (candidate: string) => candidate === '/app/assets/icon.png';

    assert.equal(resolveAppIconPath('/app/dist', exists), '/app/assets/icon.png');
});

test('applyDockIcon sets the macOS Dock icon when the icon image is available', () => {
    const calls: string[] = [];

    const applied = applyDockIcon<TestIcon>({
        platform: 'darwin',
        iconPath: '/app/assets/icon.png',
        dock: {
            setIcon: (icon: TestIcon) => {
                calls.push(icon.path);
            },
        },
        nativeImage: {
            createFromPath: (iconPath: string) => ({
                path: iconPath,
                isEmpty: () => false,
            }),
        },
    });

    assert.equal(applied, true);
    assert.deepEqual(calls, ['/app/assets/icon.png']);
});

test('applyDockIcon leaves non-macOS platforms unchanged', () => {
    const calls: string[] = [];

    const applied = applyDockIcon<TestIcon>({
        platform: 'linux',
        iconPath: '/app/assets/icon.png',
        dock: {
            setIcon: (icon: TestIcon) => {
                calls.push(icon.path);
            },
        },
        nativeImage: {
            createFromPath: (iconPath: string) => ({
                path: iconPath,
                isEmpty: () => false,
            }),
        },
    });

    assert.equal(applied, false);
    assert.deepEqual(calls, []);
});
