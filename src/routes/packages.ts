import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { HttpError } from "../lib/http.js";
import { slugify } from "../lib/slug.js";
import { adminIdOf, optionalAuth, requireAuth } from "../middleware/auth.js";
import { Package } from "../models/Package.js";

export const packagesRouter = Router();

const lines = z.array(z.string().trim()).transform((items) => items.filter(Boolean)).default([]);

const packageSchema = z.object({
  title: z.string({ error: "Title is required" }).trim().min(1, "Title is required").max(120),
  slug: z.string().trim().default(""),
  destination: z.string({ error: "Destination is required" }).trim().min(1, "Destination is required").max(60),
  nights: z.coerce.number({ error: "Enter the number of nights" }).int().min(0, "Can't be negative"),
  days: z.coerce.number({ error: "Enter the number of days" }).int().min(1, "At least 1 day"),
  summary: z.string({ error: "Summary is required" }).trim().min(1, "Summary is required").max(500),
  description: z.string().trim().default(""),
  route: z
    .array(z.object({ place: z.string().trim(), nights: z.coerce.number().int().min(0).default(0) }))
    .transform((stops) => stops.filter((s) => s.place))
    .default([]),
  itinerary: z
    .array(z.object({ title: z.string().trim(), text: z.string().trim().default("") }))
    .transform((days) => days.filter((d) => d.title))
    .default([]),
  inclusions: lines,
  exclusions: lines,
  price: z.coerce.number().min(0).default(0),
  coverImage: z.string().trim().default(""),
  gallery: lines,
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
  order: z.coerce.number().int().default(0),
});

function parsePackage(body: unknown) {
  const data = packageSchema.parse(body);
  const slug = slugify(data.slug || data.title);
  if (!slug) throw new z.ZodError([{ code: "custom", path: ["slug"], message: "Slug is required", input: data.slug }]);
  return { ...data, slug };
}

// Website: published packages, optionally ?destination=Kerala or ?featured=1.
// Admin (?all=1): drafts too.
packagesRouter.get("/", optionalAuth, async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (!(req.query.all === "1" && adminIdOf(res))) filter.published = true;
  if (typeof req.query.destination === "string" && req.query.destination) {
    filter.destination = req.query.destination;
  }
  if (req.query.featured === "1") filter.featured = true;
  res.json(await Package.find(filter).sort({ order: 1, createdAt: -1 }));
});

// Distinct destinations with at least one published package, for filters
packagesRouter.get("/destinations", async (_req, res) => {
  const names = await Package.distinct("destination", { published: true });
  res.json(names.sort());
});

// By slug (website) or id (admin editor)
packagesRouter.get("/:key", optionalAuth, async (req, res) => {
  const key = String(req.params.key);
  const pkg = mongoose.isValidObjectId(key)
    ? await Package.findById(key)
    : await Package.findOne({ slug: key.toLowerCase() });
  if (!pkg || (!pkg.published && !adminIdOf(res))) throw new HttpError(404, "Package not found");
  res.json(pkg);
});

packagesRouter.post("/", requireAuth, async (req, res) => {
  const pkg = await Package.create(parsePackage(req.body));
  res.status(201).json(pkg);
});

packagesRouter.put("/:id", requireAuth, async (req, res) => {
  const pkg = await Package.findByIdAndUpdate(req.params.id, parsePackage(req.body), {
    new: true,
    runValidators: true,
  });
  if (!pkg) throw new HttpError(404, "Package not found");
  res.json(pkg);
});

// Quick toggles from the list view (publish / feature)
packagesRouter.patch("/:id", requireAuth, async (req, res) => {
  const patch = z
    .object({ published: z.boolean().optional(), featured: z.boolean().optional() })
    .strict()
    .parse(req.body);
  const pkg = await Package.findByIdAndUpdate(req.params.id, patch, { new: true });
  if (!pkg) throw new HttpError(404, "Package not found");
  res.json(pkg);
});

packagesRouter.delete("/:id", requireAuth, async (req, res) => {
  const pkg = await Package.findByIdAndDelete(req.params.id);
  if (!pkg) throw new HttpError(404, "Package not found");
  res.status(204).end();
});
