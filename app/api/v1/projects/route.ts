import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { sendProjectAssignmentEmail } from '@/lib/email.server';

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  project_manager_id: z.string().uuid().optional(),
  business_goals: z.array(z.string()).optional(),
  target_users: z.array(z.string()).optional(),
  success_metrics: z.array(z.string()).optional(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).default('Medium'),
  github_repository: z.string().url().optional().or(z.literal('')),
  swagger_url: z.string().url().optional().or(z.literal('')),
  figma_url: z.string().url().optional().or(z.literal('')),
  cloudinary_folder: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get caller's member record and organization
    const { data: callerMember, error: callerError } = await supabase
      .from('members')
      .select('organization_id, organization_role, first_name, last_name')
      .eq('id', user.id)
      .single();

    if (callerError || !callerMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Only Org Admins or Project Managers can create projects
    if (callerMember.organization_role === 'Member') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const result = projectSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;
    let pmId = user.id; // default to caller

    // If caller is a PM, force assignment to themselves.
    if (callerMember.organization_role === 'Project Manager') {
      pmId = user.id;
    } else if (data.project_manager_id) {
      // If an Org Admin passes a specific PM, verify they exist and have rights
      const { data: pmMember, error: pmError } = await supabase
        .from('members')
        .select('id, organization_id, organization_role, first_name, last_name, email')
        .eq('id', data.project_manager_id)
        .single();
      
      if (pmError || !pmMember || pmMember.organization_id !== callerMember.organization_id) {
        return NextResponse.json({ error: 'Invalid Project Manager' }, { status: 400 });
      }

      if (pmMember.organization_role === 'Member') {
        return NextResponse.json({ error: 'Selected user is not a Project Manager or Admin' }, { status: 400 });
      }
      pmId = data.project_manager_id;
    }

    // Insert project
    const { data: newProject, error: insertError } = await supabase
      .from('projects')
      .insert({
        organization_id: callerMember.organization_id,
        project_manager_id: pmId,
        name: data.name,
        description: data.description,
        business_goals: data.business_goals ? JSON.stringify(data.business_goals) : null,
        target_users: data.target_users ? JSON.stringify(data.target_users) : null,
        success_metrics: data.success_metrics ? JSON.stringify(data.success_metrics) : null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        priority: data.priority,
        github_repository: data.github_repository,
        swagger_url: data.swagger_url,
        figma_url: data.figma_url,
        cloudinary_folder: data.cloudinary_folder,
        status: 'Draft'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Project creation failed:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    // Automatically add the assigned PM to project_members as Project Manager
    const { error: memberInsertError } = await supabase
      .from('project_members')
      .insert({
        project_id: newProject.id,
        member_id: pmId,
        project_role: 'Project Manager',
        review_authority: true
      });

    if (memberInsertError) {
      console.error('Failed to add creator as project member:', memberInsertError);
      // We don't fail the whole request, but this shouldn't happen
    }

    // Send assignment email if Admin assigned to someone else
    if (callerMember.organization_role === 'Organization Admin' && pmId !== user.id && data.project_manager_id) {
      // Re-fetch pm email if not already present or just fetch it explicitly if we need to.
      // We already fetched pmMember with email if they entered the if-block above!
      // But we need pmMember in this scope. Let's just do a quick fetch to be safe.
      const { data: finalPm } = await supabase.from('members').select('first_name, last_name, email').eq('id', pmId).single();
      if (finalPm && finalPm.email) {
        sendProjectAssignmentEmail({
          toEmail: finalPm.email,
          pmName: finalPm.first_name,
          projectName: data.name,
          adminName: `${callerMember.first_name} ${callerMember.last_name}`,
          projectId: newProject.id
        }).catch(e => console.error('Email failed:', e));
      }
    }

    return NextResponse.json(newProject, { status: 201 });
  } catch (err: any) {
    console.error('Create project exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get caller's member record and organization
    const { data: callerMember, error: callerError } = await supabase
      .from('members')
      .select('organization_id, organization_role')
      .eq('id', user.id)
      .single();

    if (callerError || !callerMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    let projects = [];

    if (callerMember.organization_role === 'Organization Admin') {
      // Org Admins see all projects in the org
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('organization_id', callerMember.organization_id)
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      projects = data || [];
    } else {
      // Project Managers and Members see only projects they are assigned to
      // In Supabase, if we do inner join with project_members filtering by member_id
      const { data, error } = await supabase
        .from('projects')
        .select('*, project_members!inner(member_id)')
        .eq('organization_id', callerMember.organization_id)
        .eq('project_members.member_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      
      // Clean up the joined field
      projects = (data || []).map(p => {
        const { project_members, ...rest } = p as any;
        return rest;
      });
    }

    return NextResponse.json(projects);
  } catch (err: any) {
    console.error('List projects exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
