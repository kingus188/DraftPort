# Editor-Only Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Version/History, Schedule, and Memos material workflows so DraftPort focuses on the Markdown editor, file tree, outline, theme, and publish-copy actions.

**Architecture:** Keep the editor shell intact and remove the workspace-view routes from the top down: header navigation first, then `App` routing/layout branches, then the document version side effects and feature-owned stores/components/tests. Do not remove the desktop app updater modal because its "version" wording belongs to application update delivery, not document history.

**Tech Stack:** React 18, TypeScript, React Router, Zustand, Vitest, Testing Library, pnpm workspace scripts.

---

## Scope And File Map

This plan deliberately deletes product workflows instead of hiding them.

Keep:

- `apps/web/src/components/Editor/*`
- `apps/web/src/outline/*`
- `apps/web/src/components/Theme/*`
- publish copy services and Header copy actions
- desktop app update modal and updater event handling in `apps/web/src/App.tsx`

Remove:

- document version/history feature: `VersionTimelinePage`, `VersionTimelinePanel`, `versionStore`, `diskVersionRepository`, `versionPolicy`, `versionTypes`, and their tests
- schedule feature: `SchedulePage`, `ScheduleContextMenu`, `scheduleStore`, `scheduleTypes`, the schedule-only calendar helper, and tests
- memos/material feature: `MemoPage`, `MemoEditor`, `MemoCalendar`, `renderMemoMarkdown`, `memoStore`, `memoTypes`, the memos-only relative-time helper, and tests

Files modified:

- `apps/web/src/components/Header/Header.tsx`: remove workspace-route navigation and keep editor actions always visible.
- `apps/web/src/__tests__/components/Header.test.tsx`: replace workspace-view expectations with editor-only assertions.
- `apps/web/src/App.tsx`: remove workspace routes and memos-only layout branches.
- `apps/web/src/__tests__/components/AppWysiwygMode.test.tsx`: add route fallback assertions for removed routes.
- `apps/web/src/hooks/useFileSystem.ts`: remove document version side effects and returned restore/milestone actions.
- `apps/web/src/__tests__/hooks/useFileSystemVersionRemoval.test.ts`: static guard that document history wiring does not return.
- delete feature-owned source and tests listed in Task 4.

Commit policy:

- Each task includes a commit command for a clean feature slice.
- Do not run a commit until focused validation has passed and the user gives explicit approval in the current conversation.

---

### Task 1: Remove Header Workspace Navigation

**Files:**

- Modify: `apps/web/src/components/Header/Header.tsx`
- Modify: `apps/web/src/__tests__/components/Header.test.tsx`

- [ ] **Step 1: Write the failing Header tests**

In `apps/web/src/__tests__/components/Header.test.tsx`, replace the tests that expect `/memos`, `/schedule`, or `/history` navigation with these editor-only tests. Keep the existing mocks and helper functions at the top of the file.

```tsx
it("renders only editor-focused top-level actions", () => {
  render(<Header />, { wrapper: MemoryRouter });

  expect(screen.getByAltText("DraftPort Logo")).toBeInTheDocument();
  expect(screen.getByText("DraftPort")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "主题" })).toBeInTheDocument();
  expect(screen.getByText("复制到公众号")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "更多复制方式" }),
  ).toBeInTheDocument();

  expect(
    screen.queryByRole("button", { name: "版本时间线" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "发布排期" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "素材收集" }),
  ).not.toBeInTheDocument();
});

it("keeps editor actions visible on legacy workspace-view URLs", () => {
  renderAt("/history");
  expect(screen.getByRole("button", { name: "主题" })).toBeInTheDocument();
  expect(screen.getByText("复制到公众号")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "版本时间线" }),
  ).not.toBeInTheDocument();

  renderAt("/schedule");
  expect(screen.getAllByRole("button", { name: "主题" })).toHaveLength(2);
  expect(screen.getAllByText("复制到公众号")).toHaveLength(2);
  expect(
    screen.queryByRole("button", { name: "发布排期" }),
  ).not.toBeInTheDocument();

  renderAt("/memos");
  expect(screen.getAllByRole("button", { name: "主题" })).toHaveLength(3);
  expect(screen.getAllByText("复制到公众号")).toHaveLength(3);
  expect(
    screen.queryByRole("button", { name: "素材收集" }),
  ).not.toBeInTheDocument();
});
```

Remove these old assertions from the same test file:

```tsx
expect(screen.getByRole("button", { name: "素材收集" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "版本时间线" })).toBeInTheDocument();
```

