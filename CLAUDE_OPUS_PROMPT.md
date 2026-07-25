# Claude Opus — Full Session Prompt

Do NOT summarize or be concise. Read every word. Execute step by step. Verify after every file change. This is a visual-design porting task on a Tauri v2 (Rust + React + WebView2) Windows desktop app.

---

## 1. ENVIRONMENT

```
cd C:\Users\Altered\Documents\Projects\ps5-mode-codex-rebuild
```

Open Visual Studio Code at this folder. Open a PowerShell terminal. You will edit TypeScript (.tsx) files and CSS. You will NOT edit Rust (.rs) files or any file under `listener/` or `launcher/src-tauri/`.

Every file change must be followed by:
```powershell
cd launcher; npx tsc --noEmit
```
If tsc shows errors, fix them before proceeding. Do NOT skip this step.

After all changes are done, run:
```powershell
.\verify.ps1
```
This gates on tsc + vite build + cargo check (both crates). All must pass.

---

## 2. WHAT THIS APP IS

DesktopConsole is a controller-first Windows couch launcher. It has two processes:
- `listener/` — tray-resident, poll DualSense HID, spawn launcher on PS triple-click
- `launcher/` — fullscreen Tauri + React console with tile dock, tabs, settings, search, power menu

The user navigates with a DualSense controller (D-pad, left stick, buttons). The UI is built with React + TypeScript and styled with inline CSS template literals in each component.

---

## 3. YOUR TASK

Port the visual style from the A1 design mockups (in `demo/`) INTO the existing React components. The existing layout, controller handling, state management, and CSS class names MUST NOT change. You are ONLY adjusting CSS values: colors, opacities, border-radii, blur amounts, shadows, font sizes, spacing, animation curves.

Read `CLAUDE_HANDOFF_A1.md` for the full spec. Also read `PROJECT_STATUS.md` and `CLAUDE_FINAL_HANDOFF.md` for design contracts.

---

## 4. WORKFLOW — do this in order

### Step 1: Fix Settings if broken
Open `launcher/src/components/SettingsMenu.tsx` and `launcher/src/components/CodexPanelShell.tsx`. Verify they compile (`npx tsc --noEmit` from the launcher folder). If either file has syntax errors from a bad revert, run:
```powershell
git checkout 8ff93e0 -- launcher/src/components/SettingsMenu.tsx launcher/src/components/CodexPanelShell.tsx
```
Then verify again.

### Step 2: Open the demo files
Open `demo/game-page-a1.html` in Chrome. Keep it visible on a second monitor or window. This is your visual target.

### Step 3: Polish CodexLauncher CSS (the Home dashboard)
Open `launcher/src/components/CodexLauncher.tsx`. Find the `CSS` template literal (a backtick string near the bottom). Edit the CSS rules IN PLACE. Do not change class names. Do not add new classes. Only change the VALUES inside existing rules. Match these specifically to the A1 demo:

- `.codex-glass` — match `background` gradient and `backdrop-filter` blur value to the demo's glass panels
- `.codex-tile` — match `width`, `height`, `border-radius`, and `transition` timing to the demo's tile specs
- `.codex-tile.focused` — match the `transform: scale()` or size change to the demo's selected tile
- `.codex-dock` / `.codex-dock-wrap` — match `border-radius` and `backdrop-filter`
- `.codex-hint` / `.codex-hints` — match `border-radius`, `backdrop-filter`, `padding`, `gap`, and `background` to the demo's hint pills
- `.codex-tab` / `.codex-tab.active` — match `background`, `border`, and `color` to the demo's tab pills
- `.codex-copy h1` — match `font-size`, `font-weight`, `letter-spacing` to the demo
- `.codex-copy p` — match `font-size` and `color` opacity
- `.codex-live-dot` / `.codex-eyebrow` — these are already close, fine-tune

For EVERY CSS rule you change, open the demo HTML and inspect the corresponding element in Chrome DevTools (right-click > Inspect). Copy the exact computed value.

### Step 4: Polish QuickOverlay CSS
Open `launcher/src/components/QuickOverlay.tsx`. Find the `overlayCss` template literal. Match:
- `.quick-overlay__panel` — match `background`, `border`, `border-radius`, `box-shadow` to the demo
- `.quick-overlay__panel:before` / `:after` — these pseudo-elements create the inner specular bloom. Match their `opacity` and `filter: blur()` values to the demo
- `.quick-overlay__item` — match `border-radius`, `background`, `backdrop-filter` to the demo
- `.quick-overlay__item.is-selected` — match `background`, `box-shadow`, `transform` to the demo
- `.quick-overlay__scrim` — match `backdrop-filter` blur to the demo

