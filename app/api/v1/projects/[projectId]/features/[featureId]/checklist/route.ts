import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createChecklistSchema = z.object({
  title: z.string().min(1, "Title is required"),
  order_index: z.number().optional().default(0),
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
    // PMs and Admins can create. We might also let Members create checklist items, but let's stick to PM/Admin for creation.
    if (role !== 'Organization Admin' && role !== 'Project Manager') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!(await verifyFeatureProject(supabase, featureId, projectId))) {
      return NextResponse.json({ error: 'Feature not found in this project' }, { status: 404 });
    }

    const body = await request.json();
    const result = createChecklistSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const { data: checklistItem, error: createError } = await supabase
      .from('feature_checklists')
      .insert({
        feature_id: featureId,
        title: result.data.title,
        order_index: result.data.order_index,
      })
      .select()
      .single();

    if (createError) return NextResponse.json({ error: createError.message }, { status: 400 });

    return NextResponse.json(checklistItem);
  } catch (error: any) {
    console.error('Create checklist item error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
