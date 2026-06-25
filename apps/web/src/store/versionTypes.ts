/**
 * Per-document version timeline. A version is an immutable point-in-time copy
 * of a document, grouped by `docKey` (the file path on filesystem/desktop, or
 * the draft entry id in browser mode). This layer sits on top of document
 * persistence — it never replaces the live document, only records its history.
 */
export type VersionKind = "auto" | "milestone";

export interface VersionContent {
  markdown: string;
  theme: string;
  themeName: string;
  customCSS?: string;
  title: string;
}

export interface DocumentVersion extends VersionContent {
  id: string;
  docKey: string;
  kind: VersionKind;
  /** Optional name for milestones the user marks deliberately. */
  label?: string;
  createdAt: string;
}

/**
 * Storage-agnostic access to a document's versions. Concrete implementations
 * back this with IndexedDB (browser) or sidecar files (desktop); callers and
 * the cut policy depend only on this contract.
 */
export interface VersionRepository {
  list(docKey: string): Promise<DocumentVersion[]>;
  append(version: DocumentVersion): Promise<void>;
  remove(docKey: string, id: string): Promise<void>;
  prune(docKey: string, keepAuto: number): Promise<void>;
}
