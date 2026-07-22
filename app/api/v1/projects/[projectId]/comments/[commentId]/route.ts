import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function verifyAccess(supabase: any, user: any, projectId: string) {
  const { data: projectAccess } = await supabase
    .from('project_members')
    .select('project_role')
    .eq('project_id', projectId)
    .eq('member_id', user.id)
    .single();
    
  if (projectAccess) return { hasAccess: true, role: projectAccess.project_role };

  const { data: callerMember } = await supabase
    .from('members')
    .select('organization_role')
    .eq('id', user.id)
    .single();

  if (callerMember?.organization_role === 'Organization Admin') {
    return { hasAccess: true, role: 'Organization Admin' };
  }

  return { hasAccess: false };
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string, commentId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, commentId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess, role } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Check ownership
    const { data: existingComment, error: fetchError } = await supabase
      .from('comments')
      .select('member_id')
      .eq('id', commentId)
      .single();

    if (fetchError || !existingComment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const canManage = role === 'Organization Admin' || role === 'Project Manager';
    if (!canManage && existingComment.member_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
