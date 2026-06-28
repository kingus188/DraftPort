# File Sidebar Manual Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual drag ordering for file sidebar folders and files, persisted in each workspace under `.draftport/order.json`.

**Architecture:** Tauri owns safe project config file IO and workspace boundary checks. React owns visual drag intent, same-parent reordering, and applying the persisted order as one sort mode while keeping existing move-to-folder drag behavior.

**Tech Stack:** Tauri/Rust commands, React + TypeScript, Vitest, Testing Library, Cargo tests.

---

### Task 1: Tauri Workspace Order Persistence

**Files:**

- Create: `apps/tauri/src-tauri/src/domain/workspace_order.rs`
- Modify: `apps/tauri/src-tauri/src/domain/mod.rs`
- Modify: `apps/tauri/src-tauri/src/commands/workspace.rs`
- Modify: `apps/tauri/src-tauri/src/main.rs`
- Test: `apps/tauri/src-tauri/src/domain/workspace_order.rs`

- [ ] **Step 1: Write failing Rust tests**

Add tests proving `.draftport/order.json` round-trips and rejects paths outside the workspace.

- [ ] **Step 2: Run Rust tests to verify RED**

Run: `cargo test workspace_order --manifest-path apps/tauri/src-tauri/Cargo.toml`
Expected: FAIL because `workspace_order` module/functions do not exist.

- [ ] **Step 3: Implement order config domain and commands**

Create a focused module with `WorkspaceOrderConfig`, `load_workspace_order`, `save_workspace_order`, and path validation. Add `workspace_order_get` and `workspace_order_save` commands.

- [ ] **Step 4: Run Rust tests to verify GREEN**

Run: `cargo test workspace_order --manifest-path apps/tauri/src-tauri/Cargo.toml`
Expected: PASS.

### Task 2: Renderer Bridge Contract

**Files:**

- Modify: `apps/web/src/hooks/useFileSystemHelpers.ts`
- Modify: `apps/web/src/types/desktop.d.ts`
- Modify: `apps/web/src/desktop/tauriBridge.ts`
- Test: `apps/web/src/__tests__/desktop/tauriBridge.test.ts`

- [ ] **Step 1: Write failing bridge test**

Assert `window.desktop.workspaceOrder.get()` invokes `workspace_order_get` and `save(payload)` invokes `workspace_order_save`.

- [ ] **Step 2: Run bridge test to verify RED**

Run: `pnpm --filter @draftport/web test -- --run src/__tests__/desktop/tauriBridge.test.ts`
Expected: FAIL because `workspaceOrder` is missing.

- [ ] **Step 3: Implement bridge API**

Add `WorkspaceOrderConfig` types and bridge calls.

- [ ] **Step 4: Run bridge test to verify GREEN**

Run: `pnpm --filter @draftport/web test -- --run src/__tests__/desktop/tauriBridge.test.ts`
Expected: PASS.

### Task 3: Manual Order Sorting

**Files:**

- Modify: `apps/web/src/components/Sidebar/sortUtils.ts`
- Test: `apps/web/src/__tests__/components/sortUtils.test.ts`

- [ ] **Step 1: Write failing sorting tests**

Cover manual order, missing paths, appended new paths, and existing non-manual modes.

- [ ] **Step 2: Run sorting test to verify RED**

Run: `pnpm --filter @draftport/web test -- --run src/__tests__/components/sortUtils.test.ts`
Expected: FAIL because `manual` mode/order map is not implemented.

- [ ] **Step 3: Implement manual order sorting**

Extend `SortMode`, persisted sort parsing, and `sortTreeItems` to accept manual order config.

- [ ] **Step 4: Run sorting test to verify GREEN**

Run: `pnpm --filter @draftport/web test -- --run src/__tests__/components/sortUtils.test.ts`
Expected: PASS.

### Task 4: Sidebar State Reordering

**Files:**

- Modify: `apps/web/src/components/Sidebar/sidebarStateHelpers.ts`
- Modify: `apps/web/src/components/Sidebar/useSidebarState.ts`
- Test: `apps/web/src/__tests__/components/useSidebarState.test.tsx`

- [ ] **Step 1: Write failing state tests**

Cover loading order config, saving same-parent reorder, ignoring reorder while filtered, and preserving cross-parent move behavior.

- [ ] **Step 2: Run state test to verify RED**

Run: `pnpm --filter @draftport/web test -- --run src/__tests__/components/useSidebarState.test.tsx`
Expected: FAIL because reorder handlers/config state do not exist.

- [ ] **Step 3: Implement state handlers**

Add order config loading, parent path resolution, same-parent reorder computation, and save flow.

- [ ] **Step 4: Run state test to verify GREEN**

Run: `pnpm --filter @draftport/web test -- --run src/__tests__/components/useSidebarState.test.tsx`
Expected: PASS.

### Task 5: Sidebar UI Drop Intent

**Files:**

- Modify: `apps/web/src/components/Sidebar/FileSidebar.tsx`
- Modify: `apps/web/src/components/Sidebar/FileSidebar.css`
- Test: `apps/web/src/__tests__/components/FileSidebar.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Cover manual sort option rendering and row drop intent classes/handlers.

- [ ] **Step 2: Run UI test to verify RED**

Run: `pnpm --filter @draftport/web test -- --run src/__tests__/components/FileSidebar.test.tsx`
Expected: FAIL because manual option/drop intent UI does not exist.

- [ ] **Step 3: Implement UI wiring**

Add manual sort label, row drop-before/drop-after event handling, and CSS insertion indicators.

- [ ] **Step 4: Run UI test to verify GREEN**

Run: `pnpm --filter @draftport/web test -- --run src/__tests__/components/FileSidebar.test.tsx`
Expected: PASS.

### Task 6: Focused Regression Verification

**Files:**

- No production edits expected.

- [ ] **Step 1: Run focused web suite**

Run: `pnpm --filter @draftport/web test -- --run src/__tests__/components/sortUtils.test.ts src/__tests__/components/useSidebarState.test.tsx src/__tests__/components/FileSidebar.test.tsx src/__tests__/desktop/tauriBridge.test.ts`
Expected: PASS.

- [ ] **Step 2: Run focused Tauri suite**

Run: `cargo test --manifest-path apps/tauri/src-tauri/Cargo.toml workspace_order`
Expected: PASS.

- [ ] **Step 3: Inspect git status**

Run: `git status --short`
Expected: Only intended sorting/order files plus pre-existing unrelated dirty files.
