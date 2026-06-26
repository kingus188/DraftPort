import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = resolve(process.cwd(), "src/hooks/useFileSystem.ts");

describe("useFileSystem editor-only scope", () => {
  it("does not wire document version history into file operations", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).not.toContain("useVersionStore");
    expect(source).not.toContain("captureVersionContent");
    expect(source).not.toContain("restoreVersion");
    expect(source).not.toContain("markMilestone");
    expect(source).not.toContain("DocumentVersion");
    expect(source).not.toContain("VersionContent");
  });
});
