import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../lib/http.js";
import { adminIdOf, optionalAuth, requireAuth } from "../middleware/auth.js";
import { Destination } from "../models/Destination.js";

export const destinationsRouter = Router();

const destinationSchema = z.object({
  title: z.string({ error: "Title is required" }).trim().min(1, "Title is required").max(80),
  text: z.string({ error: "Description is required" }).trim().min(1, "Description is required").max(400),
  image: z.string().trim().default(""),
  link: z.string().trim().default(""),
  order: z.coerce.number().int().default(0),
  published: z.boolean().default(true),
});

// Website: published cards in display order. Admin (?all=1): everything.
destinationsRouter.get("/", optionalAuth, async (req, res) => {
  const showAll = req.query.all === "1" && adminIdOf(res);
  const filter = showAll ? {} : { published: true };
  res.json(await Destination.find(filter).sort({ order: 1, createdAt: 1 }));
});

destinationsRouter.get("/:id", requireAuth, async (req, res) => {
  const destination = await Destination.findById(req.params.id);
  if (!destination) throw new HttpError(404, "Destination not found");
  res.json(destination);
});

destinationsRouter.post("/", requireAuth, async (req, res) => {
  const destination = await Destination.create(destinationSchema.parse(req.body));
  res.status(201).json(destination);
});

destinationsRouter.put("/:id", requireAuth, async (req, res) => {
  const destination = await Destination.findByIdAndUpdate(
    req.params.id,
    destinationSchema.parse(req.body),
    { new: true, runValidators: true },
  );
  if (!destination) throw new HttpError(404, "Destination not found");
  res.json(destination);
});

destinationsRouter.delete("/:id", requireAuth, async (req, res) => {
  const destination = await Destination.findByIdAndDelete(req.params.id);
  if (!destination) throw new HttpError(404, "Destination not found");
  res.status(204).end();
});
