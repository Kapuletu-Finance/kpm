import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity.server';
import { z } from 'zod';

const deliverableSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['GitHub PR', 'Figma Link', 'API Doc', 'Document', 'Video', 'Screenshot', 'Demo', 'Commit', 'Deployment URL']),
  link: z.string().url('Must be a valid URL'),
  description: z.string().optional(),
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
  { params }: { params: Promise<{ projectId: string, featureId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, featureId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data, error } = await supabase
      .from('deliverables')
      .select(`
        *,
        members (
          id,
          first_name,
          last_name,
          avatar_url
        )
      `)
      .eq('entity_type', 'Feature')
      .eq('entity_id', featureId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string, featureId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, featureId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const result = deliverableSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const { data, error } = await supabase
      .from('deliverables')
      .insert({
        entity_type: 'Feature',
        entity_id: featureId,
        member_id: user.id,
        ...result.data,
      })
      .select()
      .single();

    if (error) throw error;

    // Log the activity
    await logActivity({
      supabase,
      projectId,
      memberId: user.id,
      action: 'Created',
      entityType: 'Deliverable',
      entityId: data.id,
      description: `Created a deliverable: ${data.title}`
    });

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
