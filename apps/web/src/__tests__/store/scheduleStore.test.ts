import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useScheduleStore } from "../../store/scheduleStore";

const WS = "/ws";
const DOC = "/ws/post.md";

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
  useScheduleStore.setState({ workspacePath: null, entries: {} });
});

afterEach(() => {
  delete (window as unknown as { desktop?: unknown }).desktop;
});

describe("scheduleStore", () => {
  it("upserts status and date, then persists and reloads", async () => {
    installFakeFs();
    await useScheduleStore.getState().load(WS);

    await useScheduleStore
      .getState()
      .upsert(DOC, { status: "scheduled", title: "稿子" });
    await useScheduleStore
      .getState()
      .upsert(DOC, { scheduledAt: "2026-07-01" });

    const entry = useScheduleStore.getState().entries[DOC];
    expect(entry.status).toBe("scheduled");
    expect(entry.scheduledAt).toBe("2026-07-01");
    expect(entry.title).toBe("稿子");

    // State survives a fresh load from the sidecar.
    useScheduleStore.setState({ entries: {} });
    await useScheduleStore.getState().load(WS);
    expect(useScheduleStore.getState().entries[DOC].scheduledAt).toBe(
      "2026-07-01",
    );
  });

  it("drops entries with an unknown status when loading", async () => {
    const files = installFakeFs();
    files.set(
      "/ws/.wemd-schedule.json",
      JSON.stringify({
        [DOC]: { docPath: DOC, status: "bogus", updatedAt: "x" },
        "/ws/ok.md": { docPath: "/ws/ok.md", status: "draft", updatedAt: "x" },
      }),
    );

    await useScheduleStore.getState().load(WS);
    const entries = useScheduleStore.getState().entries;
    expect(entries[DOC]).toBeUndefined();
    expect(entries["/ws/ok.md"].status).toBe("draft");
  });

  it("removes an entry and persists the removal", async () => {
    const files = installFakeFs();
    await useScheduleStore.getState().load(WS);
    await useScheduleStore.getState().upsert(DOC, { status: "draft" });
    await useScheduleStore.getState().remove(DOC);

    expect(useScheduleStore.getState().entries[DOC]).toBeUndefined();
    const saved = JSON.parse(files.get("/ws/.wemd-schedule.json") as string);
    expect(saved[DOC]).toBeUndefined();
  });
});
