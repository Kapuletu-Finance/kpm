import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { members, users } from '@/lib/db/schema';
import { issueToken } from '@/lib/auth/tokens';
import { sendInviteEmail } from '@/lib/email.server';

export class InviteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

type InviteInput = {
  email: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  organizationRole: 'Organization Admin' | 'Project Manager' | 'Member';
  inviterName: string;
  organizationName: string;
  /** Role shown in the email; defaults to organizationRole. */
  invitedRole?: string;
};

/**
 * Creates a password-less user and an `Invited` member, then emails a 7-day invite link.
 * The invitee sets a password on /accept-invite, which activates the member.
 */
export async function inviteMember(input: InviteInput): Promise<{ id: string; email: string }> {
  const email = input.email.trim().toLowerCase();

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    throw new InviteError('A user with this email address has already been registered', 400);
  }

  const user = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({ email, name: `${input.firstName} ${input.lastName}`.trim() })
      .returning({ id: users.id, email: users.email });

    await tx.insert(members).values({
      id: created.id,
      organization_id: input.organizationId,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      email,
      organization_role: input.organizationRole,
      status: 'Invited',
      invited_at: new Date(),
    });

    return { id: created.id, email: created.email! };
  });

  await sendInvite(email, input);
  return user;
}

/** Issues a fresh invite token (revoking the old one) and re-sends the email. */
export async function sendInvite(
  email: string,
  ctx: Pick<InviteInput, 'inviterName' | 'organizationName' | 'organizationRole' | 'invitedRole'>,
) {
  const token = await issueToken('invite', email);
  await sendInviteEmail({
    toEmail: email,
    token,
    inviterName: ctx.inviterName,
    organizationName: ctx.organizationName,
    invitedRole: ctx.invitedRole ?? ctx.organizationRole,
  });
}
