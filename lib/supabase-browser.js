import { createBrowserClient } from "@supabase/ssr";

// Reads from env vars set in .env.local (see README for setup).
// Never hardcode these — the anon key is safe to expose client-side,
// but only because Row Level Security (schema.sql) locks every table
// to auth.uid(). Without RLS this key alone would expose everyone's data.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
