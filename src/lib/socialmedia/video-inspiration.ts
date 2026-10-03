type VideoInspirationItem = {
  id: string;
};

type TitledVideoInspirationItem = VideoInspirationItem & {
  title: string;
};

const ANIMATION_INSPIRATION_TITLE_ORDER = [
  "Anime Skyway Sprint",
  "Clay Garden Party",
  "Watercolor Fox Trail",
  "Paper Ocean Parade",
  "Clockwork Bird Sketch",
  "Tiny Robot Greenhouse",
  "Comic City Dash",
  "Felt Frog Tea Time"
] as const;

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return shuffled;
}

export function randomlyMixVideoInspirationTemplates<T extends VideoInspirationItem>(params: {
  primary: T[];
  additions: T[];
  limit: number;
  random?: () => number;
}): T[] {
  const limit = Math.max(0, Math.floor(params.limit));
  if (limit === 0) return [];

  const seenIds = new Set<string>();
  const uniquePrimary = params.primary.filter((item) => {
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    return true;
  });
  const uniqueAdditions = params.additions.filter((item) => {
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    return true;
  });
  const random = params.random ?? Math.random;
  const selected = shuffle([...uniquePrimary, ...uniqueAdditions], random).slice(0, limit);

  if (limit < 2 || selected.length < 2 || !uniquePrimary.length || !uniqueAdditions.length) {
    return selected;
  }

  const primaryIds = new Set(uniquePrimary.map((item) => item.id));
  const additionIds = new Set(uniqueAdditions.map((item) => item.id));
  if (!selected.some((item) => additionIds.has(item.id))) {
    selected[selected.length - 1] = uniqueAdditions[Math.floor(random() * uniqueAdditions.length)]!;
  }
  if (!selected.some((item) => primaryIds.has(item.id))) {
    selected[0] = uniquePrimary[Math.floor(random() * uniquePrimary.length)]!;
  }
  return shuffle(selected, random);
}

export function orderAnimationInspirationTemplates<T extends TitledVideoInspirationItem>(templates: T[]): T[] {
  const titleRank = new Map(
    ANIMATION_INSPIRATION_TITLE_ORDER.map((title, index) => [title.toLowerCase(), index])
  );

  return templates
    .map((template, index) => ({
      template,
      index,
      rank: titleRank.get(template.title.trim().toLowerCase()) ?? Number.MAX_SAFE_INTEGER
    }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map(({ template }) => template);
}
