# 编辑器大纲(Outline)实现计划

> **For implementer:** 按任务顺序逐个落地,每个任务走完整 TDD 循环(红→绿→提交)。不要跳步,不要合并任务。

**Goal:** 在编辑器左栏新增一个 Typora 式缩进标题大纲,支持点击跳转与滚动高亮,覆盖 Milkdown(WYSIWYG)与 CodeMirror(源码)两个编辑表面。

**Architecture:** 一份大纲模型 + 一个面板 + 按表面解耦的适配器。模型由纯函数 `parseOutline(markdown)` 从 markdown 文本扫出 `OutlineItem[]`,用**出现次序(index)**寻址,不使用 slug。面板与各表面通过 window CustomEvent 总线通信(沿用代码库已有的 `draftport-sync-scroll` 模式):面板派发 `outline:jump`,各表面监听并滚动自己的第 N 个标题;各表面在用户滚动时派发 `outline:active`,面板据此高亮。大纲与文件树在左栏 `history-pane` 内**互斥切换**。

**Tech Stack:** React 19 + TypeScript、Zustand(editorStore)、Milkdown(ProseMirror)、CodeMirror 6、Vitest + Testing Library。

**锁定规格(grilling 结论,不再变更):**

- 形态:缩进标题列表(非 minimap)
- 位置:左栏 `history-pane`,与 `FileSidebar` 互斥切换
- 寻址:出现次序 index,跨表面统一,**无 slug**
- 交互:双向(点击跳转 + 滚动高亮)
- 覆盖:Milkdown、CodeMirror;预览适配器先核实是否有实时预览面板,无则按 YAGNI 砍掉
- 共存:大纲跳转预览时临时挂起比例同步(`isSyncingRef` + `SYNC_SCROLL_EVENT`)

**已知 ceiling(实现期用 `ponytail:` 注释标注):**

- 模型是行扫描器,只解析 ATX 标题(`#`~`######`)并跳过围栏代码块。setext 标题(`===`/`---` 下划线)与引用块内标题不计入——与 ProseMirror 的标题计数在这些边界可能漂移。Typora 用户以 ATX 为主,接受此 ceiling,升级路径是改用 markdown-it token 流。

---

## 文件总览

```
新增:
  apps/web/src/outline/types.ts
  apps/web/src/outline/outlineModel.ts
  apps/web/src/outline/outlineBus.ts
  apps/web/src/outline/OutlinePanel.tsx
  apps/web/src/outline/OutlinePanel.css
  apps/web/src/outline/useHeadingScrollSpy.ts
新增测试:
  apps/web/src/__tests__/outline/outlineModel.test.ts
  apps/web/src/__tests__/outline/OutlinePanel.test.tsx
修改:
  apps/web/src/components/Editor/WysiwygMarkdownEditor.tsx  (Milkdown 适配器)
  apps/web/src/components/Editor/MarkdownEditor.tsx          (CodeMirror 适配器)
  apps/web/src/App.tsx                                       (左栏互斥切换)
```

测试命令统一:`cd apps/web && npx vitest run <路径>`。

---

# Slice 1 — 模型 + 面板 + 左栏切换 + Milkdown 适配器

核心价值切片。完成后 WYSIWYG 下大纲可用。

## Task 1.1：定义大纲类型

**Objective:** 声明 `OutlineItem` 与事件常量,后续文件依赖它。

**Files:**

- Create: `apps/web/src/outline/types.ts`

**Step 1:** 写文件:

```typescript
/** 一个标题在大纲中的条目;index 是文档内标题的出现次序(从 0 起),跨表面统一寻址。 */
export interface OutlineItem {
  /** 标题层级 1-6。 */
  level: number;
  /** 标题纯文本(去掉前缀 # 与首尾空白)。 */
  text: string;
  /** 文档内第几个标题,从 0 开始。这是跳转寻址的唯一键。 */
  index: number;
  /** 标题所在行号,从 0 开始;供 CodeMirror 行定位使用。 */
  line: number;
}
```

**Step 2:** 无测试(纯类型)。直接进入下一个任务。

**Step 3:** 暂不提交,与 Task 1.2 一起提交。

---

