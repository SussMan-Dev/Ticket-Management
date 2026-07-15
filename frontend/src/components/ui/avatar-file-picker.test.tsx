import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AvatarFilePicker } from "./avatar-file-picker";

describe("AvatarFilePicker", () => {
  it("accepts a local PNG selected from the device", async () => {
    const onChange = vi.fn();
    render(<AvatarFilePicker id="avatar" fullName="Test User" currentUrl={null} file={null} onChange={onChange} />);
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "avatar.png", {
      type: "image/png",
    });

    await userEvent.upload(screen.getByLabelText("Chọn ảnh từ thiết bị"), file);

    expect(onChange).toHaveBeenCalledWith(file);
  });

  it("rejects unsupported image formats before upload", async () => {
    const onChange = vi.fn();
    render(<AvatarFilePicker id="avatar" fullName="Test User" currentUrl={null} file={null} onChange={onChange} />);
    const file = new File(["gif"], "avatar.gif", { type: "image/gif" });

    await userEvent.upload(screen.getByLabelText("Chọn ảnh từ thiết bị"), file, {
      applyAccept: false,
    });

    expect(screen.getByRole("alert")).toHaveTextContent("JPEG, PNG hoặc WebP");
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
