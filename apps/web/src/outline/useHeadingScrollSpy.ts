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

    // 捕获相位:滚动事件不冒泡,但可在祖先上捕获到后代滚动,
    // 兼容「实际滚动的是内层元素」的情况。
    scroller.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () =>
      scroller.removeEventListener("scroll", onScroll, { capture: true });
  }, [scroller, getHeadings, options]);
}
