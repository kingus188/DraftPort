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
