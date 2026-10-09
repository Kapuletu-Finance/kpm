import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { organization_branding } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getMember } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { logActivity } from '@/lib/activity.server';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** Recognizes PNG and JPEG by their first bytes (the declared type can be anything). */
function sniffImage(buf: Buffer): 'png' | 'jpg' | null {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  return null;
}

// POST multipart { file } : uploads the letterhead logo (PNG or JPEG, up to 2 MB).
export async function POST(request: Request) {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;
    const member = await getMember(user.id);
    if (!member?.organization_id || member.organization_role !== 'Organization Admin') {
      return NextResponse.json({ error: 'Only Organization Admins can change the logo' }, { status: 403 });
    }

    const file = (await request.formData()).get('file');
    if (!file || typeof file === 'string') return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (file.size > MAX_LOGO_BYTES) return NextResponse.json({ error: 'Logos must be 2 MB or smaller' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    // PDF documents can embed PNG and JPEG only
    if (!sniffImage(buffer)) return NextResponse.json({ error: 'Upload a PNG or JPEG image' }, { status: 400 });

    const orgId = member.organization_id;
    const url = await uploadToCloudinary(buffer, `kpm/organizations/${orgId}/branding`, `logo-${Date.now()}`);

    const [saved] = await db
      .insert(organization_branding)
      .values({ organization_id: orgId, logo_url: url })
      .onConflictDoUpdate({ target: organization_branding.organization_id, set: { logo_url: url } })
      .returning();

    await logActivity({
      organizationId: orgId,
      memberId: user.id,
      action: 'Updated',
      entityType: 'Branding',
      entityId: orgId,
      description: 'Uploaded a new document logo',
    });

    return NextResponse.json(saved);
  } catch (err) {
    return handleRouteError(err, 'Branding logo upload exception');
  }
}

// DELETE: removes the logo (documents fall back to the name as a wordmark).
export async function DELETE() {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;
    const member = await getMember(user.id);
    if (!member?.organization_id || member.organization_role !== 'Organization Admin') {
      return NextResponse.json({ error: 'Only Organization Admins can change the logo' }, { status: 403 });
    }
    await db.update(organization_branding).set({ logo_url: null }).where(eq(organization_branding.organization_id, member.organization_id));
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError(err, 'Branding logo delete exception');
  }
}
