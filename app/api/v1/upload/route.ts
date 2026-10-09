import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/session';
import { uploadToCloudinary, validateUpload } from '@/lib/cloudinary';

// Uploads a deliverable attachment and returns its URL.
export async function POST(request: Request) {
  try {
    const { response } = await requireApiUser();
    if (response) return response;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    const invalid = validateUpload(file);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const buffer = Buffer.from(await file!.arrayBuffer());
    const url = await uploadToCloudinary(buffer, 'kpm_deliverables', randomUUID());

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