## Task 1.2：实现 `parseOutline` 行扫描器(TDD)

**Objective:** 从 markdown 文本扫出 `OutlineItem[]`,跳过围栏代码块。

**Files:**

- Create: `apps/web/src/outline/outlineModel.ts`
- Test: `apps/web/src/__tests__/outline/outlineModel.test.ts`

**Step 1: 写失败测试**

````typescript
import { describe, it, expect } from "vitest";
import { parseOutline } from "../../outline/outlineModel";

describe("parseOutline", () => {
  it("extracts ATX headings with level, text, index, line", () => {
    const md = "# A\n\ntext\n\n## B\n\n### C";
    expect(parseOutline(md)).toEqual([
      { level: 1, text: "A", index: 0, line: 0 },
      { level: 2, text: "B", index: 1, line: 4 },
      { level: 3, text: "C", index: 2, line: 6 },
    ]);
  });

  it("ignores # inside fenced code blocks", () => {
    const md = "# Real\n\n```\n# not a heading\n```\n\n## Also real";
    const items = parseOutline(md);
    expect(items.map((i) => i.text)).toEqual(["Real", "Also real"]);
    expect(items[1].index).toBe(1);
  });

  it("keeps duplicate heading texts distinct by index", () => {
    const md = "## 小结\n\n## 小结";
    const items = parseOutline(md);
    expect(items).toHaveLength(2);
    expect(items[0].index).toBe(0);
    expect(items[1].index).toBe(1);
  });

  it("returns empty array when there are no headings", () => {
    expect(parseOutline("just text\n\nmore")).toEqual([]);
  });
});
````

**Step 2: 运行验证失败**

Run: `cd apps/web && npx vitest run src/__tests__/outline/outlineModel.test.ts`
Expected: FAIL —「parseOutline is not a function / 模块不存在」

**Step 3: 写最小实现**

````typescript
import type { OutlineItem } from "./types";

const ATX_HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;

/**
 * 行扫描器:逐行识别 ATX 标题,跳过围栏代码块内的 #。
 * ponytail: 只解析 ATX 标题,setext/引用块内标题不计入,与 ProseMirror 标题计数在这些边界可能漂移;升级路径是改用 markdown-it token 流。
 */
export function parseOutline(markdown: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  let inFence = false;
  const lines = markdown.split("\n");

  for (let line = 0; line < lines.length; line++) {
    if (FENCE.test(lines[line])) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = ATX_HEADING.exec(lines[line]);
    if (!match) continue;

    items.push({
      level: match[1].length,
      text: match[2].trim(),
      index: items.length,
      line,
    });
  }

  return items;
}
````

**Step 4: 运行验证通过**

Run: `cd apps/web && npx vitest run src/__tests__/outline/outlineModel.test.ts`
Expected: PASS — 4 passed

**Step 5: 提交**

```bash
git add apps/web/src/outline/types.ts apps/web/src/outline/outlineModel.ts apps/web/src/__tests__/outline/outlineModel.test.ts
git commit -m "feat(web): 大纲模型 parseOutline 行扫描器"
```

---

## Task 1.3：大纲事件总线

**Objective:** 封装 window CustomEvent 的派发/订阅,面板与各表面共用,避免散落的字符串与类型断言。

**Files:**

- Create: `apps/web/src/outline/outlineBus.ts`

**Step 1:** 写文件:

```typescript
/** 大纲与编辑表面之间的解耦事件总线,沿用代码库已有的 window CustomEvent 模式。 */
const JUMP = "outline:jump";
const ACTIVE = "outline:active";

/** 面板请求跳转到第 index 个标题。 */
export function emitOutlineJump(index: number): void {
  window.dispatchEvent(new CustomEvent<number>(JUMP, { detail: index }));
}

/** 表面收到跳转请求时回调;返回取消订阅函数。 */
export function onOutlineJump(handler: (index: number) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<number>).detail);
  window.addEventListener(JUMP, listener);
  return () => window.removeEventListener(JUMP, listener);
}

/** 表面在用户滚动时上报当前标题序号。 */
export function emitOutlineActive(index: number): void {
  window.dispatchEvent(new CustomEvent<number>(ACTIVE, { detail: index }));
}

/** 面板订阅当前标题序号;返回取消订阅函数。 */
export function onOutlineActive(handler: (index: number) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<number>).detail);
  window.addEventListener(ACTIVE, listener);
  return () => window.removeEventListener(ACTIVE, listener);
}
```

