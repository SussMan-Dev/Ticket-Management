import type { Response } from "express";
import type { ApiSuccessResponse } from "../types/api-response.js";

export function sendSuccess<T, TMeta = null>(
  response: Response,
  options: {
    statusCode?: number;
    message: string;
    data: T;
    meta?: TMeta;
  },
): Response<ApiSuccessResponse<T, TMeta | null>> {
  const payload: ApiSuccessResponse<T, TMeta | null> = {
    success: true,
    message: options.message,
    data: options.data,
    meta: options.meta ?? null,
  };

  return response.status(options.statusCode ?? 200).json(payload);
}
