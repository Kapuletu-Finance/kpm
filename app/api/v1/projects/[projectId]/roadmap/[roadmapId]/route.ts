import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateRoadmapSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
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
  { params }: { params: Promise<{ projectId: string; roadmapId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, roadmapId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasPermission = await verifyAccess(supabase, user, projectId);
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const result = updateRoadmapSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });
    }

    const updates = result.data;

    const { data: updatedRoadmap, error: updateError } = await supabase
      .from('roadmaps')
      .update(updates)
      .eq('id', roadmapId)
      .eq('project_id', projectId)
      .select(`*, modules(*)`)
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json(updatedRoadmap);

  } catch (error: any) {
    console.error('Update roadmap error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; roadmapId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, roadmapId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasPermission = await verifyAccess(supabase, user, projectId);
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from('roadmaps')
      .delete()
      .eq('id', roadmapId)
      .eq('project_id', projectId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Roadmap deleted successfully' });

  } catch (error: any) {
    console.error('Delete roadmap error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