**Step 2:** 无独立测试(薄封装,由面板/适配器集成测试覆盖)。

**Step 3: 提交**

```bash
git add apps/web/src/outline/outlineBus.ts
git commit -m "feat(web): 大纲事件总线"
```

---

## Task 1.4：OutlinePanel 组件(TDD)

**Objective:** 渲染缩进标题列表,点击派发跳转,订阅 active 高亮。

**Files:**

- Create: `apps/web/src/outline/OutlinePanel.tsx`
- Create: `apps/web/src/outline/OutlinePanel.css`
- Test: `apps/web/src/__tests__/outline/OutlinePanel.test.tsx`

**Step 1: 写失败测试**

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { OutlinePanel } from "../../outline/OutlinePanel";
import * as bus from "../../outline/outlineBus";

afterEach(cleanup);

describe("OutlinePanel", () => {
  it("renders one row per heading with indent by level", () => {
    render(<OutlinePanel markdown={"# A\n\n## B"} />);
    expect(screen.getByText("A")).toBeInTheDocument();
    const rowB = screen.getByText("B").closest("button")!;
    expect(rowB).toHaveAttribute("data-level", "2");
  });

  it("emits a jump with the heading index on click", () => {
    const spy = vi.spyOn(bus, "emitOutlineJump");
    render(<OutlinePanel markdown={"# A\n\n## B"} />);
    fireEvent.click(screen.getByText("B"));
    expect(spy).toHaveBeenCalledWith(1);
  });

  it("shows an empty hint when there are no headings", () => {
    render(<OutlinePanel markdown={"plain text"} />);
    expect(screen.getByText("无标题")).toBeInTheDocument();
  });
});
```

**Step 2: 运行验证失败**

Run: `cd apps/web && npx vitest run src/__tests__/outline/OutlinePanel.test.tsx`
Expected: FAIL — 模块不存在

**Step 3: 写最小实现**

`OutlinePanel.tsx`:

```typescript
import { useEffect, useMemo, useState } from "react";
import { parseOutline } from "./outlineModel";
import { emitOutlineJump, onOutlineActive } from "./outlineBus";
import "./OutlinePanel.css";

interface OutlinePanelProps {
  /** 当前文档 markdown,大纲据此实时重算。 */
  markdown: string;
}

