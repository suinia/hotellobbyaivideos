const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

export type SupabaseAuthProvider = "google" | "apple" | "email";

const authProviders = (process.env.NEXT_PUBLIC_SUPABASE_AUTH_PROVIDERS ?? "google,email")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter((item): item is SupabaseAuthProvider => item === "google" || item === "apple" || item === "email");

export const supabaseConfig = {
  url,
  anonKey,
  serviceRoleKey,
  authProviders,
  enabled: Boolean(url && anonKey),
  adminEnabled: Boolean(url && serviceRoleKey)
};

export function getSupabaseRedirectUrl(pathname = "/auth/callback"): string {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim()
    || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
    || process.env.VERCEL_URL?.trim()
    || "";

  if (!appUrl) {
    return pathname;
  }

  const normalizedBase = appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;
  return new URL(pathname, normalizedBase).toString();
}
