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
