import type { HTMLAttributes, PropsWithChildren } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...props} />;
}

export function CardHeader({ children }: PropsWithChildren) {
  return <div className="card__header">{children}</div>;
}
