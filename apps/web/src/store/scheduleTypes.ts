/**
 * Publish schedule attached to drafts. Each entry hangs off a document by its
 * filesystem path and records where the draft sits in the publishing pipeline
 * plus an optional planned publish date.
 */
export type PublishStatus = "draft" | "scheduled" | "published" | "archived";

export const PUBLISH_STATUSES: PublishStatus[] = [
  "draft",
  "scheduled",
  "published",
  "archived",
];

export interface ScheduleEntry {
  /** Absolute file path of the draft this schedule belongs to. */
  docPath: string;
  /** Display title captured when the entry was created, for the list view. */
  title?: string;
  status: PublishStatus;
  /** Planned publish date as `yyyy-mm-dd` from a native date input, if set. */
  scheduledAt?: string;
  updatedAt: string;
}

/** Workspace schedule keyed by document path. */
export type ScheduleMap = Record<string, ScheduleEntry>;
