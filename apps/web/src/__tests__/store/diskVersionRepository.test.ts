import { describe, expect, it } from "vitest";
import {
  DiskVersionRepository,
  type VersionFs,
} from "../../store/diskVersionRepository";
import type { DocumentVersion } from "../../store/versionTypes";

/** In-memory stand-in for the Tauri fs bridge, keyed by full file path. */
function createFakeFs() {
  const files = new Map<string, string>();
  const dirname = (path: string) => path.slice(0, path.lastIndexOf("/"));
  const basename = (path: string) => path.slice(path.lastIndexOf("/") + 1);

  const fs: VersionFs = {
    createFolder: async () => ({ success: true }),
    createFile: async ({ filename, content }) => {
      files.set(filename, content);
      return { success: true, filePath: filename };
    },
    inspectFolder: async (path) => ({
      success: true,
      entries: [...files.keys()]
        .filter((p) => dirname(p) === path)
        .map(basename),
    }),
    readFile: async (path) => {
      const content = files.get(path);
      return content === undefined
        ? { success: false }
        : { success: true, content };
    },
    deleteFile: async (path) => {
      files.delete(path);
      return { success: true };
    },
  };

  return { fs, files };
}

const version = (overrides: Partial<DocumentVersion>): DocumentVersion => ({
  id: "v1",
  docKey: "/workspace/a.md",
  kind: "auto",
  markdown: "# hi",
  theme: "default",
  themeName: "默认主题",
  customCSS: "",
  title: "标题",
  createdAt: "2026-06-25T00:00:00.000Z",
  ...overrides,
});

describe("DiskVersionRepository", () => {
  it("append 后 list 能取回,且按时间倒序", async () => {
    const { fs } = createFakeFs();
    const repo = new DiskVersionRepository(fs);
    const docKey = "/workspace/a.md";

    await repo.append(
      version({ id: "v1", createdAt: "2026-06-25T00:00:00.000Z" }),
    );
    await repo.append(
      version({ id: "v2", createdAt: "2026-06-25T01:00:00.000Z" }),
    );

    const list = await repo.list(docKey);
    expect(list.map((v) => v.id)).toEqual(["v2", "v1"]);
    expect(list[0].markdown).toBe("# hi");
  });

  it("版本文件落在 .wemd-history 目录下", async () => {
    const { fs, files } = createFakeFs();
    const repo = new DiskVersionRepository(fs);

    await repo.append(version({ id: "v1" }));

    const paths = [...files.keys()];
    expect(paths).toHaveLength(1);
    expect(paths[0].startsWith(".wemd-history/")).toBe(true);
    expect(paths[0].endsWith("/v1.json")).toBe(true);
  });

  it("不同文档的版本互相隔离", async () => {
    const { fs } = createFakeFs();
    const repo = new DiskVersionRepository(fs);

    await repo.append(version({ docKey: "/workspace/a.md", id: "a1" }));
    await repo.append(version({ docKey: "/workspace/b.md", id: "b1" }));

    expect((await repo.list("/workspace/a.md")).map((v) => v.id)).toEqual([
      "a1",
    ]);
    expect((await repo.list("/workspace/b.md")).map((v) => v.id)).toEqual([
      "b1",
    ]);
  });

  it("remove 删除指定版本", async () => {
    const { fs } = createFakeFs();
    const repo = new DiskVersionRepository(fs);
    const docKey = "/workspace/a.md";

    await repo.append(version({ id: "v1" }));
    await repo.append(
      version({ id: "v2", createdAt: "2026-06-25T02:00:00.000Z" }),
    );
    await repo.remove(docKey, "v1");

    expect((await repo.list(docKey)).map((v) => v.id)).toEqual(["v2"]);
  });

  it("prune 保留最近 N 个自动版本,删除更旧的", async () => {
    const { fs } = createFakeFs();
    const repo = new DiskVersionRepository(fs);
    const docKey = "/workspace/a.md";

    for (let i = 0; i < 4; i++) {
      await repo.append(
        version({
          id: `auto-${i}`,
          createdAt: new Date(Date.UTC(2026, 0, 1, i)).toISOString(),
        }),
      );
    }
    await repo.prune(docKey, 2);

    expect((await repo.list(docKey)).map((v) => v.id)).toEqual([
      "auto-3",
      "auto-2",
    ]);
  });

  it("list 跳过损坏的 JSON,不抛错", async () => {
    const { fs, files } = createFakeFs();
    const repo = new DiskVersionRepository(fs);
    const docKey = "/workspace/a.md";

    await repo.append(version({ id: "ok" }));
    // 注入一个损坏文件到同一目录
    const dir = [...files.keys()][0].slice(
      0,
      [...files.keys()][0].lastIndexOf("/"),
    );
    files.set(`${dir}/broken.json`, "{not valid json");

    const list = await repo.list(docKey);
    expect(list.map((v) => v.id)).toEqual(["ok"]);
  });
});
