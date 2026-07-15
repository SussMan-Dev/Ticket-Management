import { useState } from "react";
import { getInitials } from "../../lib/formatting/formatters";

interface UserAvatarProps {
  fullName: string;
  src?: string | null;
  size?: "small" | "large";
  className?: string;
}

export function UserAvatar({ fullName, src, size, className = "" }: UserAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const classes = [
    "avatar",
    size ? `avatar--${size}` : "",
    className,
  ].filter(Boolean).join(" ");

  if (src && failedSrc !== src) {
    return (
      <img
        className={classes}
        src={src}
        alt={`Ảnh đại diện của ${fullName}`}
        onError={() => setFailedSrc(src)}
      />
    );
  }

  return <span className={classes} aria-label={`Ảnh đại diện của ${fullName}`}>{getInitials(fullName)}</span>;
}
