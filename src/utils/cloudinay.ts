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

export const uploadToCloudinary = async (
  fileBuffer: Buffer,
  folder: string = "general"
): Promise<UploadResult> => {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // Convert buffer to base64 Data URI to bypass broken stream chunking in Cloudinary SDK
    const b64 = fileBuffer.toString("base64");
    const dataURI = "data:image/auto;base64," + b64;

    const result = await cloudinary.uploader.upload(dataURI, {
      folder: `darkvid/uploads/${folder}`,
      resource_type: "auto",
    });

    if (!result) {
      throw new Error("Upload failed: no result");
    }

    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
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
