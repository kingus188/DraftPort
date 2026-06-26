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
