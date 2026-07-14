import { AppError } from "./app-error.js";

export class NotFoundError extends AppError {
  public constructor(message = "Resource not found", code = "RESOURCE_NOT_FOUND") {
    super(message, { statusCode: 404, code });
  }
}
