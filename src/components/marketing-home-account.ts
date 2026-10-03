import { useAppAccountStore } from "@/app/app/_components/app-account-store";
import {
  appAccountSummary,
  type AppAccountSummary
} from "@/app/app/_components/app-data";
import {
  loadClientAccountSnapshot,
  type ClientAccountApiResponse
} from "@/lib/account/client-snapshot";

function readDevelopmentMockAccount(): AppAccountSummary | null {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return null;
  const searchParams = new URL(window.location.href).searchParams;
  const requestedPlan = searchParams.get("mock_account")?.trim().toLowerCase();
  if (requestedPlan !== "free" && requestedPlan !== "basic" && requestedPlan !== "pro" && requestedPlan !== "max") {
    return null;
  }
  const requestedCredits = Number(searchParams.get("credits") ?? 0);
  const credits = Number.isFinite(requestedCredits) ? Math.max(0, Math.floor(requestedCredits)) : 0;
  const displayName = `${requestedPlan.charAt(0).toUpperCase()}${requestedPlan.slice(1)} Preview`;
  return {
    ...appAccountSummary,
    id: `mock-${requestedPlan}-homepage-user`,
    isLoggedIn: true,
    plan: requestedPlan,
    credits,
    initial: displayName.charAt(0),
    displayName,
    email: `${requestedPlan}.preview@vismuse.test`,
    authMode: "supabase"
  };
}

function toMarketingAccountSummary(data: ClientAccountApiResponse): AppAccountSummary {
  const user = data.user;
  if (!user) return appAccountSummary;

  const authMode = user.auth_mode;
  const isLoggedIn = Boolean(data.authenticated && authMode === "supabase");
  const displayName = user.display_name?.trim()
    || (isLoggedIn ? user.email?.split("@")[0] || "Vismuse User" : "Guest");

  return {
    ...appAccountSummary,
    id: user.id?.trim() || "",
    isLoggedIn,
    plan: user.plan === "basic" || user.plan === "pro" || user.plan === "max" ? user.plan : "free",
    credits: typeof user.credit_balance === "number" ? user.credit_balance : 0,
    initial: displayName.charAt(0).toUpperCase() || "G",
    displayName,
    email: user.email?.trim() || "",
    avatarUrl: user.avatar_url?.trim() || "",
    authMode,
    claimedEmail: user.claimed_email?.trim() || undefined,
    claimedProviders: user.claimed_providers
  };
}

export async function refreshMarketingHomeAccount(options: { force?: boolean } = {}): Promise<AppAccountSummary> {
  const mockAccount = readDevelopmentMockAccount();
  if (mockAccount) {
    useAppAccountStore.getState().setAccount(mockAccount);
    return mockAccount;
  }
  const data = await loadClientAccountSnapshot({
    context: "socialmedia",
    force: options.force
  }).catch(() => null);
  const account = data ? toMarketingAccountSummary(data) : appAccountSummary;
  useAppAccountStore.getState().setAccount(account);
  return account;
}

export function openMarketingHomeAuthModal(): void {
  window.dispatchEvent(new CustomEvent("vismuse:open-auth-modal"));
}
