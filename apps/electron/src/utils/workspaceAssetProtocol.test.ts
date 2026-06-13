import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getWorkspaceAssetPathFromUrl } from './workspaceAssetProtocol';

test('decodes workspace asset URLs into absolute file paths', () => {
    const filePath = '/Users/example/文章/图片/封面 图.png';
    const url = `draftport-asset://local/${encodeURIComponent(filePath)}`;

    assert.equal(getWorkspaceAssetPathFromUrl(url), filePath);
});

test('rejects malformed or foreign protocol asset URLs', () => {
    assert.equal(getWorkspaceAssetPathFromUrl('https://example.com/a.png'), null);
    assert.equal(getWorkspaceAssetPathFromUrl('draftport-asset://local/'), null);
    assert.equal(getWorkspaceAssetPathFromUrl('not a url'), null);
});
