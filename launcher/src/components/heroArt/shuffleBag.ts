// Shuffle-bag ordering for rotating hero art.
//
// Plain random repeats too often — you notice the same piece twice in a row and
// the rotation stops feeling curated. A shuffle bag fixes that: shuffle the whole
// set, hand images out one at a time, and only reshuffle once the bag is empty.
// Every image therefore appears exactly once before any of them appears twice.
//
// Cost is negligible: one array of indices per set (a few dozen numbers) and one
// O(n) shuffle per complete cycle — far cheaper than the timers already running.
//
// State lives at module level, keyed by the pool array itself (those arrays are
// module-level constants in gameLogos.ts, so their identity is stable). That is
// also what makes re-selecting an app advance the art: the cursor survives
// KeyArtHero unmounting and remounting on every focus change.

interface Bag {
  /** Indices not yet handed out this cycle. Drawn from the end. */
  remaining: number[];
  /** Last index handed out, so a reshuffle can't repeat across the seam. */
  last: number | null;
}

const bags = new WeakMap<string[], Bag>();

function refill(pool: string[], last: number | null): number[] {
  const idx = pool.map((_, i) => i);
  // Fisher-Yates.
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  // Seam guard: we draw from the end, so idx[last] is the next pick. If it
  // matches the image just shown, swap it with its neighbour — otherwise a
  // back-to-back repeat can still slip through at the reshuffle boundary.
  const end = idx.length - 1;
  if (last !== null && idx.length > 1 && idx[end] === last) {
    [idx[end], idx[end - 1]] = [idx[end - 1], idx[end]];
  }
  return idx;
}

/**
 * Next index to show for this pool. Advances the bag, so two consecutive calls
 * return different images (until the whole set has been used). This is the
 * rotation timer's call.
 */
export function nextFromBag(pool: string[]): number {
  if (pool.length <= 1) return 0;
  let bag = bags.get(pool);
  if (!bag) {
    bag = { remaining: [], last: null };
    bags.set(pool, bag);
  }
  if (bag.remaining.length === 0) bag.remaining = refill(pool, bag.last);
  const pick = bag.remaining.pop() as number;
  bag.last = pick;
  return pick;
}

/**
 * The image this pool is *currently* showing, WITHOUT advancing — draws a fresh
 * one only if the pool has never been shown.
 *
 * This is what a KeyArtHero uses for its opening frame, and it's the fix for
 * "the wallpaper cycles when I switch tabs / dip into Settings": the component
 * remounts constantly (every focus change, every return from a panel), and if
 * mount advanced the bag, the same app would show a different piece each visit.
 * Now an app keeps its wallpaper until its own rotation timer moves it on.
 */
export function currentFromBag(pool: string[]): number {
  if (pool.length <= 1) return 0;
  const bag = bags.get(pool);
  if (bag && bag.last !== null) return bag.last;
  // Never shown before — draw (and remember) one.
  return nextFromBag(pool);
}
