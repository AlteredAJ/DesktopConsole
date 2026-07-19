// Recently-launched tiles, persisted locally, powering the "Continue" tab.
// Frontend-only: no backend change needed — we already know when a tile is
// launched (launch() in CodexLauncher), and the running-process poll supplies
// what's live right now. Most-recent-first, deduped by id, capped.

const KEY = "ps5mode-recents";
const CAP = 12;

export function getRecents(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Record a launch: move `id` to the front, dedupe, cap the list. */
export function recordLaunch(id: string): void {
  try {
    const next = [id, ...getRecents().filter((x) => x !== id)].slice(0, CAP);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full / disabled — recents are non-critical, ignore */
  }
}
