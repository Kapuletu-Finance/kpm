import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  business_goals: z.array(z.string()).optional(),
  target_users: z.array(z.string()).optional(),
  success_metrics: z.array(z.string()).optional(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  status: z.enum(['Draft', 'Planning', 'Active', 'On Hold', 'Completed', 'Archived']).optional(),
  github_repository: z.string().url().optional().or(z.literal('')),
  swagger_url: z.string().url().optional().or(z.literal('')),
  figma_url: z.string().url().optional().or(z.literal('')),
  cloudinary_folder: z.string().optional(),
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

    // Get caller's role
    const { data: callerMember, error: callerError } = await supabase
      .from('members')
      .select('organization_id, organization_role')
      .eq('id', user.id)
      .single();

    if (callerError || !callerMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Fetch project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*, project_manager:project_manager_id(first_name, last_name, avatar_url, email)')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.organization_id !== callerMember.organization_id) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // If not Admin, verify they are assigned
    if (callerMember.organization_role !== 'Organization Admin') {
      const { data: membership, error: memError } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('member_id', user.id)
        .single();
        
      if (memError || !membership) {
        return NextResponse.json({ error: 'Not assigned to this project' }, { status: 403 });
      }
    }

    // Parse JSON strings back to arrays for frontend
    const parsedProject = {
      ...project,
      business_goals: project.business_goals ? JSON.parse(project.business_goals) : [],
      target_users: project.target_users ? JSON.parse(project.target_users) : [],
      success_metrics: project.success_metrics ? JSON.parse(project.success_metrics) : [],
    };

    return NextResponse.json(parsedProject);
  } catch (err: any) {
    console.error('Get project exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
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

    // Get caller's role
    const { data: callerMember, error: callerError } = await supabase
      .from('members')
      .select('organization_id, organization_role')
      .eq('id', user.id)
      .single();

    if (callerError || !callerMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Fetch project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('organization_id, project_manager_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Authorization checks
    const isOrgAdmin = callerMember.organization_role === 'Organization Admin';
    const isProjectManager = project.project_manager_id === user.id;

    if (!isOrgAdmin && !isProjectManager) {
      return NextResponse.json({ error: 'Insufficient permissions to update project' }, { status: 403 });
    }

    const body = await request.json();
    const result = updateProjectSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;
    
    // Convert arrays to JSON strings if provided
    const updatePayload: any = { ...data };
    if (data.business_goals !== undefined) updatePayload.business_goals = data.business_goals ? JSON.stringify(data.business_goals) : null;
    if (data.target_users !== undefined) updatePayload.target_users = data.target_users ? JSON.stringify(data.target_users) : null;
    if (data.success_metrics !== undefined) updatePayload.success_metrics = data.success_metrics ? JSON.stringify(data.success_metrics) : null;

    const { data: updatedProject, error: updateError } = await supabase
      .from('projects')
      .update(updatePayload)
      .eq('id', projectId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json(updatedProject);
  } catch (err: any) {
    console.error('Update project exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
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

    const { data: callerMember, error: callerError } = await supabase
      .from('members')
      .select('organization_id, organization_role')
      .eq('id', user.id)
      .single();

    if (callerError || !callerMember || callerMember.organization_role !== 'Organization Admin') {
      return NextResponse.json({ error: 'Only Organization Admins can delete projects' }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('organization_id', callerMember.organization_id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (err: any) {
    console.error('Delete project exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
