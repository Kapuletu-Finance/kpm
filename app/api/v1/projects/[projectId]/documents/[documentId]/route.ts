import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { project_documents } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { deleteFromCloudinary } from '@/lib/cloudinary';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ projectId: string, documentId: string }> }) {
  try {
    const { projectId, documentId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const documentInProject = and(eq(project_documents.id, documentId), eq(project_documents.project_id, projectId));

    const [access, [doc]] = await Promise.all([
      getProjectAccess(user.id, projectId),
      db.select({ cloudinary_url: project_documents.cloudinary_url, uploaded_by: project_documents.uploaded_by }).from(project_documents).where(documentInProject).limit(1),
    ]);

    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // The uploader, or a manager, may delete
    if (doc.uploaded_by !== user.id && !canManageProject(access)) {
      return NextResponse.json({ error: 'Only the uploader or a project manager can delete this document' }, { status: 403 });
    }

    // Best effort: remove the file from Cloudinary (public_id is the path after the version segment)
    try {
      const urlParts = doc.cloudinary_url.split('/');
      const versionIndex = urlParts.findIndex((p: string) => p.startsWith('v') && !isNaN(parseInt(p.substring(1))));
      if (versionIndex !== -1) {
        const publicIdWithExtension = urlParts.slice(versionIndex + 1).join('/');
        const publicId = publicIdWithExtension.substring(0, publicIdWithExtension.lastIndexOf('.'));
        if (publicId) {
          await deleteFromCloudinary(publicId);
        }
      }
    } catch (cloudinaryError) {
      console.warn('Failed to delete from Cloudinary, continuing with DB deletion...', cloudinaryError);
    }

    await db.delete(project_documents).where(documentInProject);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'Delete document error');
  }
}
