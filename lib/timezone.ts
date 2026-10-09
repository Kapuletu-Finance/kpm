import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { organizations, projects } from '@/lib/db/schema';

/** Whether `tz` is an IANA timezone name the runtime (and Postgres) understands, e.g. "Africa/Nairobi". */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const orUtc = (tz: string | null | undefined) => (tz && isValidTimezone(tz) ? tz : 'UTC');

/** The organization's timezone, or UTC when unset or invalid. Days ("today", report ranges) are measured in it. */
export async function organizationTimezone(organizationId: string): Promise<string> {
  const [row] = await db
    .select({ timezone: organizations.timezone })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return orUtc(row?.timezone);
}

/** The timezone of a project's organization. */
export async function projectTimezone(projectId: string): Promise<string> {
  const [row] = await db
    .select({ timezone: organizations.timezone })
    .from(projects)
    .innerJoin(organizations, eq(organizations.id, projects.organization_id))
    .where(eq(projects.id, projectId))
    .limit(1);
  return orUtc(row?.timezone);
}

/** Today's date (YYYY-MM-DD) in a timezone. */
export function todayIn(tz: string): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
