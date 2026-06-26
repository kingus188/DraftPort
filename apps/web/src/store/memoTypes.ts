/**
 * Lightweight, Memos-style material collection: quick text snippets captured
 * while drafting, tagged inline with `#tag`, kept newest-first per workspace.
 */
export interface Memo {
  id: string;
  content: string;
  /** Tags parsed from inline `#tag` tokens in the content. */
  tags: string[];
  createdAt: string;
}

/** Inline `#tag` token: letters, digits, underscore, CJK. Single source of
 *  truth for both tag extraction and in-content highlighting. */
export const TAG_TOKEN = /#([\w一-龥-]+)/g;

/** Extracts `#tag` tokens (letters, digits, underscore, CJK) from memo text. */
export function parseTags(content: string): string[] {
  const matches = content.match(TAG_TOKEN) ?? [];
  const tags = matches.map((tag) => tag.slice(1));
  return Array.from(new Set(tags));
}
