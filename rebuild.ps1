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

# 2. stop running instances so their exes aren't locked during the build.
#
# This has to be thorough, and the script has to VERIFY it worked. A running
# launcher makes `tauri build` fail with "failed to remove file ... Access is
# denied (os error 5)" — and because this script used to ignore exit codes, it
# printed "Done." anyway. The result was days of rebuilding only the listener
# while every UI change silently stayed out of the build. Hence: kill the
# LISTENER FIRST (it can respawn the launcher), force it, and wait for the
# handles to actually go rather than guessing with a fixed sleep.
Write-Host "Stopping running PS5 Mode processes..." -ForegroundColor Cyan
foreach ($name in @("ps5-listener", "ps5-launcher")) {
  Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object {
    try { $_.Kill() } catch { Write-Host "  could not kill $name ($($_.Exception.Message))" -ForegroundColor Yellow }
  }
}
foreach ($name in @("ps5-listener", "ps5-launcher")) {
  $deadline = (Get-Date).AddSeconds(10)
  while ((Get-Process -Name $name -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 200
  }
  if (Get-Process -Name $name -ErrorAction SilentlyContinue) {
    Write-Host "ABORT: $name is still running; its exe would stay locked." -ForegroundColor Red
    exit 1
  }
}
# The file handle can outlive the process briefly. Confirm we can actually
# write the target before handing off to cargo, so a lock fails HERE with a
# clear message instead of deep inside the build.
$exe = "$root\target\$profileDir\ps5-launcher.exe"
if (Test-Path $exe) {
  $deadline = (Get-Date).AddSeconds(10)
  while ((Get-Date) -lt $deadline) {
    try { [IO.File]::Open($exe, 'Open', 'ReadWrite', 'None').Close(); break }
    catch { Start-Sleep -Milliseconds 200 }
  }
}

# 3. launcher — Tauri CLI embeds the frontend (do NOT swap this for cargo build)
Write-Host "Building launcher ($profileDir, Tauri CLI, frontend embedded)..." -ForegroundColor Cyan
Push-Location "$root\launcher"
try {
  if ($Dev) { npx tauri build --no-bundle --debug } else { npx tauri build --no-bundle }
} finally { Pop-Location }
# Native commands don't trip $ErrorActionPreference — this check is the whole
# reason the failure was invisible before. Never remove it.
if ($LASTEXITCODE -ne 0) {
  Write-Host "`nLAUNCHER BUILD FAILED (exit $LASTEXITCODE). Nothing was updated." -ForegroundColor Red
  exit 1
}
# Belt and braces: prove the exe is actually newer than the frontend we built.
$built = (Get-Item $exe -ErrorAction SilentlyContinue)
if (-not $built) { Write-Host "LAUNCHER EXE MISSING after build." -ForegroundColor Red; exit 1 }
Write-Host "  launcher exe: $($built.LastWriteTime)" -ForegroundColor DarkGray

# 4. listener — plain cargo, only its crate (skips rebuilding the launcher)
if (-not $NoListener) {
  Write-Host "Building listener ($profileDir)..." -ForegroundColor Cyan
  Push-Location $root
  try {
    if ($Dev) { cargo build -p ps5-listener } else { cargo build --release -p ps5-listener }
  } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) {
    Write-Host "`nLISTENER BUILD FAILED (exit $LASTEXITCODE)." -ForegroundColor Red
    exit 1
  }

  # 5. relaunch the listener (re-arms the PS triple-click trigger)
  Write-Host "Restarting listener..." -ForegroundColor Cyan
  Start-Process "$root\target\$profileDir\ps5-listener.exe"
}

Write-Host "`nDone. Triple-press PS to open the launcher." -ForegroundColor Green
