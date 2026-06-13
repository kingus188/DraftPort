/**
 * Owns Electron application icon resolution and runtime Dock icon application.
 * The packaged app uses electron-builder metadata, while development runtime
 * needs an explicit Dock icon on macOS because it runs inside Electron.app.
 */
import * as fs from 'fs';
import * as path from 'path';

/** Minimal image contract shared by Electron NativeImage and tests. */
export interface AppIconImage {
    isEmpty(): boolean;
}

/** Factory contract for loading an application icon from disk. */
export interface AppIconImageFactory<TIcon extends AppIconImage> {
    createFromPath(iconPath: string): TIcon;
}

/** Minimal macOS Dock contract used to apply a runtime icon. */
export interface DockIconTarget<TIcon extends AppIconImage> {
    setIcon(icon: TIcon): void;
}

/** Runtime dependencies for applying the Dock icon without coupling tests to Electron. */
export interface ApplyDockIconOptions<TIcon extends AppIconImage> {
    platform: NodeJS.Platform | string;
    iconPath: string;
    dock?: DockIconTarget<TIcon>;
    nativeImage: AppIconImageFactory<TIcon>;
}

/** Resolves the icon path for compiled Electron output, then source-layout development. */
export function resolveAppIconPath(
    runtimeDir: string,
    exists: (candidate: string) => boolean = fs.existsSync,
): string {
    const compiledIconPath = path.join(runtimeDir, 'assets', 'icon.png');
    if (exists(compiledIconPath)) {
        return compiledIconPath;
    }

    return path.join(runtimeDir, '..', 'assets', 'icon.png');
}

/** Loads the app icon image and returns null when the asset is missing or unreadable. */
export function createAppIconImage<TIcon extends AppIconImage>(
    iconPath: string,
    nativeImage: AppIconImageFactory<TIcon>,
): TIcon | null {
    const icon = nativeImage.createFromPath(iconPath);
    return icon.isEmpty() ? null : icon;
}

/** Applies the runtime macOS Dock icon when a valid icon image can be loaded. */
export function applyDockIcon<TIcon extends AppIconImage>(
    options: ApplyDockIconOptions<TIcon>,
): boolean {
    if (options.platform !== 'darwin' || !options.dock) {
        return false;
    }

    const icon = createAppIconImage(options.iconPath, options.nativeImage);
    if (!icon) {
        return false;
    }

    options.dock.setIcon(icon);
    return true;
}