/** 左栏内的 Typora 式标题大纲:缩进列表 + 点击跳转 + 滚动高亮。 */
export function OutlinePanel({ markdown }: OutlinePanelProps) {
  const items = useMemo(() => parseOutline(markdown), [markdown]);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => onOutlineActive(setActiveIndex), []);

  if (items.length === 0) {
    return <div className="outline-panel outline-panel--empty">无标题</div>;
  }

  return (
    <nav className="outline-panel" aria-label="文档大纲">
      {items.map((item) => (
        <button
          key={item.index}
          className={`outline-row ${item.index === activeIndex ? "is-active" : ""}`}
          data-level={item.level}
          style={{ paddingLeft: `${(item.level - 1) * 12 + 12}px` }}
          onClick={() => emitOutlineJump(item.index)}
          title={item.text}
        >
          {item.text}
        </button>
      ))}
    </nav>
  );
}
```

`OutlinePanel.css`(占位最小样式,后续按 FileSidebar 风格微调):

```css
.outline-panel {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  height: 100%;
  padding: 8px 0;
}
.outline-panel--empty {
  padding: 16px;
  color: var(--text-secondary, #888);
  font-size: 13px;
}
.outline-row {
  text-align: left;
  border: none;
  background: none;
  cursor: pointer;
  padding: 4px 12px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary, #333);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.outline-row:hover {
  background: var(--hover-bg, rgba(0, 0, 0, 0.04));
}
.outline-row.is-active {
  color: var(--accent, #07c160);
  font-weight: 600;
}
```

**Step 4: 运行验证通过**

Run: `cd apps/web && npx vitest run src/__tests__/outline/OutlinePanel.test.tsx`
Expected: PASS — 3 passed

**Step 5: 提交**

```bash
git add apps/web/src/outline/OutlinePanel.tsx apps/web/src/outline/OutlinePanel.css apps/web/src/__tests__/outline/OutlinePanel.test.tsx
git commit -m "feat(web): OutlinePanel 大纲面板组件"
```

---

## Task 1.5：左栏文件树 ↔ 大纲互斥切换

**Objective:** 在 `history-pane` 顶部加「文件 / 大纲」分段切换,按选择渲染 `FileSidebar` 或 `OutlinePanel`。

**Files:**

- Modify: `apps/web/src/App.tsx`(`history-pane__content` 区域,约 287-296 行)

**Step 1:** 在 App 组件内加视图状态(放在 `showThemePanel` 等 useState 附近):

```typescript
const [sidebarView, setSidebarView] = useState<"files" | "outline">("files");
```

并取出当前 markdown(若组件内尚无,可用已存在的 `markdown` 选择器):

```typescript
// markdown 已由 useEditorStore 选出,见组件顶部 const markdown = useEditorStore(...)
```

**Step 2:** 把 `history-pane__content` 内的 `<FileSidebar />` 替换为带切换的结构:

```tsx
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
```

并在文件顶部加导入:

```typescript
import { OutlinePanel } from "./outline/OutlinePanel";
```

**Step 3: 手动验证**(此切片改的是布局,集成测试在 Task 1.7)

Run: `cd apps/web && npm run dev:web`,在 WYSIWYG 下点左栏「大纲」,应看到标题列表;点「文件」回到文件树。

**Step 4:** `tsc` 与既有测试不回退:
Run: `cd apps/web && npx tsc --noEmit && npx vitest run src/__tests__/components/App*.test.tsx`
Expected: PASS(App 测试已 mock 子组件,不应受影响;若断言文件树常驻则按需更新)

**Step 5: 提交**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): 左栏文件树与大纲互斥切换"
```

---

## Task 1.6：标题滚动监听通用 Hook

**Objective:** 抽出「按容器内标题节点计算当前可视标题序号」的逻辑,供 Milkdown 与预览复用。

**Files:**

- Create: `apps/web/src/outline/useHeadingScrollSpy.ts`

**Step 1:** 写文件:

```typescript
import { useEffect } from "react";
import { emitOutlineActive } from "./outlineBus";

/**
 * 监听滚动容器,把「当前最靠近顶部的可见标题」序号上报给大纲面板。
 * headings 按文档顺序排列,序号即 OutlineItem.index。
 */
export function useHeadingScrollSpy(
  scroller: HTMLElement | null,
  getHeadings: () => HTMLElement[],
  options: { suppressed?: () => boolean } = {},
): void {
  useEffect(() => {
    if (!scroller) return;

    const onScroll = () => {
      if (options.suppressed?.()) return;
      const headings = getHeadings();
      const top = scroller.getBoundingClientRect().top;
      let active = 0;
      for (let i = 0; i < headings.length; i++) {
        if (headings[i].getBoundingClientRect().top - top <= 8) active = i;
        else break;
      }
      emitOutlineActive(active);
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [scroller, getHeadings, options]);
}
```

**Step 2:** 无独立测试(DOM 滚动几何在 jsdom 下不可靠,由手动验证覆盖)。

**Step 3: 提交**

```bash
git add apps/web/src/outline/useHeadingScrollSpy.ts
git commit -m "feat(web): 标题滚动监听通用 hook"
```

---

## Task 1.7：Milkdown 适配器(跳转 + 高亮)

**Objective:** WYSIWYG 表面响应 `outline:jump` 滚到第 N 个标题节点,并在滚动时上报 active。

**Files:**

- Modify: `apps/web/src/components/Editor/WysiwygMarkdownEditor.tsx`

**背景:** Milkdown 渲染根是 `#draftport`(见 `WysiwygMarkdownEditor.tsx:113`)。标题节点是其内的 `h1`~`h6`,文档顺序与 `parseOutline` 的 index 对齐。滚动容器是该表面的可滚动祖先(`.wysiwyg-markdown-editor__surface` 或 `#draftport`,实现时确认哪个有 `overflow`)。

**Step 1:** 在 `WysiwygMarkdownEditor` 组件内加适配器 effect(组件返回的最外层 `div.wysiwyg-markdown-editor` 加一个 `ref`,作为定位根):

```typescript
import { useEffect, useMemo, useRef } from "react";
import { onOutlineJump } from "../../outline/outlineBus";
import { useHeadingScrollSpy } from "../../outline/useHeadingScrollSpy";
```

```typescript
const surfaceRef = useRef<HTMLDivElement>(null);

const getHeadings = useMemo(
  () => () =>
    Array.from(
      surfaceRef.current?.querySelectorAll<HTMLElement>(
        "h1, h2, h3, h4, h5, h6",
      ) ?? [],
    ),
  [],
);

// 跳转:滚到第 index 个标题节点
useEffect(
  () =>
    onOutlineJump((index) => {
      const target = getHeadings()[index];
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }),
  [getHeadings],
);

// 高亮:滚动容器即可滚动的表面根
useHeadingScrollSpy(surfaceRef.current, getHeadings);
```

并把最外层容器接上 ref:

```tsx
<div ref={surfaceRef} className="wysiwyg-markdown-editor" data-testid="wysiwyg-markdown-editor">
```

> 实现注记:`useHeadingScrollSpy` 第一参数在首渲染为 `null`,effect 依赖 `surfaceRef.current`,需确保 Milkdown 挂载后重新绑定。若高亮不触发,改为监听 `#draftport` 的实际滚动祖先;用 DevTools 确认哪个元素产生 scroll 事件。

**Step 2: 手动验证**

Run: `cd apps/web && npm run dev:web`

- 切到大纲,点任一标题 → WYSIWYG 平滑滚到该标题
- 滚动 WYSIWYG → 大纲当前标题高亮跟随
- 重名标题点第二个 → 跳到第二个,不跳到第一个

**Step 3:** 回归:
Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: 仅既有的 FileSidebar padding 失败(与本特性无关),其余 PASS

**Step 4: 提交**

```bash
git add apps/web/src/components/Editor/WysiwygMarkdownEditor.tsx
git commit -m "feat(web): Milkdown 大纲跳转与滚动高亮适配器"
```

**Slice 1 验收:** WYSIWYG 下大纲可点击跳转、滚动高亮、重名无歧义;文件树切换不回退;类型与测试绿。

---

# Slice 2 — CodeMirror 适配器(纯行号)

源码模式独立低风险切片。

## Task 2.1：CodeMirror 跳转 + 高亮

**Objective:** 源码表面响应 `outline:jump` 用行号滚动,并在滚动时按可视行上报 active。

**Files:**

- Modify: `apps/web/src/components/Editor/MarkdownEditor.tsx`

**背景:** `viewRef.current` 持有 `EditorView`(`MarkdownEditor.tsx:34`);`view.scrollDOM` 是滚动容器。`OutlineItem.line` 是 0 基行号,CodeMirror `doc.line(n)` 是 1 基。

**Step 1:** 在 `MarkdownEditor` 内加跳转 effect:

```typescript
import { onOutlineJump, emitOutlineActive } from "../../outline/outlineBus";
import { parseOutline } from "../../outline/outlineModel";
import { EditorView as CMEditorView } from "@codemirror/view";
```

```typescript
// 大纲跳转:按行号滚到第 index 个标题
useEffect(
  () =>
    onOutlineJump((index) => {
      const view = viewRef.current;
      if (!view) return;
      const item = parseOutline(view.state.doc.toString())[index];
      if (!item) return;
      const pos = view.state.doc.line(item.line + 1).from;
      view.dispatch({
        effects: CMEditorView.scrollIntoView(pos, { y: "start" }),
      });
    }),
  [],
);
```

**Step 2:** 在已有的 `handleEditorScroll`(`MarkdownEditor.tsx:103`)末尾追加 active 上报。`scrollDOM` 已在作用域内;用 `view.elementAtHeight` 找顶部可视行,映射到最近的上方标题:

```typescript
// 在 handleEditorScroll 内,ratio 派发之后追加:
const headings = parseOutline(view.state.doc.toString());
const topLine = view.state.doc.lineAt(
  view.lineBlockAtHeight(scrollDOM.scrollTop).from,
).number; // 1 基
let active = -1;
for (let i = 0; i < headings.length; i++) {
  if (headings[i].line + 1 <= topLine) active = i;
  else break;
}
if (active >= 0) emitOutlineActive(active);
```

> 注记:`view` 在该 effect 闭包内即 `viewRef.current` 创建的实例,直接引用局部 `view` 变量(见 97 行 `const view = new EditorView(...)`)。

**Step 3: 手动验证**

Run: `cd apps/web && npm run dev:web`,切到含 `mermaid`/公式等会强制源码模式的文档(或手动切到源码视图):

- 点大纲标题 → 源码滚到对应行
- 滚动源码 → 大纲高亮跟随

**Step 4:** 回归:
Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: 仅既有 FileSidebar 失败,其余 PASS

**Step 5: 提交**

```bash
git add apps/web/src/components/Editor/MarkdownEditor.tsx
git commit -m "feat(web): CodeMirror 大纲行号跳转与高亮适配器"
```

---

# Slice 3 — 预览适配器(条件实施)

## Task 3.0:先核实预览是否为实时面板

**Objective:** 避免给一个并不存在的实时预览面板做适配(YAGNI)。

**Step 1:** 确认 `MarkdownPreview` 是否真的作为常驻/可切换面板挂载:

Run: `cd apps/web && rg -rn '<MarkdownPreview' src`

- **若无任何渲染点** → `MarkdownPreview` 当前不是活的实时预览面板。**跳过整个 Slice 3**,在计划末尾记一行「预览适配器按 YAGNI 暂不实施」。Milkdown 本身即所见即所得,已覆盖预览式总览需求。
- **若存在渲染点** → 继续 Task 3.1。

## Task 3.1(条件):预览跳转 + 高亮 + 比例同步共存

**Files:**

- Modify: `apps/web/src/components/Preview/MarkdownPreview.tsx`

**背景:** 标题节点在 `previewRef` 内;滚动容器是 `scrollContainerRef`(`.preview-container`);已有 `isSyncingRef` 与 `SYNC_SCROLL_EVENT` 的比例同步(186-242 行)。

**Step 1:** 加跳转 effect,跳转前置 `isSyncingRef=true` 挂起比例同步,跳完用与现有同步相同的 100ms 复位:

```typescript
import { onOutlineJump } from "../../outline/outlineBus";

useEffect(
  () =>
    onOutlineJump((index) => {
      const root = previewRef.current;
      if (!root) return;
      const headings = root.querySelectorAll<HTMLElement>(
        "h1, h2, h3, h4, h5, h6",
      );
      const target = headings[index];
      if (!target) return;
      isSyncingRef.current = true; // 挂起比例同步,避免跳转回灌编辑器
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 100);
    }),
  [],
);
```

**Step 2:** 高亮上报:在已有的 `handlePreviewScroll`(186 行)`ratio` 派发后追加,用 `useHeadingScrollSpy` 的同款几何或内联计算,派发 `emitOutlineActive`。

**Step 3: 手动验证**

Run: `cd apps/web && npm run dev:web`

- 大纲点击 → 预览滚到标题,且编辑器**不被回灌跳动**(比例同步被正确挂起)
- 滚动预览 → 大纲高亮跟随

**Step 4:** 回归 + 提交:

```bash
cd apps/web && npx tsc --noEmit && npx vitest run
git add apps/web/src/components/Preview/MarkdownPreview.tsx
git commit -m "feat(web): 预览大纲跳转与比例同步共存"
```

---

# 收尾

- 全量验证:`cd apps/web && npx tsc --noEmit && npx vitest run && npm run lint`
- 更新 README「特性」表加一行「文档大纲」。
- 已知遗留:`parseOutline` 不处理 setext/引用块内标题(见 ceiling);若用户反馈需要,升级为 markdown-it token 流。
- 既有失败 `FileSidebar.test.tsx` padding 与本特性无关,单独处理。