- [ ] **Step 2: Run the Header test to verify it fails**

Run:

```bash
pnpm --filter @draftport/web test -- Header --run
```

Expected: FAIL because Header still renders `版本时间线`, `发布排期`, and `素材收集`.

- [ ] **Step 3: Remove Header workspace navigation**

In `apps/web/src/components/Header/Header.tsx`, remove unused imports and route constants:

```tsx
import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { useEditorStore } from "../../store/editorStore";
import "./Header.css";

const ThemePanel = lazy(() =>
  import("../Theme/ThemePanel").then((m) => ({ default: m.ThemePanel })),
);
import {
  Palette,
  Send,
  Code,
  BookOpenText,
  Gem,
  Sun,
  Moon,
  ChevronDown,
} from "lucide-react";

import { useUITheme } from "../../hooks/useUITheme";
import { useWindowControls } from "../../hooks/useWindowControls";
import { resolveAppAssetPath } from "../../utils/assetPath";
```

Inside `Header`, remove `useNavigate`, `useLocation`, `WORKSPACE_ROUTES`, `pathname`, `go`, and `isEditorRoute`. Keep the effect that closes the copy menu, but make it depend only on menu state through the pointer-down effect. The main return body should keep this editor action group directly inside `.header-right`:

```tsx
<button
  className="btn-secondary"
  onClick={() => setShowThemePanel(true)}
  aria-label="主题"
>
  <Palette size={18} strokeWidth={2} />
  <span>主题</span>
</button>

<div className="copy-group" ref={copyMenuRef}>
  <button className="btn-primary" onClick={copyToWechat}>
    <Send size={18} strokeWidth={2} />
    <span>复制到公众号</span>
  </button>
  <button
    className="btn-icon-only copy-menu-toggle"
    onClick={() => setCopyMenuOpen((open) => !open)}
    aria-label="更多复制方式"
    aria-expanded={copyMenuOpen}
  >
    <ChevronDown size={18} strokeWidth={2} />
  </button>

  {copyMenuOpen && (
    <div className="copy-menu" role="menu">
      <button
        className="copy-menu__item"
        onClick={() => {
          copyAsHtml();
          setCopyMenuOpen(false);
        }}
        aria-label="HTML"
      >
        <Code size={18} strokeWidth={2} />
        <span>HTML</span>
      </button>
      <button
        className="copy-menu__item"
        onClick={() => {
          copyToZhihu();
          setCopyMenuOpen(false);
        }}
      >
        <BookOpenText size={18} strokeWidth={2} />
        <span>复制到知乎</span>
      </button>
      <button
        className="copy-menu__item"
        onClick={() => {
          copyToJuejin();
          setCopyMenuOpen(false);
        }}
      >
        <Gem size={18} strokeWidth={2} />
        <span>复制到掘金</span>
      </button>
    </div>
  )}
</div>
```

- [ ] **Step 4: Run the Header test to verify it passes**

Run:

```bash
pnpm --filter @draftport/web test -- Header --run
```

Expected: PASS.

- [ ] **Step 5: Commit after approval**

After validation passes, show `git diff -- apps/web/src/components/Header/Header.tsx apps/web/src/__tests__/components/Header.test.tsx` to the user and wait for explicit approval. Then run:

```bash
git add apps/web/src/components/Header/Header.tsx apps/web/src/__tests__/components/Header.test.tsx
git commit -m "fix(web): remove workspace navigation from header"
```

---

### Task 2: Remove Workspace Routes From The App Shell

**Files:**

- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/__tests__/components/AppWysiwygMode.test.tsx`

- [ ] **Step 1: Write failing route fallback tests**

Append these tests to `apps/web/src/__tests__/components/AppWysiwygMode.test.tsx`:

```tsx
it("treats removed workspace URLs as the editor surface", () => {
  render(<App />, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={["/history"]}>{children}</MemoryRouter>
    ),
  });

  expect(screen.getByTestId("file-sidebar")).toBeInTheDocument();
  expect(screen.getByTestId("wysiwyg-markdown-editor")).toBeInTheDocument();
  expect(screen.queryByText("版本时间线")).not.toBeInTheDocument();
});

it("does not switch to a full-width memos workspace layout", () => {
  render(<App />, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={["/memos"]}>{children}</MemoryRouter>
    ),
  });

  expect(screen.getByTestId("file-sidebar")).toBeInTheDocument();
  expect(screen.getByTestId("wysiwyg-markdown-editor")).toBeInTheDocument();
  expect(screen.queryByText("素材收集")).not.toBeInTheDocument();
});

