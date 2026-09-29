import { Schema, model, type InferSchemaType } from "mongoose";

// An uploaded image. The file lives on Cloudinary (`filename` is its public id);
// `url` is what pages store.
const mediaSchema = new Schema(
  {
    filename: { type: String, required: true, unique: true },
    originalName: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    alt: { type: String, default: "" },
  },
  { timestamps: true },
);

export type MediaDoc = InferSchemaType<typeof mediaSchema>;
export const Media = model("Media", mediaSchema);
