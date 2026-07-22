import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateMemberSchema = z.object({
  project_role: z.enum(['Project Manager', 'Member']).optional(),
  functional_role: z.string().optional(),
  role_responsibilities: z.array(z.string()).optional(),
  review_authority: z.boolean().optional(),
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
  { params }: { params: Promise<{ projectId: string; memberId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, memberId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasPermission = await verifyAccess(supabase, user, projectId);
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const result = updateMemberSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });
    }

    const updates: any = {};
    if (result.data.project_role !== undefined) updates.project_role = result.data.project_role;
    if (result.data.functional_role !== undefined) updates.functional_role = result.data.functional_role;
    if (result.data.role_responsibilities !== undefined) updates.role_responsibilities = JSON.stringify(result.data.role_responsibilities);
    if (result.data.review_authority !== undefined) updates.review_authority = result.data.review_authority;

    const { data: updatedMember, error: updateError } = await supabase
      .from('project_members')
      .update(updates)
      .eq('project_id', projectId)
      .eq('member_id', memberId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Team member updated successfully',
      data: updatedMember
    });

  } catch (error: any) {
    console.error('Update project team member error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; memberId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, memberId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasPermission = await verifyAccess(supabase, user, projectId);
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Check if this is the last Project Manager
    const { data: targetMember } = await supabase
      .from('project_members')
      .select('project_role')
      .eq('project_id', projectId)
      .eq('member_id', memberId)
      .single();

    if (targetMember?.project_role === 'Project Manager') {
      const { data: pmCount } = await supabase
        .from('project_members')
        .select('id', { count: 'exact' })
        .eq('project_id', projectId)
        .eq('project_role', 'Project Manager');
      
      if (pmCount && pmCount.length <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last Project Manager' }, { status: 400 });
      }
    }

    const { error: deleteError } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('member_id', memberId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Team member removed successfully' });

  } catch (error: any) {
    console.error('Delete project team member error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
