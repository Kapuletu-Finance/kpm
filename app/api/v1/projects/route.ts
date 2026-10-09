import { NextResponse } from 'next/server';
import { and, desc, eq, getTableColumns } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { project_members, projects } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getMember } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { sendProjectAssignmentEmail } from '@/lib/email.server';
import { logActivity } from '@/lib/activity.server';

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
    const { user, response } = await requireApiUser();
    if (response) return response;

    const callerMember = await getMember(user.id);
    if (!callerMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Only Org Admins or Project Managers can create projects
    if (callerMember.organization_role === 'Member') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const result = projectSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;
    let pmId = user.id; // default to caller
    let assignedPm: { first_name: string; email: string } | null = null;

    // A PM always manages their own projects; an Org Admin may pick another PM.
    if (callerMember.organization_role !== 'Project Manager' && data.project_manager_id) {
      const pmMember = await getMember(data.project_manager_id);

      if (!pmMember || pmMember.organization_id !== callerMember.organization_id) {
        return NextResponse.json({ error: 'Invalid Project Manager' }, { status: 400 });
      }
      if (pmMember.organization_role === 'Member') {
        return NextResponse.json({ error: 'Selected user is not a Project Manager or Admin' }, { status: 400 });
      }
      pmId = data.project_manager_id;
      assignedPm = pmMember;
    }

    // Project and its PM membership are created together.
    const newProject = await db.transaction(async (tx) => {
      const [project] = await tx
        .insert(projects)
        .values({
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
          status: 'Draft',
        })
        .returning();

      await tx.insert(project_members).values({
        project_id: project.id,
        member_id: pmId,
        project_role: 'Project Manager',
        review_authority: true,
      });

      return project;
    });

    await logActivity({
      projectId: newProject.id,
      memberId: user.id,
      action: 'Created',
      entityType: 'Project',
      entityId: newProject.id,
      description: `Created project: ${newProject.name}`,
    });

    // Email the PM when an Admin assigned someone else
    if (assignedPm && pmId !== user.id && assignedPm.email) {
      sendProjectAssignmentEmail({
        toEmail: assignedPm.email,
        pmName: assignedPm.first_name,
        projectName: data.name,
        adminName: `${callerMember.first_name} ${callerMember.last_name}`,
        projectId: newProject.id
      }).catch(e => console.error('Email failed:', e));
    }

    return NextResponse.json(newProject, { status: 201 });
  } catch (err) {
    return handleRouteError(err, 'Create project exception');
  }
}

export async function GET() {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const callerMember = await getMember(user.id);
    if (!callerMember || !callerMember.organization_id) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Org Admins see every project in the org; everyone else only projects they are on.
    const list =
      callerMember.organization_role === 'Organization Admin'
        ? await db
            .select()
            .from(projects)
            .where(eq(projects.organization_id, callerMember.organization_id))
            .orderBy(desc(projects.created_at))
        : await db
            .select(getTableColumns(projects))
            .from(projects)
            .innerJoin(
              project_members,
              and(eq(project_members.project_id, projects.id), eq(project_members.member_id, user.id)),
            )
            .where(eq(projects.organization_id, callerMember.organization_id))
            .orderBy(desc(projects.created_at));

    return NextResponse.json(list);
  } catch (err) {
    return handleRouteError(err, 'List projects exception');
  }
}
