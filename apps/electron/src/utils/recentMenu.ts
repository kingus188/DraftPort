// Builds the native "Recent Open" menu from persisted desktop navigation metadata.
// The menu is presentation-only; callers own filesystem validation and open behavior.
import * as path from 'path';
import type { MenuItemConstructorOptions } from 'electron';
import type { RecentItemRecord } from '../recentItemsStore';

const RECENT_MENU_LIMIT = 10;

/**
 * Creates the File menu submenu that lists recently opened files and folders.
 */
export function buildRecentOpenSubmenu(
    items: RecentItemRecord[],
    onOpen: (item: RecentItemRecord) => void
): MenuItemConstructorOptions {
    const visibleItems = items.slice(0, RECENT_MENU_LIMIT);
    return {
        label: '最近打开',
        submenu: visibleItems.length
            ? visibleItems.map((item) => ({
                label: getRecentItemLabel(item),
                sublabel: item.itemType === 'folder' ? '文件夹' : 'Markdown 文件',
                click: () => onOpen(item),
            }))
            : [{ label: '暂无最近打开', enabled: false }],
    };
}

function getRecentItemLabel(item: RecentItemRecord): string {
    const title = item.title?.trim();
    if (title) return title;
    return path.basename(item.itemPath) || item.itemPath;
}
