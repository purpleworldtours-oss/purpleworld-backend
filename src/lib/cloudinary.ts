import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { config } from "../config.js";

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

const FOLDER = "purple-world";

/** Uploads an image (a buffer, or a path on disk) and returns Cloudinary's record of it. */
export function uploadImage(source: Buffer | string): Promise<UploadApiResponse> {
  if (typeof source === "string") {
    return cloudinary.uploader.upload(source, { folder: FOLDER, resource_type: "image" });
  }
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: FOLDER, resource_type: "image" }, (err, result) =>
        err || !result ? reject(err ?? new Error("Cloudinary upload failed")) : resolve(result),
      )
      .end(source);
  });
}

export async function deleteImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
}
