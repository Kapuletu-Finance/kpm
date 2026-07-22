import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function verifyAccess(supabase: any, user: any, projectId: string) {
  const { data: callerMember } = await supabase
    .from('members')
    .select('organization_id, organization_role')
    .eq('id', user.id)
    .single();

  if (!callerMember) return { hasAccess: false };

  if (callerMember.organization_role === 'Organization Admin') {
    return { hasAccess: true, role: 'Organization Admin' };
  }

  const { data: projectAccess } = await supabase
    .from('project_members')
    .select('project_role')
    .eq('project_id', projectId)
    .eq('member_id', user.id)
    .single();

  return { hasAccess: !!projectAccess, role: projectAccess?.project_role };
}

// Verify Feature belongs to this project
async function verifyFeatureProject(supabase: any, featureId: string, projectId: string) {
  const { data: check } = await supabase
    .from('features')
    .select('id, modules!inner(roadmaps!inner(project_id))')
    .eq('id', featureId)
    .eq('modules.roadmaps.project_id', projectId)
    .single();
  
  return !!check;
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; featureId: string; memberId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, featureId, memberId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess, role } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (role !== 'Organization Admin' && role !== 'Project Manager') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!(await verifyFeatureProject(supabase, featureId, projectId))) {
      return NextResponse.json({ error: 'Feature not found in this project' }, { status: 404 });
    }

    // `memberId` here is actually the ID in `feature_members` (or the actual `member_id` depending on how frontend calls it. Let's assume frontend passes the `member_id`).
    const { error: deleteError } = await supabase
      .from('feature_members')
      .delete()
      .eq('feature_id', featureId)
      .eq('member_id', memberId);

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

    return NextResponse.json({ message: 'Member removed from feature successfully' });
  } catch (error: any) {
    console.error('Remove feature member error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
