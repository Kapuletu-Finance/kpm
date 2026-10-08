import { NextResponse } from 'next/server';
import { and, asc, eq, getTableColumns, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { members, project_members } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { InviteError, inviteMember } from '@/lib/auth/invite.server';
import { canManageProject, getMemberWithOrgName, getProjectAccess, getProjectMembership } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

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
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    // Caller must administer the project's organization or be on the project
    if (!(await getProjectAccess(user.id, projectId)).hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const teamMembers = await db
      .select({
        ...getTableColumns(project_members),
        members: {
          id: members.id,
          first_name: members.first_name,
          last_name: members.last_name,
          email: members.email,
          avatar_url: members.avatar_url,
          status: members.status,
          organization_role: members.organization_role,
        },
      })
      .from(project_members)
      .leftJoin(members, eq(members.id, project_members.member_id))
      .where(eq(project_members.project_id, projectId))
      .orderBy(asc(project_members.joined_at));

    return NextResponse.json(teamMembers);
  } catch (error) {
    return handleRouteError(error, 'Fetch project team error');
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const callerMember = await getMemberWithOrgName(user.id);
    if (!callerMember || !callerMember.organization_id) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Org Admins of this project's organization, or the project's PM, can add members
    const access = await getProjectAccess(user.id, projectId);
    const isOrgAdmin = access.role === 'Organization Admin';

    if (!canManageProject(access)) {
      return NextResponse.json({ error: 'Insufficient permissions to add team members' }, { status: 403 });
    }

    const result = addMemberSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });
    }

    const { first_name, last_name, email, member_id, project_role, functional_role, role_responsibilities, review_authority } = result.data;

    // PMs cannot add other PMs
    if (!isOrgAdmin && project_role === 'Project Manager') {
      return NextResponse.json({ error: 'Only Organization Admins can assign Project Managers' }, { status: 403 });
    }

    if (!email && !member_id) {
      return NextResponse.json({ error: 'Either email or member_id is required' }, { status: 400 });
    }

    let targetMemberId = member_id;

    // Find the org member by email, or invite them
    if (email && !targetMemberId) {
      const [existingOrgMember] = await db
        .select({ id: members.id })
        .from(members)
        .where(
          and(
            sql`lower(${members.email}) = ${email.toLowerCase()}`,
            eq(members.organization_id, callerMember.organization_id),
          ),
        )
        .limit(1);

      if (existingOrgMember) {
        targetMemberId = existingOrgMember.id;
      } else {
        const invited = await inviteMember({
          email,
          organizationId: callerMember.organization_id,
          firstName: first_name || 'Pending',
          lastName: last_name || 'User',
          organizationRole: 'Member',
          invitedRole: project_role,
          inviterName: `${callerMember.first_name} ${callerMember.last_name}`,
          organizationName: callerMember.organization_name || 'Your Organization',
        });
        targetMemberId = invited.id;
      }
    }

    if (!targetMemberId) {
      return NextResponse.json({ error: 'Could not determine target member' }, { status: 400 });
    }

    if (await getProjectMembership(projectId, targetMemberId)) {
      return NextResponse.json({ error: 'Member is already in this project' }, { status: 400 });
    }

    const [newProjectMember] = await db
      .insert(project_members)
      .values({
        project_id: projectId,
        member_id: targetMemberId,
        project_role,
        functional_role: functional_role || null,
        role_responsibilities: role_responsibilities || [],
        review_authority,
      })
      .returning();

    return NextResponse.json({
      message: 'Team member added successfully',
      data: newProjectMember
    });
  } catch (error) {
    if (error instanceof InviteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleRouteError(error, 'Add project team member error');
  }
}
