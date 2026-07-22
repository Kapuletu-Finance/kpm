import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createModuleSchema = z.object({
  roadmap_id: z.string().uuid(),
  name: z.string().min(1, 'Module name is required'),
  description: z.string().optional(),
  objectives: z.string().optional(),
  status: z.enum(['Not Started', 'In Progress', 'Completed']).default('Not Started'),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).default('Medium'),
  order_index: z.number().default(0),
});

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
      return NextResponse.json({ error: 'Insufficient permissions to create a module' }, { status: 403 });
    }

    const body = await request.json();
    const result = createModuleSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });
    }

    // Insert module
    const { data: newModule, error: insertError } = await supabase
      .from('modules')
      .insert({
        roadmap_id: result.data.roadmap_id,
        name: result.data.name,
        description: result.data.description,
        objectives: result.data.objectives,
        status: result.data.status,
        priority: result.data.priority,
        order_index: result.data.order_index
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json(newModule, { status: 201 });

  } catch (error: any) {
    console.error('Create module error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
