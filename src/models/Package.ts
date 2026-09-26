import { Schema, model, type InferSchemaType } from "mongoose";

const packageSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Region shown as a filter on the website, e.g. "Kerala", "Asia"
    destination: { type: String, required: true, trim: true },
    nights: { type: Number, required: true, min: 0 },
    days: { type: Number, required: true, min: 1 },
    summary: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    route: [{ _id: false, place: { type: String, required: true }, nights: { type: Number, default: 0 } }],
    itinerary: [{ _id: false, title: { type: String, required: true }, text: { type: String, default: "" } }],
    inclusions: [{ type: String }],
    exclusions: [{ type: String }],
    // Starting price per person in INR; 0 means "price on request"
    price: { type: Number, default: 0, min: 0 },
    coverImage: { type: String, default: "" },
    gallery: [{ type: String }],
    featured: { type: Boolean, default: false },
    published: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type PackageDoc = InferSchemaType<typeof packageSchema>;
export const Package = model("Package", packageSchema);
