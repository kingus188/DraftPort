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
  it("keeps the header as a compact action toolbar", () => {
    const css = readWorkspaceStyle("src/components/Header/Header.css");

    expect(getRuleBody(css, ".app-header")).toContain("height: 56px");
    expect(getRuleBody(css, ".header-actions")).toContain(
      "justify-content: space-between",
    );
    expect(getRuleBody(css, ".header-brand")).toContain("display: flex");
    expect(getRuleBody(css, ".header-right")).toContain(
      "justify-content: flex-end",
    );
  });

  it("keeps the static preview content full width without preview chrome", () => {
    const css = readWorkspaceStyle(
      "src/components/Preview/MarkdownPreview.css",
    );

    expect(getRuleBody(css, ".preview-content")).toContain("width: 100%");
    expect(css).not.toContain(".preview-header");
    expect(css).not.toContain(".preview-device-actions");
  });

  it("keeps table borders collapsed across theme, preview, and WYSIWYG surfaces", () => {
    const basicTheme = readWorkspaceStyle(
      "../../packages/core/src/themes/basic.ts",
    );
    const previewCss = readWorkspaceStyle(
      "src/components/Preview/MarkdownPreview.css",
    );
    const wysiwygCss = readWorkspaceStyle(
      "src/components/Editor/WysiwygMarkdownEditor.css",
    );

    const baseTableRule = getRuleBody(basicTheme, "#draftport table");
    expect(baseTableRule).toContain("border-collapse: collapse");
    expect(baseTableRule).toContain("border-spacing: 0");

    expect(getRuleBody(previewCss, "#draftport .table-container")).toContain(
      "overflow-x: auto",
    );
    expect(
      getRuleBody(previewCss, ".preview-content #draftport table"),
    ).toContain("border-collapse: collapse");

    const wysiwygTableRule = getRuleBody(
      wysiwygCss,
      ".wysiwyg-markdown-editor #draftport .ProseMirror table",
    );
    expect(wysiwygTableRule).toContain("border-collapse: collapse");
    expect(wysiwygTableRule).toContain("border-spacing: 0");
  });

  it("keeps collapsed history width respected on narrower desktop windows", () => {
    const css = readWorkspaceStyle("src/App.css");

    expect(css).toMatch(
      /grid-template-columns:\s*var\(--history-width,\s*clamp\(280px,\s*25vw,\s*340px\)\)\s*minmax\(0,\s*1fr\);/,
    );
  });
});
