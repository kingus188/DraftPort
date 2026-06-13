import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecentOpenSubmenu } from './recentMenu';
import type { RecentItemRecord } from '../recentItemsStore';

function recentItem(path: string, type: 'file' | 'folder', title?: string): RecentItemRecord {
    return {
        workspacePath: '/workspace',
        itemPath: path,
        itemType: type,
        title: title ?? null,
        themeName: null,
        openedAt: '2026-01-01T00:00:00.000Z',
        mtime: null,
        size: null,
        missing: false,
    };
}

test('buildRecentOpenSubmenu returns a disabled empty state when no recent items exist', () => {
    const menu = buildRecentOpenSubmenu([], () => undefined);

    assert.equal(menu.label, '最近打开');
    assert.equal(Array.isArray(menu.submenu), true);
    const submenu = menu.submenu as Electron.MenuItemConstructorOptions[];
    assert.equal(submenu.length, 1);
    assert.equal(submenu[0].label, '暂无最近打开');
    assert.equal(submenu[0].enabled, false);
});

test('buildRecentOpenSubmenu creates file and folder menu items that emit their item payload', () => {
    const opened: RecentItemRecord[] = [];
    const article = recentItem('/workspace/docs/article.md', 'file', 'Article');
    const folder = recentItem('/workspace/docs', 'folder');
    const menu = buildRecentOpenSubmenu([article, folder], (item) => opened.push(item));
    const submenu = menu.submenu as Electron.MenuItemConstructorOptions[];

    assert.equal(submenu[0].label, 'Article');
    assert.equal(submenu[1].label, 'docs');

    submenu[0].click?.(undefined as never, undefined as never, undefined as never);
    submenu[1].click?.(undefined as never, undefined as never, undefined as never);

    assert.deepEqual(opened.map((item) => [item.itemType, item.itemPath]), [
        ['file', '/workspace/docs/article.md'],
        ['folder', '/workspace/docs'],
    ]);
});
