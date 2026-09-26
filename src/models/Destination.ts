import { Schema, model, type InferSchemaType } from "mongoose";

// A card in the website's "Featured Destinations" section
const destinationSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
    image: { type: String, default: "" },
    // Optional page the card opens, e.g. "/kerala" or "/packages?destination=Kerala"
    link: { type: String, default: "" },
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type DestinationDoc = InferSchemaType<typeof destinationSchema>;
export const Destination = model("Destination", destinationSchema);
