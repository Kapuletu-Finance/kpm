import { and, count, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { daily_updates, features, sprints } from '@/lib/db/schema';

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export type Sprint = typeof sprints.$inferSelect;

/**
 * Burndown for a sprint and velocity across the project's recent sprints, or null when the
 * sprint is not in the project. Burndown counts features (not points): remaining on a day is
 * the sprint scope minus features that reached Released by the end of that day. Scope is the
 * sprint's current feature set.
 */
export async function getSprintInsights(projectId: string, sprintId: string) {
  const [sprint] = await db.select().from(sprints).where(and(eq(sprints.id, sprintId), eq(sprints.project_id, projectId))).limit(1);
  if (!sprint) return null;

  const scope = await db
    .select({ status: features.status, completed_at: features.completed_at })
    .from(features)
    .where(eq(features.sprint_id, sprintId));

  const total = scope.length;
  const completedDays = scope.filter((f) => f.status === 'Released' && f.completed_at).map((f) => isoDay(f.completed_at!));

  // Day range: sprint dates, falling back to creation day and today; capped at 120 days
  const start = new Date(`${sprint.start_date ?? isoDay(sprint.created_at ?? new Date())}T00:00:00Z`);
  const end = new Date(`${sprint.end_date ?? isoDay(new Date())}T00:00:00Z`);
  const days: string[] = [];
  for (let t = start.getTime(); t <= end.getTime() && days.length < 120; t += DAY_MS) days.push(isoDay(new Date(t)));

  const today = isoDay(new Date());
  const span = Math.max(days.length - 1, 1);
  const burndown = days.map((day, i) => ({
    date: day,
    ideal: Math.round((total - (total * i) / span) * 10) / 10,
    // No actual value for future days
    remaining: day <= today ? total - completedDays.filter((d) => d <= day).length : null,
  }));

  // Velocity: features released in each of the last 6 completed sprints (plus this one)
  const recent = await db
    .select({ id: sprints.id, name: sprints.name, status: sprints.status, end_date: sprints.end_date })
    .from(sprints)
    .where(and(eq(sprints.project_id, projectId), eq(sprints.status, 'Completed')))
    .orderBy(desc(sprints.end_date), desc(sprints.created_at))
    .limit(6);
  const velocitySprints = recent.some((s) => s.id === sprintId)
    ? recent
    : [...recent, { id: sprint.id, name: sprint.name, status: sprint.status, end_date: sprint.end_date }];
  const doneCounts = velocitySprints.length
    ? await db
        .select({ sprint_id: features.sprint_id, done: count() })
        .from(features)
        .where(and(inArray(features.sprint_id, velocitySprints.map((s) => s.id)), eq(features.status, 'Released')))
        .groupBy(features.sprint_id)
    : [];
  const velocity = velocitySprints
    .map((s) => ({ sprint_id: s.id, name: s.name, completed: doneCounts.find((d) => d.sprint_id === s.id)?.done ?? 0 }))
    .reverse();

  // Standups linked to this sprint
  const [{ standups }] = await db
    .select({ standups: count() })
    .from(daily_updates)
    .where(and(eq(daily_updates.sprint_id, sprintId), isNotNull(daily_updates.member_id)));

  const statusCounts = scope.reduce<Record<string, number>>((acc, f) => {
    const key = f.status ?? 'Idea';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return {
    sprint,
    total,
    completed: completedDays.length,
    status_counts: statusCounts,
    burndown,
    velocity,
    standups,
  };
}
