import { NextRequest, NextResponse } from 'next/server';
import { desc, eq, getTableColumns } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { members, project_documents } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getProjectAccess, memberSummary } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { uploadToCloudinary, validateUpload } from '@/lib/cloudinary';
import { logActivity } from '@/lib/activity.server';

const documentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.enum(['Requirements', 'Architecture', 'Research', 'Meeting Minutes', 'Contracts', 'Other']).default('Other'),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!(await getProjectAccess(user.id, projectId)).hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const documents = await db
      .select({ ...getTableColumns(project_documents), members: memberSummary })
      .from(project_documents)
      .leftJoin(members, eq(members.id, project_documents.uploaded_by))
      .where(eq(project_documents.project_id, projectId))
      .orderBy(desc(project_documents.created_at));

    return NextResponse.json(documents);
  } catch (error) {
    return handleRouteError(error, 'List documents error');
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!(await getProjectAccess(user.id, projectId)).hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string;
    const category = formData.get('category') as string;

    const invalid = validateUpload(file);
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 });
    }

    const result = documentSchema.safeParse({ title, category });
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || 'Validation error' }, { status: 400 });
    }

    // Upload the file to Cloudinary; only its URL is stored in Postgres
    const buffer = Buffer.from(await file!.arrayBuffer());
    const safeTitle = result.data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${safeTitle}_${Date.now()}`;
    const folder = `kpm/projects/${projectId}/documents`;
    const secure_url = await uploadToCloudinary(buffer, folder, filename);

    const [doc] = await db
      .insert(project_documents)
      .values({
        project_id: projectId,
        title: result.data.title,
        category: result.data.category,
        cloudinary_url: secure_url,
        uploaded_by: user.id
      })
      .returning();

    await logActivity({
      projectId,
      memberId: user.id,
      action: 'Uploaded',
      entityType: 'Document',
      entityId: doc.id,
      description: `Uploaded document: ${doc.title}`,
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Upload document error');
  }
}
