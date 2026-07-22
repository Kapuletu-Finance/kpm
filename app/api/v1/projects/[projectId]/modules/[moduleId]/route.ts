import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateModuleSchema = z.object({
  roadmap_id: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  objectives: z.string().optional(),
  status: z.enum(['Not Started', 'In Progress', 'Completed']).optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  order_index: z.number().optional(),
});

async function verifyAccess(supabase: any, user: any, projectId: string) {
  const { data: callerMember } = await supabase
    .from('members')
    .select('organization_id, organization_role')
    .eq('id', user.id)
    .single();

  if (!callerMember) return false;

  if (callerMember.organization_role === 'Organization Admin') {
    return true;
  }

  const { data: pmAccess } = await supabase
    .from('project_members')
    .select('project_role')
    .eq('project_id', projectId)
    .eq('member_id', user.id)
    .eq('project_role', 'Project Manager')
    .single();

  return !!pmAccess;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; moduleId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, moduleId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasPermission = await verifyAccess(supabase, user, projectId);
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const result = updateModuleSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });
    }

    const updates = result.data;

    // Verify the module exists and belongs to a roadmap in this project
    const { data: moduleCheck } = await supabase
      .from('modules')
      .select('id, roadmaps!inner(project_id)')
      .eq('id', moduleId)
      .eq('roadmaps.project_id', projectId)
      .single();

    if (!moduleCheck) {
      return NextResponse.json({ error: 'Module not found in this project' }, { status: 404 });
    }

    const { data: updatedModule, error: updateError } = await supabase
      .from('modules')
      .update(updates)
      .eq('id', moduleId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json(updatedModule);

  } catch (error: any) {
    console.error('Update module error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; moduleId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, moduleId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasPermission = await verifyAccess(supabase, user, projectId);
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Verify module belongs to this project
    const { data: moduleCheck } = await supabase
      .from('modules')
      .select('id, roadmaps!inner(project_id)')
      .eq('id', moduleId)
      .eq('roadmaps.project_id', projectId)
      .single();

    if (!moduleCheck) {
      return NextResponse.json({ error: 'Module not found in this project' }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from('modules')
      .delete()
      .eq('id', moduleId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Module deleted successfully' });

  } catch (error: any) {
    console.error('Delete module error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
