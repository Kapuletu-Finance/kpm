import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createFeatureSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  status: z.enum(['Idea', 'Requirements', 'Design', 'Development', 'Integration', 'Testing', 'Approval', 'Released']).optional(),
  start_date: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; moduleId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, moduleId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Verify module belongs to project
    const { data: moduleCheck } = await supabase
      .from('modules')
      .select('id, roadmaps!inner(project_id)')
      .eq('id', moduleId)
      .eq('roadmaps.project_id', projectId)
      .single();

    if (!moduleCheck) return NextResponse.json({ error: 'Module not found in this project' }, { status: 404 });

    const { data: features, error: fetchError } = await supabase
      .from('features')
      .select(`
        *,
        feature_members (
          id,
          member_id,
          responsibility,
          members (
            first_name,
            last_name,
            email,
            avatar_url
          )
        ),
        feature_checklists (
          id,
          is_completed
        )
      `)
      .eq('module_id', moduleId)
      .order('created_at', { ascending: false });

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 });

    return NextResponse.json(features);
  } catch (error: any) {
    console.error('Fetch features error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; moduleId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, moduleId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess, role } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (role !== 'Organization Admin' && role !== 'Project Manager') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Verify module belongs to project
    const { data: moduleCheck } = await supabase
      .from('modules')
      .select('id, roadmaps!inner(project_id)')
      .eq('id', moduleId)
      .eq('roadmaps.project_id', projectId)
      .single();

    if (!moduleCheck) return NextResponse.json({ error: 'Module not found in this project' }, { status: 404 });

    const body = await request.json();
    const result = createFeatureSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const { data: feature, error: createError } = await supabase
      .from('features')
      .insert({
        module_id: moduleId,
        title: result.data.title,
        description: result.data.description,
        priority: result.data.priority || 'Medium',
        status: result.data.status || 'Idea',
        start_date: result.data.start_date || null,
        due_date: result.data.due_date || null,
      })
      .select()
      .single();

    if (createError) return NextResponse.json({ error: createError.message }, { status: 400 });

    return NextResponse.json(feature);
  } catch (error: any) {
    console.error('Create feature error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
