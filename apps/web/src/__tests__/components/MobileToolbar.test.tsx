import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileToolbar } from "../../components/common/MobileToolbar";

describe("MobileToolbar", () => {
  it("opens more menu and triggers copyAsHtml", () => {
    const onViewChange = vi.fn();
    const onCopyToWechat = vi.fn();
    const onCopyToZhihu = vi.fn();
    const onCopyToJuejin = vi.fn();
    const onCopyAsHtml = vi.fn();
    const onOpenTheme = vi.fn();

    render(
      <MobileToolbar
        activeView="editor"
        onViewChange={onViewChange}
        onCopyToWechat={onCopyToWechat}
        onCopyToZhihu={onCopyToZhihu}
        onCopyToJuejin={onCopyToJuejin}
        onCopyAsHtml={onCopyAsHtml}
        onOpenTheme={onOpenTheme}
      />,
    );

    fireEvent.click(screen.getAllByRole("button")[3]);
    fireEvent.click(screen.getByText("复制 HTML"));

    expect(onCopyAsHtml).toHaveBeenCalledTimes(1);
  });

  it("triggers theme action from more menu", () => {
    const onViewChange = vi.fn();
    const onCopyToWechat = vi.fn();
    const onCopyToZhihu = vi.fn();
    const onCopyToJuejin = vi.fn();
    const onCopyAsHtml = vi.fn();
    const onOpenTheme = vi.fn();

    render(
      <MobileToolbar
        activeView="editor"
        onViewChange={onViewChange}
        onCopyToWechat={onCopyToWechat}
        onCopyToZhihu={onCopyToZhihu}
        onCopyToJuejin={onCopyToJuejin}
        onCopyAsHtml={onCopyAsHtml}
        onOpenTheme={onOpenTheme}
      />,
    );

    fireEvent.click(screen.getAllByRole("button")[3]);
    fireEvent.click(screen.getByText("主题管理"));

    expect(onOpenTheme).toHaveBeenCalledTimes(1);
  });

  it("opens more menu and triggers copyToZhihu", () => {
    const onViewChange = vi.fn();
    const onCopyToWechat = vi.fn();
    const onCopyToZhihu = vi.fn();
    const onCopyToJuejin = vi.fn();
    const onCopyAsHtml = vi.fn();
    const onOpenTheme = vi.fn();

    render(
      <MobileToolbar
        activeView="editor"
        onViewChange={onViewChange}
        onCopyToWechat={onCopyToWechat}
        onCopyToZhihu={onCopyToZhihu}
        onCopyToJuejin={onCopyToJuejin}
        onCopyAsHtml={onCopyAsHtml}
        onOpenTheme={onOpenTheme}
      />,
    );

    fireEvent.click(screen.getAllByRole("button")[3]);
    fireEvent.click(screen.getByText("复制到知乎"));

    expect(onCopyToZhihu).toHaveBeenCalledTimes(1);
  });

  it("opens more menu and triggers copyToJuejin", () => {
    const onViewChange = vi.fn();
    const onCopyToWechat = vi.fn();
    const onCopyToZhihu = vi.fn();
    const onCopyToJuejin = vi.fn();
    const onCopyAsHtml = vi.fn();
    const onOpenTheme = vi.fn();

    render(
      <MobileToolbar
        activeView="editor"
        onViewChange={onViewChange}
        onCopyToWechat={onCopyToWechat}
        onCopyToZhihu={onCopyToZhihu}
        onCopyToJuejin={onCopyToJuejin}
        onCopyAsHtml={onCopyAsHtml}
        onOpenTheme={onOpenTheme}
      />,
    );

    fireEvent.click(screen.getAllByRole("button")[3]);
    fireEvent.click(screen.getByText("复制到掘金"));

    expect(onCopyToJuejin).toHaveBeenCalledTimes(1);
  });
});
