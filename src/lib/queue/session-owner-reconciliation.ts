import { isGuestUserId } from "@/lib/auth/guest";

type SessionOwnerSnapshot = {
  id?: string;
  ownerUserId?: string;
};

export function resolveClaimedSessionOwnerReconciliation(params: {
  sessionId?: string;
  requestedOwnerUserId?: string;
  localSession?: SessionOwnerSnapshot | null;
  remoteSession?: SessionOwnerSnapshot | null;
}): { guestUserId: string; targetUserId: string } | null {
  const sessionId = params.sessionId?.trim();
  const targetUserId = params.requestedOwnerUserId?.trim();
  const localSessionId = params.localSession?.id?.trim();
  const remoteSessionId = params.remoteSession?.id?.trim();
  const localOwnerUserId = params.localSession?.ownerUserId?.trim();
  const remoteOwnerUserId = params.remoteSession?.ownerUserId?.trim();

  if (!sessionId || !targetUserId || !localOwnerUserId) return null;
  if (localSessionId !== sessionId || remoteSessionId !== sessionId) return null;
  if (!isGuestUserId(localOwnerUserId)) return null;
  if (remoteOwnerUserId !== targetUserId) return null;

  return {
    guestUserId: localOwnerUserId,
    targetUserId
  };
}
