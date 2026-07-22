import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const addMemberSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email().optional(),
  member_id: z.string().uuid().optional(),
  project_role: z.enum(['Project Manager', 'Member']),
  functional_role: z.string().optional(),
  role_responsibilities: z.array(z.string()).optional(),
  review_authority: z.boolean().default(false),
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

    // Verify user has access to this project (they must be an org admin or a project member)
    const { data: callerMember } = await supabase
      .from('members')
      .select('organization_id, organization_role')
      .eq('id', user.id)
      .single();

    if (!callerMember) {
      return NextResponse.json({ error: 'Not part of an organization' }, { status: 403 });
    }

    // If not an Org Admin, verify they are in this project
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

    // Fetch team members
    const { data: teamMembers, error: fetchError } = await supabase
      .from('project_members')
      .select(`
        *,
        members:member_id (
          id,
          first_name,
          last_name,
          email,
          avatar_url,
          status,
          organization_role
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }

    return NextResponse.json(teamMembers);
  } catch (error: any) {
    console.error('Fetch project team error:', error);
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
    const { data: callerMember, error: callerError } = await supabase
      .from('members')
      .select('organization_id, organization_role, first_name, last_name, organizations (name)')
      .eq('id', user.id)
      .single();

    if (callerError || !callerMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Verify caller has permission to add members to this project
    let hasPermission = false;
    if (callerMember.organization_role === 'Organization Admin') {
      hasPermission = true;
    } else {
      // Check if they are the PM for this specific project
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
      return NextResponse.json({ error: 'Insufficient permissions to add team members' }, { status: 403 });
    }

    const body = await request.json();
    const result = addMemberSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });
    }

    const { first_name, last_name, email, member_id, project_role, functional_role, role_responsibilities, review_authority } = result.data;

    // Strict constraint: PMs cannot add other PMs
    if (callerMember.organization_role !== 'Organization Admin' && project_role === 'Project Manager') {
      return NextResponse.json({ error: 'Only Organization Admins can assign Project Managers' }, { status: 403 });
    }

    if (!email && !member_id) {
      return NextResponse.json({ error: 'Either email or member_id is required' }, { status: 400 });
    }

    let targetMemberId = member_id;

    // If email is provided, we need to find or invite the user
    if (email && !targetMemberId) {
      // Check if user exists in the organization
      const { data: existingOrgMember } = await supabase
        .from('members')
        .select('id')
        .eq('email', email)
        .eq('organization_id', callerMember.organization_id)
        .single();
      
      if (existingOrgMember) {
        targetMemberId = existingOrgMember.id;
      } else {
        // Invite new user using Admin API
        const adminSupabase = createAdminClient();
        const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite`;
        
        const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
          data: {
            inviter_name: `${callerMember.first_name} ${callerMember.last_name}`,
            organization_name: (Array.isArray(callerMember.organizations) ? callerMember.organizations[0]?.name : (callerMember.organizations as any)?.name) || 'Your Organization',
            invited_role: project_role
          },
          redirectTo
        });

        if (inviteError) {
          return NextResponse.json({ error: inviteError.message }, { status: 400 });
        }

        const invitedUser = inviteData.user;
        if (!invitedUser) {
          return NextResponse.json({ error: 'Failed to generate invite' }, { status: 500 });
        }

        targetMemberId = invitedUser.id;

        // Create the global member record for this org
        const { error: memberInsertError } = await adminSupabase
          .from('members')
          .insert({
            id: targetMemberId,
            organization_id: callerMember.organization_id,
            first_name: first_name || 'Pending',
            last_name: last_name || 'User',
            email: email,
            organization_role: 'Member',
            status: 'Invited',
            invited_at: new Date().toISOString(),
          });

        if (memberInsertError) {
          return NextResponse.json({ error: 'Failed to create global member record' }, { status: 500 });
        }
      }
    }

    if (!targetMemberId) {
      return NextResponse.json({ error: 'Could not determine target member' }, { status: 400 });
    }

    // Check if they are already in the project
    const { data: existingProjectMember } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('member_id', targetMemberId)
      .single();

    if (existingProjectMember) {
      return NextResponse.json({ error: 'Member is already in this project' }, { status: 400 });
    }

    // Use adminSupabase to insert into project_members to bypass any initial RLS delays for new users
    const adminSupabase = createAdminClient();
    const { data: newProjectMember, error: insertError } = await adminSupabase
      .from('project_members')
      .insert({
        project_id: projectId,
        member_id: targetMemberId,
        project_role: project_role,
        functional_role: functional_role || null,
        role_responsibilities: role_responsibilities || [],
        review_authority: review_authority
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Team member added successfully',
      data: newProjectMember
    });

  } catch (error: any) {
    console.error('Add project team member error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
