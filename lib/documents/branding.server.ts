import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { organization_branding, organizations } from '@/lib/db/schema';

export type DocumentTemplate = 'classic' | 'modern' | 'minimal';

export type DocumentBranding = {
  /** Whose letterhead this is: the KPM default, or the organization's own. */
  source: 'kpm' | 'organization';
  name: string;
  tagline: string | null;
  /** 'kpm' draws the KPM vector logo; an image is the organization's uploaded logo. */
  logo: { kind: 'kpm' } | { kind: 'image'; data: Buffer; format: 'png' | 'jpg' } | null;
  contactLines: string[];
  address: string | null;
  registrationNumber: string | null;
  primaryColor: string;
  template: DocumentTemplate;
  footerText: string | null;
  confidentialityNotice: string;
  showAttribution: boolean;
};

// KPM palette (see scripts/generate-kpm-logos.js)
export const KPM_COLORS = { green: '#097255', orange: '#ec7b23', navy: '#1b4580' };

const DEFAULT_CONFIDENTIALITY = 'Confidential. Prepared for internal use by the organization named in this document.';

/** The default letterhead. Contact details come from the environment so they can be set per deployment. */
export function kpmBranding(): DocumentBranding {
  const contactLines = [process.env.KPM_DOCS_CONTACT_EMAIL, process.env.KPM_DOCS_PHONE, process.env.KPM_DOCS_WEBSITE].filter(
    (v): v is string => !!v,
  );
  return {
    source: 'kpm',
    name: 'KPM',
    tagline: 'Kapuletu Project Manager · Kapuletu Systems',
    logo: { kind: 'kpm' },
    contactLines,
    address: process.env.KPM_DOCS_ADDRESS || null,
    registrationNumber: null,
    primaryColor: KPM_COLORS.green,
    template: 'classic',
    footerText: null,
    confidentialityNotice: DEFAULT_CONFIDENTIALITY,
    showAttribution: true,
  };
}

// ---------------------------------------------------------------------------
// Logos: only images uploaded to this deployment's Cloudinary account are embedded.
// Fetching arbitrary URLs from the server would let anyone make it request internal
// addresses, so other hosts are ignored.
// ---------------------------------------------------------------------------

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const logoCache = new Map<string, { data: Buffer; format: 'png' | 'jpg'; at: number }>();

export function isTrustedLogoUrl(url: string): boolean {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'res.cloudinary.com' && !!cloud && u.pathname.startsWith(`/${cloud}/image/upload/`);
  } catch {
    return false;
  }
}

async function loadLogo(url: string): Promise<{ data: Buffer; format: 'png' | 'jpg' } | null> {
  if (!isTrustedLogoUrl(url)) return null;
  const cached = logoCache.get(url);
  if (cached && Date.now() - cached.at < 60 * 60 * 1000) return cached;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    const format = type.includes('png') ? 'png' : type.includes('jpeg') || type.includes('jpg') ? 'jpg' : null;
    if (!format) return null;
    const data = Buffer.from(await res.arrayBuffer());
    if (data.length > MAX_LOGO_BYTES) return null;
    const entry = { data, format: format as 'png' | 'jpg', at: Date.now() };
    logoCache.set(url, entry);
    if (logoCache.size > 200) logoCache.delete(logoCache.keys().next().value!);
    return entry;
  } catch {
    return null;
  }
}

/** The letterhead for an organization's documents: its own once enabled, otherwise KPM's. */
export async function getDocumentBranding(organizationId: string): Promise<DocumentBranding> {
  const [row] = await db
    .select({ branding: organization_branding, org: { name: organizations.name, website: organizations.website, logo_url: organizations.logo_url } })
    .from(organizations)
    .leftJoin(organization_branding, eq(organization_branding.organization_id, organizations.id))
    .where(eq(organizations.id, organizationId))
    .limit(1);

  const b = row?.branding;
  if (!row || !b?.enabled) return kpmBranding();

  const logoUrl = b.logo_url || row.org.logo_url;
  const logo = logoUrl ? await loadLogo(logoUrl) : null;
  const website = b.website || row.org.website;

  return {
    source: 'organization',
    name: b.display_name?.trim() || row.org.name,
    tagline: b.tagline?.trim() || null,
    logo: logo ? { kind: 'image', ...logo } : null,
    contactLines: [b.contact_email, b.contact_phone, website].filter((v): v is string => !!v?.trim()),
    address: b.address?.trim() || null,
    registrationNumber: b.registration_number?.trim() || null,
    primaryColor: b.primary_color,
    template: b.template as DocumentTemplate,
    footerText: b.footer_text?.trim() || null,
    confidentialityNotice: b.confidentiality_notice?.trim() || DEFAULT_CONFIDENTIALITY,
    showAttribution: b.show_kpm_attribution,
  };
}
