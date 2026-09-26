import type { RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { HttpError } from "../lib/http.js";

type TokenPayload = { sub: string };

export function signToken(adminId: string): string {
  return jwt.sign({ sub: adminId } satisfies TokenPayload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

function readAdminId(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as TokenPayload;
    return payload.sub;
  } catch {
    return null;
  }
}

export function adminIdOf(res: Response): string | undefined {
  return res.locals.adminId as string | undefined;
}

/** Rejects the request unless it carries a valid admin token. */
export const requireAuth: RequestHandler = (req, res, next) => {
  const adminId = readAdminId(req.headers.authorization);
  if (!adminId) throw new HttpError(401, "Please log in");
  res.locals.adminId = adminId;
  next();
};

/** Public routes use this to show unpublished items to a logged-in admin. */
export const optionalAuth: RequestHandler = (req, res, next) => {
  const adminId = readAdminId(req.headers.authorization);
  if (adminId) res.locals.adminId = adminId;
  next();
};
