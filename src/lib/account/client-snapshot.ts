export type ClientAccountContext = "socialmedia";

export type ClientAccountApiUser = {
  id?: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  plan?: string;
  credit_balance?: number;
  auth_mode?: "supabase" | "guest" | "guest_claimed";
  pricing_variant?: string | null;
  claimed_email?: string;
  claimed_providers?: string[];
};

export type ClientAccountApiResponse = {
  enabled?: boolean;
  authenticated?: boolean;
  guest?: boolean;
  claimed?: boolean;
  user?: ClientAccountApiUser | null;
};

export class ClientAccountRequestError extends Error {
  status: number;

  constructor(status: number) {
    super(`Failed to load account: ${status}`);
    this.status = status;
  }
}

type ClientAccountRequest = {
  promise: Promise<ClientAccountApiResponse>;
  force: boolean;
};

type ClientAccountRequestState = {
  cache?: {
    value: ClientAccountApiResponse;
    expiresAt: number;
  };
  request?: ClientAccountRequest;
  version: number;
};

const ACCOUNT_CACHE_TTL_MS = 5_000;
const accountRequestStates = new Map<string, ClientAccountRequestState>();

function getRequestState(context?: ClientAccountContext): ClientAccountRequestState {
  const key = context ?? "default";
  const existing = accountRequestStates.get(key);
  if (existing) return existing;

  const state: ClientAccountRequestState = { version: 0 };
  accountRequestStates.set(key, state);
  return state;
}

function buildAccountUrl(options: { context?: ClientAccountContext; force?: boolean }): string {
  const searchParams = new URLSearchParams();
  if (options.context) searchParams.set("context", options.context);
  if (options.force) searchParams.set("sync", "1");
  const query = searchParams.toString();
  return query ? `/api/v1/account?${query}` : "/api/v1/account";
}

export function loadClientAccountSnapshot(options: {
  context?: ClientAccountContext;
  force?: boolean;
} = {}): Promise<ClientAccountApiResponse> {
  const force = Boolean(options.force);
  const state = getRequestState(options.context);
  const now = Date.now();

  if (!force && state.cache && state.cache.expiresAt > now) {
    return Promise.resolve(state.cache.value);
  }
  if (state.request && (!force || state.request.force)) {
    return state.request.promise;
  }

  const requestVersion = ++state.version;
  const promise = fetch(buildAccountUrl(options), {
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: "application/json" }
  }).then(async (response) => {
    if (!response.ok) throw new ClientAccountRequestError(response.status);

    const data = await response.json() as ClientAccountApiResponse;
    if (state.version === requestVersion) {
      state.cache = {
        value: data,
        expiresAt: Date.now() + ACCOUNT_CACHE_TTL_MS
      };
    }
    return data;
  }).finally(() => {
    if (state.request?.promise === promise) {
      state.request = undefined;
    }
  });

  state.request = { promise, force };
  return promise;
}
