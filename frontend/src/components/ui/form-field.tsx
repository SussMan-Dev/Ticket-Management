import type { PropsWithChildren, ReactNode } from "react";

interface FormFieldProps extends PropsWithChildren {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
}

export function FormField({ label, htmlFor, error, hint, required, children }: FormFieldProps) {
  return (
    <div className={`form-field ${error ? "form-field--error" : ""}`}>
      <label htmlFor={htmlFor}>
        {label}{required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {hint && !error ? <small>{hint}</small> : null}
      {error ? <small id={`${htmlFor}-error`} role="alert">{error}</small> : null}
    </div>
  );
}
