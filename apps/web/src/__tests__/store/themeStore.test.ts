// Verifies theme store state that drives the live editor and preview surfaces.
import { beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "../../store/themeStore";
import { builtInThemes } from "../../store/themes/builtInThemes";

describe("themeStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useThemeStore.setState({
      themeId: "default",
      themeName: "默认主题",
      customCSS: "",
      customThemes: [],
      fileThemes: {},
    });
  });

  it("refreshes the active custom CSS when the selected custom theme is updated", () => {
    const theme = useThemeStore
      .getState()
      .createTheme(
        "Live Theme",
        "css",
        "#draftport h2 .content { display: block; }",
      );

    useThemeStore.getState().selectTheme(theme.id);
    expect(useThemeStore.getState().customCSS).toContain("display: block");

    useThemeStore.getState().updateTheme(theme.id, {
      name: "Live Theme",
      css: "#draftport h2 .content { display: inline-block; }",
    });

    expect(useThemeStore.getState().customCSS).toContain(
      "display: inline-block",
    );
  });

  it("includes the extracted Kami paper CSS as a built-in theme", () => {
    const kamiTheme = builtInThemes.find((theme) => theme.id === "kami-paper");

    expect(kamiTheme?.name).toBe("Kami 纸感");
    expect(kamiTheme?.css).toContain("--kami-parchment: #f5f4ed");
    expect(kamiTheme?.css).toContain("--kami-brand: #1B365D");
    expect(kamiTheme?.css).toContain("--kami-highlight-bg: #eee6d4");
    expect(kamiTheme?.css).toContain("background: var(--kami-highlight-bg)");
    expect(kamiTheme?.css).toContain("#draftport h2 .content");
  });

  it("stores selected themes per file without changing other file assignments", () => {
    useThemeStore.getState().selectTheme("receipt", "/workspace/a.md");
    useThemeStore.getState().selectTheme("kami-paper", "/workspace/b.md");

    expect(useThemeStore.getState().getFileTheme("/workspace/a.md")).toEqual({
      themeId: "receipt",
      themeName: "购物小票",
    });
    expect(useThemeStore.getState().getFileTheme("/workspace/b.md")).toEqual({
      themeId: "kami-paper",
      themeName: "Kami 纸感",
    });
    expect(useThemeStore.getState().themeId).toBe("kami-paper");
  });

  it("resolves a file theme from local assignment before frontmatter fallback", () => {
    useThemeStore.getState().selectTheme("receipt", "/workspace/a.md");

    expect(
      useThemeStore.getState().resolveFileTheme("/workspace/a.md", {
        themeId: "default",
        themeName: "默认主题",
      }),
    ).toEqual({
      themeId: "receipt",
      themeName: "购物小票",
    });

    expect(
      useThemeStore.getState().resolveFileTheme("/workspace/missing.md", {
        themeId: "kami-paper",
        themeName: "Kami 纸感",
      }),
    ).toEqual({
      themeId: "kami-paper",
      themeName: "Kami 纸感",
    });
  });
  it("moves and removes stored file theme assignments with file paths", () => {
    useThemeStore.getState().selectTheme("receipt", "/workspace/a.md");
    useThemeStore.getState().selectTheme("kami-paper", "/workspace/docs/b.md");

    useThemeStore
      .getState()
      .moveFileThemePath("/workspace/docs", "/workspace/archive/docs");

    expect(useThemeStore.getState().getFileTheme("/workspace/docs/b.md")).toBe(
      null,
    );
    expect(
      useThemeStore.getState().getFileTheme("/workspace/archive/docs/b.md"),
    ).toEqual({
      themeId: "kami-paper",
      themeName: "Kami 纸感",
    });

    useThemeStore.getState().removeFileThemePath("/workspace/archive");

    expect(
      useThemeStore.getState().getFileTheme("/workspace/archive/docs/b.md"),
    ).toBe(null);
    expect(useThemeStore.getState().getFileTheme("/workspace/a.md")).toEqual({
      themeId: "receipt",
      themeName: "购物小票",
    });
  });
});
