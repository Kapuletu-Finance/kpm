import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Files that run in a browser when opened from the upload's public URL.
const BLOCKED_EXTENSIONS = /\.(html?|xhtml|svg|js|mjs|exe|bat|cmd|sh|ps1|msi|dll|jar|php)$/i;
const BLOCKED_TYPES = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|application\/(x-)?javascript|text\/javascript)/i;

/** Returns an error message when a file must not be uploaded, else null. */
export function validateUpload(file: File | null): string | null {
  if (!file || typeof file === 'string') return 'No file provided';
  if (file.size === 0) return 'The file is empty';
  if (file.size > MAX_UPLOAD_BYTES) return `Files must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller`;
  if (BLOCKED_EXTENSIONS.test(file.name) || BLOCKED_TYPES.test(file.type)) return 'This file type is not allowed';
  return null;
}

export async function uploadToCloudinary(buffer: Buffer, folder: string, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        public_id: filename,
        use_filename: true,
      },
      (error, result) => {
        if (error || !result) {
          console.error('Cloudinary upload error:', error);
          reject(error || new Error('Upload failed'));
        } else {
          resolve(result.secure_url);
        }
      }
    );

    uploadStream.end(buffer);
  });
}

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        console.error('Cloudinary delete error:', error);
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
