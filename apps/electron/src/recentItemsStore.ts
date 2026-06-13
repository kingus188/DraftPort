// Owns SQLite persistence for desktop recent navigation items.
// The store keeps only local file and folder metadata; document content stays on disk.
import Database from 'better-sqlite3';
import * as fs from 'fs';

export type RecentItemType = 'file' | 'folder';

export interface RecentItemInput {
    workspacePath: string;
    itemPath: string;
    itemType: RecentItemType;
    title?: string | null;
    themeName?: string | null;
    openedAt?: string;
}

export interface RecentItemRecord {
    workspacePath: string;
    itemPath: string;
    itemType: RecentItemType;
    title: string | null;
    themeName: string | null;
    openedAt: string;
    mtime: number | null;
    size: number | null;
    missing: boolean;
}

interface RecentItemRow {
    workspace_path: string;
    item_path: string;
    item_type: RecentItemType;
    title: string | null;
    theme_name: string | null;
    opened_at: string;
    mtime: number | null;
    size: number | null;
    missing: 0 | 1;
}

const DEFAULT_LIMIT = 100;

/**
 * Creates a SQLite-backed store for recent files and folders.
 */
export function createRecentItemsStore(dbPath: string, limit = DEFAULT_LIMIT) {
    return new RecentItemsStore(dbPath, limit);
}

/**
 * Persists recent file and folder metadata for Electron workspaces.
 */
export class RecentItemsStore {
    private readonly db: Database.Database;
    private readonly limit: number;

