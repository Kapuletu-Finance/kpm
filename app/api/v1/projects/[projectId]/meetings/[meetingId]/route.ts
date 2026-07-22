import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const meetingUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  sprint_id: z.string().uuid().optional().nullable(),
  objective: z.string().optional(),
  agenda: z.string().optional(),
  type: z.enum(['Online', 'Physical']).optional(),
  meeting_link: z.string().url().optional().or(z.literal('')),
  location: z.string().optional(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  minutes: z.string().optional(),
  decisions: z.string().optional(),
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
      .from('meetings')
      .select(`
        *,
        members:created_by(id, first_name, last_name, avatar_url)
      `)
      .eq('id', meetingId)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string, meetingId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, meetingId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess, role } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const result = meetingUpdateSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const canManage = role === 'Organization Admin' || role === 'Project Manager';

    if (!canManage) {
      // Check if user is created_by or a participant
      const { data: meetingData } = await supabase.from('meetings').select('created_by').eq('id', meetingId).single();
      const { data: participantData } = await supabase.from('meeting_participants').select('member_id').eq('meeting_id', meetingId).eq('member_id', user.id).single();
      
      if (meetingData?.created_by !== user.id && !participantData) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { data, error } = await supabase
      .from('meetings')
      .update(result.data)
      .eq('id', meetingId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string, meetingId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, meetingId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess, role } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (role !== 'Organization Admin' && role !== 'Project Manager') {
      const { data: meetingData } = await supabase.from('meetings').select('created_by').eq('id', meetingId).single();
      if (meetingData?.created_by !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { error } = await supabase
      .from('meetings')
      .delete()
      .eq('id', meetingId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
