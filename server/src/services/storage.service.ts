import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { env } from '../config/env';
import { createLogger } from '../lib/logger';
import { BadRequestError, ServiceUnavailableError } from '../lib/errors';

const log = createLogger('storage');

export interface StoredFile {
  key: string;
  url: string;
  size: number;
  mimeType: string;
}

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const assertImage = (file: Express.Multer.File): void => {
  if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
    throw new BadRequestError(
      'Only JPEG, PNG, WebP and HEIC images are accepted',
      'UNSUPPORTED_FILE_TYPE',
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new BadRequestError('Image must be 8MB or smaller', 'FILE_TOO_LARGE');
  }
};

/** `proofs/2026/08/uuid.jpg` — grouped by month so buckets stay browsable. */
const buildKey = (folder: string, originalName: string): string => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const ext = extname(originalName).toLowerCase() || '.jpg';
  return `${folder}/${year}/${month}/${randomUUID()}${ext}`;
};

const localDriver = async (file: Express.Multer.File, folder: string): Promise<StoredFile> => {
  const key = buildKey(folder, file.originalname);
  const fullPath = join(process.cwd(), env.STORAGE_LOCAL_DIR, key);
  await mkdir(join(fullPath, '..'), { recursive: true });
  await writeFile(fullPath, file.buffer);
  return {
    key,
    url: `${env.STORAGE_PUBLIC_URL.replace(/\/$/, '')}/${key}`,
    size: file.size,
    mimeType: file.mimetype,
  };
};

let configured = false;

const configureCloudinary = (): void => {
  if (configured) return;
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new ServiceUnavailableError(
      'File storage is not configured',
      'STORAGE_NOT_CONFIGURED',
    );
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
};

/**
 * Cloudinary upload, streamed straight from the in-memory buffer — the file
 * never touches the API server's disk.
 *
 * `public_id` carries our own key so the asset is traceable back to a booking,
 * and `overwrite: false` means a replayed request can never silently destroy
 * an existing proof photo.
 */
const cloudinaryDriver = (file: Express.Multer.File, folder: string): Promise<StoredFile> => {
  configureCloudinary();

  const key = buildKey(folder, file.originalname);
  // Cloudinary appends its own format extension, so the public_id must not.
  const publicId = `${env.CLOUDINARY_FOLDER}/${key.replace(/\.[^.]+$/, '')}`;

  return new Promise<StoredFile>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: 'image',
        overwrite: false,
        // Proof photos are evidence: strip nothing, but cap absurd dimensions
        // and let Cloudinary pick an efficient format for delivery.
        transformation: [{ width: 2000, height: 2000, crop: 'limit', quality: 'auto:good' }],
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          log.error({ error, publicId }, 'cloudinary upload failed');
          reject(
            new ServiceUnavailableError(
              'We could not upload that image. Please try again.',
              'UPLOAD_FAILED',
            ),
          );
          return;
        }

        resolve({
          key: result.public_id,
          url: result.secure_url,
          size: result.bytes,
          mimeType: file.mimetype,
        });
      },
    );

    stream.end(file.buffer);
  });
};

/**
 * Persists an uploaded image and returns its public URL. Proof-of-collection
 * photos flow through here (driver.md §6).
 */
export const storeImage = async (file: Express.Multer.File, folder: string): Promise<StoredFile> => {
  assertImage(file);
  return env.STORAGE_DRIVER === 'cloudinary'
    ? cloudinaryDriver(file, folder)
    : localDriver(file, folder);
};

export const storeImages = (files: Express.Multer.File[], folder: string): Promise<StoredFile[]> =>
  Promise.all(files.map((file) => storeImage(file, folder)));

/**
 * Removes an asset. Used when a record that owns an image is discarded; proof
 * photos are never deleted, since they exist to settle disputes.
 */
export const deleteImage = async (key: string): Promise<void> => {
  if (env.STORAGE_DRIVER !== 'cloudinary') return;
  try {
    configureCloudinary();
    await cloudinary.uploader.destroy(key);
  } catch (err) {
    log.error({ err, key }, 'failed to delete image');
  }
};
