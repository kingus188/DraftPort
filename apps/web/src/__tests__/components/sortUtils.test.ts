import { describe, it, expect } from "vitest";
import { getSortMode, sortTreeItems } from "../../components/Sidebar/sortUtils";
import type { RecentItemMap } from "../../components/Sidebar/sortUtils";
import type { SortMode } from "../../components/Sidebar/sortUtils";
import type { FileItem, FolderItem, TreeItem } from "../../store/fileTypes";

function makeFile(name: string, updatedAt: string, title?: string): FileItem {
  return {
    name,
    path: `/${name}`,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date(updatedAt),
    size: 100,
    title,
  };
}

function makeFolder(name: string, children: TreeItem[]): FolderItem {
  return {
    name,
    path: `/${name}`,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    isDirectory: true as const,
    children,
  };
}

function names(items: TreeItem[]): string[] {
  return items.map((i) => i.name);
}

describe("sortTreeItems", () => {
  const files = [
    makeFile("b.md", "2024-03-01"),
    makeFile("a.md", "2024-01-01"),
    makeFile("c.md", "2024-02-01"),
  ];

  it("按最近编辑排序（降序）", () => {
    const sorted = sortTreeItems(files, "updated-desc");
    expect(names(sorted)).toEqual(["b.md", "c.md", "a.md"]);
  });

  it("按名称升序排序", () => {
    const sorted = sortTreeItems(files, "name-asc");
    expect(names(sorted)).toEqual(["a.md", "b.md", "c.md"]);
  });

  it("按名称降序排序", () => {
    const sorted = sortTreeItems(files, "name-desc");
    expect(names(sorted)).toEqual(["c.md", "b.md", "a.md"]);
  });

  it("文件夹始终置顶", () => {
    const items: TreeItem[] = [
      makeFile("z.md", "2024-03-01"),
      makeFolder("alpha", []),
      makeFile("a.md", "2024-01-01"),
      makeFolder("beta", []),
    ];
    for (const mode of [
      "updated-desc",
      "name-asc",
      "name-desc",
    ] as SortMode[]) {
      const sorted = sortTreeItems(items, mode);
      expect(sorted[0].isDirectory).toBe(true);
      expect(sorted[1].isDirectory).toBe(true);
      expect(sorted[0].name).toBe("alpha");
      expect(sorted[1].name).toBe("beta");
    }
  });

  it("递归排序子目录", () => {
    const folder = makeFolder("docs", [
      makeFile("z.md", "2024-01-01"),
      makeFile("a.md", "2024-03-01"),
      makeFolder("sub", [
        makeFile("m.md", "2024-01-01"),
        makeFile("b.md", "2024-02-01"),
      ]),
    ]);
    const sorted = sortTreeItems([folder], "name-asc");
    const sortedFolder = sorted[0] as FolderItem;
    expect(sortedFolder.children[0].name).toBe("sub");
    expect(sortedFolder.children[1].name).toBe("a.md");
    expect(sortedFolder.children[2].name).toBe("z.md");
    const sub = sortedFolder.children[0] as FolderItem;
    expect(sub.children[0].name).toBe("b.md");
    expect(sub.children[1].name).toBe("m.md");
  });

  it("数字自然排序（2 < 10）", () => {
    const items = [
      makeFile("file10.md", "2024-01-01"),
      makeFile("file2.md", "2024-01-01"),
      makeFile("file1.md", "2024-01-01"),
    ];
    const sorted = sortTreeItems(items, "name-asc");
    expect(names(sorted)).toEqual(["file1.md", "file2.md", "file10.md"]);
  });

  it("大小写不敏感", () => {
    const items = [
      makeFile("Beta.md", "2024-01-01"),
      makeFile("alpha.md", "2024-01-01"),
      makeFile("CHARLIE.md", "2024-01-01"),
    ];
    const sorted = sortTreeItems(items, "name-asc");
    expect(names(sorted)).toEqual(["alpha.md", "Beta.md", "CHARLIE.md"]);
  });

  it("中文排序", () => {
    const items = [
      makeFile("测试.md", "2024-01-01", "测试"),
      makeFile("编辑.md", "2024-01-01", "编辑"),
      makeFile("阿里.md", "2024-01-01", "阿里"),
    ];
    const sorted = sortTreeItems(items, "name-asc");
    expect(names(sorted)).toEqual(["阿里.md", "编辑.md", "测试.md"]);
  });

  it("按 title 排序（优先于 name）", () => {
    const items = [
      makeFile("z.md", "2024-01-01", "Alpha"),
      makeFile("a.md", "2024-01-01", "Charlie"),
      makeFile("m.md", "2024-01-01", "Beta"),
    ];
    const sorted = sortTreeItems(items, "name-asc");
    expect(names(sorted)).toEqual(["z.md", "m.md", "a.md"]);
  });

  it("不修改原始数组", () => {
    const original = [
      makeFile("c.md", "2024-01-01"),
      makeFile("a.md", "2024-02-01"),
    ];
    const originalNames = names(original);
    sortTreeItems(original, "name-asc");
    expect(names(original)).toEqual(originalNames);
  });
});

