export const GENERAL_ENTRY_EXPERIMENT_KEY = "general_entry_experiment_v1";
export const GENERAL_ENTRY_VISITOR_COOKIE = "vismuse_general_entry_visitor";
export type GeneralEntryVariant = "control" | "general";
export function isGeneralEntryVariant(value: unknown): value is GeneralEntryVariant {
  return value === "control" || value === "general";
}
export function parseGeneralEntryVisitor(value?: string): string | undefined {
  return value && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value) ? value : undefined;
}

export function readGeneralEntryVisitor(cookieHeader?: string | null): string | undefined {
  const cookie = cookieHeader?.split(";").find(part => part.trim().startsWith(`${GENERAL_ENTRY_VISITOR_COOKIE}=`));
  try { return parseGeneralEntryVisitor(cookie ? decodeURIComponent(cookie.trim().slice(GENERAL_ENTRY_VISITOR_COOKIE.length + 1)) : undefined); } catch { return undefined; }
}
