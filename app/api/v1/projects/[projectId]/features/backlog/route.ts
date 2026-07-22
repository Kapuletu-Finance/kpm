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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Fetch all features in the project that do not have a sprint_id and are not Released
    const { data: features, error: fetchError } = await supabase
      .from('features')
      .select('id, module_id, title, description, priority, status, modules!inner(name, roadmaps!inner(project_id))')
      .eq('modules.roadmaps.project_id', projectId)
      .is('sprint_id', null)
      .neq('status', 'Released')
      .order('created_at', { ascending: false });

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 });

    return NextResponse.json(features);
  } catch (error: any) {
    console.error('Fetch backlog features error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
