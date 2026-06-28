# File Sidebar Per-Folder Sort Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each folder in the DraftPort file sidebar keep its own sort mode without regressing existing recent-open, manual order, drag-to-folder, search, or workspace behavior.

**Architecture:** Keep `.draftport/order.json` as the project-local sidebar ordering config and extend it with per-parent-folder sort modes. `sortUtils` resolves the effective mode for each tree level, while `useSidebarState` saves mode changes for the active folder or workspace root and switches only the reordered parent to `manual` during same-parent drag sorting.

**Tech Stack:** React + TypeScript, Vitest, Tauri/Rust serde schema and unit tests.

---

### Task 1: Sorting Model

**Files:**

- Modify: `apps/web/src/components/Sidebar/sortUtils.ts`
- Test: `apps/web/src/__tests__/components/sortUtils.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests proving a root folder can use `opened-desc`, a child folder can use `name-asc`, and a nested folder can use `manual` at the same time. Also add a fallback test proving folders without local settings use the legacy global mode.

- [ ] **Step 2: Run sorting tests to verify RED**

Run from `apps/web`: `./node_modules/.bin/vitest run src/__tests__/components/sortUtils.test.ts --maxWorkers=1 --no-fileParallelism`
Expected: FAIL because `sortTreeItems` only accepts one global `SortMode`.

- [ ] **Step 3: Implement level-specific sort resolution**

Introduce a `FolderSortModes = Record<string, SortMode>` type and make `sortTreeItems` resolve `folderSortModes[parentPath] ?? fallbackSortMode` for each parent level. Keep legacy non-manual behavior unchanged when no folder-specific mode is passed.

- [ ] **Step 4: Run sorting tests to verify GREEN**

Run from `apps/web`: `./node_modules/.bin/vitest run src/__tests__/components/sortUtils.test.ts --maxWorkers=1 --no-fileParallelism`
Expected: PASS.

### Task 2: Sidebar State Persistence

**Files:**

- Modify: `apps/web/src/components/Sidebar/useSidebarState.ts`
- Modify: `apps/web/src/components/Sidebar/sidebarStateHelpers.ts`
- Test: `apps/web/src/__tests__/components/useSidebarState.test.tsx`

- [ ] **Step 1: Write failing state tests**

Add tests proving `workspaceOrder.get()` loads `sortModes`, selecting sort mode saves only the active folder/root bucket, and same-parent reorder changes only that parent bucket to `manual`.

- [ ] **Step 2: Run state tests to verify RED**

Run from `apps/web`: `./node_modules/.bin/vitest run src/__tests__/components/useSidebarState.test.tsx --maxWorkers=1 --no-fileParallelism`
Expected: FAIL because `sortModes` is ignored and `handleSetSortMode` still writes one global localStorage key.

- [ ] **Step 3: Implement state save flow**

Track `folderSortModes` beside `manualOrderFolders`. Resolve the active sort target as `activeFolder ?? workspacePath`; save `{ version: 1, folders, sortModes }` through `workspaceOrder.save`; keep `draftport-file-sort-mode` only as a legacy fallback for folders without local settings.

- [ ] **Step 4: Run state tests to verify GREEN**

Run from `apps/web`: `./node_modules/.bin/vitest run src/__tests__/components/useSidebarState.test.tsx --maxWorkers=1 --no-fileParallelism`
Expected: PASS.

### Task 3: UI Active Mode

**Files:**

- Modify: `apps/web/src/components/Sidebar/FileSidebar.tsx`
- Test: `apps/web/src/__tests__/components/FileSidebar.test.tsx`

- [ ] **Step 1: Write failing UI test**

Add a focused test proving the sort dropdown highlights the effective mode for the selected folder instead of a global mode.

- [ ] **Step 2: Run UI test to verify RED**

Run from `apps/web`: `./node_modules/.bin/vitest run src/__tests__/components/FileSidebar.test.tsx --maxWorkers=1 --no-fileParallelism`
Expected: FAIL because the dropdown reads `state.sortMode`.

- [ ] **Step 3: Wire effective mode into the dropdown**

Expose `activeSortMode` from `useSidebarState` and use it for the sort option active state. Keep labels and controls unchanged.

- [ ] **Step 4: Run UI test to verify GREEN**

Run from `apps/web`: `./node_modules/.bin/vitest run src/__tests__/components/FileSidebar.test.tsx --maxWorkers=1 --no-fileParallelism`
Expected: PASS.

### Task 4: Bridge And Rust Schema

**Files:**

- Modify: `apps/web/src/hooks/useFileSystemHelpers.ts`
- Modify: `apps/web/src/types/desktop.d.ts`
- Modify: `apps/web/src/desktop/tauriBridge.ts`
- Modify: `apps/web/src/__tests__/desktop/tauriBridge.test.ts`
- Modify: `apps/tauri/src-tauri/src/domain/workspace_order.rs`

- [ ] **Step 1: Write failing schema tests**

Extend existing tests so `sortModes` round-trips through the bridge and Rust `WorkspaceOrderConfig`.

- [ ] **Step 2: Run bridge and Rust tests to verify RED**

Run from `apps/web`: `./node_modules/.bin/vitest run src/__tests__/desktop/tauriBridge.test.ts --maxWorkers=1 --no-fileParallelism`
Run from repo root: `cargo test workspace_order --manifest-path apps/tauri/src-tauri/Cargo.toml`
Expected: At least one test FAILS because schema/types do not yet include `sortModes`.

- [ ] **Step 3: Add optional-compatible schema support**

Add `sortModes` to TypeScript types and Rust `WorkspaceOrderConfig` with serde default support so existing `.draftport/order.json` files that only contain `folders` still load.

- [ ] **Step 4: Run schema tests to verify GREEN**

Run the same bridge and Rust commands.
Expected: PASS.

### Task 5: Focused Regression Verification

**Files:**

- No production edits expected.

- [ ] **Step 1: Run sidebar web suite**

Run from `apps/web`: `./node_modules/.bin/vitest run src/__tests__/components/sortUtils.test.ts src/__tests__/components/useSidebarState.test.tsx src/__tests__/components/FileSidebar.test.tsx src/__tests__/desktop/tauriBridge.test.ts --maxWorkers=1 --no-fileParallelism`
Expected: PASS.

- [ ] **Step 2: Run type check**

Run from `apps/web`: `./node_modules/.bin/tsc -b`
Expected: PASS.

- [ ] **Step 3: Run Rust workspace order tests**

Run from repo root: `cargo test workspace_order --manifest-path apps/tauri/src-tauri/Cargo.toml`
Expected: PASS.

- [ ] **Step 4: Inspect final diff**

Run: `git diff --check` and `git status --short`
Expected: No whitespace errors; only intended plan, sidebar sorting, bridge type, and workspace order files changed.
