/**
 * Reads and writes a single JSON sidecar file at the workspace root via the
 * desktop fs bridge. Shared by the publish-schedule and memo stores, which each
 * keep their whole state in one workspace-level JSON file (mutable, overwritten
 * on every change) rather than the per-document directories the version
 * timeline uses.
 */

function joinWorkspace(workspacePath: string, fileName: string): string {
  const sep = workspacePath.includes("\\") ? "\\" : "/";
  const base = workspacePath.endsWith(sep)
    ? workspacePath.slice(0, -sep.length)
    : workspacePath;
  return `${base}${sep}${fileName}`;
}

export async function readWorkspaceJson<T>(
  workspacePath: string,
  fileName: string,
  fallback: T,
): Promise<T> {
  const fs = window.desktop?.fs;
  if (!fs) return fallback;
  const res = await fs.readFile(joinWorkspace(workspacePath, fileName));
  if (!res.success || typeof res.content !== "string") return fallback;
  try {
    return JSON.parse(res.content) as T;
  } catch {
    // A corrupt sidecar should not wipe the feature; fall back to empty state.
    return fallback;
  }
}

export async function writeWorkspaceJson(
  workspacePath: string,
  fileName: string,
  value: unknown,
): Promise<void> {
  const fs = window.desktop?.fs;
  if (!fs) return;
  await fs.saveFile({
    filePath: joinWorkspace(workspacePath, fileName),
    content: JSON.stringify(value, null, 2),
  });
}