### Step 5: Polish GameDetailPanel CSS
Open `launcher/src/components/GameDetailPanel.tsx`. Find the `CSS` template literal. Match:
- `.gamedetail-panel` — match `background`, `border`, `border-radius`, `backdrop-filter` to the demo's card styling
- `.gamedetail-header-icon` — match `border-radius`, `background`, `border` to demo
- `.gamedetail-boxart` — match `border-radius` to the demo's box art card
- `.gamedetail-info` — match `border-radius`, `background`, `backdrop-filter` to the demo's info row
- `.gamedetail-action-btn` — match `border-radius`, `background`, gap to demo's CTA buttons
- `.gamedetail-action-btn.selected` — match `background`, `box-shadow` to demo

### Step 6: Polish IdleScreen
Open `launcher/src/components/IdleScreen.tsx`. The branding was already updated (LM wordmark + DualSense SVG). Fine-tune:
- Idle art scrim `opacity` values to match the demo's balance of art visibility vs legibility
- Particle `opacity` and `boxShadow` glow — match the demo's constellation star intensity

### Step 7: Final verify
```powershell
.\verify.ps1
```
If all three gates pass (tsc, vite, cargo check both crates), you're done. Commit:
```powershell
git add -A
git commit -m "refine: A1 visual polish — tile sizing, glass treatment, hint bar, Quick Menu bloom, GameDetailPanel styling"
git push
```

---

## 5. IRON RULES — DO NOT VIOLATE

1. **NEVER change a CSS class name.** If a class is `.codex-tile.focused`, keep it exactly that. Only change the values inside `{ }`.
2. **NEVER move an HTML element in the JSX.** The `return` block structure of every component is off-limits. The user's controller mappings depend on the order of elements.
3. **NEVER change a `useState`, `useEffect`, `useRef`, or `useController` call.** These are the input system. If you touch them, the controller stops working.
4. **NEVER do a structural redesign.** The bottom-dock layout stays. Tabs stay on the left. Utility buttons stay on the right. The dock stays at the bottom.
5. **ALWAYS run `npx tsc --noEmit` after every file save.** If it shows red errors, fix them immediately. Do not stack changes on top of broken code.
6. **ALWAYS open the A1 demo in Chrome DevTools** and copy exact computed values. Do not guess colors or sizes from memory.

---

## 6. HOW TO USE CHROME DEVTOOLS FOR THIS

For any element in the A1 demo:
1. Right-click the element → Inspect
2. In the Styles panel, scroll to the relevant CSS rule (e.g., for `.codex-glass` look at `.glass` in the demo)
3. Copy the computed values for: `background`, `backdrop-filter`, `border-radius`, `border`, `box-shadow`, `padding`, `gap`, `font-size`, `color`, `opacity`
4. Translate those pixel values to `cqw`/`cqh` where the existing codebase uses them. If the codebase currently uses `rem` or `px`, use `rem` or `px` to match. If it uses `cqw`/`cqh`, use those. Match the EXISTING unit system in each CSS rule.
5. Apply the value to the corresponding rule in the component's CSS template literal

---

## 7. FILES YOU MAY EDIT

Only these files:
- `launcher/src/components/CodexLauncher.tsx` — CSS template literal (the `CSS` backtick string)
- `launcher/src/components/QuickOverlay.tsx` — CSS template literal (the `overlayCss` backtick string)
- `launcher/src/components/GameDetailPanel.tsx` — CSS template literal (the `CSS` backtick string)
- `launcher/src/components/IdleScreen.tsx` — inline styles (the `style={{}}` objects)
- `launcher/src/components/SettingsMenu.tsx` — inline styles (only if fixing revert issues)
- `launcher/src/components/CodexPanelShell.tsx` — inline styles (only if fixing revert issues)

Do NOT edit any other file. Especially do not edit:
- `launcher/src-tauri/src/` (any .rs file)
- `listener/` (any file)
- `launcher/src/hooks/` (any .ts file)
- `launcher/src/settings.ts`
- `launcher/src/motion.ts`
- `launcher/src/App.tsx`

---

## 8. KNOWN STATE

- The A1 structural redesign (top-dock layout) was REVERTED. The current codebase has the original bottom-dock layout, which is the PROVEN WORKING version.
- All bug fixes from the July 23 session are intact: restore_focus crash fix, keyboard exit guard, Quick Menu dormant guard, Cross-leak guard, Phase 1+2 optimizations.
- New components exist and are wired: `GameDetailPanel.tsx`, `FluidAtmosphere.tsx`.
- The Settings page was reverted to its pre-session state (pill tabs, no sidebar). If it crashes when opened, use `git checkout 8ff93e0 -- launcher/src/components/SettingsMenu.tsx launcher/src/components/CodexPanelShell.tsx` to get a clean copy.
- `ISSUES.md` tracks 26 known items. `OPTIMIZATION_PLAN.md` has phases 3-5 remaining.

---

## 9. SESSION START

First action:
```powershell
cd C:\Users\Altered\Documents\Projects\ps5-mode-codex-rebuild
.\verify.ps1
```
If this passes, proceed. If not, fix any errors before starting.

Then open `demo/game-page-a1.html` in Chrome. Keep it open. Begin Step 3.
