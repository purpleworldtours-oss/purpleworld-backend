// One-time move of images from the local uploads/ folder to Cloudinary. Rewrites
// the media library and every package and destination that points at them.
// Safe to re-run; images already on Cloudinary are skipped.
import { fileURLToPath } from "node:url";
import path from "node:path";
import mongoose from "mongoose";
import { config } from "./config.js";
import { uploadImage } from "./lib/cloudinary.js";
import { Destination } from "./models/Destination.js";
import { Media } from "./models/Media.js";
import { Package } from "./models/Package.js";

const uploadDir = fileURLToPath(config.uploadDir);

await mongoose.connect(config.mongoUri);

const local = await Media.find({ url: /^\/uploads\// });
console.log(`${local.length} image(s) to move`);

let failed = 0;
for (const media of local) {
  const oldUrl = media.url;
  try {
    const uploaded = await uploadImage(path.join(uploadDir, media.filename));
    const newUrl = uploaded.secure_url;
    await Promise.all([
      Package.updateMany({ coverImage: oldUrl }, { coverImage: newUrl }),
      Package.updateMany({ gallery: oldUrl }, { $set: { "gallery.$[g]": newUrl } }, { arrayFilters: [{ g: oldUrl }] }),
      Destination.updateMany({ image: oldUrl }, { image: newUrl }),
    ]);
    media.url = newUrl;
    media.filename = uploaded.public_id;
    await media.save();
    console.log(`Moved ${media.originalName}`);
  } catch (err) {
    failed++;
    console.error(`Failed ${media.originalName} (${oldUrl}):`, err instanceof Error ? err.message : err);
  }
}

// Anything still pointing at /uploads has no media record to move it from
const [orphanPackages, orphanDestinations] = await Promise.all([
  Package.find({ $or: [{ coverImage: /^\/uploads\// }, { gallery: /^\/uploads\// }] }, "title"),
  Destination.find({ image: /^\/uploads\// }, "title"),
]);
for (const p of orphanPackages) console.warn(`Package "${p.title}" still uses a local image; pick a new one in the admin`);
for (const d of orphanDestinations) console.warn(`Destination "${d.title}" still uses a local image; pick a new one in the admin`);

await mongoose.disconnect();
if (failed > 0) process.exit(1);
