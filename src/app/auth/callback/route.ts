import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { getGuestClaimIntentCookieName, getGuestClaimIntentCookieOptions } from "@/lib/auth/guest-claim-intent";
import { safeReturnPath } from "@/lib/auth/safe-return-path";
export async function GET(request: Request) { const url = new URL(request.url); const target = new URL(safeReturnPath(url.searchParams.get("next")), url.origin); const code = url.searchParams.get("code"); let error = url.searchParams.get("error"); if (!error && code && supabaseConfig.enabled) {
    try {
        const client = await createSupabaseServerClient();
        const result = await client.auth.exchangeCodeForSession(code);
        if (result.error) {
            const { data } = await client.auth.getUser();
            if (!data.user)
                error = "oauth_callback_failed";
        }
    }
    catch {
        error = "oauth_callback_failed";
    }
} if (error)
    target.searchParams.set("auth_error", error); const response = NextResponse.redirect(target); if (error || !code)
    response.cookies.set(getGuestClaimIntentCookieName(), "", getGuestClaimIntentCookieOptions(0)); return response; }
