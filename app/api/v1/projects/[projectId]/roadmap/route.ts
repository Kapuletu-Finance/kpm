import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createRoadmapSchema = z.object({
  name: z.string().min(1, 'Phase name is required'),
  description: z.string().optional(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  order_index: z.number().default(0),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId } = await params;

    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this project
    const { data: callerMember } = await supabase
      .from('members')
      .select('organization_id, organization_role')
      .eq('id', user.id)
      .single();

    if (!callerMember) {
      return NextResponse.json({ error: 'Not part of an organization' }, { status: 403 });
    }

    if (callerMember.organization_role !== 'Organization Admin') {
      const { data: projectAccess, error: accessError } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('member_id', user.id)
        .single();
      
      if (accessError || !projectAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Fetch roadmaps joined with their nested modules
    const { data: roadmaps, error: fetchError } = await supabase
      .from('roadmaps')
      .select(`
        *,
        modules (
          *
        )
      `)
      .eq('project_id', projectId)
      .order('order_index', { ascending: true });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }

    // Sort modules by order_index inside the JS since Supabase nested order requires special syntax
    const sortedRoadmaps = roadmaps.map((rm: any) => ({
      ...rm,
      modules: Array.isArray(rm.modules) ? rm.modules.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0)) : []
    }));

    return NextResponse.json(sortedRoadmaps);
  } catch (error: any) {
    console.error('Fetch roadmap error:', error);
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
    
    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get caller's member record
    const { data: callerMember } = await supabase
      .from('members')
      .select('organization_id, organization_role')
      .eq('id', user.id)
      .single();

    if (!callerMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Verify caller is Admin or PM
    let hasPermission = false;
    if (callerMember.organization_role === 'Organization Admin') {
      hasPermission = true;
    } else {
      const { data: pmAccess } = await supabase
        .from('project_members')
        .select('project_role')
        .eq('project_id', projectId)
        .eq('member_id', user.id)
        .eq('project_role', 'Project Manager')
        .single();
      
      if (pmAccess) hasPermission = true;
    }

    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions to create a roadmap phase' }, { status: 403 });
    }

    const body = await request.json();
    const result = createRoadmapSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });
    }

    // Insert roadmap
    const { data: newRoadmap, error: insertError } = await supabase
      .from('roadmaps')
      .insert({
        project_id: projectId,
        name: result.data.name,
        description: result.data.description,
        start_date: result.data.start_date || null,
        end_date: result.data.end_date || null,
        order_index: result.data.order_index
      })
      .select(`*, modules(*)`)
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json(newRoadmap, { status: 201 });

  } catch (error: any) {
    console.error('Create roadmap error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
