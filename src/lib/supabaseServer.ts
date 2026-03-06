import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Service-role client for admin operations (server-side only).
// Bypasses RLS — use only in API routes after verifying admin PIN.
export const supabaseAdmin: SupabaseClient =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : ((() => {
        const errResult = Promise.resolve({
          data: null,
          error: { message: "Supabase service role not configured" },
        });
        const chainable: Record<string, unknown> = {};
        const handler: ProxyHandler<Record<string, unknown>> = {
          get: (_target, prop) => {
            if (prop === "then" || prop === "catch" || prop === "finally") {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return (...args: any[]) => (errResult as any)[prop](...args);
            }
            return (..._args: unknown[]) => new Proxy(chainable, handler);
          },
        };
        return new Proxy(chainable, handler) as unknown as SupabaseClient;
      })());
