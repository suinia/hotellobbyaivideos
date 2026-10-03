const PENDING_GOOGLE_PURCHASES_KEY = "vismuse_pending_google_purchases_v1";
const MAX_PENDING_GOOGLE_PURCHASES = 20;
export const PENDING_GOOGLE_PURCHASE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type PendingGooglePurchase = {
  key: string;
  checkoutId?: string;
  provider?: string;
  fallbackTransactionId?: string;
  packageId?: string;
  value?: number;
  currency?: string;
  createdAt: number;
};

type PendingGooglePurchaseStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizePendingGooglePurchase(value: unknown): PendingGooglePurchase | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const key = normalizeString(record.key);
  if (!key) return null;
  const provider = normalizeString(record.provider);

  return {
    key,
    checkoutId: normalizeString(record.checkoutId),
    ...(provider ? { provider } : {}),
    fallbackTransactionId: normalizeString(record.fallbackTransactionId),
    packageId: normalizeString(record.packageId),
    value: typeof record.value === "number" && Number.isFinite(record.value) && record.value >= 0
      ? record.value
      : undefined,
    currency: normalizeString(record.currency)?.toUpperCase(),
    createdAt: typeof record.createdAt === "number" && Number.isFinite(record.createdAt)
      ? record.createdAt
      : Number.NaN
  };
}

export function readPendingGooglePurchases(storage: PendingGooglePurchaseStorage): PendingGooglePurchase[] {
  try {
    const parsed = JSON.parse(storage.getItem(PENDING_GOOGLE_PURCHASES_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    const pending = parsed
      .map(normalizePendingGooglePurchase)
      .filter((item): item is PendingGooglePurchase => (
        Boolean(item)
        && Number.isFinite(item?.createdAt)
        && (item?.createdAt ?? 0) <= Date.now()
        && Date.now() - (item?.createdAt ?? 0) <= PENDING_GOOGLE_PURCHASE_MAX_AGE_MS
      ));
    if (pending.length !== parsed.length) {
      writePendingGooglePurchases(storage, pending);
    }
    return pending;
  } catch {
    return [];
  }
}

function writePendingGooglePurchases(
  storage: PendingGooglePurchaseStorage,
  pending: PendingGooglePurchase[]
): void {
  if (!pending.length) {
    storage.removeItem(PENDING_GOOGLE_PURCHASES_KEY);
    return;
  }
  storage.setItem(
    PENDING_GOOGLE_PURCHASES_KEY,
    JSON.stringify(pending.slice(-MAX_PENDING_GOOGLE_PURCHASES))
  );
}

export function upsertPendingGooglePurchase(
  storage: PendingGooglePurchaseStorage,
  purchase: PendingGooglePurchase
): void {
  const pending = readPendingGooglePurchases(storage);
  const existingIndex = pending.findIndex((item) => item.key === purchase.key);
  if (existingIndex >= 0) {
    pending[existingIndex] = purchase;
  } else {
    pending.push(purchase);
  }
  writePendingGooglePurchases(storage, pending);
}

export function removePendingGooglePurchase(
  storage: PendingGooglePurchaseStorage,
  key: string
): void {
  writePendingGooglePurchases(
    storage,
    readPendingGooglePurchases(storage).filter((item) => item.key !== key)
  );
}
