import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { HttpError } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";
import { Enquiry, enquiryStatuses } from "../models/Enquiry.js";

export const enquiriesRouter = Router();

// Visitors submit straight from the browser; limit bursts per IP to curb spam
const submitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in a few minutes, or call us." },
});

const submitSchema = z.object({
  fullName: z.string({ error: "Enter your name" }).trim().min(1, "Enter your name").max(100),
  phone: z
    .string({ error: "Enter your phone number" })
    .trim()
    .regex(/^\+?[0-9 ]{10,16}$/, "Enter a valid phone number"),
  travelDate: z.string({ error: "Choose a travel date" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a travel date"),
  destination: z.string({ error: "Choose a destination" }).trim().min(1, "Choose a destination").max(60),
  budget: z.string({ error: "Choose a budget" }).trim().min(1, "Choose a budget").max(60),
  travelers: z.coerce.number({ error: "Enter the number of travellers" }).int().min(1).max(100),
  notes: z.string().trim().max(2000).default(""),
  // Honeypot: hidden on the form, so only bots fill it in
  website: z.string().optional(),
});

enquiriesRouter.post("/", submitLimiter, async (req, res) => {
  const { website, ...data } = submitSchema.parse(req.body);
  if (website) {
    // Pretend it worked so bots don't retry
    res.status(201).json({ ok: true });
    return;
  }
  await Enquiry.create(data);
  res.status(201).json({ ok: true });
});

// Everything below is for the admin panel
enquiriesRouter.use(requireAuth);

enquiriesRouter.get("/", async (req, res) => {
  const status = enquiryStatuses.find((s) => s === req.query.status);
  const filter: Record<string, unknown> = status ? { status } : {};
  res.json(await Enquiry.find(filter).sort({ createdAt: -1 }).limit(500));
});

enquiriesRouter.get("/counts", async (_req, res) => {
  const rows = await Enquiry.aggregate<{ _id: string; count: number }>([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(enquiryStatuses.map((s) => [s, 0]));
  for (const row of rows) counts[row._id] = row.count;
  res.json(counts);
});

enquiriesRouter.patch("/:id", async (req, res) => {
  const patch = z
    .object({
      status: z.enum(enquiryStatuses).optional(),
      adminNotes: z.string().trim().max(2000).optional(),
    })
    .strict()
    .parse(req.body);
  const enquiry = await Enquiry.findByIdAndUpdate(req.params.id, patch, { new: true });
  if (!enquiry) throw new HttpError(404, "Enquiry not found");
  res.json(enquiry);
});

enquiriesRouter.delete("/:id", async (req, res) => {
  const enquiry = await Enquiry.findByIdAndDelete(req.params.id);
  if (!enquiry) throw new HttpError(404, "Enquiry not found");
  res.status(204).end();
});
