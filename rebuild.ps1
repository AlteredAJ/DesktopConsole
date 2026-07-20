# rebuild.ps1 — one-shot rebuild for PS5 Mode.
#
#   .\rebuild.ps1               release build (LTO, slow) — use for real on-device/perf testing
#   .\rebuild.ps1 -Dev          debug build (no LTO, fast) — use for iterating on UI/logic changes
#   .\rebuild.ps1 -NoListener   rebuild the launcher only (frontend-only changes)
#   (flags combine, e.g. .\rebuild.ps1 -Dev -NoListener)
#
# Why -Dev exists: [profile.release] in the workspace Cargo.toml deliberately
# turns on lto=true + codegen-units=1 + strip for shipping-quality binaries
# (smaller/faster at runtime, less for AV to scan) — but that's exactly what
# makes release builds slow, and iterating on a CSS tweak or a controller-input
# fix doesn't need it. -Dev builds both crates with the plain dev profile
# (unoptimized+debuginfo, incremental compilation) instead, which is the same
# profile verify.ps1's `cargo check` already uses. Reserve a plain
# `.\rebuild.ps1` release build for the sessions where you're actually judging
# real feel/perf on the panel, not every single iteration.
#
# Why a script: the launcher MUST be built with the Tauri CLI (`tauri build`) so
# the React frontend is bundled into the exe — a plain `cargo build` points the
# window at the dev server and you get "localhost refused to connect". The
# listener has no frontend, so plain cargo is fine for it. This also puts cargo
# on PATH and stops the running exes first (they lock their own files).

param([switch]$NoListener, [switch]$Dev)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$profileDir = if ($Dev) { "debug" } else { "release" }

# 1. cargo on PATH (rustup default location)
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  $env:Path += ";$env:USERPROFILE\.cargo\bin"
}

# 2. stop running instances so their exes aren't locked during the build
Write-Host "Stopping running PS5 Mode processes..." -ForegroundColor Cyan
Stop-Process -Name ps5-launcher -ErrorAction SilentlyContinue
Stop-Process -Name ps5-listener -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500   # let Windows release the file handles

# 3. launcher — Tauri CLI embeds the frontend (do NOT swap this for cargo build)
Write-Host "Building launcher ($profileDir, Tauri CLI, frontend embedded)..." -ForegroundColor Cyan
Push-Location "$root\launcher"
try {
  if ($Dev) { npx tauri build --no-bundle --debug } else { npx tauri build --no-bundle }
} finally { Pop-Location }

# 4. listener — plain cargo, only its crate (skips rebuilding the launcher)
if (-not $NoListener) {
  Write-Host "Building listener ($profileDir)..." -ForegroundColor Cyan
  Push-Location $root
  try {
    if ($Dev) { cargo build -p ps5-listener } else { cargo build --release -p ps5-listener }
  } finally { Pop-Location }

  # 5. relaunch the listener (re-arms the PS triple-click trigger)
  Write-Host "Restarting listener..." -ForegroundColor Cyan
  Start-Process "$root\target\$profileDir\ps5-listener.exe"
}

Write-Host "`nDone. Triple-press PS to open the launcher." -ForegroundColor Green
