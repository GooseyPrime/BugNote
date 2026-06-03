import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./config/index.js";

let s3: S3Client | null = null;

function getS3(): S3Client | null {
  if (!env.SPACES_ENDPOINT || !env.SPACES_KEY || !env.SPACES_SECRET) {
    return null;
  }
  if (!s3) {
    s3 = new S3Client({
      endpoint: env.SPACES_ENDPOINT,
      region: "us-east-1",
      credentials: {
        accessKeyId: env.SPACES_KEY,
        secretAccessKey: env.SPACES_SECRET,
      },
      forcePathStyle: false,
    });
  }
  return s3;
}

function decodeDataUrl(dataUrl: string): Buffer | null {
  const m = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  const b64 = m?.[1];
  if (!b64) return null;
  return Buffer.from(b64, "base64");
}

export async function uploadScreenshot(
  appId: string,
  reportId: string,
  dataUrl: string,
): Promise<string | null> {
  const client = getS3();
  if (!client) return null;
  const body = decodeDataUrl(dataUrl);
  if (!body) return null;
  const key = `screenshots/${appId}/${reportId}.png`;
  await client.send(
    new PutObjectCommand({
      Bucket: env.SPACES_BUCKET,
      Key: key,
      Body: body,
      ContentType: "image/png",
      ACL: "private",
    }),
  );
  return key;
}

export async function signedScreenshotUrl(key: string): Promise<string> {
  const client = getS3();
  if (!client) throw new Error("Spaces not configured");
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: env.SPACES_BUCKET, Key: key }),
    { expiresIn: 300 },
  );
}
