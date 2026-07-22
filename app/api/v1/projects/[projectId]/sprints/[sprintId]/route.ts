import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateSprintSchema = z.object({
  name: z.string().min(1).optional(),
  goal: z.string().optional(),
  definition_of_success: z.string().optional(),
  risks: z.string().optional(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  status: z.enum(['Planning', 'Active', 'Review', 'Completed']).optional(),
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

// Verify Sprint belongs to this project
async function verifySprintProject(supabase: any, sprintId: string, projectId: string) {
  const { data: check } = await supabase
    .from('sprints')
    .select('id')
    .eq('id', sprintId)
    .eq('project_id', projectId)
    .single();
  
  return !!check;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sprintId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, sprintId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (!(await verifySprintProject(supabase, sprintId, projectId))) {
      return NextResponse.json({ error: 'Sprint not found in this project' }, { status: 404 });
    }

    const { data: sprint, error: fetchError } = await supabase
      .from('sprints')
      .select(`
        *,
        features (
          id,
          module_id,
          title,
          description,
          priority,
          status,
          feature_members (
            id,
            member_id,
            members (
              first_name,
              last_name,
              avatar_url
            )
          )
        )
      `)
      .eq('id', sprintId)
      .single();

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 });

    return NextResponse.json(sprint);
  } catch (error: any) {
    console.error('Fetch sprint error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sprintId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, sprintId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess, role } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (role !== 'Organization Admin' && role !== 'Project Manager') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!(await verifySprintProject(supabase, sprintId, projectId))) {
      return NextResponse.json({ error: 'Sprint not found in this project' }, { status: 404 });
    }

    const body = await request.json();
    const result = updateSprintSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const { data: sprint, error: updateError } = await supabase
      .from('sprints')
      .update(result.data)
      .eq('id', sprintId)
      .select()
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

    return NextResponse.json(sprint);
  } catch (error: any) {
    console.error('Update sprint error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sprintId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, sprintId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess, role } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (role !== 'Organization Admin' && role !== 'Project Manager') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!(await verifySprintProject(supabase, sprintId, projectId))) {
      return NextResponse.json({ error: 'Sprint not found in this project' }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from('sprints')
      .delete()
      .eq('id', sprintId);

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

    return NextResponse.json({ message: 'Sprint deleted successfully' });
  } catch (error: any) {
    console.error('Delete sprint error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
