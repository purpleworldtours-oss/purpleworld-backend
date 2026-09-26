import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { HttpError } from "../lib/http.js";
import { adminIdOf, requireAuth, signToken } from "../middleware/auth.js";
import { Admin } from "../models/Admin.js";

export const authRouter = Router();

// Slow down password guessing: 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again in 15 minutes." },
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  password: z.string().min(1, "Enter your password"),
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const admin = await Admin.findOne({ email }).select("+passwordHash");
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    throw new HttpError(401, "Incorrect email or password");
  }
  res.json({
    token: signToken(admin.id),
    admin: { id: admin.id, name: admin.name, email: admin.email },
  });
});

authRouter.get("/me", requireAuth, async (_req, res) => {
  const admin = await Admin.findById(adminIdOf(res));
  if (!admin) throw new HttpError(401, "Please log in");
  res.json({ id: admin.id, name: admin.name, email: admin.email });
});
