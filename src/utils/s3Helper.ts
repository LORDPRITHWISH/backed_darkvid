// utils/s3.ts
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET!;

if (!BUCKET) {
  throw new Error("S3_BUCKET environment variable is not set");
}

export async function initMultipartUpload(key: string, contentType: string) {
  const command = new CreateMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const resp = await s3.send(command);

  return {
    uploadId: resp.UploadId!,
    videoUrl: `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
  };
}

export async function getPresignedUrl(key: string, uploadId: string, partNumber: number) {
  const command = new UploadPartCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });

  return await getSignedUrl(s3, command, { expiresIn: 3000 }); // 5 min
}

export async function completeMultipartUpload(key: string, uploadId: string, parts: { ETag: string; PartNumber: number }[]) {
  const command = new CompleteMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  });

  const resp = await s3.send(command);
  return resp.Location;
}

export const getVideoUrl = async (key: string) => {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  // expires in 1 hour
  return await getSignedUrl(s3, command, { expiresIn: 3600 });
};
