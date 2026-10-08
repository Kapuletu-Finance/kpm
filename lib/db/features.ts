import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { feature_checklists, feature_members, features, members } from '@/lib/db/schema';

type Feature = typeof features.$inferSelect;

/**
 * Embeds `feature_members` (with member details) and `feature_checklists` into each
 * feature, matching the nested shape the UI expects. Two batched queries regardless
 * of how many features are passed.
 */
export async function withFeatureRelations<T extends Pick<Feature, 'id'>>(
  rows: T[],
  options: { fullChecklists?: boolean } = {},
) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [assignees, checklists] = await Promise.all([
    db
      .select({
        feature_id: feature_members.feature_id,
        id: feature_members.id,
        member_id: feature_members.member_id,
        responsibility: feature_members.responsibility,
        members: {
          first_name: members.first_name,
          last_name: members.last_name,
          email: members.email,
          avatar_url: members.avatar_url,
        },
      })
      .from(feature_members)
      .leftJoin(members, eq(members.id, feature_members.member_id))
      .where(inArray(feature_members.feature_id, ids)),
    options.fullChecklists
      ? db
          .select()
          .from(feature_checklists)
          .where(inArray(feature_checklists.feature_id, ids))
          .orderBy(asc(feature_checklists.order_index))
      : db
          .select({
            feature_id: feature_checklists.feature_id,
            id: feature_checklists.id,
            is_completed: feature_checklists.is_completed,
          })
          .from(feature_checklists)
          .where(inArray(feature_checklists.feature_id, ids)),
  ]);

  return rows.map((row) => ({
    ...row,
    feature_members: assignees
      .filter((a) => a.feature_id === row.id)
      .map((a) => ({ id: a.id, member_id: a.member_id, responsibility: a.responsibility, members: a.members })),
    feature_checklists: options.fullChecklists
      ? checklists.filter((c) => c.feature_id === row.id)
      : checklists.filter((c) => c.feature_id === row.id).map((c) => ({ id: c.id, is_completed: c.is_completed })),
  }));
}
