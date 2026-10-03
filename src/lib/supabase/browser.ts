"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/supabase/config";

let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!supabaseConfig.enabled) {
    return null;
  }

  if (!client) {
    client = createBrowserClient(supabaseConfig.url, supabaseConfig.anonKey);
  }

  return client;
}
