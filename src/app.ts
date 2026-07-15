import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { imageStorageService } from "./common/services/image-storage.service.js";
import { env } from "./config/env.js";
import { errorHandlerMiddleware } from "./middlewares/error-handler.middleware.js";
import { notFoundMiddleware } from "./middlewares/not-found.middleware.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY);
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: false, limit: env.REQUEST_BODY_LIMIT }));

app.use(
  "/uploads",
  express.static(imageStorageService.rootDirectory, {
    dotfiles: "deny",
    index: false,
    maxAge: "1y",
    immutable: true,
    setHeaders(response) {
      response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      response.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);

app.use(env.API_PREFIX, apiRouter);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);
