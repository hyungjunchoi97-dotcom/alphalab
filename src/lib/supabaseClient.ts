import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Create a real client only if env vars are set (avoids build-time crash)
export const supabase: SupabaseClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : (new Proxy({} as SupabaseClient, {
        get: (_target, prop) => {
          if (prop === "auth") {
            return {
              getSession: async () => ({ data: { session: null }, error: null }),
              onAuthStateChange: () => ({
                data: { subscription: { unsubscribe: () => {} } },
              }),
              signInWithPassword: async () => ({
                error: { message: "Supabase not configured" },
              }),
              signUp: async () => ({
                error: { message: "Supabase not configured" },
              }),
              signInWithOAuth: async () => ({
                error: { message: "Supabase not configured" },
              }),
              signOut: async () => ({}),
            };
          }
          return () => {};
        },
      }) as unknown as SupabaseClient);
