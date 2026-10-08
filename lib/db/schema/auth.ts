import type { AdapterAccountType } from 'next-auth/adapters';
import { index, integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Auth.js tables. The adapter maps by JS property name, so the SQL names follow
// the app's snake_case convention while the keys match what the adapter expects.
//
// users.id is a uuid so existing Supabase auth.users ids carry over unchanged and
// members.id can keep pointing at it.

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { mode: 'date', withTimezone: true }),
  image: text('image'),
  // Not part of the adapter contract: used by the Credentials provider.
  // bcrypt, so hashes copied from Supabase's auth.users.encrypted_password still verify.
  passwordHash: text('password_hash'),
  lastSignInAt: timestamp('last_sign_in_at', { mode: 'date', withTimezone: true }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index('accounts_user_id_idx').on(t.userId),
  ],
);

// Only used with the "database" session strategy. KPM signs in with Credentials,
// which Auth.js supports only with JWT sessions, so this stays empty unless the
// strategy changes. Kept so the adapter contract is complete.
export const sessions = pgTable(
  'sessions',
  {
    sessionToken: text('session_token').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expires: timestamp('expires', { mode: 'date', withTimezone: true }).notNull(),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
);

// Single-use tokens: magic links, and the app's own email verification,
// password reset and invite tokens (store a hash, never the raw token).
export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date', withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.identifier, t.token] }),
    // Links carry only the token, so lookups go by token alone.
    index('verification_tokens_token_idx').on(t.token),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
