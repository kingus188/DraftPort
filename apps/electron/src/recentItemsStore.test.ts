import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRecentItemsStore, type RecentItemInput } from './recentItemsStore';

function makeStore() {
    const dir = mkdtempSync(path.join(tmpdir(), 'draftport-recent-'));
    return createRecentItemsStore(path.join(dir, 'recent.sqlite'));
}

function makeWorkspace() {
    const workspace = mkdtempSync(path.join(tmpdir(), 'draftport-workspace-'));
    const docs = path.join(workspace, 'docs');
    mkdirSync(docs);
    const article = path.join(docs, 'article.md');
    writeFileSync(article, '# Article\n', 'utf8');
    return { workspace, docs, article };
}

function item(input: Partial<RecentItemInput> & Pick<RecentItemInput, 'workspacePath' | 'itemPath' | 'itemType'>): RecentItemInput {
    return {
        title: null,
        themeName: null,
        ...input,
    };
}

test('records files and folders per workspace in newest-opened order', () => {
    const store = makeStore();
    const first = makeWorkspace();
    const second = makeWorkspace();

    store.recordOpen(item({
        workspacePath: first.workspace,
        itemPath: first.docs,
        itemType: 'folder',
        openedAt: '2026-01-01T00:00:00.000Z',
    }));
    store.recordOpen(item({
        workspacePath: first.workspace,
        itemPath: first.article,
        itemType: 'file',
        title: 'Article',
        themeName: '默认主题',
        openedAt: '2026-01-02T00:00:00.000Z',
    }));
    store.recordOpen(item({
        workspacePath: second.workspace,
        itemPath: second.article,
        itemType: 'file',
        openedAt: '2026-01-03T00:00:00.000Z',
    }));

    const items = store.list(first.workspace);
    assert.deepEqual(items.map((entry) => [entry.itemType, entry.itemPath]), [
        ['file', first.article],
        ['folder', first.docs],
    ]);
    assert.equal(items[0].title, 'Article');
    assert.equal(items[0].themeName, '默认主题');
});

test('lists recent items across workspaces for startup screens', () => {
    const store = makeStore();
    const first = makeWorkspace();
    const second = makeWorkspace();

    store.recordOpen(item({
        workspacePath: first.workspace,
        itemPath: first.article,
        itemType: 'file',
        openedAt: '2026-01-01T00:00:00.000Z',
    }));
    store.recordOpen(item({
        workspacePath: second.workspace,
        itemPath: second.docs,
        itemType: 'folder',
        openedAt: '2026-01-02T00:00:00.000Z',
    }));

    assert.deepEqual(store.listAll().map((entry) => [entry.workspacePath, entry.itemPath]), [
        [second.workspace, second.docs],
        [first.workspace, first.article],
    ]);
});

test('renames a recent path without changing its opened time', () => {
    const store = makeStore();
    const { workspace, article } = makeWorkspace();
    const nextPath = path.join(workspace, 'renamed.md');

    store.recordOpen(item({
        workspacePath: workspace,
        itemPath: article,
        itemType: 'file',
        openedAt: '2026-01-01T00:00:00.000Z',
    }));
    renameSync(article, nextPath);
    store.renamePath(workspace, article, nextPath);

    const [entry] = store.list(workspace);
    assert.equal(entry.itemPath, nextPath);
    assert.equal(entry.openedAt, '2026-01-01T00:00:00.000Z');
});

test('renames and removes descendants when a recent folder path changes', () => {
    const store = makeStore();
    const { workspace, docs, article } = makeWorkspace();
    const renamedDocs = path.join(workspace, 'renamed-docs');

    store.recordOpen(item({
        workspacePath: workspace,
        itemPath: docs,
        itemType: 'folder',
        openedAt: '2026-01-01T00:00:00.000Z',
    }));
    store.recordOpen(item({
        workspacePath: workspace,
        itemPath: article,
        itemType: 'file',
        openedAt: '2026-01-02T00:00:00.000Z',
    }));

    renameSync(docs, renamedDocs);
    store.renamePath(workspace, docs, renamedDocs);

    assert.deepEqual(store.list(workspace).map((entry) => entry.itemPath), [
        path.join(renamedDocs, 'article.md'),
        renamedDocs,
    ]);

    store.remove(workspace, renamedDocs);
    assert.equal(store.list(workspace).length, 0);
});

test('removes missing items and trims each workspace to the configured limit', () => {
    const store = makeStore();
    const { workspace, article } = makeWorkspace();

    store.recordOpen(item({
        workspacePath: workspace,
        itemPath: article,
        itemType: 'file',
        openedAt: '2026-01-01T00:00:00.000Z',
    }));
    store.remove(workspace, article);
    assert.equal(store.list(workspace).length, 0);

    for (let index = 0; index < 105; index += 1) {
        const filePath = path.join(workspace, `${index}.md`);
        writeFileSync(filePath, `# ${index}\n`, 'utf8');
        store.recordOpen(item({
            workspacePath: workspace,
            itemPath: filePath,
            itemType: 'file',
            openedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
        }));
    }

    const items = store.list(workspace);
    assert.equal(items.length, 100);
    assert.equal(path.basename(items[0].itemPath), '104.md');
    assert.equal(path.basename(items.at(-1)?.itemPath ?? ''), '5.md');
});
