import { createBrowserClient } from '@supabase/ssr';

// Browser/client Supabase client. Writes auth to cookies so that the
// server-side middleware (which uses createServerClient) can see the session.
// Only import this from client components — for API routes, instantiate a
// fresh createClient or createServerClient inline.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
