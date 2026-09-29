// One-time setup: creates the first admin and copies the website's current
// destinations and Kerala packages into the database. Safe to re-run; it
// skips anything that already exists.
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { config } from "./config.js";
import { uploadImage } from "./lib/cloudinary.js";
import { Admin } from "./models/Admin.js";
import { Destination } from "./models/Destination.js";
import { Media } from "./models/Media.js";
import { Package } from "./models/Package.js";
// The Kerala itineraries currently hard-coded on the website
import { keralaPackages } from "../../purple-frontend/src/data/kerala.ts";

const frontendImages = fileURLToPath(new URL("../../purple-frontend/public/images/", import.meta.url));

/** Uploads a website image to Cloudinary and registers it in the media library. */
async function importImage(file: string, alt: string): Promise<string> {
  const existing = await Media.findOne({ originalName: file });
  if (existing) return existing.url;
  const source = path.join(frontendImages, file);
  const { size } = await stat(source);
  const uploaded = await uploadImage(source);
  const media = await Media.create({
    filename: uploaded.public_id,
    originalName: file,
    url: uploaded.secure_url,
    mimeType: path.extname(file) === ".png" ? "image/png" : "image/jpeg",
    size,
    alt,
  });
  return media.url;
}

await mongoose.connect(config.mongoUri);

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password || password === "change-me") {
  throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before seeding");
}
// The admin password lives in .env only; re-running the seed applies any change
const existing = await Admin.findOne({ email: email.toLowerCase() }).select("+passwordHash");
if (existing) {
  if (await bcrypt.compare(password, existing.passwordHash)) {
    console.log(`Admin ${email} is up to date`);
  } else {
    existing.passwordHash = await bcrypt.hash(password, 12);
    await existing.save();
    console.log(`Updated the password for ${email} from .env`);
  }
} else {
  await Admin.create({ name: "Admin", email, passwordHash: await bcrypt.hash(password, 12) });
  console.log(`Created admin ${email}`);
}

if ((await Destination.countDocuments()) === 0) {
  const destinations = [
    {
      file: "destination-asia.jpg",
      title: "Asian Immersion",
      text: "From the neon streets of Tokyo to the serene temples of Bali, we offer cultural deep-dives that go beyond the typical tourist corridors.",
      link: "",
    },
    {
      file: "destination-india.jpg",
      title: "The Indian Greatness",
      text: "Explore the rugged beauty or the versatile vibrant culture with itineraries that balance adventure with comfort.",
      link: "",
    },
    {
      file: "destination-kerala.jpg",
      title: "Captivating Kerala",
      text: "Tea hills in Munnar, houseboat nights in Alleppey, Wayanad's forests and Kovalam's beaches, all in one enchanting state.",
      link: "/kerala",
    },
  ];
  for (const [order, d] of destinations.entries()) {
    const image = await importImage(d.file, d.title);
    await Destination.create({ title: d.title, text: d.text, image, link: d.link, order });
  }
  console.log(`Added ${destinations.length} destinations`);
} else {
  console.log("Destinations already exist, skipped");
}

if ((await Package.countDocuments()) === 0) {
  const cover = await importImage("destination-kerala.jpg", "Kerala backwaters at sunset");
  for (const [order, p] of keralaPackages.entries()) {
    const nights = p.route.reduce((sum, stop) => sum + (stop.nights ?? 0), 0);
    await Package.create({
      title: p.name,
      slug: p.slug,
      destination: "Kerala",
      nights,
      days: nights + 1,
      summary: p.summary,
      route: p.route.map((stop) => ({ place: stop.place, nights: stop.nights ?? 0 })),
      itinerary: p.days,
      coverImage: cover,
      featured: order < 2,
      order,
    });
  }
  console.log(`Added ${keralaPackages.length} Kerala packages`);
} else {
  console.log("Packages already exist, skipped");
}

await mongoose.disconnect();
