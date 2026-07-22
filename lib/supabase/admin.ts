import { createClient } from '@supabase/supabase-js';

// Note: This must NEVER be used on the client-side.
// The service role key bypasses Row Level Security (RLS) entirely.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
