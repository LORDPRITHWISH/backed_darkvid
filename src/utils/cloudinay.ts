import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, // Click 'View API Keys' above to copy your API secret
});

const uploadFile = async (localFilePath: string) => {
  try {
    if (!localFilePath || !fs.existsSync(localFilePath)) {
      return null;
    }
    const uploadResult = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    console.log(`file uploaded to cloudinary: ${uploadResult.secure_url}`);
    return uploadResult;
  } catch (error) {
    console.log(error);
    return null;
  }
  finally {
    fs.unlinkSync(localFilePath);
  }
};

const deleteFile = async (publicId: string) => {
  try {
    console.log('deleating from cloudinary',publicId);
    const deleteResult = await cloudinary.uploader.destroy(publicId);
    console.log('cloudinary deleated',deleteResult);
    return deleteResult;
  } catch (error) {
    console.log("Dark:error deleating from cloudinary",error);
    return null;
  }
}

export { uploadFile, deleteFile };