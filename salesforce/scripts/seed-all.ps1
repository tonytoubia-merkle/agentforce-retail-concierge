# seed-all.ps1
#
# Runs all Apex anonymous seed/setup scripts in dependency order.
# Run this AFTER deploy.ps1 completes successfully.
# PowerShell equivalent of seed-all.sh for Windows.
#
# Usage:
#   .\salesforce\scripts\seed-all.ps1 -Org beauty-demo-new
#
# To run a single script manually:
#   sf apex run --file salesforce\scripts\apex\<script>.apex --target-org <alias>

param(
    [Parameter(Mandatory=$true)]
    [string]$Org
)

$ErrorActionPreference = "Continue"
$ApexDir = Join-Path $PSScriptRoot "apex"

# ─── Helper ───────────────────────────────────────────────────
function Run-Apex($Script, $Label) {
    $path = Join-Path $ApexDir $Script
    $padded = "Running: $Label".PadRight(55)
    if (Test-Path $path) {
        Write-Host "  $padded" -NoNewline
        sf apex run --file $path --target-org $Org --json | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host " ✓" -ForegroundColor Green
        } else {
            Write-Host " ⚠" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  $("Skipping: $Label".PadRight(55)) (not found: $Script)" -ForegroundColor DarkGray
    }
}

# ─── Banner ───────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║   AGENTFORCE RETAIL ADVISOR — DEMO DATA SEED            ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Target org : $Org"
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

# ══════════════════════════════════════════════════════════════
# PHASE 1 — CORE CONFIG
# ══════════════════════════════════════════════════════════════
Write-Host "── Phase 1: Core Configuration ──────────────────────────" -ForegroundColor Cyan
Run-Apex "setup-loyalty-program.apex"    "Loyalty program config"
Run-Apex "create-app-products.apex"      "Product catalog (brands, SKUs, prices)"
Run-Apex "seed-segment-definitions.apex" "Segment definitions"
Run-Apex "seed-campaign-decodes.apex"    "Campaign decode mappings"
Write-Host ""

# ══════════════════════════════════════════════════════════════
# PHASE 2 — CLIENTELLING PORTFOLIOS & CONTACTS
# ══════════════════════════════════════════════════════════════
Write-Host "── Phase 2: Portfolios & Clientelling Data ───────────────" -ForegroundColor Cyan
Run-Apex "setup-demo-portfolios.apex"    "Demo portfolios"
Run-Apex "seed-clientelling-data.apex"   "Clientelling contacts & profiles"
Run-Apex "setup-product-affinities.apex" "Product affinity scores"
Write-Host ""

# ══════════════════════════════════════════════════════════════
# PHASE 3 — DATA CLOUD / MERKURY IDENTITY
# ══════════════════════════════════════════════════════════════
Write-Host "── Phase 3: Data Cloud / Merkury Identity ────────────────" -ForegroundColor Cyan
Run-Apex "dc-connector-add-merkury-field.apex"        "Merkury field connector"
Run-Apex "dc-connector-add-merkury-hid.apex"          "Merkury HID connector"
Run-Apex "dc-connector-object-permissions.apex"       "DC object permissions"
Run-Apex "dc-connector-field-permissions-batch1.apex" "DC field permissions (batch 1)"
Run-Apex "dc-connector-field-permissions-batch2.apex" "DC field permissions (batch 2)"
Run-Apex "dc-verify-merkury-setup.apex"               "Verify Merkury setup"
Write-Host ""

# ══════════════════════════════════════════════════════════════
# PHASE 4 — JOURNEYS & ENGAGEMENT
# ══════════════════════════════════════════════════════════════
Write-Host "── Phase 4: Journeys & Engagement ───────────────────────" -ForegroundColor Cyan
Run-Apex "create-multi-step-journey.apex" "Multi-step journey setup"
Run-Apex "award-purchase-points.apex"     "Award loyalty purchase points"
Write-Host ""

# ══════════════════════════════════════════════════════════════
# PHASE 5 — SCHEDULED JOBS
# ══════════════════════════════════════════════════════════════
Write-Host "── Phase 5: Scheduled Batch Jobs ────────────────────────" -ForegroundColor Cyan
Run-Apex "schedule-engagement-processor.apex"       "Schedule engagement processor"
Run-Apex "schedule-nightly-journey-processor.apex"  "Schedule nightly journey processor"
Write-Host ""

# ══════════════════════════════════════════════════════════════
# PHASE 6 — FIXES & PATCHES
# ══════════════════════════════════════════════════════════════
Write-Host "── Phase 6: Fixes & Patches ─────────────────────────────" -ForegroundColor Cyan
Run-Apex "fix-demo-profile-field.apex" "Fix demo profile field"
Run-Apex "fix-empty-prompts.apex"      "Fix empty prompt templates"
Write-Host ""

Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   SEED COMPLETE                                         ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Check any ⚠ warnings above in Setup > Apex Jobs."
Write-Host ""
Write-Host "NEXT — Open your org and verify:"
Write-Host "  sf org open --target-org $Org"
Write-Host "  Then: Setup > Agentforce Agents > Activate agents"
Write-Host "        Setup > Remote Site Settings > Update SelfOrgDomain URL"
Write-Host "        See AGENTFORCE_SETUP_GUIDE.md for OAuth + .env setup"
Write-Host ""