    /**
     * Opens the database and ensures the recent item schema exists.
     */
    constructor(dbPath: string, limit = DEFAULT_LIMIT) {
        this.db = new Database(dbPath);
        this.limit = limit;
        this.db.pragma('journal_mode = WAL');
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS recent_items (
                workspace_path TEXT NOT NULL,
                item_path TEXT NOT NULL,
                item_type TEXT NOT NULL CHECK (item_type IN ('file', 'folder')),
                title TEXT,
                theme_name TEXT,
                opened_at TEXT NOT NULL,
                mtime INTEGER,
                size INTEGER,
                missing INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (workspace_path, item_path, item_type)
            );

            CREATE INDEX IF NOT EXISTS idx_recent_items_workspace_opened
            ON recent_items (workspace_path, opened_at DESC);

            CREATE INDEX IF NOT EXISTS idx_recent_items_opened
            ON recent_items (opened_at DESC);
        `);
    }

    /**
     * Inserts or refreshes a recent item, then trims the workspace history.
     */
    recordOpen(input: RecentItemInput): RecentItemRecord {
        const metadata = readItemMetadata(input.itemPath);
        const openedAt = input.openedAt ?? new Date().toISOString();
        this.db.prepare(`
            INSERT INTO recent_items (
                workspace_path,
                item_path,
                item_type,
                title,
                theme_name,
                opened_at,
                mtime,
                size,
                missing
            )
            VALUES (@workspacePath, @itemPath, @itemType, @title, @themeName, @openedAt, @mtime, @size, @missing)
            ON CONFLICT(workspace_path, item_path, item_type) DO UPDATE SET
                title = excluded.title,
                theme_name = excluded.theme_name,
                opened_at = excluded.opened_at,
                mtime = excluded.mtime,
                size = excluded.size,
                missing = excluded.missing
        `).run({
            workspacePath: input.workspacePath,
            itemPath: input.itemPath,
            itemType: input.itemType,
            title: input.title ?? null,
            themeName: input.themeName ?? null,
            openedAt,
            mtime: metadata.mtime,
            size: metadata.size,
            missing: metadata.missing ? 1 : 0,
        });
        this.trim(input.workspacePath);
        return this.get(input.workspacePath, input.itemPath, input.itemType);
    }

    /**
     * Lists existing recent items for one workspace in newest-opened order.
     */
    list(workspacePath: string, limit = this.limit): RecentItemRecord[] {
        this.pruneMissing(workspacePath);
        const rows = this.db.prepare(`
            SELECT workspace_path, item_path, item_type, title, theme_name, opened_at, mtime, size, missing
            FROM recent_items
            WHERE workspace_path = ? AND missing = 0
            ORDER BY opened_at DESC, item_path ASC
            LIMIT ?
        `).all(workspacePath, limit) as RecentItemRow[];
        return rows.map(mapRow);
    }

    /**
     * Lists existing recent items across workspaces for startup surfaces with no active workspace yet.
     */
    listAll(limit = this.limit): RecentItemRecord[] {
        this.pruneMissingRows(this.getExistingRows());
        const rows = this.db.prepare(`
            SELECT workspace_path, item_path, item_type, title, theme_name, opened_at, mtime, size, missing
            FROM recent_items
            WHERE missing = 0
            ORDER BY opened_at DESC, item_path ASC
            LIMIT ?
        `).all(limit) as RecentItemRow[];
        return rows.map(mapRow);
    }

    /**
     * Removes every recent entry for the given path in one workspace.
     */
    remove(workspacePath: string, itemPath: string): void {
        const rows = this.findPathsAtOrBelow(workspacePath, itemPath);
        const removePath = this.db.prepare(`
            DELETE FROM recent_items
            WHERE workspace_path = ? AND item_path = ?
        `);
        const removeMany = this.db.transaction((paths: string[]) => {
            for (const pathToRemove of paths) {
                removePath.run(workspacePath, pathToRemove);
            }
        });
        removeMany(rows);
    }

    /**
     * Renames or moves a stored path while preserving its opened timestamp.
     */
    renamePath(workspacePath: string, oldPath: string, newPath: string): void {
        const rows = this.findPathsAtOrBelow(workspacePath, oldPath);
        const renamePath = this.db.prepare(`
            UPDATE recent_items
            SET item_path = ?
            WHERE workspace_path = ? AND item_path = ?
        `);
        const renameMany = this.db.transaction((paths: string[]) => {
            for (const currentPath of paths) {
                renamePath.run(replacePathPrefix(currentPath, oldPath, newPath), workspacePath, currentPath);
            }
        });
        renameMany(rows);
    }

    /**
     * Clears all recent entries for one workspace.
     */
    clear(workspacePath: string): void {
        this.db.prepare('DELETE FROM recent_items WHERE workspace_path = ?').run(workspacePath);
    }

    /**
     * Closes the underlying SQLite connection.
     */
    close(): void {
        this.db.close();
    }

    private get(workspacePath: string, itemPath: string, itemType: RecentItemType): RecentItemRecord {
        const row = this.db.prepare(`
            SELECT workspace_path, item_path, item_type, title, theme_name, opened_at, mtime, size, missing
            FROM recent_items
            WHERE workspace_path = ? AND item_path = ? AND item_type = ?
        `).get(workspacePath, itemPath, itemType) as RecentItemRow | undefined;
        if (!row) {
            throw new Error('Recent item was not persisted');
        }
        return mapRow(row);
    }

    private trim(workspacePath: string): void {
        this.db.prepare(`
            DELETE FROM recent_items
            WHERE workspace_path = ?
              AND rowid NOT IN (
                SELECT rowid FROM recent_items
                WHERE workspace_path = ?
                ORDER BY opened_at DESC, item_path ASC
                LIMIT ?
              )
        `).run(workspacePath, workspacePath, this.limit);
    }

    private pruneMissing(workspacePath: string): void {
        const rows = this.db.prepare(`
            SELECT workspace_path, item_path FROM recent_items
            WHERE workspace_path = ? AND missing = 0
        `).all(workspacePath) as Array<{ workspace_path: string; item_path: string }>;
        this.pruneMissingRows(rows);
    }

    private getExistingRows(): Array<{ workspace_path: string; item_path: string }> {
        return this.db.prepare(`
            SELECT workspace_path, item_path FROM recent_items
            WHERE missing = 0
        `).all() as Array<{ workspace_path: string; item_path: string }>;
    }

    private pruneMissingRows(rows: Array<{ workspace_path: string; item_path: string }>): void {
        const markMissing = this.db.prepare(`
            UPDATE recent_items SET missing = 1
            WHERE workspace_path = ? AND item_path = ?
        `);
        for (const row of rows) {
            if (!fs.existsSync(row.item_path)) {
                markMissing.run(row.workspace_path, row.item_path);
            }
        }
    }

    private findPathsAtOrBelow(workspacePath: string, itemPath: string): string[] {
        const rows = this.db.prepare(`
            SELECT item_path FROM recent_items
            WHERE workspace_path = ?
        `).all(workspacePath) as Array<{ item_path: string }>;
        return rows
            .map((row) => row.item_path)
            .filter((candidate) => isPathAtOrBelow(candidate, itemPath));
    }
}

function readItemMetadata(itemPath: string) {
    try {
        const stats = fs.statSync(itemPath);
        return {
            mtime: Math.trunc(stats.mtimeMs),
            size: stats.isFile() ? stats.size : null,
            missing: false,
        };
    } catch {
        return {
            mtime: null,
            size: null,
            missing: true,
        };
    }
}

function mapRow(row: RecentItemRow): RecentItemRecord {
    return {
        workspacePath: row.workspace_path,
        itemPath: row.item_path,
        itemType: row.item_type,
        title: row.title,
        themeName: row.theme_name,
        openedAt: row.opened_at,
        mtime: row.mtime,
        size: row.size,
        missing: row.missing === 1,
    };
}

function isPathAtOrBelow(candidate: string, parent: string): boolean {
    return (
        candidate === parent ||
        candidate.startsWith(`${parent}/`) ||
        candidate.startsWith(`${parent}\\`)
    );
}

function replacePathPrefix(candidate: string, oldPath: string, newPath: string): string {
    if (candidate === oldPath) return newPath;
    return `${newPath}${candidate.slice(oldPath.length)}`;
}
