"use client";

import type { PricingVariant } from "@/lib/billing/catalog";
import { buildClientFlagsActorId, setClientFlagsActor } from "@/lib/flags/client";
import type { SupabaseAuthProvider } from "@/lib/supabase/config";
import { buildGuestUserRequestHeaders } from "@/lib/telemetry/client";

export type SocialmediaAccountUser = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  plan: "free" | "basic" | "pro" | "max";
  starter_access?: boolean;
  pricing_variant?: PricingVariant | null;
  billing_market?: "default" | "gb" | "ca";
  billing_currency?: "USD" | "GBP" | "CAD";
  subscription_package_id?: string | null;
  pricing_experiment_key?: string | null;
  credit_balance: number;
  auth_mode?: "supabase" | "guest" | "guest_claimed";
  claimed_email?: string;
  claimed_providers?: SupabaseAuthProvider[];
  can_generate?: boolean;
};

export type SocialmediaAccountResponse = {
  enabled: boolean;
  authenticated: boolean;
  billing_market?: "default" | "gb" | "ca";
  billing_currency?: "USD" | "GBP" | "CAD";
  claimed?: boolean;
  claimed_email?: string;
  claimed_providers?: SupabaseAuthProvider[];
  code?: string;
  message?: string;
  auth_providers?: SupabaseAuthProvider[];
  user?: SocialmediaAccountUser;
};

export type SocialmediaAccountUserPatch = Partial<SocialmediaAccountUser>;

export const SOCIALMEDIA_ACCOUNT_SNAPSHOT_EVENT = "vismuse:socialmedia-account-snapshot";
export const SOCIALMEDIA_ACCOUNT_USER_PATCH_EVENT = "vismuse:socialmedia-account-user-patch";

const ACCOUNT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const AUTH_PENDING_STORAGE_KEY = "vismuse_socialmedia_pending_auth";
const PENDING_GUEST_CLAIM_HEADER = "x-vismuse-pending-guest-claim";

let accountCache: { value: SocialmediaAccountResponse; expiresAt: number } | null = null;
let accountInFlight: { request: Promise<SocialmediaAccountResponse>; sync: boolean } | null = null;

function hasPendingGuestClaim(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(AUTH_PENDING_STORAGE_KEY);
    if (!raw) return false;
    const pending = JSON.parse(raw) as { guestId?: unknown; claimGuest?: unknown };
    return pending.claimGuest === true && typeof pending.guestId === "string" && pending.guestId.trim().length > 0;
  } catch {
    return false;
  }
}

export function dispatchSocialmediaAccountSnapshot(user: SocialmediaAccountUser | null): void {
  if (typeof window === "undefined") return;
  setClientFlagsActor(buildClientFlagsActorId(user));
  window.dispatchEvent(new CustomEvent(SOCIALMEDIA_ACCOUNT_SNAPSHOT_EVENT, {
    detail: {
      user
    }
  }));
}

function isCompatibleAccountPatch(current: SocialmediaAccountUser, patch: SocialmediaAccountUserPatch): boolean {
  if (patch.id && current.id && patch.id !== current.id) {
    return false;
  }
  return true;
}

export function patchSocialmediaAccountUser(patch: SocialmediaAccountUserPatch): SocialmediaAccountUser | null {
  if (typeof window === "undefined") return null;
  if (!patch || Object.keys(patch).length === 0) return null;

  let nextUser: SocialmediaAccountUser | null = null;
  if (accountCache?.value.user && isCompatibleAccountPatch(accountCache.value.user, patch)) {
    nextUser = {
      ...accountCache.value.user,
      ...patch
    };
    accountCache = {
      value: {
        ...accountCache.value,
        user: nextUser
      },
      expiresAt: Math.max(accountCache.expiresAt, Date.now() + ACCOUNT_CACHE_TTL_MS)
    };
    dispatchSocialmediaAccountSnapshot(nextUser);
  }

  window.dispatchEvent(new CustomEvent(SOCIALMEDIA_ACCOUNT_USER_PATCH_EVENT, {
    detail: {
      user: patch
    }
  }));

  return nextUser;
}

export async function fetchSocialmediaAccount(options?: {
  force?: boolean;
  sync?: boolean;
}): Promise<SocialmediaAccountResponse> {
  const now = Date.now();
  const sync = Boolean(options?.sync);
  if (!options?.force && accountCache && accountCache.expiresAt > now) {
    return accountCache.value;
  }
  if (!options?.force && accountInFlight && (!sync || accountInFlight.sync)) {
    return accountInFlight.request;
  }

  const params = new URLSearchParams({ context: "socialmedia" });
  if (sync) {
    params.set("sync", "1");
  }

  const headers = buildGuestUserRequestHeaders();
  if (hasPendingGuestClaim()) {
    headers[PENDING_GUEST_CLAIM_HEADER] = "1";
  }

  const request = fetch(`/api/v1/account?${params.toString()}`, {
    cache: "no-store",
    headers
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load account: ${response.status}`);
      }
      const data = await response.json() as SocialmediaAccountResponse;
      accountCache = {
        value: data,
        expiresAt: Date.now() + ACCOUNT_CACHE_TTL_MS
      };
      setClientFlagsActor(buildClientFlagsActorId(data.user));
      return data;
    })
    .finally(() => {
      if (accountInFlight?.request === request) {
        accountInFlight = null;
      }
    });

  accountInFlight = { request, sync };
  return request;
}

export function clearSocialmediaAccountCache(options?: { clearInFlight?: boolean }): void {
  accountCache = null;
  if (options?.clearInFlight) {
    accountInFlight = null;
  }
}
