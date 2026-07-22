import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const actionItemSchema = z.object({
  description: z.string().min(1),
  assigned_to: z.string().uuid().optional().nullable(),
  status: z.enum(['Pending', 'In Progress', 'Completed']).default('Pending'),
  due_date: z.string().optional().nullable(),
});

async function verifyAccess(supabase: any, user: any, projectId: string) {
  const { data: projectAccess } = await supabase
    .from('project_members')
    .select('project_role')
    .eq('project_id', projectId)
    .eq('member_id', user.id)
    .single();
    
  if (projectAccess) return { hasAccess: true, role: projectAccess.project_role };

  const { data: callerMember } = await supabase
    .from('members')
    .select('organization_role')
    .eq('id', user.id)
    .single();

  if (callerMember?.organization_role === 'Organization Admin') {
    return { hasAccess: true, role: 'Organization Admin' };
  }

  return { hasAccess: false };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string, meetingId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, meetingId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data, error } = await supabase
      .from('meeting_action_items')
      .select(`
        *,
        members:assigned_to(id, first_name, last_name, avatar_url)
      `)
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string, meetingId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, meetingId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const result = actionItemSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const { data, error } = await supabase
      .from('meeting_action_items')
      .insert({
        meeting_id: meetingId,
        description: result.data.description,
        assigned_to: result.data.assigned_to || null,
        status: result.data.status,
        due_date: result.data.due_date || null
      })
      .select(`
        *,
        members:assigned_to(id, first_name, last_name, avatar_url)
      `)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
