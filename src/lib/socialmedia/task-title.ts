type TaskTitleInput = {
  text?: string | null;
  createdAt?: string | null;
};

function timestamp(value?: string | null): number {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function isPlaceholderTaskTitle(title?: string | null): boolean {
  return !title?.trim() || /^(?:Session\s+\d+|Social media generation|New chat|Untitled board)$/i.test(title.trim());
}

export function resolveTaskTitle(
  inputs: TaskTitleInput[],
  savedTitle?: string | null,
  conversationInputs: TaskTitleInput[] = []
): string {
  // Saved names (including background AI titles and manual renames) are final.
  // Until one is available, keep the original request through clarification/edit turns.
  if (!isPlaceholderTaskTitle(savedTitle)) return savedTitle!.trim();
  const firstInput = [...conversationInputs, ...inputs]
    .map((input, index) => ({
      text: input.text?.trim() ?? "",
      createdAt: timestamp(input.createdAt),
      index
    }))
    .filter((input) => input.text)
    .sort((left, right) => left.createdAt - right.createdAt || left.index - right.index)[0]?.text;

  return firstInput || "Untitled board";
}
