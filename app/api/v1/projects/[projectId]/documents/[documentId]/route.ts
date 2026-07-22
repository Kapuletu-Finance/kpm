import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deleteFromCloudinary } from '@/lib/cloudinary';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ projectId: string, documentId: string }> }) {
  try {
    const { projectId, documentId } = await params;
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Ensure user has access
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

    // Get the document to find the Cloudinary URL
    const { data: doc, error: fetchError } = await supabase
      .from('project_documents')
      .select('cloudinary_url')
      .eq('id', documentId)
      .eq('project_id', projectId)
      .single();
      
    if (fetchError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Attempt to extract public_id and delete from Cloudinary
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

    // Delete from Database
    const { error } = await supabase
      .from('project_documents')
      .delete()
      .eq('id', documentId)
      .eq('project_id', projectId);

    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
