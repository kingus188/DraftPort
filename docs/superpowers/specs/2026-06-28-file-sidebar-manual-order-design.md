# File Sidebar Manual Order Design

## Goal

让文件面板里的文件夹和 Markdown 文件支持同级拖拽排序，并把排序结果记忆到当前项目中。排序不应破坏现有拖拽移动文件/文件夹、最近打开排序、名称排序、最近编辑排序、搜索过滤、打开文件、创建/移动/删除/重命名等功能。

## Decisions

- 使用项目配置文件 `.draftport/order.json` 作为持久化真相源，不引入 sqlite。
- 新增 `manual` 排序模式。只有在手动排序模式下，拖拽到同级插入位置才表示排序。
- 现有拖到文件夹主体的语义继续保持为“移动到文件夹”。
- 搜索过滤时禁用拖拽排序和移动，沿用当前 `isDragEnabled = !filter` 的约束。
- 文件系统扫描仍是文件树真相源；排序配置只重排当前存在的节点，缺失路径忽略，新节点按原始扫描顺序补到末尾。

## Persistence Shape

```json
{
  "version": 1,
  "folders": {
    "/workspace": ["/workspace/docs", "/workspace/a.md"],
    "/workspace/docs": ["/workspace/docs/b.md"]
  }
}
```

`folders` 的 key 是父目录绝对路径，value 是该父目录下直接子节点的绝对路径顺序。Tauri 只允许在当前 workspace 内读写 `.draftport/order.json`，并把 `.draftport` 从 workspace tree 扫描中隐藏。

## Architecture

Tauri workspace domain 增加项目排序配置读写 helper，并暴露两个窄命令：读取当前 workspace 的 order config、保存 renderer 传入的 order config。Renderer bridge 在 `window.desktop.workspaceOrder` 下暴露该能力。

前端 `sortUtils` 增加 `manual` mode 和 order-aware tree sorting。`useSidebarState` 在 workspace 切换后加载 order config，在同级 drop 后构造新的父目录顺序并保存。`FileSidebar` 只负责呈现 drop-before/drop-after 插入点和把 drop 事件传给 state hook。

## Validation

- Web unit tests:
  - `sortUtils` 能按手动顺序重排文件夹和文件。
  - 缺失路径被忽略，新文件按扫描顺序追加。
  - 非手动排序模式保留原有行为。
  - `useSidebarState` 同级排序时保存 order config，跨父目录拖拽仍走移动逻辑。
  - `FileSidebar` 渲染手动排序选项和拖拽插入点状态。
- Tauri tests:
  - `.draftport` 不出现在 workspace tree。
  - order config 可 round trip 到 `.draftport/order.json`。
  - 非法路径不会写出 workspace 边界。
- Focused checks:
  - `pnpm --filter @draftport/web test -- --run src/__tests__/components/sortUtils.test.ts src/__tests__/components/useSidebarState.test.tsx src/__tests__/components/FileSidebar.test.tsx src/__tests__/desktop/tauriBridge.test.ts`
  - `cargo test` in `apps/tauri/src-tauri`
