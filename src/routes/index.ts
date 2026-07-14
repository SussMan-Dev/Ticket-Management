import { Router } from "express";
import { sendSuccess } from "../common/utils/response.util.js";
import { authRouter } from "../modules/auth/auth.route.js";
import { customerRouter } from "../modules/customers/customer.route.js";
import { deviceRouter } from "../modules/devices/device.route.js";
import { repairTicketRouter } from "../modules/repair-tickets/repair-ticket.route.js";
import { userRouter } from "../modules/users/user.route.js";

export const apiRouter = Router();

apiRouter.get("/health", (_request, response) => {
  return sendSuccess(response, {
    message: "Service is healthy",
    data: {
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/customers", customerRouter);
apiRouter.use("/devices", deviceRouter);
apiRouter.use("/repair-tickets", repairTicketRouter);
