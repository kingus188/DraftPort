import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ClipboardCopy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { WorkspacePage } from "./WorkspacePage";
import { MemoEditor } from "./MemoEditor";
import { MemoCalendar } from "./MemoCalendar";
import { renderMemoMarkdown } from "./renderMemoMarkdown";
import { relativeTime } from "./relativeTime";
import { toDateKey } from "./calendarGrid";
import { useFileStore } from "../../store/fileStore";
import { useMemoStore } from "../../store/memoStore";
import type { Memo } from "../../store/memoTypes";
import "./WorkspaceViews.css";

function textMatches(memo: Memo, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    memo.content.toLowerCase().includes(q) ||
    memo.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

/**
 * Copies a memo to the clipboard so it can be pasted into the draft. Direct
 * cursor insertion is not wired yet because the WYSIWYG editor only reads the
 * markdown store on mount; clipboard copy works reliably in both edit modes.
 * ponytail: clipboard insert, upgrade to cursor insertion via editor commands
 * if it becomes a common ask.
 */
async function copyMemo(content: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(content);
    toast.success("已复制,粘贴到正文即可");
  } catch {
    toast.error("复制失败");
  }
}

/**
 * Memos-style material collection: a left rail with search, an activity
 * calendar and tags, and a main column with a WYSIWYG Markdown composer and
 * memo cards that render their Markdown.
 */
export function MemoPage() {
  const workspacePath = useFileStore((state) => state.workspacePath);
  const memos = useMemoStore((state) => state.memos);
  const load = useMemoStore((state) => state.load);
  const add = useMemoStore((state) => state.add);
  const update = useMemoStore((state) => state.update);
  const remove = useMemoStore((state) => state.remove);

  const [draft, setDraft] = useState("");
  const [composerKey, setComposerKey] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const composeRef = useRef<HTMLDivElement>(null);

  // Clicking anywhere in the composer (padding, hint) drops the cursor into the
  // editor, not just clicks landing on the contenteditable itself.
  const focusComposerFromBox = (e: React.MouseEvent<HTMLDivElement>): void => {
    const editor =
      composeRef.current?.querySelector<HTMLElement>(".ProseMirror");
    if (!editor) return;
    const target = e.target as HTMLElement;
    if (editor.contains(target) || target.closest("button")) return;
    e.preventDefault();
    editor.focus();
  };

  useEffect(() => {
    if (workspacePath) void load(workspacePath);
  }, [workspacePath, load]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const memo of memos) {
      for (const tag of memo.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
  }, [memos]);

  const visible = useMemo(
    () =>
      memos.filter(
        (memo) =>
          textMatches(memo, query) &&
          (!selectedTag || memo.tags.includes(selectedTag)) &&
          (!selectedDate ||
            toDateKey(new Date(memo.createdAt)) === selectedDate),
      ),
    [memos, query, selectedTag, selectedDate],
  );

  // Only one editor is active at a time. Opening a different one first flushes
  // whatever was active: the composer draft is recorded, an editing card saved.
  const submit = () => {
    if (!draft.trim()) return;
    void add(draft);
    setDraft("");
    setComposerKey((key) => key + 1);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const commitEdit = () => {
    if (editingId && editDraft.trim()) void update(editingId, editDraft);
    cancelEdit();
  };

  const startEdit = (memo: Memo) => {
    submit(); // auto-record an in-progress composer draft
    commitEdit(); // auto-save any other card being edited
    setEditingId(memo.id);
    setEditDraft(memo.content);
    setOpenMenuId(null);
  };

  return (
    <WorkspacePage title="素材收集">
      <div className="memos">
        <aside className="memos__side">
          <input
            className="memo-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索素材或 #标签"
          />
          <MemoCalendar
            memos={memos}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          {tagCounts.length > 0 && (
            <div className="memo-tags">
              <span className="memo-tags__title">标签</span>
              <div className="memo-tags__list">
                {tagCounts.map(([tag, count]) => (
                  <button
                    key={tag}
                    className={`memo-tags__item ${selectedTag === tag ? "is-active" : ""}`}
                    onClick={() =>
                      setSelectedTag(selectedTag === tag ? null : tag)
                    }
                  >
                    <span># {tag}</span>
                    <span className="memo-tags__count">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <div className="memos__main">
          <div
            className="memo-compose"
            ref={composeRef}
            onMouseDown={focusComposerFromBox}
          >
            <div
              className="memo-compose__editor"
              onFocusCapture={commitEdit}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            >
              <MemoEditor key={composerKey} onChange={setDraft} autoFocus />
            </div>
            <div className="memo-compose__bar">
              <span className="memo-compose__hint">
                支持 Markdown · ⌘/Ctrl+Enter
              </span>
              <button
                className="memo-compose__save"
                onClick={submit}
                disabled={!draft.trim()}
              >
                记录
              </button>
            </div>
          </div>

          <div className="memo-list">
            {visible.length === 0 ? (
              <p className="workspace-page__empty">
                {memos.length === 0
                  ? "还没有素材,随手记一条。"
                  : "没有匹配的素材。"}
              </p>
            ) : (
              visible.map((memo) => {
                const isEditing = editingId === memo.id;
                return (
                  <div
                    className={`memo-card ${isEditing ? "is-editing" : ""}`}
                    key={memo.id}
                  >
                    <div className="memo-card__head">
                      <span className="memo-card__time">
                        {relativeTime(memo.createdAt)}
                      </span>
                      {!isEditing && (
                        <div className="memo-card__menu">
                          <button
                            aria-label="更多操作"
                            onClick={() =>
                              setOpenMenuId(
                                openMenuId === memo.id ? null : memo.id,
                              )
                            }
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {openMenuId === memo.id && (
                            <div className="memo-card__dropdown">
                              <button onClick={() => startEdit(memo)}>
                                <Pencil size={14} /> 编辑
                              </button>
                              <button
                                onClick={() => {
                                  void copyMemo(memo.content);
                                  setOpenMenuId(null);
                                }}
                              >
                                <ClipboardCopy size={14} /> 复制
                              </button>
                              <button
                                className="danger"
                                onClick={() => {
                                  void remove(memo.id);
                                  setOpenMenuId(null);
                                }}
                              >
                                <Trash2 size={14} /> 删除
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div
                        className="memo-card__edit"
                        onKeyDown={(e) => {
                          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                            e.preventDefault();
                            commitEdit();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelEdit();
                          }
                        }}
                      >
                        <div className="memo-card__edit-field">
                          <MemoEditor
                            key={`edit-${memo.id}`}
                            initialContent={memo.content}
                            onChange={setEditDraft}
                            autoFocus
                          />
                        </div>
                        <div className="memo-card__edit-bar">
                          <button
                            className="memo-card__edit-cancel"
                            onClick={cancelEdit}
                          >
                            取消
                          </button>
                          <button
                            className="memo-compose__save"
                            onClick={commitEdit}
                            disabled={!editDraft.trim()}
                          >
                            保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="memo-card__rendered"
                        dangerouslySetInnerHTML={{
                          __html: renderMemoMarkdown(memo.content),
                        }}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </WorkspacePage>
  );
}
