import { NextResponse } from 'next/server';
import { sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth/session';
import { getMember } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { logActivity } from '@/lib/activity.server';

/**
 * GET: every record the organization owns, as one JSON download (data portability / backup).
 * Org Admins only. Login secrets (password hashes, tokens) are never included.
 */
export async function GET() {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const member = await getMember(user.id);
    if (!member?.organization_id || member.organization_role !== 'Organization Admin') {
      return NextResponse.json({ error: 'Only Organization Admins can export organization data' }, { status: 403 });
    }
    const org = member.organization_id;

    // Building blocks: the org's projects, their features, meetings and deliverables
    const projectIds = sql`select id from projects where organization_id = ${org}::uuid`;
    const featureIds = sql`
      select f.id from features f join modules m on m.id = f.module_id
      join roadmaps r on r.id = m.roadmap_id where r.project_id in (${projectIds})`;
    const meetingIds = sql`select id from meetings where project_id in (${projectIds})`;
    const deliverableIds = sql`
      select id from deliverables where
        (entity_type = 'Feature' and entity_id in (${featureIds})) or
        (entity_type = 'Project' and entity_id in (${projectIds})) or
        (entity_type = 'Meeting' and entity_id in (${meetingIds}))`;
    const moduleIds = sql`select m.id from modules m join roadmaps r on r.id = m.roadmap_id where r.project_id in (${projectIds})`;

    const tables: Record<string, SQL> = {
      organization: sql`select * from organizations where id = ${org}::uuid`,
      organization_standards: sql`select * from organization_standards where organization_id = ${org}::uuid`,
      members: sql`select * from members where organization_id = ${org}::uuid`,
      projects: sql`select * from projects where organization_id = ${org}::uuid`,
      project_members: sql`select * from project_members where project_id in (${projectIds})`,
      roadmaps: sql`select * from roadmaps where project_id in (${projectIds})`,
      modules: sql`select * from modules where id in (${moduleIds})`,
      features: sql`select * from features where id in (${featureIds})`,
      feature_members: sql`select * from feature_members where feature_id in (${featureIds})`,
      feature_checklists: sql`select * from feature_checklists where feature_id in (${featureIds})`,
      feature_dependencies: sql`select * from feature_dependencies where feature_id in (${featureIds})`,
      sprints: sql`select * from sprints where project_id in (${projectIds})`,
      sprint_retrospectives: sql`select sr.* from sprint_retrospectives sr join sprints s on s.id = sr.sprint_id where s.project_id in (${projectIds})`,
      milestones: sql`select * from milestones where project_id in (${projectIds})`,
      releases: sql`select * from releases where project_id in (${projectIds})`,
      meetings: sql`select * from meetings where project_id in (${projectIds})`,
      meeting_participants: sql`select * from meeting_participants where meeting_id in (${meetingIds})`,
      meeting_action_items: sql`select * from meeting_action_items where meeting_id in (${meetingIds})`,
      daily_updates: sql`select * from daily_updates where project_id in (${projectIds})`,
      deliverables: sql`select * from deliverables where id in (${deliverableIds})`,
      reviews: sql`select * from reviews where deliverable_id in (${deliverableIds})`,
      comments: sql`
        select * from comments where
          (entity_type = 'Project' and entity_id in (${projectIds})) or
          (entity_type = 'Feature' and entity_id in (${featureIds})) or
          (entity_type = 'Module' and entity_id in (${moduleIds})) or
          (entity_type = 'Meeting' and entity_id in (${meetingIds})) or
          (entity_type = 'Deliverable' and entity_id in (${deliverableIds}))`,
      project_documents: sql`select * from project_documents where project_id in (${projectIds})`,
      activity_logs: sql`select * from activity_logs where organization_id = ${org}::uuid order by created_at`,
    };

    const entries = await Promise.all(
      Object.entries(tables).map(async ([name, query]) => [name, (await db.execute(query)).rows] as const),
    );
    const data = Object.fromEntries(entries);

    await logActivity({
      organizationId: org,
      memberId: user.id,
      action: 'Exported',
      entityType: 'Organization',
      entityId: org,
      description: 'Exported all organization data',
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(
      JSON.stringify({ exported_at: new Date().toISOString(), format: 'kpm-export/1', ...data }, null, 2),
      {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="kpm-organization-export-${stamp}.json"`,
        },
      },
    );
  } catch (error) {
    return handleRouteError(error, 'Organization export error');
  }
}
