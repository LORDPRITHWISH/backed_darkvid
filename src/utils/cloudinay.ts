import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

if (
  !process.env.CLOUDINARY_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  throw new Error("Cloudinary env not set properly");
}

const getCloudinaryConfig = () => ({
  cloud_name: process.env.CLOUDINARY_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const uploadFile = async (
  localFilePath: string,
  folder: string = "general"
) => {
  try {
    if (!localFilePath || !fs.existsSync(localFilePath)) {
      return null;
    }

    // Re-apply config before every upload to avoid credential loss between calls
    cloudinary.config(getCloudinaryConfig());
    console.log("CLOUDINARY CONFIG:", cloudinary.config());

    const uploadResult = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder: `darkvid/uploads/${folder}`,
    });
    console.log(`file uploaded to cloudinary: ${uploadResult.secure_url}`);
    return uploadResult;
  } catch (error) {
    console.log(error);
    return null;
    } finally {
      if (localFilePath && fs.existsSync(localFilePath)) {
        // fs.unlinkSync(localFilePath);
        await fs.promises.unlink(localFilePath).catch(() => {});
      }
  }
};

const deleteFile = async (publicId: string) => {
  try {
    cloudinary.config(getCloudinaryConfig());
    const deleteResult = await cloudinary.uploader.destroy(publicId);
    console.log("cloudinary deleted", deleteResult);
    return deleteResult;
  } catch (error) {
    console.log("Dark:error deleting from cloudinary", error);
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

export { uploadFile, deleteFile, getCloudinaryPublicId };
