import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler.js";
import {
  authenticate,
  authenticateForLogout,
} from "../../middlewares/authentication.middleware.js";
import { loginRateLimiter } from "../../middlewares/login-rate-limit.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import { authController } from "./auth.controller.js";
import { loginSchema, registerSchema } from "./auth.schema.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  validate(registerSchema),
  asyncHandler(authController.register),
);
authRouter.post(
  "/login",
  loginRateLimiter,
  validate(loginSchema),
  asyncHandler(authController.login),
);
authRouter.post("/refresh-token", asyncHandler(authController.refresh));
authRouter.post("/logout", authenticateForLogout, asyncHandler(authController.logout));
authRouter.post("/logout-all", authenticateForLogout, asyncHandler(authController.logoutAll));
authRouter.get("/me", authenticate, asyncHandler(authController.me));