describe("recent-open sorting", () => {
  it("默认使用最近打开排序", () => {
    localStorage.removeItem("draftport-file-sort-mode");
    expect(getSortMode()).toBe("opened-desc");
  });

  it("兼容旧 recent 存储值为最近编辑", () => {
    localStorage.setItem("draftport-file-sort-mode", "recent");
    expect(getSortMode()).toBe("updated-desc");
  });

  it("按最近打开混排文件夹和文件，未打开项目排后", () => {
    const items: TreeItem[] = [
      makeFile("old.md", "2024-01-01"),
      makeFolder("docs", [makeFile("nested.md", "2024-01-03")]),
      makeFile("fresh.md", "2024-03-01"),
      makeFolder("ideas", []),
    ];
    const recentItems: RecentItemMap = new Map([
      ["/docs", "2026-01-02T00:00:00.000Z"],
      ["/fresh.md", "2026-01-03T00:00:00.000Z"],
    ]);

    const sorted = sortTreeItems(items, "opened-desc", recentItems);

    expect(sorted.map((entry) => entry.name)).toEqual([
      "fresh.md",
      "docs",
      "ideas",
      "old.md",
    ]);
  });
});

describe("manual order sorting", () => {
  it("按项目配置里的同级顺序混排文件夹和文件", () => {
    const items: TreeItem[] = [
      makeFolder("docs", []),
      makeFile("a.md", "2024-01-01"),
      makeFile("b.md", "2024-01-02"),
    ];

    const sorted = sortTreeItems(items, "manual", undefined, {
      "/": ["/b.md", "/docs", "/a.md"],
    });

    expect(sorted.map((entry) => entry.name)).toEqual(["b.md", "docs", "a.md"]);
  });

  it("忽略不存在的手动顺序路径，并把新增项目按扫描顺序追加", () => {
    const items: TreeItem[] = [
      makeFile("a.md", "2024-01-01"),
      makeFile("b.md", "2024-01-02"),
      makeFile("c.md", "2024-01-03"),
    ];

    const sorted = sortTreeItems(items, "manual", undefined, {
      "/": ["/missing.md", "/b.md"],
    });

    expect(sorted.map((entry) => entry.name)).toEqual(["b.md", "a.md", "c.md"]);
  });

  it("递归使用每个父目录自己的手动顺序", () => {
    const folder = makeFolder("docs", [
      makeFile("a.md", "2024-01-01"),
      makeFile("b.md", "2024-01-02"),
    ]);

    const sorted = sortTreeItems([folder], "manual", undefined, {
      "/": ["/docs"],
      "/docs": ["/b.md", "/a.md"],
    });
    const sortedFolder = sorted[0] as FolderItem;

    expect(sortedFolder.children.map((entry) => entry.name)).toEqual([
      "b.md",
      "a.md",
    ]);
  });
});

describe("切换排序模式后列表顺序变化", () => {
  const items: TreeItem[] = [
    makeFile("beta.md", "2024-01-01"),
    makeFile("alpha.md", "2024-03-01"),
    makeFile("charlie.md", "2024-02-01"),
  ];

  it("从 updated-desc 切换到 name-asc", () => {
    const byRecent = sortTreeItems(items, "updated-desc");
    expect(byRecent[0].name).toBe("alpha.md");

    const byName = sortTreeItems(items, "name-asc");
    expect(byName[0].name).toBe("alpha.md");
    expect(byName[1].name).toBe("beta.md");
    expect(byName[2].name).toBe("charlie.md");
  });

  it("从 name-asc 切换到 name-desc", () => {
    const asc = sortTreeItems(items, "name-asc");
    const desc = sortTreeItems(items, "name-desc");
    expect(asc.map((i) => i.name)).toEqual(desc.map((i) => i.name).reverse());
  });

  it("排序模式切换不影响文件夹位置", () => {
    const mixed: TreeItem[] = [
      makeFile("z.md", "2024-03-01"),
      makeFolder("folder", []),
      makeFile("a.md", "2024-01-01"),
    ];

    for (const mode of [
      "updated-desc",
      "name-asc",
      "name-desc",
    ] as SortMode[]) {
      const sorted = sortTreeItems(mixed, mode);
      expect(sorted[0].name).toBe("folder");
      expect(sorted[0].isDirectory).toBe(true);
    }
  });
});
