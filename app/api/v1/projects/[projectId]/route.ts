import { NextResponse } from 'next/server';
import { and, eq, getTableColumns } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { members, project_members, projects } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getMember, getProjectMembership } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { sendProjectAssignmentEmail } from '@/lib/email.server';

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  project_manager_id: z.string().optional(),
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

const parseList = (value: string | null) => (value ? JSON.parse(value) : []);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const callerMember = await getMember(user.id);
    if (!callerMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const [row] = await db
      .select({
        ...getTableColumns(projects),
        project_manager: {
          first_name: members.first_name,
          last_name: members.last_name,
          avatar_url: members.avatar_url,
          email: members.email,
        },
      })
      .from(projects)
      .leftJoin(members, eq(members.id, projects.project_manager_id))
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!row || row.organization_id !== callerMember.organization_id) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // If not Admin, verify they are assigned
    if (callerMember.organization_role !== 'Organization Admin') {
      if (!(await getProjectMembership(projectId, user.id))) {
        return NextResponse.json({ error: 'Not assigned to this project' }, { status: 403 });
      }
    }

    // Stored as JSON strings; the UI expects arrays
    return NextResponse.json({
      ...row,
      business_goals: parseList(row.business_goals),
      target_users: parseList(row.target_users),
      success_metrics: parseList(row.success_metrics),
    });
  } catch (err) {
    return handleRouteError(err, 'Get project exception');
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const callerMember = await getMember(user.id);
    if (!callerMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const [project] = await db
      .select({
        organization_id: projects.organization_id,
        project_manager_id: projects.project_manager_id,
        name: projects.name,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isOrgAdmin =
      callerMember.organization_role === 'Organization Admin' && callerMember.organization_id === project.organization_id;
    const isProjectManager = project.project_manager_id === user.id;

    if (!isOrgAdmin && !isProjectManager) {
      return NextResponse.json({ error: 'Insufficient permissions to update project' }, { status: 403 });
    }

    const result = updateProjectSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { business_goals, target_users, success_metrics, project_manager_id, ...rest } = result.data;
    const updatePayload: Partial<typeof projects.$inferInsert> = { ...rest };

    // Arrays are stored as JSON strings
    if (business_goals !== undefined) updatePayload.business_goals = business_goals ? JSON.stringify(business_goals) : null;
    if (target_users !== undefined) updatePayload.target_users = target_users ? JSON.stringify(target_users) : null;
    if (success_metrics !== undefined) updatePayload.success_metrics = success_metrics ? JSON.stringify(success_metrics) : null;

    // Project Manager reassignment
    if (project_manager_id && project_manager_id !== project.project_manager_id) {
      if (!isOrgAdmin) {
        return NextResponse.json({ error: 'Only Organization Admins can reassign Project Managers' }, { status: 403 });
      }

      const pmMember = await getMember(project_manager_id);
      if (!pmMember || pmMember.organization_id !== callerMember.organization_id) {
        return NextResponse.json({ error: 'Invalid Project Manager' }, { status: 400 });
      }
      if (pmMember.organization_role === 'Member') {
        return NextResponse.json({ error: 'Selected user is not a Project Manager or Admin' }, { status: 400 });
      }

      updatePayload.project_manager_id = project_manager_id;

      // Make sure the new PM is on the team as Project Manager
      await db
        .insert(project_members)
        .values({
          project_id: projectId,
          member_id: project_manager_id,
          project_role: 'Project Manager',
          review_authority: true,
        })
        .onConflictDoUpdate({
          target: [project_members.project_id, project_members.member_id],
          set: { project_role: 'Project Manager', review_authority: true },
        });

      if (pmMember.email) {
        sendProjectAssignmentEmail({
          toEmail: pmMember.email,
          pmName: pmMember.first_name,
          projectName: project.name,
          adminName: `${callerMember.first_name} ${callerMember.last_name}`,
          projectId: projectId
        }).catch(e => console.error('Email failed:', e));
      }
    }

    const [updatedProject] = await db
      .update(projects)
      .set(updatePayload)
      .where(eq(projects.id, projectId))
      .returning();

    return NextResponse.json(updatedProject);
  } catch (err) {
    return handleRouteError(err, 'Update project exception');
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const callerMember = await getMember(user.id);
    if (!callerMember || callerMember.organization_role !== 'Organization Admin' || !callerMember.organization_id) {
      return NextResponse.json({ error: 'Only Organization Admins can delete projects' }, { status: 403 });
    }

    await db
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.organization_id, callerMember.organization_id)));

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (err) {
    return handleRouteError(err, 'Delete project exception');
  }
}
