# Install the self-contained PS5 Mode release for the current Windows user.
# Run this from the rebuild folder or from the unpacked release folder.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSCommandPath
$source = if (Test-Path -LiteralPath (Join-Path $root "target\release\ps5-listener.exe")) {
    Join-Path $root "target\release"
} else {
    $root
}
$dest = Join-Path $env:LOCALAPPDATA "PS5Mode"

foreach ($binary in @("ps5-listener.exe", "ps5-launcher.exe")) {
    if (-not (Test-Path -LiteralPath (Join-Path $source $binary))) {
        throw "Missing $binary in $source. Build the release first."
    }
}

Write-Host "Installing PS5 Mode to $dest ..."
New-Item -ItemType Directory -Path $dest -Force | Out-Null
Get-Process -Name ps5-listener,ps5-launcher -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 300
Remove-ItemProperty -LiteralPath "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "PS5 Mode Listener" -ErrorAction SilentlyContinue
Copy-Item -LiteralPath (Join-Path $source "ps5-listener.exe") -Destination (Join-Path $dest "ps5-listener.exe") -Force
Copy-Item -LiteralPath (Join-Path $source "ps5-launcher.exe") -Destination (Join-Path $dest "ps5-launcher.exe") -Force

Start-Process -FilePath (Join-Path $dest "ps5-listener.exe") -WindowStyle Hidden
Write-Host "Installed. Triple-press PS to open PS5 Mode; the listener now starts automatically at sign-in."