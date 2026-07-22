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
  { params }: { params: Promise<{ projectId: string, featureId: string, deliverableId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, featureId, deliverableId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess, role } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Ensure it belongs to the feature
    const { data: existing, error: fetchError } = await supabase
      .from('deliverables')
      .select('member_id')
      .eq('id', deliverableId)
      .eq('entity_id', featureId)
      .single();
      
    if (fetchError || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Only allow deletion if the user is the submitter or an admin/manager
    if (existing.member_id !== user.id && role !== 'Organization Admin' && role !== 'Project Manager') {
      return NextResponse.json({ error: 'Insufficient permissions to delete this deliverable' }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from('deliverables')
      .delete()
      .eq('id', deliverableId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
