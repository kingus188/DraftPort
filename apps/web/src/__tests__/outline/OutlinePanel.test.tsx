import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { OutlinePanel } from "../../outline/OutlinePanel";
import * as bus from "../../outline/outlineBus";

afterEach(cleanup);

describe("OutlinePanel", () => {
  it("renders one row per heading with indent by level", () => {
    render(<OutlinePanel markdown={"# A\n\n## B"} />);
    expect(screen.getByText("A")).toBeInTheDocument();
    const rowB = screen.getByText("B").closest("button")!;
    expect(rowB).toHaveAttribute("data-level", "2");
  });

  it("emits a jump with the heading index on click", () => {
    const spy = vi.spyOn(bus, "emitOutlineJump");
    render(<OutlinePanel markdown={"# A\n\n## B"} />);
    fireEvent.click(screen.getByText("B"));
    expect(spy).toHaveBeenCalledWith(1);
  });

  it("shows an empty hint when there are no headings", () => {
    render(<OutlinePanel markdown={"plain text"} />);
    expect(screen.getByText("无标题")).toBeInTheDocument();
  });
});
