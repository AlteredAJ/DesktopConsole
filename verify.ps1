# verify.ps1 — the single pre-commit check for PS5 Mode.
#
#   .\verify.ps1              full check (frontend + both Rust crates)
#   .\verify.ps1 -Frontend    frontend only (fast loop for UI work)
#
# Why this exists: every check used to be run by hand, which is easy to half-do.
# A commit shipped once with its Rust unverified simply because `cargo` wasn't on
# PATH in that shell and the failure was silent. This puts cargo on PATH itself
# and returns ONE exit code for everything.
#
# Rule: no commit without a green verify.ps1.
#
# Note: this deliberately does NOT run `tauri build` — that's a packaging step
# (see rebuild.ps1). This is the correctness gate, meant to be fast enough to run
# every time.

param([switch]$Frontend)

$root = $PSScriptRoot
$failures = @()

function Step($name, $block) {
  Write-Host "`n=== $name ===" -ForegroundColor Cyan
  & $block
  if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: $name" -ForegroundColor Red
    $script:failures += $name
  } else {
    Write-Host "ok: $name" -ForegroundColor DarkGray
  }
}

# cargo on PATH (rustup default location) — the thing that silently broke before
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  $env:Path += ";$env:USERPROFILE\.cargo\bin"
}

Push-Location "$root\launcher"
try {
  Step "frontend: tsc --noEmit" { npx tsc --noEmit }
  Step "frontend: vite build"   { npx vite build }
} finally { Pop-Location }

if (-not $Frontend) {
  Push-Location "$root\launcher\src-tauri"
  try { Step "launcher backend: cargo check" { cargo check } } finally { Pop-Location }

  Push-Location "$root\listener\src-tauri"
  try { Step "listener backend: cargo check" { cargo check } } finally { Pop-Location }
}

Write-Host ""
if ($failures.Count -gt 0) {
  Write-Host "VERIFY FAILED ($($failures.Count)): $($failures -join ', ')" -ForegroundColor Red
  exit 1
}
Write-Host "VERIFY PASSED" -ForegroundColor Green
exit 0
