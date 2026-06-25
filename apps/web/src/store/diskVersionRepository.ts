import type { DocumentVersion, VersionRepository } from "./versionTypes";
import { selectPrunableVersionIds } from "./versionPolicy";

/**
 * The subset of the Tauri desktop fs bridge the version store needs. Kept
 * narrow so it can be mocked in tests and so the repository never reaches for
 * the global `window.desktop`.
 */
export interface VersionFs {
  createFolder(path: string): Promise<{ success: boolean }>;
  createFile(payload: {
    filename: string;
    content: string;
  }): Promise<{ success: boolean; filePath?: string }>;
  inspectFolder(
    path: string,
  ): Promise<{ success: boolean; entries?: string[] }>;
  readFile(path: string): Promise<{ success: boolean; content?: string }>;
  deleteFile(path: string): Promise<{ success: boolean }>;
}

const HISTORY_ROOT = ".wemd-history";

/** Stable, filesystem-safe directory name for a document's versions. */
function sidecarDirName(docKey: string): string {
  const base = docKey.split(/[/\\]/).pop() || "doc";
  const safe = base.replace(/[^\w.-]+/g, "_").slice(0, 40);
  // djb2 hash keeps the directory unique even when two documents share a base
  // name or sanitization collapses different characters.
  let hash = 5381;
  for (let i = 0; i < docKey.length; i++) {
    hash = ((hash << 5) + hash + docKey.charCodeAt(i)) >>> 0;
  }
  return `${safe}-${hash.toString(36)}`;
}

/**
 * Stores each version as a JSON file under
 * `<workspace>/.wemd-history/<doc-dir>/<id>.json`. JSON round-trips every field
 * without a frontmatter schema; the directory groups versions per document.
 */
export class DiskVersionRepository implements VersionRepository {
  constructor(private readonly fs: VersionFs) {}

  private dir(docKey: string): string {
    return `${HISTORY_ROOT}/${sidecarDirName(docKey)}`;
  }

  private file(docKey: string, id: string): string {
    return `${this.dir(docKey)}/${id}.json`;
  }

  async append(version: DocumentVersion): Promise<void> {
    const dir = this.dir(version.docKey);
    // Best-effort: the directory may already exist; ignore that failure.
    await this.fs.createFolder(dir).catch(() => undefined);
    await this.fs.createFile({
      filename: this.file(version.docKey, version.id),
      content: JSON.stringify(version, null, 2),
    });
  }

  async list(docKey: string): Promise<DocumentVersion[]> {
    const dir = this.dir(docKey);
    const res = await this.fs.inspectFolder(dir);
    if (!res.success || !res.entries) return [];

    const versions: DocumentVersion[] = [];
    for (const entry of res.entries) {
      if (!entry.endsWith(".json")) continue;
      const path = entry.includes("/") ? entry : `${dir}/${entry}`;
      const fileRes = await this.fs.readFile(path);
      if (!fileRes.success || typeof fileRes.content !== "string") continue;
      try {
        versions.push(JSON.parse(fileRes.content) as DocumentVersion);
      } catch {
        // Skip a corrupt snapshot rather than failing the whole timeline.
      }
    }

    return versions.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async remove(docKey: string, id: string): Promise<void> {
    await this.fs.deleteFile(this.file(docKey, id));
  }

  async prune(docKey: string, keepAuto: number): Promise<void> {
    const versions = await this.list(docKey);
    const prunable = selectPrunableVersionIds(versions, keepAuto);
    for (const id of prunable) {
      await this.fs.deleteFile(this.file(docKey, id));
    }
  }
}
