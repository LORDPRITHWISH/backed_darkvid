import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

if (
  !process.env.CLOUDINARY_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  throw new Error("Cloudinary env not set properly");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

type UploadResult = {
  secure_url: string;
  public_id: string;
};

export const uploadToCloudinary = (
  fileBuffer: Buffer,
  folder: string = "general"
): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    // Re-apply config before upload to ensure credentials are set
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `darkvid/uploads/${folder}`,
        resource_type: "image", // 👈 force stability
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return reject(error);
        }

        if (!result) {
          return reject(new Error("Upload failed: no result"));
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );

    Readable.from(fileBuffer).pipe(stream);
  });
};

export const deleteFromCloudinary = async (publicId: string) => {
  try {
    // Re-apply config before delete to ensure credentials are set
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    return await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Delete failed:", err);
    return null;
  }
};

const getCloudinaryPublicId = (assetUrl: string) => {
  const withoutQuery = assetUrl.split("?")[0];
  const uploadIndex = withoutQuery.indexOf("/upload/");

  if (uploadIndex === -1) {
    return assetUrl;
  }

  const pathAfterUpload = withoutQuery.slice(uploadIndex + "/upload/".length);
  const withoutVersion = pathAfterUpload.replace(/^v\d+\//, "");
  return withoutVersion.replace(/\.[^/.]+$/, "");
};

export { getCloudinaryPublicId };
export default cloudinary;
