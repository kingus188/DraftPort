// Verifies shell chrome responsive constraints that JSDOM cannot measure as layout.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readWorkspaceStyle = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

/** Returns the first CSS rule body for a selector so responsive contracts stay explicit. */
function getRuleBody(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));

  if (!match) {
    throw new Error(`Missing CSS rule for ${selector}`);
  }

  return match[1];
}

describe("responsive shell chrome styles", () => {
  it("keeps header branding on one line and lets the subtitle truncate", () => {
    const css = readWorkspaceStyle("src/components/Header/Header.css");

    expect(getRuleBody(css, ".logo-info")).toContain("flex-wrap: nowrap");
    expect(getRuleBody(css, ".logo-subtitle")).toContain(
      "text-overflow: ellipsis",
    );
  });

  it("keeps preview header actions separate from truncating subtitle text", () => {
    const css = readWorkspaceStyle(
      "src/components/Preview/MarkdownPreview.css",
    );

    expect(getRuleBody(css, ".preview-title-stack")).toContain(
      "overflow: hidden",
    );
    expect(getRuleBody(css, ".preview-subtitle")).toContain(
      "text-overflow: ellipsis",
    );
    expect(getRuleBody(css, ".preview-header-actions")).toContain(
      "flex-shrink: 0",
    );
  });

  it("keeps collapsed history width respected on narrower desktop windows", () => {
    const css = readWorkspaceStyle("src/App.css");

    expect(css).toMatch(
      /grid-template-columns:\s*var\(--history-width,\s*clamp\(280px,\s*25vw,\s*340px\)\)\s*minmax\(0,\s*1fr\);/,
    );
  });
});
