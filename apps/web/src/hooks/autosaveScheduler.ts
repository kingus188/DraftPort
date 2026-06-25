/**
 * Idle-debounced autosave timing with a hard ceiling.
 *
 * Each `schedule()` (one per edit) restarts an idle countdown so a burst of
 * keystrokes collapses into a single write once typing settles. `maxWaitMs`
 * caps how long continuous typing can defer that write, so the document is
 * never more than `maxWaitMs` behind the editor. `flush()` forces an immediate
 * write on lifecycle boundaries (blur, tab hidden, unload, file switch).
 */
export interface AutosaveScheduler {
  /** Record an edit; (re)arms the idle timer under the maxWait ceiling. */
  schedule(): void;
  /** Write immediately if anything is pending; no-op otherwise. */
  flush(): void;
  /** Drop the pending write without saving (cleanup). */
  cancel(): void;
}

export interface AutosaveSchedulerOptions {
  onSave: () => void;
  /** Quiet period after the last edit before writing. */
  idleMs?: number;
  /** Upper bound on how long a write can be deferred during continuous edits. */
  maxWaitMs?: number;
}

export function createAutosaveScheduler({
  onSave,
  idleMs = 800,
  maxWaitMs = 5000,
}: AutosaveSchedulerOptions): AutosaveScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Non-null marks "a write is pending"; also anchors the maxWait window.
  let firstChangeAt: number | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const run = () => {
    clearTimer();
    firstChangeAt = null;
    onSave();
  };

  return {
    schedule() {
      const now = Date.now();
      if (firstChangeAt === null) firstChangeAt = now;
      clearTimer();
      const remainingMax = Math.max(0, maxWaitMs - (now - firstChangeAt));
      timer = setTimeout(run, Math.min(idleMs, remainingMax));
    },
    flush() {
      if (firstChangeAt === null) return;
      run();
    },
    cancel() {
      clearTimer();
      firstChangeAt = null;
    },
  };
}
