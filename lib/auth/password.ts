import bcrypt from 'bcryptjs';

// Cost 10 matches Supabase (GoTrue), so migrated and new hashes cost the same to verify.
const BCRYPT_COST = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// A precomputed hash to compare against when the email is unknown, so a login
// for a missing account takes as long as one with a wrong password.
export const DUMMY_HASH = '$2b$10$z49MP.Z7M3gm3VlGrlLtvONyZ/nRmp16XON7iwBQpjinc.r5AM3QO';
