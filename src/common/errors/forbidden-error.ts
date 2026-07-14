import { AppError } from "./app-error.js";

export class ForbiddenError extends AppError {
  public constructor(message = "You are not allowed to perform this action", code = "FORBIDDEN") {
    super(message, { statusCode: 403, code });
  }
}
