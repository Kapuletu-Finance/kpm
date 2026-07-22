import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateChecklistSchema = z.object({
  title: z.string().min(1).optional(),
  is_completed: z.boolean().optional(),
  order_index: z.number().optional(),
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

// Verify Checklist belongs to Feature, Feature belongs to this project
async function verifyChecklistProject(supabase: any, checklistId: string, featureId: string, projectId: string) {
  const { data: check } = await supabase
    .from('feature_checklists')
    .select('id, feature_id, features!inner(modules!inner(roadmaps!inner(project_id)))')
    .eq('id', checklistId)
    .eq('feature_id', featureId)
    .eq('features.modules.roadmaps.project_id', projectId)
    .single();
  
  return !!check;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; featureId: string; checklistId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, featureId, checklistId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess, role } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // Note: Any project member should be able to check off a checklist item

    if (!(await verifyChecklistProject(supabase, checklistId, featureId, projectId))) {
      return NextResponse.json({ error: 'Checklist not found in this feature/project' }, { status: 404 });
    }

    const body = await request.json();
    const result = updateChecklistSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const updates: any = { ...result.data };
    
    if (updates.is_completed !== undefined) {
      if (updates.is_completed) {
        updates.completed_by = user.id;
        updates.completed_at = new Date().toISOString();
      } else {
        updates.completed_by = null;
        updates.completed_at = null;
      }
    }

    const { data: checklistItem, error: updateError } = await supabase
      .from('feature_checklists')
      .update(updates)
      .eq('id', checklistId)
      .select()
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

    return NextResponse.json(checklistItem);
  } catch (error: any) {
    console.error('Update checklist item error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; featureId: string; checklistId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, featureId, checklistId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess, role } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (role !== 'Organization Admin' && role !== 'Project Manager') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!(await verifyChecklistProject(supabase, checklistId, featureId, projectId))) {
      return NextResponse.json({ error: 'Checklist not found in this feature/project' }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from('feature_checklists')
      .delete()
      .eq('id', checklistId);

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

    return NextResponse.json({ message: 'Checklist item deleted successfully' });
  } catch (error: any) {
    console.error('Delete checklist item error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
