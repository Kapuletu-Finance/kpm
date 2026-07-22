import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateStandupSchema = z.object({
  manager_comments: z.string().optional(),
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; standupId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, standupId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess, role } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (role !== 'Organization Admin' && role !== 'Project Manager') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const result = updateStandupSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const { data: standup, error: updateError } = await supabase
      .from('daily_updates')
      .update(result.data)
      .eq('id', standupId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

    return NextResponse.json(standup);
  } catch (error: any) {
    console.error('Update standup error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
