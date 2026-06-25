import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemePanel } from "../../components/Theme/ThemePanel";
import { useThemeStore } from "../../store/themeStore";
import { useUITheme } from "../../hooks/useUITheme";

// Mock stores and hooks
vi.mock("../../store/themeStore");
vi.mock("../../hooks/useUITheme");

// Mock ThemeDesigner to avoid complex dependencies
vi.mock("../../components/Theme/ThemeDesigner", () => ({
  ThemeDesigner: () => <div data-testid="theme-designer">Theme Designer</div>,
  defaultVariables: {},
  generateCSS: () => "",
}));

describe("ThemePanel", () => {
  const mockSelectTheme = vi.fn();
  const mockCreateTheme = vi.fn();
  const mockUpdateTheme = vi.fn();
  const mockDeleteTheme = vi.fn();
  const mockDuplicateTheme = vi.fn();

  const mockThemes = [
    {
      id: "default",
      name: "默认主题",
      css: "",
      isBuiltIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "custom1",
      name: "自定义主题",
      css: "body{}",
      isBuiltIn: false,
      editorMode: "css" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useThemeStore).mockImplementation((selector) => {
      const state = {
        themeId: "default",
        themeName: "默认主题",
        customCSS: "",
        customThemes: mockThemes.filter((theme) => !theme.isBuiltIn),
        selectTheme: mockSelectTheme,
        setCustomCSS: vi.fn(),
        getThemeCSS: vi.fn().mockReturnValue(""),
        getAllThemes: () => mockThemes,
        createTheme: mockCreateTheme,
        updateTheme: mockUpdateTheme,
        deleteTheme: mockDeleteTheme,
        duplicateTheme: mockDuplicateTheme,
        exportTheme: vi.fn(),
        exportThemeCSS: vi.fn(),
        importTheme: vi.fn().mockResolvedValue(true),
      };
      return selector(state);
    });

    vi.mocked(useUITheme).mockImplementation((selector) => {
      const state = { theme: "default" as const, setTheme: vi.fn() };
      return selector(state);
    });
  });

  it("renders when open", () => {
    render(<ThemePanel open={true} onClose={() => {}} />);

    expect(screen.getByText("主题管理")).toBeInTheDocument();
    expect(screen.getByText("新建自定义主题")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<ThemePanel open={false} onClose={() => {}} />);

    expect(screen.queryByText("主题管理")).not.toBeInTheDocument();
  });

  it("displays built-in and custom themes", () => {
    render(<ThemePanel open={true} onClose={() => {}} />);

    expect(screen.getByText("默认主题")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "自定义主题" }),
    ).toBeInTheDocument();
    expect(screen.getByText("内置主题")).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", () => {
    const mockOnClose = vi.fn();
    render(<ThemePanel open={true} onClose={mockOnClose} />);

    fireEvent.click(screen.getByLabelText("关闭"));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("selects a theme when clicked", () => {
    render(<ThemePanel open={true} onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "自定义主题" }));

    const nameInput = screen.getByPlaceholderText("输入主题名称...");
    expect(nameInput).toHaveValue("自定义主题");
  });

  it("enters creation mode when new theme button clicked", () => {
    render(<ThemePanel open={true} onClose={() => {}} />);

    fireEvent.click(screen.getByText("新建自定义主题"));

    expect(screen.getByText("选择创建方式")).toBeInTheDocument();
    expect(screen.getByText("可视化设计")).toBeInTheDocument();
    expect(screen.getByText("手写 CSS")).toBeInTheDocument();
  });
});
