import { unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { config } from "../config.js";
import { deleteImage, uploadImage } from "../lib/cloudinary.js";
import { HttpError } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";
import { Destination } from "../models/Destination.js";
import { Media } from "../models/Media.js";
import { Package } from "../models/Package.js";

export const mediaRouter = Router();
mediaRouter.use(requireAuth);

const uploadDir = fileURLToPath(config.uploadDir);
const allowed: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
};

// Files are held in memory just long enough to send them to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (allowed[file.mimetype]) cb(null, true);
    else cb(new HttpError(400, `${file.originalname}: only JPG, PNG, WebP, AVIF or GIF images are allowed`));
  },
});

mediaRouter.get("/", async (_req, res) => {
  res.json(await Media.find().sort({ createdAt: -1 }));
});

mediaRouter.post("/", upload.array("files"), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) throw new HttpError(400, "Choose at least one image");
  const uploaded = await Promise.all(files.map((file) => uploadImage(file.buffer)));
  const media = await Media.insertMany(
    files.map((file, i) => ({
      filename: uploaded[i].public_id,
      originalName: file.originalname,
      url: uploaded[i].secure_url,
      mimeType: file.mimetype,
      size: file.size,
      alt: path.parse(file.originalname).name.replace(/[-_]+/g, " "),
    })),
  );
  res.status(201).json(media);
});

mediaRouter.patch("/:id", async (req, res) => {
  const { alt } = z.object({ alt: z.string().trim().max(200) }).parse(req.body);
  const media = await Media.findByIdAndUpdate(req.params.id, { alt }, { new: true });
  if (!media) throw new HttpError(404, "Image not found");
  res.json(media);
});

/** Where an image is used, so the admin isn't surprised by broken pages. */
async function usageOf(url: string) {
  const [packages, destinations] = await Promise.all([
    Package.find({ $or: [{ coverImage: url }, { gallery: url }] }, "title"),
    Destination.find({ image: url }, "title"),
  ]);
  return [
    ...packages.map((p) => `Package: ${p.title}`),
    ...destinations.map((d) => `Destination: ${d.title}`),
  ];
}

mediaRouter.get("/:id/usage", async (req, res) => {
  const media = await Media.findById(req.params.id);
  if (!media) throw new HttpError(404, "Image not found");
  res.json(await usageOf(media.url));
});

// Refuses while the image is in use, unless ?force=1
mediaRouter.delete("/:id", async (req, res) => {
  const media = await Media.findById(req.params.id);
  if (!media) throw new HttpError(404, "Image not found");
  const usedBy = await usageOf(media.url);
  if (usedBy.length > 0 && req.query.force !== "1") {
    res.status(409).json({ error: "This image is still in use", usedBy });
    return;
  }
  await media.deleteOne();
  // Images from before the Cloudinary switch are still local files
  if (media.url.startsWith("/uploads/")) {
    await unlink(path.join(uploadDir, media.filename)).catch(() => {});
  } else {
    await deleteImage(media.filename).catch((err) => console.error("Cloudinary delete failed", err));
  }
  res.status(204).end();
});
