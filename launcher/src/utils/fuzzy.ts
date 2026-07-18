// Small in-house fuzzy matcher over the tile list — deliberately NOT piggybacking
// on Windows Search: that only knows about Start-Menu-registered exes/files, has
// no concept of "embedded YouTube panel" vs "browser to netflix.com" vs a raw
// .exe path vs a launcher app, and its UI isn't controller-navigable. Matching
// stays over our own already-loaded config.rs tiles instead.
//
// Lower score = better match. `null` = no match at all.
export function fuzzyScore(query: string, target: string): number | null {
  const q = query.trim().toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 0;
  if (t.startsWith(q)) return 0;

  const idx = t.indexOf(q);
  if (idx >= 0) return 1 + idx * 0.01;

  // Subsequence fallback: every query char appears in order, not necessarily
  // contiguous ("ntflx" -> "Netflix"). Score penalizes gaps between matches.
  let qi = 0;
  let gaps = 0;
  let lastMatch = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (lastMatch >= 0) gaps += ti - lastMatch - 1;
      lastMatch = ti;
      qi++;
    }
  }
  if (qi === q.length) return 2 + gaps * 0.1;
  return null;
}

export function fuzzyFilter<T>(query: string, items: T[], labelOf: (item: T) => string, limit = 8): T[] {
  return items
    .map((item) => ({ item, score: fuzzyScore(query, labelOf(item)) }))
    .filter((r): r is { item: T; score: number } => r.score !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((r) => r.item);
}
