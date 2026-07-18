# PS5 Mode agent instructions

Keep this file lean. Read these files before changing code:

1. `AI_CURRENT_STATE.md` — current task, running release, last verification
2. `CLAUDE_FINAL_HANDOFF.md` — authoritative design and behavior
3. `AI_CONTINUATION_PROTOCOL.md` — required process and validation
4. `PERFORMANCE_AND_NATIVE_PLAN.md` or `LIVE_APP_BACKDROP_SPEC.md` when relevant

Rules:

- Work only in this rebuild; never modify `C:\Users\Altered\Documents\Projects\ps5-mode`.
- Preserve the final Codex glass visual system and controller/input contract.
- Make small changes, verify them, then update `AI_CURRENT_STATE.md` and the continuation log.
- Production package uses `tauri build --no-bundle`; do not ship a localhost/Vite build.
- Never add injection, game hooks, anti-cheat workarounds, or a public local-network port.

