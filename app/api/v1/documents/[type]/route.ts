import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { requireApiUser } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/api/http';
import { logActivity } from '@/lib/activity.server';
import { getDocumentBranding } from '@/lib/documents/branding.server';
import { DOCUMENTS, DocumentError, loadViewer } from '@/lib/documents/catalog.server';
import { documentReference, safeFilename } from '@/lib/documents/text';

// Rendering PDFs needs the Node.js runtime
export const runtime = 'nodejs';

/**
 * GET /api/v1/documents/{type}?... : issues an official PDF on the organization's letterhead.
 * Types: project-status, portfolio, team-performance, sprint-report, meeting-minutes,
 * standup-digest, member-report, release-notes, branding-preview. ?inline=1 opens it in the browser.
 */
export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  try {
    const { type } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const definition = DOCUMENTS[type];
    if (!definition) return NextResponse.json({ error: 'Unknown document type' }, { status: 404 });

    const url = new URL(request.url);
    const { viewer, organizationName } = await loadViewer(user.id);
    const prepared = await definition.prepare({ userId: user.id, viewer, params: url.searchParams });

    const branding = await getDocumentBranding(prepared.organizationId);
    const reference = documentReference(definition.code, branding.source === 'organization' ? branding.name : 'KPM');
    const pdf = await renderToBuffer(
      prepared.render(branding, {
        reference,
        generatedAt: new Date(),
        generatedBy: `${viewer.first_name} ${viewer.last_name}`.trim(),
        organizationName,
      }),
    );

    // Issued documents are part of the audit trail (previews are not)
    if (type !== 'branding-preview') {
      await logActivity({
        organizationId: prepared.organizationId,
        projectId: prepared.projectId ?? null,
        memberId: user.id,
        action: 'Issued',
        entityType: 'Document',
        entityId: prepared.projectId ?? prepared.organizationId,
        description: `Issued ${prepared.title} (${reference})`,
      } as Parameters<typeof logActivity>[0]);
    }

    const filename = safeFilename(prepared.filename);
    const disposition = url.searchParams.get('inline') ? 'inline' : 'attachment';
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(prepared.filename)}`,
        'Cache-Control': 'private, no-store',
        'X-Document-Reference': reference,
      },
    });
  } catch (error) {
    if (error instanceof DocumentError) return NextResponse.json({ error: error.message }, { status: error.status });
    return handleRouteError(error, 'Issue document error');
  }
}
