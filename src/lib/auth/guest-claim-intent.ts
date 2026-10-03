import { createHmac, timingSafeEqual } from "node:crypto";
import { isGuestUserId } from "@/lib/auth/guest";

const GUEST_CLAIM_INTENT_COOKIE = "vf_guest_claim_intent";
const DEFAULT_GUEST_CLAIM_INTENT_TTL_SECONDS = 10 * 60;

type GuestClaimIntentPayload = {
  g: string;
  e: number;
};

function resolveSecret(explicitSecret?: string): string {
  return explicitSecret?.trim()
    || process.env.GUEST_CLAIM_INTENT_SECRET?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || "";
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function getGuestClaimIntentCookieName(): string {
  return GUEST_CLAIM_INTENT_COOKIE;
}

export function getGuestClaimIntentCookieOptions(maxAge = DEFAULT_GUEST_CLAIM_INTENT_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  };
}

export function issueGuestClaimIntent(params: {
  guestId: string;
  secret?: string;
  nowMs?: number;
  ttlSeconds?: number;
}): string | undefined {
  const guestId = params.guestId.trim().toLowerCase();
  const secret = resolveSecret(params.secret);
  if (!secret || !isGuestUserId(guestId)) return undefined;

  const payload: GuestClaimIntentPayload = {
    g: guestId,
    e: Math.floor((params.nowMs ?? Date.now()) / 1000)
      + Math.max(30, Math.floor(params.ttlSeconds ?? DEFAULT_GUEST_CLAIM_INTENT_TTL_SECONDS))
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signPayload(encoded, secret)}`;
}

export function verifyGuestClaimIntent(params: {
  token?: string | null;
  guestId: string;
  secret?: string;
  nowMs?: number;
}): boolean {
  const secret = resolveSecret(params.secret);
  const token = params.token?.trim() ?? "";
  const guestId = params.guestId.trim().toLowerCase();
  if (!secret || !token || !isGuestUserId(guestId)) return false;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return false;
  const expected = signPayload(encoded, secret);
  if (signature.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<GuestClaimIntentPayload>;
    const nowSeconds = Math.floor((params.nowMs ?? Date.now()) / 1000);
    return payload.g?.toLowerCase() === guestId
      && Number.isFinite(payload.e)
      && Number(payload.e) > nowSeconds;
  } catch {
    return false;
  }
}

export function readGuestClaimIntentFromCookieHeader(cookieHeader?: string | null): string | undefined {
  for (const segment of cookieHeader?.split(";") ?? []) {
    const [name, ...valueParts] = segment.trim().split("=");
    if (name !== GUEST_CLAIM_INTENT_COOKIE) continue;
    const rawValue = valueParts.join("=");
    try {
      return decodeURIComponent(rawValue).trim() || undefined;
    } catch {
      return rawValue.trim() || undefined;
    }
  }
  return undefined;
}
