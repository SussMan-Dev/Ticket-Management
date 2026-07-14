import { AppError } from "./app-error.js";

export class BadRequestError extends AppError {
  public constructor(
    message = "Bad request",
    code = "BAD_REQUEST",
    details: unknown = null,
  ) {
    super(message, { statusCode: 400, code, details });
  }
}
