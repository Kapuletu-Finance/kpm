import { NextResponse } from 'next/server';
import { and, asc, count, desc, eq, gte, inArray, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deliverables, feature_members, features, meetings, modules, project_members, projects, roadmaps } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/api/http';

export async function GET() {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const myProjectIds = db
      .select({ id: project_members.project_id })
      .from(project_members)
      .where(eq(project_members.member_id, user.id));

    const myFeatureIds = db
      .select({ id: feature_members.feature_id })
      .from(feature_members)
      .where(eq(feature_members.member_id, user.id));

    const pendingWhere = and(eq(deliverables.member_id, user.id), ne(deliverables.status, 'Approved'));
    const upcomingWhere = and(inArray(meetings.project_id, myProjectIds), gte(meetings.start_time, new Date()));

    // Everything is independent, so it runs in one round of parallel queries
    const [
      [{ activeProjects }],
      [{ assignedFeaturesCount }],
      featureRows,
      [{ pendingCount }],
      deliverableRows,
      [{ upcomingCount }],
      meetingRows,
    ] = await Promise.all([
      db
        .select({ activeProjects: count() })
        .from(projects)
        .where(and(inArray(projects.id, myProjectIds), eq(projects.status, 'Active'))),
      db.select({ assignedFeaturesCount: count() }).from(feature_members).where(eq(feature_members.member_id, user.id)),
      db
        .select({
          id: features.id,
          title: features.title,
          status: features.status,
          priority: features.priority,
          due_date: features.due_date,
          project_id: roadmaps.project_id,
          project_name: projects.name,
        })
        .from(features)
        .innerJoin(modules, eq(modules.id, features.module_id))
        .innerJoin(roadmaps, eq(roadmaps.id, modules.roadmap_id))
        .leftJoin(projects, eq(projects.id, roadmaps.project_id))
        .where(and(inArray(features.id, myFeatureIds), ne(features.status, 'Released')))
        .orderBy(asc(features.due_date))
        .limit(5),
      db.select({ pendingCount: count() }).from(deliverables).where(pendingWhere),
      db
        .select({
          id: deliverables.id,
          title: deliverables.title,
          status: deliverables.status,
          entity_type: deliverables.entity_type,
          entity_id: deliverables.entity_id,
          submitted_at: deliverables.submitted_at,
        })
        .from(deliverables)
        .where(pendingWhere)
        .orderBy(desc(deliverables.submitted_at))
        .limit(5),
      db.select({ upcomingCount: count() }).from(meetings).where(upcomingWhere),
      db
        .select({
          id: meetings.id,
          title: meetings.title,
          start_time: meetings.start_time,
          type: meetings.type,
          project_id: meetings.project_id,
          project_name: projects.name,
        })
        .from(meetings)
        .leftJoin(projects, eq(projects.id, meetings.project_id))
        .where(upcomingWhere)
        .orderBy(asc(meetings.start_time))
        .limit(5),
    ]);

    // The widgets read `date` + `start_time` separately; split the timestamp (UTC, with Z).
    const upcomingMeetings = meetingRows.map(({ start_time, ...m }) => {
      const [date, time] = (start_time ?? new Date(0)).toISOString().split('T');
      return { ...m, date, start_time: time };
    });

    return NextResponse.json({
      stats: {
        activeProjects,
        assignedFeatures: assignedFeaturesCount,
        pendingDeliverables: pendingCount,
        upcomingMeetings: upcomingCount,
      },
      assignedFeatures: featureRows,
      // Deliverables have no due date column; kept for the widget's shape
      pendingDeliverables: deliverableRows.map((d) => ({ ...d, due_date: null })),
      upcomingMeetings,
    });
  } catch (error) {
    return handleRouteError(error, 'Personal dashboard error');
  }
}
