// Owns the custom protocol used by the preview renderer for local workspace assets.
// It deliberately serves only paths accepted by the caller's workspace boundary.
import { net, protocol } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

export const WORKSPACE_ASSET_PROTOCOL = 'draftport-asset';

interface WorkspaceAssetProtocolOptions {
    isPathAllowed: (filePath: string) => boolean;
}

let registered = false;

/**
 * Extracts the encoded absolute file path from a workspace asset URL.
 * Returns null for malformed URLs or URLs owned by another protocol.
 */
export function getWorkspaceAssetPathFromUrl(requestUrl: string): string | null {
    try {
        const url = new URL(requestUrl);
        if (url.protocol !== `${WORKSPACE_ASSET_PROTOCOL}:`) {
            return null;
        }

        const encodedPath = url.pathname.replace(/^\/+/, '');
        if (!encodedPath) {
            return null;
        }

        return decodeURIComponent(encodedPath);
    } catch {
        return null;
    }
}

/**
 * Registers a workspace-scoped asset protocol for preview images.
 * The renderer can ask for any path, but the main process only serves files
 * that are absolute, inside the active workspace, and present on disk.
 */
export function registerWorkspaceAssetProtocol(options: WorkspaceAssetProtocolOptions): void {
    if (registered) {
        return;
    }

    protocol.handle(WORKSPACE_ASSET_PROTOCOL, async (request) => {
        const filePath = getWorkspaceAssetPathFromUrl(request.url);
        if (!filePath || !path.isAbsolute(filePath)) {
            return new Response('Bad asset path', { status: 400 });
        }
        if (!options.isPathAllowed(filePath)) {
            return new Response('Forbidden', { status: 403 });
        }
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            return new Response('Asset not found', { status: 404 });
        }

        return net.fetch(pathToFileURL(filePath).toString());
    });

    registered = true;
}
