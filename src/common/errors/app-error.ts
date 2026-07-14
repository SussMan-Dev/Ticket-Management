export interface AppErrorOptions {
  statusCode: number;
  code: string;
  details?: unknown;
  isOperational?: boolean;
  cause?: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: unknown;
  public readonly isOperational: boolean;

  public constructor(message: string, options: AppErrorOptions) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details ?? null;
    this.isOperational = options.isOperational ?? true;
    Error.captureStackTrace(this, new.target);
  }
}
