import type { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, "Not found"));
};

// Express 5 forwards rejected promises here, so route handlers can just throw
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    res.status(400).json({
      error: "Validation failed",
      fields: Object.fromEntries(err.issues.map((i) => [i.path.join("."), i.message])),
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Image is larger than 5 MB" : err.message;
    res.status(400).json({ error: message });
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // Duplicate key, e.g. two packages with the same slug
  if ((err as { code?: number }).code === 11000) {
    const field = Object.keys((err as { keyValue?: object }).keyValue ?? {})[0] ?? "value";
    res.status(409).json({ error: `That ${field} is already in use`, fields: { [field]: "Already in use" } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
};
