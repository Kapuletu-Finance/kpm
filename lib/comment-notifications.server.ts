import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { comments, deliverables, feature_members, meeting_participants, members, project_members } from '@/lib/db/schema';
import { createNotification } from '@/lib/notifications.server';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Team members mentioned in a comment. A mention is "@First Last", "@first.last",
 * the email's local part ("@dana"), or "@First" when only one teammate has that first name.
 */
async function findMentions(projectId: string, text: string): Promise<string[]> {
  if (!text.includes('@')) return [];
  const team = await db
    .select({ id: members.id, first: members.first_name, last: members.last_name, email: members.email })
    .from(project_members)
    .innerJoin(members, eq(members.id, project_members.member_id))
    .where(eq(project_members.project_id, projectId));

  const firstNameCount = new Map<string, number>();
  for (const m of team) firstNameCount.set(m.first.toLowerCase(), (firstNameCount.get(m.first.toLowerCase()) ?? 0) + 1);

  const mentioned = (handle: string) => new RegExp(`(^|\\s)@${escapeRegExp(handle)}(?![\\w.])`, 'i').test(text);

  return team
    .filter((m) => {
      const handles = [`${m.first} ${m.last}`, `${m.first}.${m.last}`.replace(/\s+/g, ''), m.email.split('@')[0]];
      if (firstNameCount.get(m.first.toLowerCase()) === 1) handles.push(m.first);
      return handles.some(mentioned);
    })
    .map((m) => m.id);
}

/** People following the commented entity: feature assignees, the deliverable's submitter, meeting participants. */
async function findFollowers(entityType: string, entityId: string): Promise<string[]> {
  if (entityType === 'Feature') {
    const rows = await db.select({ id: feature_members.member_id }).from(feature_members).where(eq(feature_members.feature_id, entityId));
    return rows.map((r) => r.id).filter((id): id is string => !!id);
  }
  if (entityType === 'Deliverable') {
    const rows = await db.select({ id: deliverables.member_id }).from(deliverables).where(eq(deliverables.id, entityId));
    return rows.map((r) => r.id).filter((id): id is string => !!id);
  }
  if (entityType === 'Meeting') {
    const rows = await db.select({ id: meeting_participants.member_id }).from(meeting_participants).where(eq(meeting_participants.meeting_id, entityId));
    return rows.map((r) => r.id);
  }
  return [];
}

/**
 * Notifies, once each and never the author: anyone @mentioned, the author of the comment
 * being replied to, and the entity's followers.
 */
export async function notifyCommentAudience(input: {
  projectId: string;
  authorId: string;
  authorName: string;
  entityType: 'Feature' | 'Deliverable' | 'Meeting' | 'Project' | 'Module';
  entityId: string;
  comment: string;
  parentCommentId?: string | null;
}) {
  try {
    const [mentions, followers, parent] = await Promise.all([
      findMentions(input.projectId, input.comment),
      findFollowers(input.entityType, input.entityId),
      input.parentCommentId
        ? db.select({ member_id: comments.member_id }).from(comments).where(eq(comments.id, input.parentCommentId)).limit(1)
        : Promise.resolve([]),
    ]);

    const preview = input.comment.length > 160 ? `${input.comment.slice(0, 157)}...` : input.comment;
    // Notifications link to entities the notification types support; others point at the project
    const target =
      input.entityType === 'Module'
        ? { entity_type: 'Project' as const, entity_id: input.projectId }
        : { entity_type: input.entityType, entity_id: input.entityId };

    const sent = new Set<string>([input.authorId]);
    const send = async (memberId: string, title: string, type: 'Mention' | 'System') => {
      if (sent.has(memberId)) return;
      sent.add(memberId);
      await createNotification({ member_id: memberId, title, message: preview, type, ...target });
    };

    for (const id of mentions) await send(id, `${input.authorName} mentioned you`, 'Mention');
    const parentAuthor = parent[0]?.member_id;
    if (parentAuthor) await send(parentAuthor, `${input.authorName} replied to your comment`, 'Mention');
    for (const id of followers) await send(id, `${input.authorName} commented on a ${input.entityType.toLowerCase()} you follow`, 'System');
  } catch (error) {
    // Never fail the comment because a notification failed
    console.error('Comment notifications failed:', error);
  }
}
