import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, like } from 'drizzle-orm';
import { db } from '@/lib/db';
import { verificationTokens } from '@/lib/db/schema';

// Single-use email tokens (verify email, accept invite, reset password).
// Only a SHA-256 of the token is stored, so a database leak cannot be replayed.

export type TokenPurpose = 'verify' | 'invite' | 'reset';

const TTL_MS: Record<TokenPurpose, number> = {
  verify: 24 * 60 * 60 * 1000,
  invite: 7 * 24 * 60 * 60 * 1000,
  reset: 60 * 60 * 1000,
};

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** Issues a new token for `email`, revoking any earlier token of the same purpose. */
export async function issueToken(purpose: TokenPurpose, email: string): Promise<string> {
  const identifier = `${purpose}:${email.toLowerCase()}`;
  const token = randomBytes(32).toString('base64url');

  await db.transaction(async (tx) => {
    await tx.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier));
    await tx.insert(verificationTokens).values({
      identifier,
      token: hash(token),
      expires: new Date(Date.now() + TTL_MS[purpose]),
    });
  });

  return token;
}

/** Validates and deletes a token. Returns the email it was issued for, or null. */
export async function consumeToken(purpose: TokenPurpose, token: string): Promise<string | null> {
  if (!token) return null;

  const [row] = await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.token, hash(token)),
        like(verificationTokens.identifier, `${purpose}:%`),
        gt(verificationTokens.expires, new Date()),
      ),
    )
    .returning({ identifier: verificationTokens.identifier });

  return row ? row.identifier.slice(purpose.length + 1) : null;
}

/** Looks a token up without consuming it (e.g. to show the invitee's email). */
export async function peekToken(purpose: TokenPurpose, token: string): Promise<string | null> {
  if (!token) return null;
  const [row] = await db
    .select({ identifier: verificationTokens.identifier })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.token, hash(token)),
        like(verificationTokens.identifier, `${purpose}:%`),
        gt(verificationTokens.expires, new Date()),
      ),
    )
    .limit(1);
  return row ? row.identifier.slice(purpose.length + 1) : null;
}
