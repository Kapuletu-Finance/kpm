import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateFeatureSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  business_value: z.string().optional(),
  requirements: z.string().optional(),
  acceptance_criteria: z.string().optional(),
  user_stories: z.string().optional(),
  technical_notes: z.string().optional(),
  api_links: z.string().optional(),
  design_links: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  status: z.enum(['Idea', 'Requirements', 'Design', 'Development', 'Integration', 'Testing', 'Approval', 'Released']).optional(),
  start_date: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
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

// Verify Feature belongs to this project
async function verifyFeatureProject(supabase: any, featureId: string, projectId: string) {
  const { data: check } = await supabase
    .from('features')
    .select('id, modules!inner(roadmaps!inner(project_id))')
    .eq('id', featureId)
    .eq('modules.roadmaps.project_id', projectId)
    .single();
  
  return !!check;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; featureId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, featureId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (!(await verifyFeatureProject(supabase, featureId, projectId))) {
      return NextResponse.json({ error: 'Feature not found in this project' }, { status: 404 });
    }

    const { data: feature, error: fetchError } = await supabase
      .from('features')
      .select(`
        *,
        feature_members (
          id,
          member_id,
          responsibility,
          members (
            first_name,
            last_name,
            email,
            avatar_url
          )
        ),
        feature_checklists (
          *
        )
      `)
      .eq('id', featureId)
      .single();

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 });

    // Sort checklists by order_index in JS since it's a nested array
    if (feature && Array.isArray(feature.feature_checklists)) {
      feature.feature_checklists.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
    }

    return NextResponse.json(feature);
  } catch (error: any) {
    console.error('Fetch feature error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; featureId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, featureId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess, role } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (role !== 'Organization Admin' && role !== 'Project Manager') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!(await verifyFeatureProject(supabase, featureId, projectId))) {
      return NextResponse.json({ error: 'Feature not found in this project' }, { status: 404 });
    }

    const body = await request.json();
    const result = updateFeatureSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const { data: feature, error: updateError } = await supabase
      .from('features')
      .update(result.data)
      .eq('id', featureId)
      .select()
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

    return NextResponse.json(feature);
  } catch (error: any) {
    console.error('Update feature error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; featureId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId, featureId } = await params;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hasAccess, role } = await verifyAccess(supabase, user, projectId);
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (role !== 'Organization Admin' && role !== 'Project Manager') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!(await verifyFeatureProject(supabase, featureId, projectId))) {
      return NextResponse.json({ error: 'Feature not found in this project' }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from('features')
      .delete()
      .eq('id', featureId);

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

    return NextResponse.json({ message: 'Feature deleted successfully' });
  } catch (error: any) {
    console.error('Delete feature error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
