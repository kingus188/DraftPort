import type { DocumentVersion, VersionContent } from "./versionTypes";

/**
 * Whether `next` is identical to the most recent version, so cutting a new
 * version would be redundant. No previous version means the first cut must
 * always happen.
 */
export function isSameVersionContent(
  latest: DocumentVersion | undefined,
  next: VersionContent,
): boolean {
  if (!latest) return false;
  return (
    latest.markdown === next.markdown &&
    latest.theme === next.theme &&
    latest.themeName === next.themeName &&
    (latest.customCSS ?? "") === (next.customCSS ?? "") &&
    latest.title === next.title
  );
}

/**
 * Retention: keep every milestone plus the most recent `keepAuto` automatic
 * versions; return the ids of the automatic versions to drop. Milestones never
 * count against the quota and are never returned.
 */
export function selectPrunableVersionIds(
  versions: DocumentVersion[],
  keepAuto: number,
): string[] {
  const autos = versions
    .filter((version) => version.kind === "auto")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  return autos.slice(keepAuto).map((version) => version.id);
}
