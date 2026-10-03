import { STARTER_PACK_PACKAGE_IDS } from "@/lib/billing/credits";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";

export type StarterPackCreditWindow = {
  ledgerId: string;
  createdAt: string;
  expiresAt?: string | null;
  remainingCredits: number;
};

type CreditLedgerAccessRow = {
  id?: string | null;
  job_id?: string | null;
  type?: string | null;
  amount?: number | null;
  note?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
};

type SimulatedCreditLot = {
  id: string;
  remaining: number;
  starterPack: boolean;
  createdAtMs: number;
  expiresAtMs?: number;
};

type StarterPackGrantRow = {
  id?: string;
  created_at?: string | null;
  expires_at?: string | null;
};

type CreditLotConsumptionRow = {
  ledger_id?: string | null;
  lot_id?: string | null;
};

type CreditLotSourceRow = {
  id?: string | null;
  source_ledger_id?: string | null;
};

type CachedValue<T> = {
  expiresAt: number;
  value: T;
};

const STARTER_PACK_ACCESS_CACHE_TTL_MS = Math.max(
  5_000,
  Number(process.env.STARTER_PACK_ACCESS_CACHE_TTL_MS ?? 15_000) || 15_000
);
const starterPackGrantRowsCache = new Map<string, CachedValue<StarterPackGrantRow[]>>();
const starterPackGrantRowsInflight = new Map<string, Promise<StarterPackGrantRow[]>>();
const starterPackCreditHoldCache = new Map<string, CachedValue<Set<string>>>();
const starterPackCreditHoldInflight = new Map<string, Promise<Set<string>>>();
const activeStarterPackWindowsCache = new Map<string, CachedValue<StarterPackCreditWindow[]>>();
const activeStarterPackWindowsInflight = new Map<string, Promise<StarterPackCreditWindow[]>>();

function getCachedValue<T>(cache: Map<string, CachedValue<T>>, key: string): T | null {
  const cached = cache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedValue<T>(cache: Map<string, CachedValue<T>>, key: string, value: T): T {
  cache.set(key, {
    expiresAt: Date.now() + STARTER_PACK_ACCESS_CACHE_TTL_MS,
    value
  });
  return value;
}

function isMissingCreditLotConsumptionsTableError(error: { message?: string; code?: string }): boolean {
  const message = error.message ?? "";
  return (
    error.code === "PGRST205"
    || message.includes("Could not find the table 'public.credit_lot_consumptions'")
    || message.includes("relation \"public.credit_lot_consumptions\" does not exist")
  );
}

function buildJobIdsCacheKey(userId: string, jobIds: string[]): string {
  return `${userId}:${[...new Set(jobIds.map((jobId) => jobId.trim()).filter(Boolean))].sort().join(",")}`;
}

export async function hasActiveStarterPackCredits(userId: string): Promise<boolean> {
  return (await listActiveStarterPackCreditWindows(userId)).length > 0;
}

export async function hasStarterPackCreditsForAmount(userId: string, amount: number): Promise<boolean> {
  const requiredCredits = Math.max(1, Math.ceil(Number(amount) || 0));
  return (await getStarterPackCreditBalance(userId)) >= requiredCredits;
}

export async function getStarterPackCreditBalance(userId: string): Promise<number> {
  const windows = await listActiveStarterPackCreditWindows(userId);
  return windows.reduce((total, window) => total + Math.max(0, Number(window.remainingCredits) || 0), 0);
}

export async function hasUnexpiredStarterPackGrant(userId: string): Promise<boolean> {
  return (await listUnexpiredStarterPackGrantRows(userId)).length > 0;
}

export async function hasStarterPackCreditHoldForJob(userId: string, jobId: string): Promise<boolean> {
  const normalizedJobId = jobId.trim();
  if (!normalizedJobId) return false;
  return (await listStarterPackCreditHoldJobIds(userId, [normalizedJobId])).has(normalizedJobId);
}

export async function listStarterPackCreditHoldJobIds(userId: string, jobIds: string[]): Promise<Set<string>> {
  const normalizedJobIds = [...new Set(jobIds.map((jobId) => jobId.trim()).filter(Boolean))];
  if (!normalizedJobIds.length || !supabaseConfig.adminEnabled || !STARTER_PACK_PACKAGE_IDS.length) return new Set();

  const cacheKey = buildJobIdsCacheKey(userId, normalizedJobIds);
  const cached = getCachedValue(starterPackCreditHoldCache, cacheKey);
  if (cached) return cached;
  const inflight = starterPackCreditHoldInflight.get(cacheKey);
  if (inflight) return inflight;

  const promise = listStarterPackCreditHoldJobIdsUncached(userId, normalizedJobIds)
    .then((value) => setCachedValue(starterPackCreditHoldCache, cacheKey, value))
    .finally(() => {
      starterPackCreditHoldInflight.delete(cacheKey);
    });
  starterPackCreditHoldInflight.set(cacheKey, promise);
  return promise;
}

async function listStarterPackCreditHoldJobIdsUncached(userId: string, normalizedJobIds: string[]): Promise<Set<string>> {
  const recordedConsumptionJobIds = await listStarterPackCreditHoldJobIdsFromRecordedConsumptions(userId, normalizedJobIds);
  if (recordedConsumptionJobIds) return recordedConsumptionJobIds;

  const { data, error } = await getSupabaseAdminClient()
    .from("credit_ledger")
    .select("id, job_id, type, amount, note, expires_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("[billing] failed to read credit ledger for starter pack access", {
      userId,
      jobIds: normalizedJobIds,
      error: error.message
    });
    return new Set();
  }

  const targetJobIds = new Set(normalizedJobIds);
  const starterHoldJobIds = new Set<string>();
  const lots: SimulatedCreditLot[] = [];

  for (const row of (data ?? []) as CreditLedgerAccessRow[]) {
    const amount = Number(row.amount ?? 0);
    const createdAtMs = Date.parse(row.created_at ?? "");
    if (!Number.isFinite(createdAtMs) || amount === 0) continue;

    if (amount > 0) {
      lots.push({
        id: row.id?.trim() ?? "",
        remaining: amount,
        starterPack: isStarterPackGrantLedgerRow(row),
        createdAtMs,
        expiresAtMs: parseOptionalTime(row.expires_at)
      });
      continue;
    }

    const consumedStarterPackCredits = consumeSimulatedCreditLots(lots, Math.abs(amount), createdAtMs);
    const jobId = row.type === "hold" || row.type === "consume"
      ? row.job_id?.trim()
      : undefined;
    if (jobId && targetJobIds.has(jobId) && consumedStarterPackCredits) {
      starterHoldJobIds.add(jobId);
    }
  }

  return starterHoldJobIds;
}

