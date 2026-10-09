import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { organization_branding, organizations } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getMember } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { logActivity } from '@/lib/activity.server';

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

const brandingSchema = z.object({
  enabled: z.boolean(),
  display_name: optionalText(120),
  tagline: optionalText(160),
  contact_email: z.string().trim().email('Enter a valid contact email').optional().nullable().or(z.literal('')),
  contact_phone: optionalText(40),
  address: optionalText(300),
  website: z.string().trim().url('Enter a full website address, e.g. https://example.com').optional().nullable().or(z.literal('')),
  registration_number: optionalText(60),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Brand color must be a hex color like #097255'),
  template: z.enum(['classic', 'modern', 'minimal']),
  footer_text: optionalText(300),
  confidentiality_notice: optionalText(400),
  show_kpm_attribution: z.boolean(),
  // Only clearing is allowed here; logos are set by uploading (POST /organization/branding/logo)
  logo_url: z.null().optional(),
});

async function adminOrg(userId: string) {
  const member = await getMember(userId);
  if (!member?.organization_id || member.organization_role !== 'Organization Admin') return null;
  return member;
}

// GET: the organization's document branding (defaults when never configured).
export async function GET() {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;
    const member = await adminOrg(user.id);
    if (!member) return NextResponse.json({ error: 'Only Organization Admins can manage document branding' }, { status: 403 });

    const [row] = await db
      .select({ branding: organization_branding, org: { name: organizations.name, website: organizations.website } })
      .from(organizations)
      .leftJoin(organization_branding, eq(organization_branding.organization_id, organizations.id))
      .where(eq(organizations.id, member.organization_id!))
      .limit(1);

    return NextResponse.json({
      organization_name: row?.org.name,
      branding: row?.branding ?? {
        organization_id: member.organization_id,
        enabled: false,
        display_name: null,
        tagline: null,
        logo_url: null,
        contact_email: null,
        contact_phone: null,
        address: null,
        website: row?.org.website ?? null,
        registration_number: null,
        primary_color: '#097255',
        template: 'classic',
        footer_text: null,
        confidentiality_notice: null,
        show_kpm_attribution: true,
      },
    });
  } catch (err) {
    return handleRouteError(err, 'Branding GET exception');
  }
}

// PUT: save the whole branding form.
export async function PUT(request: Request) {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;
    const member = await adminOrg(user.id);
    if (!member) return NextResponse.json({ error: 'Only Organization Admins can manage document branding' }, { status: 403 });

    const result = brandingSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || 'Invalid payload' }, { status: 400 });
    }
    // Empty strings are stored as "not set"
    const values = Object.fromEntries(
      Object.entries(result.data).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? null : v]),
    ) as typeof result.data;
    const orgId = member.organization_id!;

    const [saved] = await db
      .insert(organization_branding)
      .values({ organization_id: orgId, ...values })
      .onConflictDoUpdate({ target: organization_branding.organization_id, set: values })
      .returning();

    await logActivity({
      organizationId: orgId,
      memberId: user.id,
      action: 'Updated',
      entityType: 'Branding',
      entityId: orgId,
      description: saved.enabled
        ? `Updated document branding (${saved.template} template)`
        : 'Switched official documents to the default KPM letterhead',
    });

    return NextResponse.json(saved);
  } catch (err) {
    return handleRouteError(err, 'Branding PUT exception');
  }
}
