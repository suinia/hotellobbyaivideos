import { headers } from "next/headers";
import { resolveTriggerHostname } from "./trigger-hostname";

/** Read once at creation, never when syncing or recovering an existing job. */
export async function readRequestTriggerHostname(): Promise<string | undefined> {
  try {
    return resolveTriggerHostname(await headers());
  } catch {
    // CLI/background callers have no request scope; leave their source unknown.
    return undefined;
  }
}
