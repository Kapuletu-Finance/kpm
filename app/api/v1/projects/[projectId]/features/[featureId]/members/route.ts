import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const assignMemberSchema = z.object({
  member_id: z.string().uuid("Invalid member ID"),
  responsibility: z.string().optional(),
});

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; featureId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, featureId } = await params;
    
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

    const body = await request.json();
    const result = assignMemberSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    // Verify the member being assigned is actually in the project
    const { data: isProjectMember } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('member_id', result.data.member_id)
      .single();
      
    if (!isProjectMember) return NextResponse.json({ error: 'User is not a member of this project' }, { status: 400 });

    // Ensure they aren't already assigned to avoid duplicates
    const { data: existing } = await supabase
      .from('feature_members')
      .select('id')
      .eq('feature_id', featureId)
      .eq('member_id', result.data.member_id)
      .single();
      
    if (existing) return NextResponse.json({ error: 'Member is already assigned to this feature' }, { status: 400 });

    const { data: assignment, error: createError } = await supabase
      .from('feature_members')
      .insert({
        feature_id: featureId,
        member_id: result.data.member_id,
        responsibility: result.data.responsibility,
      })
      .select(`
        id,
        member_id,
        responsibility,
        members (
          first_name,
          last_name,
          email,
          avatar_url
        )
      `)
      .single();

    if (createError) return NextResponse.json({ error: createError.message }, { status: 400 });

    return NextResponse.json(assignment);
  } catch (error: any) {
    console.error('Assign feature member error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
