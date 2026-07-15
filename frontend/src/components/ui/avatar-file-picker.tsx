import { useEffect, useMemo, useRef, useState } from "react";
import { UserAvatar } from "./user-avatar";

const allowedAvatarTypes = ["image/jpeg", "image/png", "image/webp"];
const maximumAvatarBytes = 5 * 1_024 * 1_024;

interface AvatarFilePickerProps {
  id: string;
  fullName: string;
  currentUrl: string | null;
  file: File | null;
  disabled?: boolean;
  onChange(file: File | null): void;
}

export function AvatarFilePicker({
  id,
  fullName,
  currentUrl,
  file,
  disabled = false,
  onChange,
}: AvatarFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = useMemo(() => (
    file && typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null
  ), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
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
    if (!allowedAvatarTypes.includes(selectedFile.type)) {
      setError("Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.");
      if (inputRef.current) inputRef.current.value = "";
      onChange(null);
      return;
    }
    if (selectedFile.size > maximumAvatarBytes) {
      setError("Ảnh không được vượt quá 5 MB.");
      if (inputRef.current) inputRef.current.value = "";
      onChange(null);
      return;
    }
    onChange(selectedFile);
  };

  return (
    <div className="avatar-picker">
      <UserAvatar fullName={fullName} src={previewUrl ?? currentUrl} size="large" />
      <div className="avatar-picker__content">
        <strong>Ảnh đại diện</strong>
        <small>JPEG, PNG hoặc WebP · tối đa 5 MB</small>
        <div className="button-row">
          <label className={`button button--secondary button--sm${disabled ? " avatar-picker__label--disabled" : ""}`} htmlFor={id}>Chọn ảnh từ thiết bị</label>
          <input
            ref={inputRef}
            className="sr-only"
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled}
            onChange={(event) => selectFile(event.currentTarget.files?.[0])}
          />
          {file ? <button className="text-button" type="button" disabled={disabled} onClick={() => { setError(null); onChange(null); }}>Bỏ chọn</button> : null}
        </div>
        {file ? <span className="avatar-picker__file">{file.name}</span> : null}
        {error ? <span className="avatar-picker__error" role="alert">{error}</span> : null}
      </div>
    </div>
  );
}
