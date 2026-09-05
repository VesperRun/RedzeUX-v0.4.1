# package-pilot.ps1 — Zip RedzeUX for sideload distribution (no build step).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/package-pilot.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$version = (Get-Content (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json).version
$outDir = Join-Path $root 'dist'
$zipName = "RedzeUX-v$version-pilot.zip"
$zipPath = Join-Path $outDir $zipName

if (-not (Test-Path $outDir)) {
  New-Item -ItemType Directory -Path $outDir | Out-Null
}

$exclude = @(
  '.git',
  'dist',
  'stripe/node_modules',
  'stripe/.env',
  'stripe/licenses.json',
  'agency/COMPETITIVE-UX-PRACTICE.txt'
)

$stage = Join-Path $env:TEMP "RedzeUX-pilot-stage-$version"
if (Test-Path $stage) {
  Remove-Item -Recurse -Force $stage
}
New-Item -ItemType Directory -Path $stage | Out-Null

Get-ChildItem -Path $root -Force | ForEach-Object {
  if ($exclude -contains $_.Name) { return }
  Copy-Item -Path $_.FullName -Destination (Join-Path $stage $_.Name) -Recurse -Force
}

if (Test-Path $zipPath) {
  Remove-Item -Force $zipPath
}
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zipPath -Force
Remove-Item -Recurse -Force $stage

Write-Host "Pilot package ready:"
Write-Host "  $zipPath"
Write-Host ""
Write-Host "Pilot steps: unzip, then see PILOT-INSTALL.md (Load unpacked in chrome://extensions)."
