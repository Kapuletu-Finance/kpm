import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import NextAuth, { CredentialsSignin, type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { db } from '@/lib/db';
import { accounts, rateLimits, sessions, users, verificationTokens } from '@/lib/db/schema';
import { clientIp, hitRateLimits } from '@/lib/auth/rate-limit';
import { DUMMY_HASH, verifyPassword } from '@/lib/auth/password';

declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user'];
  }
}

class EmailNotVerified extends CredentialsSignin {
  code = 'email_not_verified';
}

class RateLimited extends CredentialsSignin {
  code = 'rate_limited';
}

const credentialsSchema = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // Credentials sign-in only works with JWT sessions. It also means checking a
  // session (proxy, every API route) is a cookie decrypt, not a database query.
  // Sessions last 30 days from sign-in; nothing re-issues the cookie (see proxy.ts).
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/login' },
  logger: {
    // A wrong password is an expected outcome, not a server error.
    error(error) {
      if ((error as { type?: string }).type === 'CredentialsSignin') return;
      console.error(error);
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Brute-force protection. Enforced here so it also covers Auth.js's own
        // /api/auth/callback/credentials endpoint, not just /api/v1/auth/login.
        const limit = await hitRateLimits([
          { key: `login:email:${email}`, limit: 10, windowSeconds: 15 * 60 },
          { key: `login:ip:${clientIp(request.headers)}`, limit: 50, windowSeconds: 15 * 60 },
        ]);
        if (!limit.allowed) throw new RateLimited();

        const [user] = await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            image: users.image,
            passwordHash: users.passwordHash,
            emailVerified: users.emailVerified,
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        // Always run a bcrypt compare so response time does not reveal whether the email exists.
        const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !user.passwordHash || !ok) return null;
        if (!user.emailVerified) throw new EmailNotVerified();

        await Promise.all([
          db.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, user.id)),
          // A successful sign-in clears that account's failure count.
          db.delete(rateLimits).where(eq(rateLimits.key, `login:email:${email}`)),
        ]);

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
