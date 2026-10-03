import { createHmac, timingSafeEqual } from "node:crypto";

type JobPollTokenPayload = {
  j: string;
  u?: string;
  e: number;
};

const DEFAULT_TTL_SEC = 30 * 60;
const tokenSecret =
  process.env.CLAWVISUAL_JOB_POLL_SECRET?.trim()
  || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  || "";

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(payloadB64: string): string {
  return createHmac("sha256", tokenSecret).update(payloadB64).digest("base64url");
}

function normalizeOwnerUserId(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function issueJobPollToken(jobId: string, ownerUserId?: string, ttlSec = DEFAULT_TTL_SEC): string | undefined {
  if (!tokenSecret) return undefined;
  const id = String(jobId).trim();
  if (!id) return undefined;

  const payload: JobPollTokenPayload = {
    j: id,
    u: normalizeOwnerUserId(ownerUserId),
    e: Math.floor(Date.now() / 1000) + Math.max(30, Math.floor(ttlSec))
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function verifyJobPollToken(token: string | null | undefined, expectedJobId: string): {
  ok: boolean;
  ownerUserId?: string;
} {
  if (!tokenSecret) return { ok: false };
  const raw = String(token ?? "").trim();
  if (!raw) return { ok: false };

  const [payloadB64, signature] = raw.split(".");
  if (!payloadB64 || !signature) return { ok: false };

  const expectedSignature = signPayload(payloadB64);
  if (signature.length !== expectedSignature.length) return { ok: false };
  const isValidSig = timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  if (!isValidSig) return { ok: false };

  try {
    const parsed = JSON.parse(base64UrlDecode(payloadB64)) as Partial<JobPollTokenPayload>;
    const tokenJobId = String(parsed?.j ?? "").trim();
    const expiresAt = Number(parsed?.e ?? 0);
    if (!tokenJobId || tokenJobId !== String(expectedJobId).trim()) return { ok: false };
    if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return { ok: false };
    return {
      ok: true,
      ownerUserId: normalizeOwnerUserId(parsed?.u)
    };
  } catch {
    return { ok: false };
  }
}

export function buildJobStatusUrl(jobId: string, ownerUserId?: string, basePath = "/api/v1/jobs"): string {
  const normalizedBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  const path = `${normalizedBase}/${encodeURIComponent(jobId)}`;
  const token = issueJobPollToken(jobId, ownerUserId);
  if (!token) return path;
  const params = new URLSearchParams({ poll_token: token });
  return `${path}?${params.toString()}`;
}
