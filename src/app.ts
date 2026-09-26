import cors from "cors";
import express from "express";
import helmet from "helmet";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { errorHandler, notFound } from "./lib/http.js";
import { authRouter } from "./routes/auth.js";
import { destinationsRouter } from "./routes/destinations.js";
import { enquiriesRouter } from "./routes/enquiries.js";
import { mediaRouter } from "./routes/media.js";
import { packagesRouter } from "./routes/packages.js";

export function createApp() {
  const app = express();
  // Behind a reverse proxy (nginx, Render, etc.) set TRUST_PROXY=1 so rate
  // limits see the visitor's IP instead of the proxy's
  if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY));

  // Uploaded images are shown on the website and admin, which run on other origins
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      // Listed origins, plus any localhost port during development (Vite picks
      // the next free port when 5173 is busy)
      origin: (origin, callback) => {
        const allowed =
          !origin ||
          config.corsOrigins.includes(origin) ||
          (process.env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+$/.test(origin));
        callback(null, allowed);
      },
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.use(
    "/uploads",
    express.static(fileURLToPath(config.uploadDir), {
      maxAge: "30d",
      immutable: true,
    }),
  );

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/auth", authRouter);
  app.use("/api/destinations", destinationsRouter);
  app.use("/api/packages", packagesRouter);
  app.use("/api/media", mediaRouter);
  app.use("/api/enquiries", enquiriesRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
