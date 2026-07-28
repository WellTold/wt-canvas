/** Convert a Shopify slug (e.g. "home-town-maps-barware") to a readable label ("Home Town Maps Barware"). */
export function slugToLabel(slug: string): string {
  return slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Inserts a philosophy intro paragraph immediately after the first # heading
 * in the markdown body so it renders below the page title, not above it.
 */
export function withPhilosophyAfterTitle(philosophy: string | null | undefined, markdown: string): string {
  if (!philosophy) return markdown.trimEnd();
  const firstHeadingMatch = markdown.match(/^# .+$/m);
  if (firstHeadingMatch && firstHeadingMatch.index !== undefined) {
    const end = firstHeadingMatch.index + firstHeadingMatch[0].length;
    return markdown.slice(0, end) + "\n\n" + philosophy.trim() + "\n\n" + markdown.slice(end).trimStart();
  }
  // No H1 heading found — put philosophy at start
  return philosophy.trim() + "\n\n" + markdown.trimEnd();
}

// Rank a list of supporting keywords by word-overlap similarity to a primary keyword,
// then return the top N (default 8, hard cap 10). This prevents dumping an entire
// cluster into a single AI prompt while still picking the most relevant terms.
export function filterSupportingKeywords(
  primaryKeyword: string,
  candidates: string[],
  take = 8,
  cap = 10,
): string[] {
  const limit = Math.min(take, cap);

  // Build primary word set — also include 4-char+ stems so "hiking" matches "hike"
  const primaryTokens = primaryKeyword.toLowerCase().split(/\W+/).filter(Boolean);
  const primaryWords = new Set(primaryTokens);
  const primaryStems = new Set(primaryTokens.filter(w => w.length >= 4).map(w => w.slice(0, 4)));

  const scored = candidates.map((kw) => {
    const kwWords = kw.toLowerCase().split(/\W+/).filter(Boolean);
    // Signal 1: exact word overlap with primary
    const exactOverlap = kwWords.filter(w => primaryWords.has(w)).length;
    // Signal 2: stem overlap (partial match) — half-weight
    const stemOverlap = kwWords.filter(w => w.length >= 4 && primaryStems.has(w.slice(0, 4)) && !primaryWords.has(w)).length;
    const score = exactOverlap + stemOverlap * 0.5;
    return { kw, score };
  });

  // Sort by score descending, break ties by shorter keyword (more focused)
  scored.sort((a, b) => b.score - a.score || a.kw.length - b.kw.length);

  // Deduplicate near-identical phrases: skip a candidate if it shares 80%+ of its
  // words with an already-selected keyword (prevents packing the list with variants)
  const selected: string[] = [];
  for (const { kw } of scored) {
    if (selected.length >= limit) break;
    const kwWords = new Set(kw.toLowerCase().split(/\W+/).filter(Boolean));
    const isDuplicate = selected.some(s => {
      const sWords = s.toLowerCase().split(/\W+/).filter(Boolean);
      const shared = sWords.filter(w => kwWords.has(w)).length;
      return shared / Math.max(sWords.length, kwWords.size) >= 0.8;
    });
    if (!isDuplicate) selected.push(kw);
  }

  return selected;
}
