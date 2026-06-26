import { describe, expect, it } from "vitest";
import { relativeTime } from "../../components/WorkspaceViews/relativeTime";

const now = new Date("2026-06-25T12:00:00");

describe("relativeTime", () => {
  it("buckets recent timestamps", () => {
    expect(relativeTime("2026-06-25T11:59:30", now)).toBe("刚刚");
    expect(relativeTime("2026-06-25T11:45:00", now)).toBe("15 分钟前");
    expect(relativeTime("2026-06-25T09:00:00", now)).toBe("3 小时前");
    expect(relativeTime("2026-06-23T12:00:00", now)).toBe("2 天前");
  });

  it("falls back to a date past a week", () => {
    expect(relativeTime("2026-06-01T12:00:00", now)).toBe(
      new Date("2026-06-01T12:00:00").toLocaleDateString(),
    );
  });

  it("returns empty for an invalid date", () => {
    expect(relativeTime("not-a-date", now)).toBe("");
  });
});
