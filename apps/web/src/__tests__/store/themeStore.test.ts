// Verifies theme store state that drives the live editor and preview surfaces.
import { beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "../../store/themeStore";

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
});
