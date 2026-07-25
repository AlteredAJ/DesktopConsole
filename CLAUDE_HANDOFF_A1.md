# Claude Handoff — DesktopConsole A1 Visual Polish

## Path

```
C:\Users\Altered\Documents\Projects\ps5-mode-codex-rebuild
```

## Task

Apply the A1 design mockup visual polish to the existing working layout. **Do NOT restructure, move elements, or change class names.** Only change visual values: colors, opacities, border-radii, spacing, glass effects, font sizes, animation curves. The existing bottom-dock layout, controller input system, and CSS class structure must stay intact.

## Design Reference

Open these in a browser and match their visual treatment:

1. `demo\game-page-a1.html` — Home dashboard (game tiles, dock, copy section, hints bar)
2. `demo\game-page-a1-settings.html` — Settings (sidebar + cards — translate to existing pill tabs)
3. `demo\game-page-a1-power.html` — Power menu (right-edge glass panel)
4. `demo\game-page-a1-quickmenu.html` — Quick Menu (glass depth, specular bloom)
5. `demo\game-page-a1-idle.html` — Idle/startup screen
6. `demo\game-page-a1-search.html` — Search page
7. `demo\game-page-a1-keyboard.html` — Keyboard overlay

## What to Change (in-place, no structural moves)

1. **Tile sizing & focus** — Match A1 demo tile proportions (square, ~11cqw, focus scale) by editing CSS values in CodexLauncher's `CSS` template literal
2. **Glass treatment** — Match demo's `backdrop-filter` blur values, border opacities, and inset shadow highlights on the dock, modals, and hints bar
3. **Color values** — Match demo's rgba opacities for backgrounds, borders, text
4. **Tab pill styling** — Match demo's pill colors, active/inactive states
5. **Hints bar** — Already close, fine-tune to match demo spacing/blur
6. **Power panel** — Right-edge slide panel (already built, just needs CSS to match demo)
7. **Quick Menu** — Header already has LM branding. Match the panel's `::before`/`::after` bloom intensity to the demo
8. **GameDetailPanel** — Already wired as a component. Match its card styling to the demo's game detail section

## What NOT to Do

- Do NOT move the dock from bottom to top
- Do NOT change CSS class names
- Do NOT restructure the JSX return of CodexLauncher
- Do NOT touch the controller hooks or state management
- Do NOT remove the existing Atmosphere component

## Known Issues to Check First

1. Settings page may be broken — verify it opens from the dashboard. If it crashes, the revert from `8ff93e0` may need a clean `git checkout` of both `SettingsMenu.tsx` and `CodexPanelShell.tsx`
2. After any CSS change, run `.\verify.ps1` before committing

## Build & Verify

```powershell
cd C:\Users\Altered\Documents\Projects\ps5-mode-codex-rebuild
.\verify.ps1      # tsc + vite + cargo check
.\rebuild.ps1     # full Tauri build + restart listener
```

## Key Files

- `launcher/src/components/CodexLauncher.tsx` — Home dashboard (CSS in `CSS` const)
- `launcher/src/components/SettingsMenu.tsx` — Settings
- `launcher/src/components/QuickOverlay.tsx` — Quick Menu
- `launcher/src/components/GameDetailPanel.tsx` — Game detail overlay
- `launcher/src/components/IdleScreen.tsx` — Idle/startup
- `launcher/src/components/FluidAtmosphere.tsx` — WebGL fluid backgrounds
- `launcher/src/styles.css` — Global CSS (reduced-motion/transparency queries)
- `ISSUES.md` — Bug & feature tracker
- `demo/` — All A1 design mockups