it("does not render the schedule workspace view", () => {
  render(<App />, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={["/schedule"]}>{children}</MemoryRouter>
    ),
  });

  expect(screen.getByTestId("file-sidebar")).toBeInTheDocument();
  expect(screen.getByTestId("wysiwyg-markdown-editor")).toBeInTheDocument();
  expect(screen.queryByText("发布排期")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the App test to verify it fails**

Run:

```bash
pnpm --filter @draftport/web test -- AppWysiwygMode --run
```

Expected: FAIL because `/history`, `/memos`, and `/schedule` still render workspace views or memos-only layout behavior.

- [ ] **Step 3: Remove workspace route imports and memos layout branch**

In `apps/web/src/App.tsx`, replace the router import:

```tsx
import { Route, Routes } from "react-router-dom";
```

Remove these imports:

```tsx
import { SchedulePage } from "./components/WorkspaceViews/SchedulePage";
import { MemoPage } from "./components/WorkspaceViews/MemoPage";
import { VersionTimelinePage } from "./components/WorkspaceViews/VersionTimelinePage";
```

Remove this state:

```tsx
const isMemosRoute = useLocation().pathname === "/memos";
```

Replace the sidebar layout values with editor-only values:

```tsx
const sidebarVisible = showHistory;
const effectiveHistoryWidth = historyWidth;
```

Replace both `!isMemosRoute && (` guards around the history toggle and history pane with unconditional rendering. The history toggle should become:

```tsx
<button
  className={`history-toggle ${sidebarVisible ? "" : "is-collapsed"}`}
  onClick={() => setShowHistory((prev) => !prev)}
  aria-label={sidebarVisible ? "隐藏列表" : "显示列表"}
>
  <span className="sr-only">{sidebarVisible ? "隐藏列表" : "显示列表"}</span>
</button>
```

The history pane should become:

```tsx
<div
  className={`history-pane ${sidebarVisible ? "is-visible" : "is-hidden"}`}
  aria-hidden={!sidebarVisible}
>
  <div className="history-pane__content">
    <div className="sidebar-switch" role="tablist">
      <button
        role="tab"
        aria-selected={sidebarView === "files"}
        className={sidebarView === "files" ? "is-active" : ""}
        onClick={() => setSidebarView("files")}
      >
        文件
      </button>
      <button
        role="tab"
        aria-selected={sidebarView === "outline"}
        className={sidebarView === "outline" ? "is-active" : ""}
        onClick={() => setSidebarView("outline")}
      >
        大纲
      </button>
    </div>
    {sidebarView === "files" ? (
      <FileSidebar />
    ) : (
      <OutlinePanel markdown={markdown} />
    )}
  </div>
</div>
```

- [ ] **Step 4: Replace workspace routes with editor fallback only**

In `apps/web/src/App.tsx`, replace the `Routes` content with:

```tsx
<Routes>
  <Route
    path="*"
    element={
      hasNoSelectedMarkdown ? (
        <div className="workspace-empty-selection">
          <p>无选择文件</p>
        </div>
      ) : canUseWysiwygEditor ? (
        <>
          <div
            hidden={activeEditorMode !== "wysiwyg"}
            aria-hidden={activeEditorMode !== "wysiwyg"}
            style={{ height: "100%" }}
          >
            <WysiwygMarkdownEditor key={wysiwygDocumentKey} />
          </div>
          <div
            hidden={activeEditorMode !== "source"}
            aria-hidden={activeEditorMode !== "source"}
            style={{ height: "100%" }}
          >
            <MarkdownEditor />
          </div>
        </>
      ) : (
        <MarkdownEditor />
      )
    }
  />
</Routes>
```

- [ ] **Step 5: Run the App test to verify it passes**

Run:

```bash
pnpm --filter @draftport/web test -- AppWysiwygMode --run
```

Expected: PASS.

- [ ] **Step 6: Commit after approval**

After validation passes, show `git diff -- apps/web/src/App.tsx apps/web/src/__tests__/components/AppWysiwygMode.test.tsx` to the user and wait for explicit approval. Then run:

```bash
git add apps/web/src/App.tsx apps/web/src/__tests__/components/AppWysiwygMode.test.tsx
git commit -m "fix(web): route legacy workspace views to editor"
```

---

### Task 3: Remove Document Version Side Effects From File Operations

**Files:**

- Modify: `apps/web/src/hooks/useFileSystem.ts`
- Create: `apps/web/src/__tests__/hooks/useFileSystemVersionRemoval.test.ts`

- [ ] **Step 1: Write a static guard test**

Create `apps/web/src/__tests__/hooks/useFileSystemVersionRemoval.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = resolve(process.cwd(), "src/hooks/useFileSystem.ts");

describe("useFileSystem editor-only scope", () => {
  it("does not wire document version history into file operations", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).not.toContain("useVersionStore");
    expect(source).not.toContain("captureVersionContent");
    expect(source).not.toContain("restoreVersion");
    expect(source).not.toContain("markMilestone");
    expect(source).not.toContain("DocumentVersion");
    expect(source).not.toContain("VersionContent");
  });
});
```

- [ ] **Step 2: Run the guard test to verify it fails**

Run:

```bash
pnpm --filter @draftport/web test -- useFileSystemVersionRemoval --run
```

Expected: FAIL because `useFileSystem.ts` still imports and calls `useVersionStore`.

- [ ] **Step 3: Remove version imports and helper**

In `apps/web/src/hooks/useFileSystem.ts`, remove these imports:

```ts
import { useVersionStore } from "../store/versionStore";
import type { DocumentVersion, VersionContent } from "../store/versionTypes";
```

Delete the helper:

```ts
/** Snapshot of the live editor/theme state used to cut a version. */
function captureVersionContent(file: FileItem): VersionContent {
  const { markdown } = useEditorStore.getState();
  const { themeId, themeName, customCSS } = useThemeStore.getState();
  return {
    markdown,
    theme: themeId,
    themeName,
    customCSS,
    title: file.title || stripMarkdownExtension(file.name),
  };
}
```

- [ ] **Step 4: Remove version load/cut/restore actions**

In `apps/web/src/hooks/useFileSystem.ts`, remove this statement from the successful `openFile` branch:

```ts
void useVersionStore.getState().load(file.path);
```

Remove this block from the successful `saveFile` branch:

```ts
// 每次成功保存切一个自动版本(cut 内部去重,内容未变则跳过)。
void useVersionStore.getState().cut({
  docKey: currentFile.path,
  content: captureVersionContent(currentFile),
  kind: "auto",
});
```

Delete the full `restoreVersion` callback:

```ts
const restoreVersion = useCallback(
  async (version: DocumentVersion) => {
    const file = useFileStore.getState().currentFile;
    if (!file) return;
    // 恢复前先快照当前态,保证恢复可回退(非破坏)。
    await useVersionStore.getState().cut({
      docKey: file.path,
      content: captureVersionContent(file),
      kind: "auto",
    });
    setMarkdown(version.markdown);
    useThemeStore.getState().selectTheme(version.theme);
    useThemeStore.getState().setCustomCSS(version.customCSS ?? "");
    await saveFile();
  },
  [setMarkdown, saveFile],
);
```

Delete the full `markMilestone` callback:

```ts
const markMilestone = useCallback(async (label: string) => {
  const file = useFileStore.getState().currentFile;
  if (!file) return;
  await useVersionStore.getState().cut({
    docKey: file.path,
    content: captureVersionContent(file),
    kind: "milestone",
    label: label.trim() || "里程碑",
  });
}, []);
```

Remove these fields from the returned object:

```ts
restoreVersion,
markMilestone,
```

- [ ] **Step 5: Run the guard and existing hook tests**

Run:

```bash
pnpm --filter @draftport/web test -- useFileSystemVersionRemoval useFileSystemEffects --run
```

Expected: PASS.

- [ ] **Step 6: Commit after approval**

After validation passes, show `git diff -- apps/web/src/hooks/useFileSystem.ts apps/web/src/__tests__/hooks/useFileSystemVersionRemoval.test.ts` to the user and wait for explicit approval. Then run:

```bash
git add apps/web/src/hooks/useFileSystem.ts apps/web/src/__tests__/hooks/useFileSystemVersionRemoval.test.ts
git commit -m "fix(web): remove document history side effects"
```

---

### Task 4: Delete Version, Schedule, And Memos Feature Files

**Files:**

- Delete: `apps/web/src/components/VersionTimeline/VersionTimelinePanel.css`
- Delete: `apps/web/src/components/VersionTimeline/VersionTimelinePanel.tsx`
- Delete: `apps/web/src/components/WorkspaceViews/MemoCalendar.tsx`
- Delete: `apps/web/src/components/WorkspaceViews/MemoEditor.tsx`
- Delete: `apps/web/src/components/WorkspaceViews/MemoPage.tsx`
- Delete: `apps/web/src/components/WorkspaceViews/ScheduleContextMenu.tsx`
- Delete: `apps/web/src/components/WorkspaceViews/SchedulePage.tsx`
- Delete: `apps/web/src/components/WorkspaceViews/VersionTimelinePage.tsx`
- Delete: `apps/web/src/components/WorkspaceViews/WorkspacePage.tsx`
- Delete: `apps/web/src/components/WorkspaceViews/WorkspaceViews.css`
- Delete: `apps/web/src/components/WorkspaceViews/calendarGrid.ts`
- Delete: `apps/web/src/components/WorkspaceViews/relativeTime.ts`
- Delete: `apps/web/src/components/WorkspaceViews/renderMemoMarkdown.ts`
- Delete: `apps/web/src/store/diskVersionRepository.ts`
- Delete: `apps/web/src/store/memoStore.ts`
- Delete: `apps/web/src/store/memoTypes.ts`
- Delete: `apps/web/src/store/scheduleStore.ts`
- Delete: `apps/web/src/store/scheduleTypes.ts`
- Delete: `apps/web/src/store/versionPolicy.ts`
- Delete: `apps/web/src/store/versionStore.ts`
- Delete: `apps/web/src/store/versionTypes.ts`
- Delete: `apps/web/src/__tests__/components/calendarGrid.test.ts`
- Delete: `apps/web/src/__tests__/components/relativeTime.test.ts`
- Delete: `apps/web/src/__tests__/components/renderMemoMarkdown.test.ts`
- Delete: `apps/web/src/__tests__/store/diskVersionRepository.test.ts`
- Delete: `apps/web/src/__tests__/store/memoStore.test.ts`
- Delete: `apps/web/src/__tests__/store/scheduleStore.test.ts`
- Delete: `apps/web/src/__tests__/store/versionPolicy.test.ts`
- Delete: `apps/web/src/__tests__/store/versionStore.test.ts`

- [ ] **Step 1: Run a reference search before deletion**

Run:

```bash
rg -n "VersionTimeline|versionStore|diskVersionRepository|versionPolicy|versionTypes|SchedulePage|ScheduleContextMenu|scheduleStore|scheduleTypes|MemoPage|MemoEditor|MemoCalendar|memoStore|memoTypes|renderMemoMarkdown|WorkspacePage|calendarGrid|relativeTime" apps/web/src
```

Expected: references are limited to files listed in this task plus any files already modified in Tasks 1-3. If a reference appears outside the listed files, stop and inspect that file before deleting.

- [ ] **Step 2: Delete feature-owned files**

Run:

```bash
git rm apps/web/src/components/VersionTimeline/VersionTimelinePanel.css \
  apps/web/src/components/VersionTimeline/VersionTimelinePanel.tsx \
  apps/web/src/components/WorkspaceViews/MemoCalendar.tsx \
  apps/web/src/components/WorkspaceViews/MemoEditor.tsx \
  apps/web/src/components/WorkspaceViews/MemoPage.tsx \
  apps/web/src/components/WorkspaceViews/ScheduleContextMenu.tsx \
  apps/web/src/components/WorkspaceViews/SchedulePage.tsx \
  apps/web/src/components/WorkspaceViews/VersionTimelinePage.tsx \
  apps/web/src/components/WorkspaceViews/WorkspacePage.tsx \
  apps/web/src/components/WorkspaceViews/WorkspaceViews.css \
  apps/web/src/components/WorkspaceViews/calendarGrid.ts \
  apps/web/src/components/WorkspaceViews/relativeTime.ts \
  apps/web/src/components/WorkspaceViews/renderMemoMarkdown.ts \
  apps/web/src/store/diskVersionRepository.ts \
  apps/web/src/store/memoStore.ts \
  apps/web/src/store/memoTypes.ts \
  apps/web/src/store/scheduleStore.ts \
  apps/web/src/store/scheduleTypes.ts \
  apps/web/src/store/versionPolicy.ts \
  apps/web/src/store/versionStore.ts \
  apps/web/src/store/versionTypes.ts \
  apps/web/src/__tests__/components/calendarGrid.test.ts \
  apps/web/src/__tests__/components/relativeTime.test.ts \
  apps/web/src/__tests__/components/renderMemoMarkdown.test.ts \
  apps/web/src/__tests__/store/diskVersionRepository.test.ts \
  apps/web/src/__tests__/store/memoStore.test.ts \
  apps/web/src/__tests__/store/scheduleStore.test.ts \
  apps/web/src/__tests__/store/versionPolicy.test.ts \
  apps/web/src/__tests__/store/versionStore.test.ts
```

- [ ] **Step 3: Verify no feature references remain**

Run:

```bash
rg -n "VersionTimeline|versionStore|diskVersionRepository|versionPolicy|versionTypes|SchedulePage|ScheduleContextMenu|scheduleStore|scheduleTypes|MemoPage|MemoEditor|MemoCalendar|memoStore|memoTypes|renderMemoMarkdown|WorkspacePage|calendarGrid|relativeTime|/history|/schedule|/memos|版本时间线|发布排期|素材收集" apps/web/src --glob '!**/__tests__/**'
```

Expected: no production-source matches for removed product workflows. Legacy URL strings may remain in regression tests that prove the removed routes fall back to the editor.

- [ ] **Step 4: Run focused tests after deletion**

Run:

```bash
pnpm --filter @draftport/web test -- Header AppWysiwygMode useFileSystemVersionRemoval --run
```

Expected: PASS.

- [ ] **Step 5: Commit after approval**

After validation passes, show `git status --short` and `git diff --cached --name-only` after staging, then wait for explicit approval. Then run:

```bash
git add -u apps/web/src
git commit -m "fix(web): delete non-editor workspace features"
```

---

### Task 5: Final Verification And Cleanup

**Files:**

- Verify: `apps/web/src`
- Verify: `apps/web/package.json`
- Verify: `package.json`

- [ ] **Step 1: Run full web tests**

Run:

```bash
pnpm --filter @draftport/web test -- --run
```

Expected: PASS for the remaining web test suite.

- [ ] **Step 2: Run web build**

Run:

```bash
pnpm --filter @draftport/web run build
```

Expected: PASS with TypeScript build and Vite production build completing successfully.

- [ ] **Step 3: Run lint if build succeeds**

Run:

```bash
pnpm --filter @draftport/web run lint
```

Expected: PASS. If lint reports deleted-file cache artifacts, clear only the relevant local cache after showing the exact error.

- [ ] **Step 4: Confirm no non-editor workflows remain in source**

Run:

```bash
rg -n "版本时间线|发布排期|素材收集|VersionTimeline|SchedulePage|MemoPage|useVersionStore|useScheduleStore|useMemoStore|/history|/schedule|/memos" apps/web/src --glob '!**/__tests__/**'
```

Expected: no production-source matches for removed workflows.

- [ ] **Step 5: Confirm application updater wording remains**

Run:

```bash
rg -n "latestVersion|currentVersion|发现新版本|跳过此版本" apps/web/src/App.tsx apps/web/src/components/UpdateModal/UpdateModal.tsx
```

Expected: matches remain in `App.tsx` and `UpdateModal.tsx`, proving app update delivery was not deleted with document history.

- [ ] **Step 6: Prepare final scoped finish**

Run:

```bash
git status --short
git diff --check
```

Expected: only files from this editor-only scope are modified or deleted, and `git diff --check` reports no whitespace errors.

- [ ] **Step 7: Ask for manual verification and final commit approval**

Report the validation output and the exact file list. Ask the user to manually verify the app behavior:

```text
请确认手动验证结果：Header 只剩编辑器相关操作，访问 /history、/schedule、/memos 不再出现独立页面，保存文章不再生成文档历史入口。
确认后我再按当前 staged diff 提交。
```

Run the final commit only after explicit approval:

```bash
git add apps/web/src
git commit -m "fix(web): focus workspace on editor"
```

---

## Self-Review

Spec coverage:

- Remove Version/History: covered by Tasks 1, 2, 3, and 4.
- Remove Schedule: covered by Tasks 1, 2, and 4.
- Remove Memos/materials: covered by Tasks 1, 2, and 4.
- Keep editor focus: covered by App route fallback tests in Task 2.
- Keep application updater version semantics: covered by Task 5 Step 5.

Placeholder scan:

- The plan avoids open-ended placeholders and gives concrete files, code blocks, commands, and expected outcomes.

Type consistency:

- Removed feature names match current source references from `rg`.
- New test file name `useFileSystemVersionRemoval.test.ts` matches the command used in Tasks 3 and 5.
- Header route removal does not introduce new public types.
