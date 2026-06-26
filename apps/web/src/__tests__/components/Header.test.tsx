import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

const renderAt = (path: string) =>
  render(<Header />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    ),
  });

const openCopyMenu = () =>
  fireEvent.click(screen.getByRole("button", { name: "更多复制方式" }));
import { Header } from "../../components/Header/Header";
import { useWindowControls } from "../../hooks/useWindowControls";
import { useUITheme } from "../../hooks/useUITheme";
import { useEditorStore } from "../../store/editorStore";

// Mock hooks
vi.mock("../../hooks/useWindowControls");
vi.mock("../../hooks/useUITheme");
vi.mock("../../store/editorStore");

// Mock components that might cause issues in JSDOM or aren't focus of test
vi.mock("../../components/Theme/ThemePanel", () => ({
  ThemePanel: ({ open }: { open: boolean }) =>
    open ? <div data-testid="theme-panel">Theme Panel</div> : null,
}));

type HeaderThemeState = {
  theme: "default" | "dark";
  setTheme: (theme: "default" | "dark") => void;
};

describe("Header", () => {
  // Default mocks
  const mockCopyToWechat = vi.fn();
  const mockCopyToZhihu = vi.fn();
  const mockCopyToJuejin = vi.fn();
  const mockCopyAsHtml = vi.fn();
  const mockSetTheme = vi.fn();
  const mockMinimize = vi.fn();
  const mockMaximize = vi.fn();
  const mockClose = vi.fn();
  let storageMock: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    key: ReturnType<typeof vi.fn>;
    length: number;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const store = new Map<string, string>();
    storageMock = {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, String(value));
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key);
      }),
      clear: vi.fn(() => {
        store.clear();
      }),
      key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
      length: 0,
    };
    Object.defineProperty(storageMock, "length", {
      get: () => store.size,
      enumerable: true,
    });
    vi.stubGlobal("localStorage", storageMock);

    if (
      typeof window !== "undefined" &&
      window.localStorage &&
      typeof window.localStorage.removeItem === "function"
    ) {
      window.localStorage.removeItem("draftport-header-autohide");
    }

    // Setup default hook returns
    vi.mocked(useEditorStore).mockReturnValue({
      copyToWechat: mockCopyToWechat,
      copyToZhihu: mockCopyToZhihu,
      copyToJuejin: mockCopyToJuejin,
      copyAsHtml: mockCopyAsHtml,
    });

    vi.mocked(useUITheme).mockImplementation((selector) => {
      const state: HeaderThemeState = {
        theme: "default",
        setTheme: mockSetTheme,
      };
      return selector(state);
    });

    vi.mocked(useWindowControls).mockReturnValue({
      isDesktop: false,
      isWindows: false,
      isMac: true,
      platform: "web",
      minimize: mockMinimize,
      maximize: mockMaximize,
      close: mockClose,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a compact publishing toolbar with minimal brand identity", () => {
    render(<Header />, { wrapper: MemoryRouter });

    expect(screen.getByAltText("DraftPort Logo")).toBeInTheDocument();
    expect(screen.getByText("DraftPort")).toBeInTheDocument();
    expect(
      screen.queryByText("公众号 Markdown 排版编辑器"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "主题" })).toBeInTheDocument();
    // 公众号是主操作,直接可见
    expect(screen.getByText("复制到公众号")).toBeInTheDocument();
    // 次要复制项收进下拉,默认折叠
    expect(
      screen.getByRole("button", { name: "更多复制方式" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("复制到知乎")).not.toBeInTheDocument();
    expect(screen.queryByText("复制到掘金")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "HTML" }),
    ).not.toBeInTheDocument();
  });

  it("reveals secondary copy targets after opening the copy menu", () => {
    render(<Header />, { wrapper: MemoryRouter });

    openCopyMenu();

    expect(screen.getByText("复制到知乎")).toBeInTheDocument();
    expect(screen.getByText("复制到掘金")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "HTML" })).toBeInTheDocument();
  });

  it("hides publishing actions and theme on the version timeline view", () => {
    renderAt("/history");

    // 发布与主题在版本视图无意义,应隐藏
    expect(screen.queryByText("复制到公众号")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "更多复制方式" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "主题" }),
    ).not.toBeInTheDocument();

    // 导航与外观切换常驻
    expect(
      screen.getByRole("button", { name: "版本时间线" }),
    ).toBeInTheDocument();
    expect(screen.getByTitle("切换到暗色模式")).toBeInTheDocument();
  });

  it("keeps the minimal brand visible on macOS", () => {
    vi.mocked(useWindowControls).mockReturnValue({
      isDesktop: true,
      isWindows: false,
      isMac: true,
      platform: "darwin",
      minimize: mockMinimize,
      maximize: mockMaximize,
      close: mockClose,
    });

    render(<Header />, { wrapper: MemoryRouter });

    expect(screen.getByText("DraftPort")).toBeInTheDocument();
    expect(document.querySelector(".app-header")).not.toHaveStyle({
      paddingLeft: "80px",
    });
  });

  it("toggles theme interaction", () => {
    render(<Header />, { wrapper: MemoryRouter });

    const themeBtn = screen.getByTitle("切换到暗色模式");
    fireEvent.click(themeBtn);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("calls copyToWechat action", () => {
    render(<Header />, { wrapper: MemoryRouter });

    fireEvent.click(screen.getByText("复制到公众号"));
    expect(mockCopyToWechat).toHaveBeenCalled();
  });

  it("calls copyToZhihu action", () => {
    render(<Header />, { wrapper: MemoryRouter });

    openCopyMenu();
    fireEvent.click(screen.getByText("复制到知乎"));
    expect(mockCopyToZhihu).toHaveBeenCalled();
  });

  it("calls copyToJuejin action", () => {
    render(<Header />, { wrapper: MemoryRouter });

    openCopyMenu();
    fireEvent.click(screen.getByText("复制到掘金"));
    expect(mockCopyToJuejin).toHaveBeenCalled();
  });

  it("calls copyAsHtml action", () => {
    render(<Header />, { wrapper: MemoryRouter });

    openCopyMenu();
    fireEvent.click(screen.getByRole("button", { name: "HTML" }));
    expect(mockCopyAsHtml).toHaveBeenCalled();
  });

  it("does not render window controls on Web/Mac", () => {
    vi.mocked(useWindowControls).mockReturnValue({
      isDesktop: false,
      isWindows: false,
      isMac: true,
      platform: "web",
      minimize: mockMinimize,
      maximize: mockMaximize,
      close: mockClose,
    });

    render(<Header />, { wrapper: MemoryRouter });

    expect(screen.queryByLabelText("最小化")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("关闭")).not.toBeInTheDocument();
  });

  it("renders window controls on Windows Desktop", () => {
    vi.mocked(useWindowControls).mockReturnValue({
      isDesktop: true,
      isWindows: true,
      isMac: false,
      platform: "win32",
      minimize: mockMinimize,
      maximize: mockMaximize,
      close: mockClose,
    });

    render(<Header />, { wrapper: MemoryRouter });

    expect(screen.getByLabelText("最小化")).toBeInTheDocument();
    expect(screen.getByLabelText("最大化")).toBeInTheDocument();
    expect(screen.getByLabelText("关闭")).toBeInTheDocument();

    // Test interactions
    fireEvent.click(screen.getByLabelText("关闭"));
    expect(mockClose).toHaveBeenCalled();
  });

  it("does not expose manual header visibility switching", () => {
    render(<Header />, { wrapper: MemoryRouter });

    expect(screen.queryByLabelText("隐藏标题栏")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("显示标题栏")).not.toBeInTheDocument();
  });

  it("does not render floating toolbar buttons", () => {
    render(<Header />, { wrapper: MemoryRouter });

    expect(document.querySelector(".floating-toolbar")).not.toBeInTheDocument();
  });

  it("does not persist header visibility state", async () => {
    render(<Header />, { wrapper: MemoryRouter });

    await waitFor(() => {
      expect(storageMock.setItem).not.toHaveBeenCalled();
    });
  });
});
