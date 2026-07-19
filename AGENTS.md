# PS5 Mode — agent instructions

Keep this file lean. Read these before changing code:

1. **`PROJECT_STATUS.md`** — current state, architecture map, ground rules,
   validation matrix, change log. Start here.
2. **`CLAUDE_FINAL_HANDOFF.md`** — authoritative visual + interaction design contract.
3. The relevant spec when applicable — `PERFORMANCE_AND_NATIVE_PLAN.md`,
   `OVERLAY_ARCHITECTURE.md`, `LIVE_APP_BACKDROP_SPEC.md`, `ART_SHOPPING_LIST.md`.
4. The module(s) you're touching in `launcher/src` and `launcher/src-tauri/src`.

Older scaffold-era handoffs live in `docs/archive/` — history only, superseded.

## Rules

- Work only in this rebuild; never modify `C:\Users\Altered\Documents\Projects\ps5-mode`.
- Preserve the final Codex glass visual system and the controller/input contract.
- Make a small change, verify it (type/build check at minimum), then update the
  change log in `PROJECT_STATUS.md`.
- Production package uses `tauri build --no-bundle`; never ship a localhost/Vite build.
- Never add injection, game hooks, anti-cheat workarounds, or a public
  local-network port. Never auto-scan game drives.
