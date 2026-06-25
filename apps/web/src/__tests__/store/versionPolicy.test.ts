import { describe, expect, it } from "vitest";
import {
  isSameVersionContent,
  selectPrunableVersionIds,
} from "../../store/versionPolicy";
import type { DocumentVersion, VersionContent } from "../../store/versionTypes";

const content = (overrides: Partial<VersionContent> = {}): VersionContent => ({
  markdown: "# hello",
  theme: "default",
  themeName: "默认主题",
  customCSS: "",
  title: "标题",
  ...overrides,
});

const version = (overrides: Partial<DocumentVersion>): DocumentVersion => ({
  id: "id",
  docKey: "doc-a",
  kind: "auto",
  markdown: "# hello",
  theme: "default",
  themeName: "默认主题",
  customCSS: "",
  title: "标题",
  createdAt: "2026-06-25T00:00:00.000Z",
  ...overrides,
});

describe("isSameVersionContent", () => {
  it("没有上一个版本时视为不同(必须切首个版本)", () => {
    expect(isSameVersionContent(undefined, content())).toBe(false);
  });

  it("内容完全一致时视为相同(去重)", () => {
    expect(isSameVersionContent(version({}), content())).toBe(true);
  });

  it("正文不同则视为不同", () => {
    expect(
      isSameVersionContent(version({}), content({ markdown: "# 改了" })),
    ).toBe(false);
  });

  it("主题或标题不同则视为不同", () => {
    expect(isSameVersionContent(version({}), content({ theme: "dark" }))).toBe(
      false,
    );
    expect(
      isSameVersionContent(version({}), content({ title: "新标题" })),
    ).toBe(false);
  });
});

describe("selectPrunableVersionIds", () => {
  const autos = (count: number): DocumentVersion[] =>
    Array.from({ length: count }, (_, i) =>
      version({
        id: `auto-${i}`,
        kind: "auto",
        // index 0 最旧,递增更新
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      }),
    );

  it("自动版本不超过上限时不裁剪", () => {
    expect(selectPrunableVersionIds(autos(3), 5)).toEqual([]);
  });

  it("只保留最近 keepAuto 个自动版本,裁掉更旧的", () => {
    const prunable = selectPrunableVersionIds(autos(5), 2);
    // 保留 auto-4 / auto-3(最新两个),裁掉 auto-0/1/2
    expect(prunable.sort()).toEqual(["auto-0", "auto-1", "auto-2"]);
  });

  it("里程碑永不被裁剪,且不计入自动版本配额", () => {
    const versions: DocumentVersion[] = [
      ...autos(3),
      version({ id: "m-1", kind: "milestone", label: "v1 发布" }),
    ];
    const prunable = selectPrunableVersionIds(versions, 1);
    expect(prunable).not.toContain("m-1");
    // 3 个 auto 保留最新 1 个(auto-2),裁掉 auto-0/auto-1
    expect(prunable.sort()).toEqual(["auto-0", "auto-1"]);
  });
});
