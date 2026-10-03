"use client";

const CHECKOUT_DISCOUNT_KEY = "vismuse:checkout_discount";
const CHECKOUT_DISCOUNT_USED_KEY = "vismuse:checkout_discount_used";
const CHECKOUT_DISCOUNT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type StoredCheckoutDiscount = {
  code: string;
  saved_at: number;
  expires_at: number;
};

export function normalizeCheckoutDiscountCode(value?: string | null): string {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (!normalized || normalized.length > 64) return "";
  return /^[A-Z0-9_-]+$/.test(normalized) ? normalized : "";
}

function readUsedCheckoutDiscountCodes(): Set<string> {
  if (typeof window === "undefined") return new Set();

  try {
    const parsed = JSON.parse(window.localStorage.getItem(CHECKOUT_DISCOUNT_USED_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((value) => normalizeCheckoutDiscountCode(String(value))).filter(Boolean));
  } catch {
    return new Set();
  }
}

export function hasUsedCheckoutDiscountCode(value?: string | null): boolean {
  const code = normalizeCheckoutDiscountCode(value);
  return Boolean(code && readUsedCheckoutDiscountCodes().has(code));
}

export function rememberCheckoutDiscountCode(value?: string | null): string {
  const code = normalizeCheckoutDiscountCode(value);
  if (!code || typeof window === "undefined") return "";
  if (hasUsedCheckoutDiscountCode(code)) return "";

  try {
    const now = Date.now();
    const stored: StoredCheckoutDiscount = {
      code,
      saved_at: now,
      expires_at: now + CHECKOUT_DISCOUNT_TTL_MS
    };
    window.localStorage.setItem(CHECKOUT_DISCOUNT_KEY, JSON.stringify(stored));
  } catch {
    // Discount links should never block checkout.
  }
  return code;
}

export function readCheckoutDiscountCode(): string {
  if (typeof window === "undefined") return "";

  try {
    const raw = window.localStorage.getItem(CHECKOUT_DISCOUNT_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as Partial<StoredCheckoutDiscount>;
    if (typeof parsed.expires_at === "number" && parsed.expires_at < Date.now()) {
      window.localStorage.removeItem(CHECKOUT_DISCOUNT_KEY);
      return "";
    }
    const code = normalizeCheckoutDiscountCode(parsed.code);
    if (hasUsedCheckoutDiscountCode(code)) {
      window.localStorage.removeItem(CHECKOUT_DISCOUNT_KEY);
      return "";
    }
    return code;
  } catch {
    return "";
  }
}

export function markCheckoutDiscountCodeUsed(value?: string | null): void {
  const code = normalizeCheckoutDiscountCode(value);
  if (!code || typeof window === "undefined") return;

  try {
    const usedCodes = readUsedCheckoutDiscountCodes();
    usedCodes.add(code);
    window.localStorage.setItem(CHECKOUT_DISCOUNT_USED_KEY, JSON.stringify([...usedCodes]));
    window.localStorage.removeItem(CHECKOUT_DISCOUNT_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function clearCheckoutDiscountCode(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(CHECKOUT_DISCOUNT_KEY);
  } catch {
    // Ignore storage failures.
  }
}
