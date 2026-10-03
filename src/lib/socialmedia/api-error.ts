function firstString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!Array.isArray(value)) return undefined;
  return value.find((item): item is string => typeof item === "string" && Boolean(item.trim()))?.trim();
}

export function resolveSocialmediaApiErrorMessage(value: unknown, fallback: string): string {
  const direct = firstString(value);
  if (direct) return direct;
  if (!value || typeof value !== "object") return fallback;

  const record = value as Record<string, unknown>;
  const message = firstString(record.message) ?? firstString(record.formErrors);
  if (message) return message;

  if (record.fieldErrors && typeof record.fieldErrors === "object") {
    for (const fieldError of Object.values(record.fieldErrors as Record<string, unknown>)) {
      const fieldMessage = firstString(fieldError);
      if (fieldMessage) return fieldMessage;
    }
  }

  return fallback;
}
