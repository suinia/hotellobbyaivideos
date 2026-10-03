import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "@/lib/supabase/config";

type CreateSupabaseServerClientOptions = {
  fetch?: typeof fetch;
};

export async function createSupabaseServerClient(options?: CreateSupabaseServerClientOptions) {
  if (!supabaseConfig.enabled) {
    throw new Error("Supabase public environment variables are not configured.");
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseConfig.url, supabaseConfig.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Ignore cookie writes in render contexts where response cookies are immutable.
        }
      }
    },
    ...(options?.fetch ? { global: { fetch: options.fetch } } : {})
  });
}
