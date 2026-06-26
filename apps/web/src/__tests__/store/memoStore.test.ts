import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useMemoStore } from "../../store/memoStore";
import { parseTags } from "../../store/memoTypes";

const WS = "/ws";

/** Minimal in-memory desktop fs so the store can round-trip its sidecar. */
function installFakeFs(): Map<string, string> {
  const files = new Map<string, string>();
  (window as unknown as { desktop: unknown }).desktop = {
    fs: {
      readFile: async (filePath: string) =>
        files.has(filePath)
          ? { success: true, content: files.get(filePath) }
          : { success: false },
      saveFile: async ({
        filePath,
        content,
      }: {
        filePath: string;
        content: string;
      }) => {
        files.set(filePath, content);
        return { success: true };
      },
    },
  };
  return files;
}

beforeEach(() => {
  useMemoStore.setState({ workspacePath: null, memos: [] });
});

afterEach(() => {
  delete (window as unknown as { desktop?: unknown }).desktop;
});

describe("parseTags", () => {
  it("extracts unique inline tags including CJK", () => {
    expect(parseTags("聊聊 #灵感 和 #idea 再 #灵感")).toEqual(["灵感", "idea"]);
  });
});

describe("memoStore", () => {
  it("adds a memo, parses tags, and persists newest-first", async () => {
    const files = installFakeFs();
    await useMemoStore.getState().load(WS);

    await useMemoStore.getState().add("第一条 #note");
    await useMemoStore.getState().add("第二条");

    const memos = useMemoStore.getState().memos;
    expect(memos.map((m) => m.content)).toEqual(["第二条", "第一条 #note"]);
    expect(memos[1].tags).toEqual(["note"]);

    const saved = JSON.parse(files.get("/ws/.wemd-memos.json") as string);
    expect(saved).toHaveLength(2);
  });

  it("ignores blank input and reloads from the sidecar", async () => {
    installFakeFs();
    await useMemoStore.getState().load(WS);

    await useMemoStore.getState().add("   ");
    expect(useMemoStore.getState().memos).toHaveLength(0);

    await useMemoStore.getState().add("保留我");
    const id = useMemoStore.getState().memos[0].id;

    // A fresh load must see the persisted memo.
    useMemoStore.setState({ memos: [] });
    await useMemoStore.getState().load(WS);
    expect(useMemoStore.getState().memos[0].id).toBe(id);

    await useMemoStore.getState().remove(id);
    expect(useMemoStore.getState().memos).toHaveLength(0);
  });

  it("updates content, re-parses tags, keeps id/createdAt, and persists", async () => {
    const files = installFakeFs();
    await useMemoStore.getState().load(WS);

    await useMemoStore.getState().add("旧内容 #old");
    const original = useMemoStore.getState().memos[0];

    await useMemoStore.getState().update(original.id, "  新内容 #new  ");

    const memo = useMemoStore.getState().memos[0];
    expect(memo.id).toBe(original.id);
    expect(memo.createdAt).toBe(original.createdAt);
    expect(memo.content).toBe("新内容 #new");
    expect(memo.tags).toEqual(["new"]);

    const saved = JSON.parse(files.get("/ws/.wemd-memos.json") as string);
    expect(saved[0].content).toBe("新内容 #new");
  });

  it("ignores a blank edit", async () => {
    installFakeFs();
    await useMemoStore.getState().load(WS);

    await useMemoStore.getState().add("保持不变");
    const before = useMemoStore.getState().memos[0];

    await useMemoStore.getState().update(before.id, "   ");
    expect(useMemoStore.getState().memos[0].content).toBe("保持不变");
  });
});
