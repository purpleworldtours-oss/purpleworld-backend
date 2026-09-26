import { Schema, model, type InferSchemaType } from "mongoose";

export const enquiryStatuses = ["new", "contacted", "closed"] as const;

// A "Start Your Journey" form submission from the website
const enquirySchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    travelDate: { type: String, required: true },
    destination: { type: String, required: true, trim: true },
    budget: { type: String, required: true, trim: true },
    travelers: { type: Number, required: true, min: 1 },
    notes: { type: String, default: "" },
    status: { type: String, enum: enquiryStatuses, default: "new", index: true },
    // Private notes the team adds while following up
    adminNotes: { type: String, default: "" },
  },
  { timestamps: true },
);

export type EnquiryDoc = InferSchemaType<typeof enquirySchema>;
export const Enquiry = model("Enquiry", enquirySchema);
