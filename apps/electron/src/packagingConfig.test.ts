/**
 * Verifies packaging metadata required by native SQLite dependencies.
 * These checks prevent packaged builds from omitting runtime modules needed by better-sqlite3.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

interface ElectronPackageJson {
    dependencies?: Record<string, string>;
}

interface ElectronBuilderConfig {
    files?: string[];
    asarUnpack?: string[];
}

const electronRoot = path.resolve(__dirname, '..');

/** Reads a JSON file from the Electron package root. */
function readElectronJson<T>(filename: string): T {
    return JSON.parse(readFileSync(path.join(electronRoot, filename), 'utf8')) as T;
}

test('declares better-sqlite3 runtime dependencies for packaged builds', () => {
    const packageJson = readElectronJson<ElectronPackageJson>('package.json');

    assert.equal(packageJson.dependencies?.['better-sqlite3'], '^12.10.0');
    assert.equal(packageJson.dependencies?.bindings, '^1.5.0');
    assert.equal(packageJson.dependencies?.['file-uri-to-path'], '^1.0.0');
});

test('unpacks the better-sqlite3 native module from app.asar', () => {
    const builderConfig = readElectronJson<ElectronBuilderConfig>('electron-builder.json');

    assert.ok(
        builderConfig.asarUnpack?.includes('node_modules/better-sqlite3/build/Release/*.node'),
        'better-sqlite3 native module must be unpacked for Electron to load it',
    );
});

test('includes native SQLite runtime packages in the packaged app', () => {
    const builderConfig = readElectronJson<ElectronBuilderConfig>('electron-builder.json');
    const files = builderConfig.files ?? [];

    assert.ok(files.includes('node_modules/better-sqlite3/**/*'));
    assert.ok(files.includes('node_modules/bindings/**/*'));
    assert.ok(files.includes('node_modules/file-uri-to-path/**/*'));
});
