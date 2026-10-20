// Keyword cannibalization guard: decides whether a keyword is already served by an
// existing article, so the generator doesn't write a second page competing for the
// same search ("gifts for men" vs "gift for men" vs "what to get the guy...").

const SYNONYMS: Record<string, string> = {
  him: "man", men: "man", guy: "man", guys: "man", male: "man",
  her: "woman", women: "woman", lady: "woman", ladies: "woman", female: "woman",
  father: "dad", daddy: "dad", fathers: "dad",
  mother: "mom", mum: "mom", mommy: "mom", mothers: "mom",
  xmas: "christmas", holiday: "christmas", holidays: "christmas",
  valentines: "valentine", bf: "boyfriend", gf: "girlfriend",
  "has": "everything", have: "everything", nothing: "everything", anything: "everything",
};

// Words that carry no search intent on their own for gift queries.
const STOPWORDS = new Set([
  "a", "an", "the", "for", "to", "of", "and", "or", "in", "on", "with", "who", "that", "this",
  "your", "my", "his", "their", "our", "best", "top", "ideas", "idea", "gift", "gifts", "gifting",
  "what", "get", "give", "buy", "good", "great", "unique", "thoughtful", "special", "cool",
  "already", "says", "doesnt", "doesn't", "dont", "don't", "need", "needs", "want", "wants",
  "actually", "really", "someone", "person", "people", "is", "are", "be", "it", "from",
  "he", "she", "they", "them", "you", "i", "me", "we", "us", "will", "can", "should",
]);

function singular(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 3 && word.endsWith("s") && !/(ss|as|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

/** Order-insensitive set of intent-bearing words, with synonyms and plurals folded. */
export function keywordSignature(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\b20\d{2}\b/g, " ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const sig = new Set<string>();
  for (const raw of words) {
    const mapped = SYNONYMS[raw] ?? raw;
    if (STOPWORDS.has(mapped)) continue;
    sig.add(SYNONYMS[singular(mapped)] ?? singular(mapped));
  }
  return sig;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  a.forEach((w) => { if (b.has(w)) shared++; });
  return shared / (a.size + b.size - shared);
}

export interface CoverageCandidate {
  id: string;
  title: string;
  focusKeyword: string | null;
  status: string;
}

/**
 * Returns the existing article that already serves this keyword, or null.
 * Matches on the article's focus keyword (or title when it has none). An exact
 * signature match always counts; otherwise both sides need 2+ words and 80% overlap,
 * so "christmas gifts for dad" is NOT treated as covered by "gifts for dad".
 */
export function findCoveringArticle(keyword: string, articles: CoverageCandidate[]): CoverageCandidate | null {
  const sig = keywordSignature(keyword);
  if (sig.size === 0) return null;
  for (const a of articles) {
    const other = keywordSignature(a.focusKeyword || a.title);
    if (other.size === 0) continue;
    const sameSet = other.size === sig.size && Array.from(sig).every((w) => other.has(w));
    if (sameSet) return a;
    if (sig.size >= 2 && other.size >= 2 && jaccard(sig, other) >= 0.8) return a;
  }
  return null;
}
