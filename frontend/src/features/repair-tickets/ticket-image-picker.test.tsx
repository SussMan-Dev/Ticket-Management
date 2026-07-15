import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TicketImagePicker } from "./ticket-image-picker";

describe("TicketImagePicker", () => {
  it("accepts a repair photo selected from the technician device", async () => {
    const onChange = vi.fn();
    render(<TicketImagePicker file={null} onChange={onChange} />);
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47])],
      "repair.png",
      { type: "image/png" },
    );

    await userEvent.upload(screen.getByLabelText("Chọn tệp ảnh"), file);

    expect(onChange).toHaveBeenCalledWith(file);
  });

  it("rejects unsupported ticket image formats before upload", async () => {
    const onChange = vi.fn();
    render(<TicketImagePicker file={null} onChange={onChange} />);
    const file = new File(["gif"], "repair.gif", { type: "image/gif" });

    await userEvent.upload(screen.getByLabelText("Chọn tệp ảnh"), file, {
      applyAccept: false,
    });

    expect(screen.getByRole("alert")).toHaveTextContent("JPEG, PNG hoặc WebP");
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
