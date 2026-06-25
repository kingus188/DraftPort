# Typora-Like WYSIWYG Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DraftPort edit Markdown files in a Typora-like single-pane WYSIWYG surface by default, with `Ctrl+/` toggling back to full-pane Markdown source editing.

**Architecture:** Add a new WYSIWYG editor component that owns rendered-document editing and writes serialized Markdown back into `useEditorStore`. Keep the existing CodeMirror editor as source mode. Replace the permanent editor/preview split with one editor pane whose mode can switch between WYSIWYG and source, while keeping `MarkdownPreview` available as a publish-preview/check surface.

**Tech Stack:** React 18, Zustand, CodeMirror 6, Milkdown for WYSIWYG Markdown editing, Vitest and Testing Library.

---

### Task 1: Mode Contract And Layout Tests

**Files:**

- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/Editor/MarkdownEditor.tsx`
- Create: `apps/web/src/components/Editor/WysiwygMarkdownEditor.tsx`
- Test: `apps/web/src/__tests__/components/AppWysiwygMode.test.tsx`

- [ ] **Step 1: Write failing tests**

Create tests that assert:

- the workspace renders the WYSIWYG editor by default
- the legacy Markdown source editor is hidden by default
- pressing `Ctrl+/` switches to source mode
- pressing `Ctrl+/` again returns to WYSIWYG mode

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm --filter @draftport/web test -- AppWysiwygMode
```

Expected: fails because `WysiwygMarkdownEditor` and the new mode behavior do not exist.

- [ ] **Step 3: Add the minimum mode wiring**

Introduce a local `editorMode` state in `App.tsx` with values `wysiwyg` and `source`, a document-level `Ctrl+/` listener, and conditional rendering between the new WYSIWYG editor placeholder and the existing source editor.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
pnpm --filter @draftport/web test -- AppWysiwygMode
```

Expected: the new mode tests pass.

### Task 2: WYSIWYG Markdown Surface

**Files:**

- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/web/src/components/Editor/WysiwygMarkdownEditor.tsx`
- Create: `apps/web/src/components/Editor/WysiwygMarkdownEditor.css`
- Test: `apps/web/src/__tests__/components/WysiwygMarkdownEditor.test.tsx`

- [ ] **Step 1: Add failing component tests**

Test that the WYSIWYG component:

- receives the current Markdown document from `useEditorStore`
- renders a WYSIWYG editor host
- calls `setMarkdown` when its serialized Markdown changes

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm --filter @draftport/web test -- WysiwygMarkdownEditor
```

Expected: fails because the Milkdown-backed component is not implemented.

- [ ] **Step 3: Install WYSIWYG dependencies**

Install the minimal Milkdown packages needed for React, common Markdown schema, commands, history, clipboard, and theme-free editor mounting.

- [ ] **Step 4: Implement the component**

Create a focused component that initializes Milkdown from the current Markdown, updates `useEditorStore` with serialized Markdown on document changes, and avoids feedback loops when the external Markdown state changes.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
pnpm --filter @draftport/web test -- WysiwygMarkdownEditor
```

Expected: component tests pass.

### Task 3: Preserve Existing Publishing Preview

**Files:**

- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/hooks/useWorkspacePreviewLayout.ts`
- Test: `apps/web/src/__tests__/components/AppWysiwygMode.test.tsx`
- Test: `apps/web/src/__tests__/hooks/useWorkspacePreviewLayout.test.ts`

- [ ] **Step 1: Add failing layout tests**

Extend tests to prove the workspace no longer shows the preview pane as a permanent split while WYSIWYG editing is active, and that publish preview can still be toggled intentionally.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm --filter @draftport/web test -- AppWysiwygMode useWorkspacePreviewLayout
```

Expected: fails until layout mode distinguishes editing from publish-preview display.

- [ ] **Step 3: Implement layout behavior**

Keep one main editor pane in normal editing. Render `MarkdownPreview` only for explicit preview/read-only layout states.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
pnpm --filter @draftport/web test -- AppWysiwygMode useWorkspacePreviewLayout
```

Expected: layout tests pass.

### Task 4: Verification

**Files:**

- Modified source and tests from Tasks 1-3

- [ ] **Step 1: Run focused web tests**

```bash
pnpm --filter @draftport/web test -- AppWysiwygMode WysiwygMarkdownEditor MarkdownEditor MarkdownPreview
```

- [ ] **Step 2: Run web build**

```bash
pnpm --filter @draftport/web build
```

- [ ] **Step 3: Inspect git diff**

```bash
git status --short
git diff --stat
```

Confirm only WYSIWYG editor, layout, dependency, and plan/test files are part of this feature slice, apart from pre-existing unrelated dirty files.
