import { AppError } from "./app-error.js";

export class UnauthorizedError extends AppError {
  public constructor(message = "Authentication is required", code = "UNAUTHORIZED") {
    super(message, { statusCode: 401, code });
  }
}
