import type { ApiFailure } from "../../types/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function toApiError(status: number, body: unknown): ApiError {
  if (isApiFailure(body)) {
    return new ApiError(body.message, status, body.error.code, body.error.details);
  }
  return new ApiError("Không thể xử lý yêu cầu. Vui lòng thử lại.", status, "UNKNOWN_ERROR");
}

function isApiFailure(body: unknown): body is ApiFailure {
  if (!body || typeof body !== "object") return false;
  const value = body as Partial<ApiFailure>;
  return value.success === false && typeof value.message === "string" && !!value.error;
}
