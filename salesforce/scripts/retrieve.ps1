# retrieve.ps1
#
# Retrieves ALL org metadata into salesforce/force-app using package.xml.
# Run this against a SOURCE org to capture its current state.
# PowerShell equivalent of retrieve.sh for Windows.
#
# Usage:
#   .\salesforce\scripts\retrieve.ps1 -Org beauty-demo-source
#
# Prerequisites:
#   - Salesforce CLI installed:  npm install -g @salesforce/cli
#   - Authenticated to source:   sf org login web -a beauty-demo-source

param(
    [Parameter(Mandatory=$true)]
    [string]$Org
)

$ErrorActionPreference = "Stop"

$RootDir    = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$Manifest   = Join-Path $RootDir "salesforce\manifest\package.xml"
$OutputDir  = Join-Path $RootDir "salesforce\force-app"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║   AGENTFORCE RETAIL ADVISOR — ORG METADATA RETRIEVE     ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Source org  : $Org"
Write-Host "  Manifest    : $Manifest"
Write-Host "  Output dir  : $OutputDir"
Write-Host ""

# ─── Verify org ───────────────────────────────────────────────
Write-Host "► Verifying org authentication..." -ForegroundColor Cyan
sf org display --target-org $Org --json | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Org '$Org' not authenticated. Run: sf org login web -a $Org" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Org authenticated" -ForegroundColor Green
Write-Host ""

# ─── Retrieve metadata via manifest ───────────────────────────
Write-Host "► Retrieving metadata from org (this may take 2-5 minutes)..." -ForegroundColor Cyan
sf project retrieve start `
    --manifest $Manifest `
    --target-org $Org `
    --output-dir $OutputDir `
    --wait 30
Write-Host "  ✓ Metadata retrieved to: $OutputDir" -ForegroundColor Green
Write-Host ""

# ─── Attempt agent metadata retrieve ──────────────────────────
Write-Host "► Attempting agent metadata retrieve (Bot/BotVersion)..." -ForegroundColor Cyan
sf project retrieve start `
    --metadata "Bot" "BotVersion" `
    --target-org $Org `
    --output-dir $OutputDir `
    --wait 30 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Agent metadata retrieved" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Agent metadata unavailable via source retrieve — activate manually in Setup" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  RETRIEVE COMPLETE" -ForegroundColor Green
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Review: git diff salesforce/force-app/"
Write-Host "  2. Commit: git add salesforce/force-app/ && git commit -m 'chore: retrieve org metadata'"
Write-Host "  3. Deploy: .\salesforce\scripts\deploy.ps1 -Org <target-org>"
Write-Host ""
