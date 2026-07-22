import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { z } from 'zod';

const documentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.enum(['Requirements', 'Architecture', 'Research', 'Meeting Minutes', 'Contracts', 'Other']).default('Other'),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: documents, error } = await supabase
      .from('project_documents')
      .select(`
        *,
        members:uploaded_by (
          id,
          first_name,
          last_name,
          avatar_url
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(documents);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Validate access (Project Manager or Admin or assigned to project)
    const { data: member } = await supabase
      .from('members')
      .select('organization_role')
      .eq('id', user.id)
      .single();

    const { data: projectMember } = await supabase
      .from('project_members')
      .select('project_role')
      .eq('project_id', projectId)
      .eq('member_id', user.id)
      .single();

    if (!member && !projectMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string;
    const category = formData.get('category') as string;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    // Validate textual data
    const result = documentSchema.safeParse({ title, category });
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || 'Validation error' }, { status: 400 });
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudinary
    const safeTitle = result.data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${safeTitle}_${Date.now()}`;
    const folder = `kpm/projects/${projectId}/documents`;
    
    const secure_url = await uploadToCloudinary(buffer, folder, filename);

    // Save to database
    const { data: doc, error } = await supabase
      .from('project_documents')
      .insert({
        project_id: projectId,
        title: result.data.title,
        category: result.data.category,
        cloudinary_url: secure_url,
        uploaded_by: user.id
      })
      .select()
      .single();

    if (error) throw error;
    
    return NextResponse.json(doc, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
