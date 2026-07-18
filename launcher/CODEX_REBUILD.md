# Codex visual rebuild

This duplicate project is intentionally separate from `ps5-mode` and is the
safe handoff target for integrating the Codex design kit into the real Tauri
launcher.

## What changed

- `src/entries/CodexHome.tsx` is the restored Netflix-quality Codex home frame.
- `src/App.tsx` renders that design for the grid state.
- `design-kit/` contains the complete visual system: tokens, screen references,
  state notes, game hero scenes, and icon treatment.

## What Claude should reconnect

The original functional components remain in `src/components/` untouched:
`Launcher.tsx`, `Search.tsx`, `SettingsMenu.tsx`, `VirtualKeyboard.tsx`,
`YouTubeEmbed.tsx`, and `IdleScreen.tsx`.

Use their existing controller/backend logic as the behavior source; replace
their visual composition with the corresponding references under `design-kit/`.
Do not copy `ClaudeHome.tsx` into the product. Preserve its controller wiring
only where necessary, and preserve the Codex visual rules from the kit.
