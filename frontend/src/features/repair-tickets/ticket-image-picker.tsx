import { useEffect, useMemo, useRef, useState } from "react";

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maximumImageBytes = 5 * 1_024 * 1_024;

interface TicketImagePickerProps {
  file: File | null;
  disabled?: boolean;
  onChange(file: File | null): void;
}

export function TicketImagePicker({
  file,
  disabled = false,
  onChange,
}: TicketImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = useMemo(
    () => file && typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(file)
      : null,
    [file],
  );

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!file && inputRef.current) inputRef.current.value = "";
  }, [file]);

  const selectFile = (selectedFile: File | undefined) => {
    setError(null);
    if (!selectedFile) {
      onChange(null);
      return;
    }
    if (!allowedImageTypes.includes(selectedFile.type)) {
      setError("Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.");
      if (inputRef.current) inputRef.current.value = "";
      onChange(null);
      return;
    }
    if (selectedFile.size > maximumImageBytes) {
      setError("Ảnh không được vượt quá 5 MB.");
      if (inputRef.current) inputRef.current.value = "";
      onChange(null);
      return;
    }
    onChange(selectedFile);
  };

  return (
    <div className="ticket-image-picker">
      <div className="ticket-image-picker__preview">
        {previewUrl
          ? <img src={previewUrl} alt="Ảnh ticket đã chọn" />
          : <span aria-hidden="true">＋</span>}
      </div>
      <div className="ticket-image-picker__content">
        <strong>{file?.name ?? "Chọn ảnh từ thiết bị"}</strong>
        <small>JPEG, PNG hoặc WebP · tối đa 5 MB</small>
        <div className="button-row">
          <label
            className={`button button--secondary button--sm${disabled ? " ticket-image-picker__label--disabled" : ""}`}
            htmlFor="ticket-attachment-file"
          >
            {file ? "Chọn ảnh khác" : "Chọn tệp ảnh"}
          </label>
          <input
            ref={inputRef}
            className="sr-only"
            id="ticket-attachment-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled}
            onChange={(event) => selectFile(event.currentTarget.files?.[0])}
          />
          {file
            ? <button className="text-button" type="button" disabled={disabled} onClick={() => onChange(null)}>Bỏ chọn</button>
            : null}
        </div>
        {error ? <span className="ticket-image-picker__error" role="alert">{error}</span> : null}
      </div>
    </div>
  );
}
