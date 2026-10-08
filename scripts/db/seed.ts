// Seeds a local database with a working organization so the app can be used offline.
//   npm run db:seed
//
// Idempotent: re-running skips if the demo admin already exists.
// Never run against production; it refuses unless the URL points at localhost.
import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../lib/db/schema';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL');
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  throw new Error(`Refusing to seed a non-local database: ${url.replace(/:[^:@/]+@/, ':***@')}`);
}

const PASSWORD = 'Password123!';
const people = [
  { email: 'admin@kpm.local', first: 'Ada', last: 'Admin', role: 'Organization Admin' },
  { email: 'pm@kpm.local', first: 'Paul', last: 'Manager', role: 'Project Manager' },
  { email: 'dev@kpm.local', first: 'Dana', last: 'Developer', role: 'Member' },
] as const;

async function main() {
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle({ client: pool, schema });
  const { users, members, organizations, projects, project_members, roadmaps, modules, features, sprints } = schema;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, people[0].email));
  if (existing) {
    console.log('Seed data already present; nothing to do.');
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({ name: 'Kapuletu Demo', slug: 'kapuletu-demo', industry: 'Software', country: 'Kenya', timezone: 'Africa/Nairobi' })
      .returning();

    const ids: Record<string, string> = {};
    for (const p of people) {
      const [u] = await tx
        .insert(users)
        .values({ email: p.email, name: `${p.first} ${p.last}`, passwordHash, emailVerified: new Date() })
        .returning({ id: users.id });
      ids[p.role] = u.id;
      await tx.insert(members).values({
        id: u.id,
        organization_id: org.id,
        first_name: p.first,
        last_name: p.last,
        email: p.email,
        organization_role: p.role,
        status: 'Active',
      });
    }

    const [project] = await tx
      .insert(projects)
      .values({
        organization_id: org.id,
        project_manager_id: ids['Project Manager'],
        name: 'Customer Portal',
        description: 'Self-service portal for customers.',
        business_goals: JSON.stringify(['Reduce support tickets by 30%']),
        target_users: JSON.stringify(['Existing customers']),
        success_metrics: JSON.stringify(['Weekly active users']),
        status: 'Active',
        priority: 'High',
        start_date: new Date().toISOString().slice(0, 10),
      })
      .returning();

    await tx.insert(project_members).values([
      { project_id: project.id, member_id: ids['Project Manager'], project_role: 'Project Manager', review_authority: true },
      { project_id: project.id, member_id: ids['Member'], project_role: 'Member', functional_role: 'Frontend Developer' },
    ]);

    const [phase] = await tx.insert(roadmaps).values({ project_id: project.id, name: 'Phase 1: Foundation', order_index: 0 }).returning();
    const [mod] = await tx
      .insert(modules)
      .values({ roadmap_id: phase.id, name: 'Authentication', status: 'In Progress', priority: 'High' })
      .returning();
    const [sprint] = await tx
      .insert(sprints)
      .values({ project_id: project.id, name: 'Sprint 1', goal: 'Ship sign-in', status: 'Active' })
      .returning();

    await tx.insert(features).values([
      { module_id: mod.id, sprint_id: sprint.id, title: 'Email + password sign-in', status: 'Development', priority: 'High' },
      { module_id: mod.id, title: 'Password reset', status: 'Requirements', priority: 'Medium' },
    ]);
  });

  console.log('Seeded demo organization. Sign in at http://localhost:3000/login with:');
  for (const p of people) console.log(`  ${p.role.padEnd(18)} ${p.email}  /  ${PASSWORD}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
