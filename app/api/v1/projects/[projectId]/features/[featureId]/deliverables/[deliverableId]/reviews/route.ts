import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { createNotification } from '@/lib/notifications.server';
import { logActivity } from '@/lib/activity.server';

const reviewSchema = z.object({
  decision: z.enum(['Approved', 'Changes Requested', 'Rejected']),
  comments: z.string().optional(),
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
  { params }: { params: Promise<{ projectId: string, featureId: string, deliverableId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, featureId, deliverableId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        members (
          id,
          first_name,
          last_name,
          avatar_url
        )
      `)
      .eq('deliverable_id', deliverableId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string, featureId: string, deliverableId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, featureId, deliverableId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess, role } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (role !== 'Organization Admin' && role !== 'Project Manager') {
      return NextResponse.json({ error: 'Only Project Managers and Admins can review deliverables' }, { status: 403 });
    }

    const body = await request.json();
    const result = reviewSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    // 1. Insert Review
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .insert({
        deliverable_id: deliverableId,
        reviewer_id: user.id,
        decision: result.data.decision,
        comments: result.data.comments,
        reviewed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (reviewError) throw reviewError;

    // 2. Update Deliverable Status
    // Even if migration 4 hasn't run yet, Supabase JS ignores TS errors for check constraints until execution
    // It will pass if migration is applied.
    const { error: updateError } = await supabase
      .from('deliverables')
      .update({ status: result.data.decision })
      .eq('id', deliverableId);

    if (updateError) throw updateError;

    // 🚀 Inject Notification
    const { data: deliverable } = await supabase.from('deliverables').select('title, member_id').eq('id', deliverableId).single();
    if (deliverable?.member_id) {
      await createNotification({
        member_id: deliverable.member_id,
        title: `Deliverable ${result.data.decision}`,
        message: `Your deliverable "${deliverable.title}" was reviewed and marked as ${result.data.decision}.`,
        type: 'Review',
        entity_type: 'Deliverable',
        entity_id: deliverableId
      });
    }

    // Log the activity
    await logActivity({
      supabase,
      projectId,
      memberId: user.id,
      action: 'Reviewed',
      entityType: 'Deliverable',
      entityId: deliverableId,
      description: `Submitted a review (${result.data.decision}) for deliverable: ${deliverable?.title || 'Unknown'}`
    });

    return NextResponse.json(review);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
