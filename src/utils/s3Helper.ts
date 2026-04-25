// utils/s3.ts
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type StorageProvider = "aws" | "vultr";

const requiredEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
};

const configuredProvider = process.env.OBJECT_STORAGE_PROVIDER?.toLowerCase();
const provider: StorageProvider =
  configuredProvider === "vultr" ? "vultr" : "aws";

const awsRegion = process.env.AWS_REGION || "us-east-1";
const vultrHostname =
  process.env.VULTR_HOSTNAME || "";

if (provider === "vultr" && !vultrHostname) {
  throw new Error("VULTR_HOSTNAME environment variable is not set");
}

const BUCKET =
  provider === "vultr" ? requiredEnv("VULTR_BUCKET") : requiredEnv("S3_BUCKET");

const s3 = new S3Client(
  provider === "vultr"
    ? {
        region: awsRegion,
        endpoint: `https://${vultrHostname}`,
        forcePathStyle: false,
        credentials: {
          accessKeyId: requiredEnv("VULTR_ACCESS_KEY"),
          secretAccessKey: requiredEnv("VULTR_SECRET_KEY"),
        },
      }
    : {
        region: requiredEnv("AWS_REGION"),
        credentials: {
          accessKeyId: requiredEnv("AWS_ACCESS_KEY_ID"),
          secretAccessKey: requiredEnv("AWS_SECRET_ACCESS_KEY"),
        },
      }
);

const objectPublicBaseUrl =
  provider === "vultr"
    ? `https://${BUCKET}.${vultrHostname}`
    : `https://${BUCKET}.s3.${requiredEnv("AWS_REGION")}.amazonaws.com`;

if (
  configuredProvider &&
  configuredProvider !== "aws" &&
  configuredProvider !== "vultr"
) {
  console.warn(
    `Unsupported OBJECT_STORAGE_PROVIDER "${configuredProvider}", defaulting to "aws".`
  );
}

export const getObjectPublicUrl = (key: string) =>
  `${objectPublicBaseUrl}/${key}`;

export async function initMultipartUpload(key: string, contentType: string) {
  const command = new CreateMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const resp = await s3.send(command);

  return {
    uploadId: resp.UploadId!,
    videoUrl: getObjectPublicUrl(key),
  };
}

export async function getPresignedUrl(
  key: string,
  uploadId: string,
  partNumber: number
) {
  const command = new UploadPartCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });

  return await getSignedUrl(s3, command, { expiresIn: 3000 }); // 5 min
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { ETag: string; PartNumber: number }[]
) {
  const command = new CompleteMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  });

  const resp = await s3.send(command);
  return resp.Location;
}

export async function uploadImage(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    // Body: body,
    ContentType: contentType,
    // ACL: "public-read",
  });

  // const resp = await s3.send(command);
  const resp = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour

  // console.log("Image upload response:", resp);
  return resp;
}

export const getVideoUrl = async (key: string) => {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  // expires in 1 hour
  return await getSignedUrl(s3, command, { expiresIn: 3600 });
};
