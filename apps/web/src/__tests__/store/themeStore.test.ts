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
});
