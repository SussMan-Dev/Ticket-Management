interface MySqlErrorLike {
  code?: unknown;
  message?: unknown;
  sqlMessage?: unknown;
}

export function isDuplicateEntryError(error: unknown): boolean {
  return (error as MySqlErrorLike).code === "ER_DUP_ENTRY";
}

export function duplicateEntryField(error: unknown): "email" | "phone" | null {
  const candidate = error as MySqlErrorLike;
  const message = `${String(candidate.message ?? "")} ${String(candidate.sqlMessage ?? "")}`;

  if (/email/i.test(message)) {
    return "email";
  }

  if (/phone/i.test(message)) {
    return "phone";
  }

  return null;
}