async function listStarterPackCreditHoldJobIdsFromRecordedConsumptions(
  userId: string,
  normalizedJobIds: string[]
): Promise<Set<string> | null> {
  const admin = getSupabaseAdminClient();
  const { data: debitRows, error: debitError } = await admin
    .from("credit_ledger")
    .select("id, job_id")
    .eq("user_id", userId)
    .in("type", ["hold", "consume"])
    .in("job_id", normalizedJobIds);
  if (debitError) {
    console.warn("[billing] failed to read starter pack hold ledger rows", {
      userId,
      jobIds: normalizedJobIds,
      error: debitError.message
    });
    return null;
  }

  const jobIdByLedgerId = new Map<string, string>();
  for (const row of debitRows ?? []) {
    const item = row as { id?: string | null; job_id?: string | null };
    const ledgerId = item.id?.trim();
    const jobId = item.job_id?.trim();
    if (ledgerId && jobId) jobIdByLedgerId.set(ledgerId, jobId);
  }
  const ledgerIds = [...jobIdByLedgerId.keys()];
  if (!ledgerIds.length) return new Set();

  const { data: consumptionRows, error: consumptionError } = await admin
    .from("credit_lot_consumptions")
    .select("ledger_id, lot_id")
    .in("ledger_id", ledgerIds);
  if (consumptionError) {
    if (isMissingCreditLotConsumptionsTableError(consumptionError)) return null;
    console.warn("[billing] failed to read credit lot consumptions for starter pack access", {
      userId,
      jobIds: normalizedJobIds,
      error: consumptionError.message
    });
    return null;
  }

  const lotIds = [...new Set((consumptionRows ?? [])
    .map((row) => (row as CreditLotConsumptionRow).lot_id?.trim())
    .filter((lotId): lotId is string => Boolean(lotId)))];
  if (!lotIds.length) return null;

  const { data: lotRows, error: lotError } = await admin
    .from("credit_lots")
    .select("id, source_ledger_id")
    .in("id", lotIds);
  if (lotError) {
    console.warn("[billing] failed to read consumed credit lots for starter pack access", {
      userId,
      jobIds: normalizedJobIds,
      error: lotError.message
    });
    return null;
  }

  const sourceLedgerIdByLotId = new Map<string, string>();
  for (const row of lotRows ?? []) {
    const item = row as CreditLotSourceRow;
    const lotId = item.id?.trim();
    const sourceLedgerId = item.source_ledger_id?.trim();
    if (lotId && sourceLedgerId) sourceLedgerIdByLotId.set(lotId, sourceLedgerId);
  }
  const sourceLedgerIds = [...new Set([...sourceLedgerIdByLotId.values()])];
  if (!sourceLedgerIds.length) return null;

  const { data: sourceLedgerRows, error: sourceLedgerError } = await admin
    .from("credit_ledger")
    .select("id, type, amount, note")
    .eq("user_id", userId)
    .in("id", sourceLedgerIds);
  if (sourceLedgerError) {
    console.warn("[billing] failed to read credit lot source ledgers for starter pack access", {
      userId,
      jobIds: normalizedJobIds,
      error: sourceLedgerError.message
    });
    return null;
  }

  const starterPackSourceLedgerIds = new Set((sourceLedgerRows ?? [])
    .filter((row) => isStarterPackGrantLedgerRow(row as CreditLedgerAccessRow))
    .map((row) => (row as { id?: string | null }).id?.trim())
    .filter((ledgerId): ledgerId is string => Boolean(ledgerId)));
  if (!starterPackSourceLedgerIds.size) return new Set();

  const starterPackHoldJobIds = new Set<string>();
  for (const row of consumptionRows ?? []) {
    const item = row as CreditLotConsumptionRow;
    const ledgerId = item.ledger_id?.trim();
    const lotId = item.lot_id?.trim();
    const sourceLedgerId = lotId ? sourceLedgerIdByLotId.get(lotId) : undefined;
    const jobId = ledgerId ? jobIdByLedgerId.get(ledgerId) : undefined;
    if (jobId && sourceLedgerId && starterPackSourceLedgerIds.has(sourceLedgerId)) {
      starterPackHoldJobIds.add(jobId);
    }
  }
  return starterPackHoldJobIds;
}

