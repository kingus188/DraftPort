// Verifies the Electron startup screen can resume work from persisted recent items.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Welcome } from "../../components/Welcome/Welcome";

const mocks = vi.hoisted(() => {
  const loadWorkspace = vi.fn(async () => undefined);
  const openFile = vi.fn(async () => undefined);
  const selectWorkspace = vi.fn(async () => undefined);
  const list = vi.fn(async () => ({
    success: true,
    items: [
      {
        workspacePath: "/workspace",
        itemPath: "/workspace/draft.md",
        itemType: "file" as const,
        title: "Draft",
        themeName: "默认主题",
        openedAt: "2026-01-02T00:00:00.000Z",
        mtime: 1760000000000,
        size: 12,
        missing: false,
      },
      {
        workspacePath: "/workspace",
        itemPath: "/workspace/docs",
        itemType: "folder" as const,
        title: null,
        themeName: null,
        openedAt: "2026-01-01T00:00:00.000Z",
        mtime: 1760000000000,
        size: null,
        missing: false,
      },
    ],
  }));

  const electron = {
    recentItems: {
      list,
    },
  };

  return {
    loadWorkspace,
    openFile,
    selectWorkspace,
    list,
    electron,
  };
});

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    loadWorkspace: mocks.loadWorkspace,
    openFile: mocks.openFile,
    selectWorkspace: mocks.selectWorkspace,
  }),
}));

vi.mock("../../hooks/useFileSystemHelpers", () => ({
  getElectron: () => mocks.electron,
}));

describe("Welcome recent items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows recent startup items and opens a selected file", async () => {
    render(<Welcome />);

    expect(await screen.findByText("最近打开")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("docs")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Draft/ }));

    await waitFor(() => {
      expect(mocks.loadWorkspace).toHaveBeenCalledWith("/workspace");
      expect(mocks.openFile).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/workspace/draft.md",
          name: "draft.md",
          title: "Draft",
          themeName: "默认主题",
          size: 12,
        }),
      );
    });
  });
});
