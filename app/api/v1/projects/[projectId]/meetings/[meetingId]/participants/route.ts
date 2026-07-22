import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const participantSchema = z.object({
  member_id: z.string().uuid(),
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
      .from('meeting_participants')
      .select(`
        member_id,
        joined_at,
        members(id, first_name, last_name, avatar_url, email)
      `)
      .eq('meeting_id', meetingId);

    if (error) {
      // If table doesn't exist yet, return empty array gracefully
      if (error.code === '42P01') return NextResponse.json([]);
      throw error;
    }
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
    const result = participantSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const { data, error } = await supabase
      .from('meeting_participants')
      .insert({
        meeting_id: meetingId,
        member_id: result.data.member_id
      })
      .select(`
        member_id,
        joined_at,
        members(id, first_name, last_name, avatar_url, email)
      `)
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Already a participant' }, { status: 400 });
      throw error;
    }
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