export async function listActiveStarterPackCreditWindows(userId: string): Promise<StarterPackCreditWindow[]> {
  const cached = getCachedValue(activeStarterPackWindowsCache, userId);
  if (cached) return cached;
  const inflight = activeStarterPackWindowsInflight.get(userId);
  if (inflight) return inflight;

  const promise = listActiveStarterPackCreditWindowsUncached(userId)
    .then((value) => setCachedValue(activeStarterPackWindowsCache, userId, value))
    .finally(() => {
      activeStarterPackWindowsInflight.delete(userId);
    });
  activeStarterPackWindowsInflight.set(userId, promise);
  return promise;
}

async function listActiveStarterPackCreditWindowsUncached(userId: string): Promise<StarterPackCreditWindow[]> {
  const ledgerRows = await listUnexpiredStarterPackGrantRows(userId);

  const ledgerById = new Map<string, { id?: string; created_at?: string | null; expires_at?: string | null }>();
  for (const row of ledgerRows ?? []) {
    const ledgerId = row.id?.trim();
    if (ledgerId) ledgerById.set(ledgerId, row);
  }
  const ledgerIds = [...ledgerById.keys()];
  if (!ledgerIds.length) return [];

  const admin = getSupabaseAdminClient();
  const { data: lotRows, error: lotError } = await admin
    .from("credit_lots")
    .select("source_ledger_id, remaining_amount")
    .eq("user_id", userId)
    .gt("remaining_amount", 0)
    .in("source_ledger_id", ledgerIds);
  if (lotError) {
    console.warn("[billing] failed to read starter pack credit lots", {
      userId,
      error: lotError.message
    });
    return [];
  }

  const remainingByLedgerId = new Map<string, number>();
  for (const row of lotRows ?? []) {
    const item = row as { source_ledger_id?: string | null; remaining_amount?: number | null };
    const ledgerId = item.source_ledger_id?.trim();
    if (!ledgerId) continue;
    remainingByLedgerId.set(ledgerId, (remainingByLedgerId.get(ledgerId) ?? 0) + Number(item.remaining_amount ?? 0));
  }

  return ledgerIds.flatMap((ledgerId) => {
    const ledger = ledgerById.get(ledgerId);
    const remainingCredits = remainingByLedgerId.get(ledgerId) ?? 0;
    if (!ledger?.created_at || remainingCredits <= 0) return [];
    return [{
      ledgerId,
      createdAt: ledger.created_at,
      expiresAt: ledger.expires_at,
      remainingCredits
    }];
  });
}

