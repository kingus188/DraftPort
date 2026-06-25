import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  setVersionRepository,
  useVersionStore,
} from "../../store/versionStore";
import type {
  DocumentVersion,
  VersionContent,
  VersionRepository,
} from "../../store/versionTypes";

/** Array-backed VersionRepository for exercising the store's orchestration. */
function createFakeRepository() {
  let store: DocumentVersion[] = [];
  const pruneCalls: Array<{ docKey: string; keepAuto: number }> = [];

  const repo: VersionRepository = {
    list: async (docKey) =>
      store
        .filter((v) => v.docKey === docKey)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    append: async (version) => {
      store.push(version);
    },
    remove: async (docKey, id) => {
      store = store.filter((v) => !(v.docKey === docKey && v.id === id));
    },
    prune: async (docKey, keepAuto) => {
      pruneCalls.push({ docKey, keepAuto });
    },
  };

  return { repo, pruneCalls, all: () => store };
}

const content = (overrides: Partial<VersionContent> = {}): VersionContent => ({
  markdown: "# hi",
  theme: "default",
  themeName: "默认主题",
  customCSS: "",
  title: "标题",
  ...overrides,
});

describe("versionStore", () => {
  beforeEach(() => {
    useVersionStore.setState({ versions: [], docKey: null });
  });

  afterEach(() => {
    setVersionRepository(null);
  });

  it("cut 追加版本并刷新 store", async () => {
    const { repo } = createFakeRepository();
    setVersionRepository(repo);

    const v = await useVersionStore.getState().cut({
      docKey: "/a.md",
      content: content(),
      kind: "auto",
    });

    expect(v).not.toBeNull();
    expect(useVersionStore.getState().versions).toHaveLength(1);
    expect(useVersionStore.getState().docKey).toBe("/a.md");
  });

  it("内容未变时自动 cut 被去重", async () => {
    const { repo } = createFakeRepository();
    setVersionRepository(repo);
    const store = useVersionStore.getState();

    await store.cut({ docKey: "/a.md", content: content(), kind: "auto" });
    const second = await store.cut({
      docKey: "/a.md",
      content: content(),
      kind: "auto",
    });

    expect(second).toBeNull();
    expect(useVersionStore.getState().versions).toHaveLength(1);
  });

  it("里程碑即使内容相同也会记录", async () => {
    const { repo } = createFakeRepository();
    setVersionRepository(repo);
    const store = useVersionStore.getState();

    await store.cut({ docKey: "/a.md", content: content(), kind: "auto" });
    const milestone = await store.cut({
      docKey: "/a.md",
      content: content(),
      kind: "milestone",
      label: "v1",
    });

    expect(milestone).not.toBeNull();
    expect(useVersionStore.getState().versions).toHaveLength(2);
  });

  it("cut 后触发保留裁剪", async () => {
    const { repo, pruneCalls } = createFakeRepository();
    setVersionRepository(repo);

    await useVersionStore.getState().cut({
      docKey: "/a.md",
      content: content(),
      kind: "auto",
    });

    expect(pruneCalls).toEqual([{ docKey: "/a.md", keepAuto: 50 }]);
  });

  it("load 拉取指定文档的版本", async () => {
    const { repo } = createFakeRepository();
    setVersionRepository(repo);
    const store = useVersionStore.getState();
    await store.cut({ docKey: "/a.md", content: content(), kind: "auto" });
    await store.cut({
      docKey: "/b.md",
      content: content({ markdown: "# b" }),
      kind: "auto",
    });

    await useVersionStore.getState().load("/a.md");
    expect(useVersionStore.getState().versions).toHaveLength(1);
    expect(useVersionStore.getState().versions[0].docKey).toBe("/a.md");
  });

  it("无可用仓储时 cut 返回 null", async () => {
    setVersionRepository(null);
    // 无 window.desktop 时 getRepository 返回 null
    const v = await useVersionStore.getState().cut({
      docKey: "/a.md",
      content: content(),
      kind: "auto",
    });
    expect(v).toBeNull();
  });
});
