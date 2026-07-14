import { AppError } from "./app-error.js";

export class ConflictError extends AppError {
  public constructor(message = "Resource conflict", code = "CONFLICT", details: unknown = null) {
    super(message, { statusCode: 409, code, details });
  }
}