export async function listStarterPackCreditWindows(userId: string): Promise<StarterPackCreditWindow[]> {
  const ledgerRows = await listStarterPackGrantRows(userId);
  return ledgerRows.flatMap((row) => {
    const ledgerId = row.id?.trim();
    if (!ledgerId || !row.created_at) return [];
    return [{
      ledgerId,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      remainingCredits: 0
    }];
  });
}

async function listUnexpiredStarterPackGrantRows(userId: string): Promise<Array<{
  id?: string;
  created_at?: string | null;
  expires_at?: string | null;
}>> {
  const rows = await listStarterPackGrantRows(userId);
  const nowMs = Date.now();
  return rows.filter((row) => {
    if (!row.expires_at) return true;
    const expiresAtMs = Date.parse(row.expires_at ?? "");
    return !Number.isFinite(expiresAtMs) || expiresAtMs > nowMs;
  });
}

async function listStarterPackGrantRows(userId: string): Promise<Array<{
  id?: string;
  created_at?: string | null;
  expires_at?: string | null;
}>> {
  if (!supabaseConfig.adminEnabled || !STARTER_PACK_PACKAGE_IDS.length) return [];

  const cached = getCachedValue(starterPackGrantRowsCache, userId);
  if (cached) return cached;
  const inflight = starterPackGrantRowsInflight.get(userId);
  if (inflight) return inflight;

  const promise = listStarterPackGrantRowsUncached(userId)
    .then((value) => setCachedValue(starterPackGrantRowsCache, userId, value))
    .finally(() => {
      starterPackGrantRowsInflight.delete(userId);
    });
  starterPackGrantRowsInflight.set(userId, promise);
  return promise;
}

async function listStarterPackGrantRowsUncached(userId: string): Promise<StarterPackGrantRow[]> {
  const packageMatchers = STARTER_PACK_PACKAGE_IDS.map((packageId) => `note.ilike.%recharge ${packageId} (%`);
  packageMatchers.push("note.ilike.%starter_pack_watermark_free%");
  const { data, error } = await getSupabaseAdminClient()
    .from("credit_ledger")
    .select("id, created_at, expires_at")
    .eq("user_id", userId)
    .eq("type", "grant")
    .gt("amount", 0)
    .or(packageMatchers.join(","))
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("[billing] failed to read starter pack ledger", {
      userId,
      error: error.message
    });
    return [];
  }
  return (data ?? []) as Array<{ id?: string; created_at?: string | null; expires_at?: string | null }>;
}

function isStarterPackGrantLedgerRow(row: CreditLedgerAccessRow): boolean {
  if (row.type !== "grant" || Number(row.amount ?? 0) <= 0) return false;
  const note = row.note ?? "";
  return note.includes("starter_pack_watermark_free")
    || STARTER_PACK_PACKAGE_IDS.some((packageId) => note.includes(`recharge ${packageId} (`));
}

function parseOptionalTime(value?: string | null): number | undefined {
  const timeMs = Date.parse(value ?? "");
  return Number.isFinite(timeMs) ? timeMs : undefined;
}

function consumeSimulatedCreditLots(lots: SimulatedCreditLot[], amount: number, atMs: number): boolean {
  let remainingToConsume = Math.max(0, Math.ceil(amount));
  if (remainingToConsume <= 0) return false;

  lots.sort((left, right) => {
    const leftExpiry = left.expiresAtMs ?? Number.POSITIVE_INFINITY;
    const rightExpiry = right.expiresAtMs ?? Number.POSITIVE_INFINITY;
    if (leftExpiry !== rightExpiry) return leftExpiry - rightExpiry;
    if (left.createdAtMs !== right.createdAtMs) return left.createdAtMs - right.createdAtMs;
    return left.id.localeCompare(right.id);
  });

  let consumedStarterPackCredits = false;
  for (const lot of lots) {
    if (remainingToConsume <= 0) break;
    if (lot.remaining <= 0) continue;
    if (typeof lot.expiresAtMs === "number" && lot.expiresAtMs <= atMs) continue;

    const consumed = Math.min(lot.remaining, remainingToConsume);
    lot.remaining -= consumed;
    remainingToConsume -= consumed;
    if (consumed > 0 && lot.starterPack) {
      consumedStarterPackCredits = true;
    }
  }

  return consumedStarterPackCredits;
}
