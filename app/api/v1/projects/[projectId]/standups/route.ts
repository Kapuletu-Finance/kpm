import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const standupSchema = z.object({
  yesterday: z.string().min(1, 'Please enter what you did yesterday'),
  today: z.string().min(1, 'Please enter what you plan to do today'),
  blockers: z.string().optional(),
  risks: z.string().optional(),
  help_needed: z.string().optional(),
  sprint_id: z.string().optional().nullable(),
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
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Fetch standups with member details and sprint names
    const { data: standups, error: fetchError } = await supabase
      .from('daily_updates')
      .select(`
        *,
        members (
          id,
          first_name,
          last_name,
          avatar_url
        ),
        sprints (
          id,
          name
        )
      `)
      .eq('project_id', projectId)
      .order('submitted_at', { ascending: false });

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 });

    return NextResponse.json(standups);
  } catch (error: any) {
    console.error('Fetch standups error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const result = standupSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    // Check if the user already submitted a standup today to potentially upsert/prevent spam
    // For simplicity, we just allow multiple or rely on UI.
    // The requirement says "Daily standup form". Let's just insert a new record each time they submit.

    const { data: standup, error: createError } = await supabase
      .from('daily_updates')
      .insert({
        project_id: projectId,
        member_id: user.id,
        ...result.data,
        submitted_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) return NextResponse.json({ error: createError.message }, { status: 400 });

    return NextResponse.json(standup);
  } catch (error: any) {
    console.error('Submit standup error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
