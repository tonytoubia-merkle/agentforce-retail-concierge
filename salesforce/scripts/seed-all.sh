#!/usr/bin/env bash
# seed-all.sh
#
# Runs all Apex anonymous seed/setup scripts against a target org in the
# correct dependency order. Run this AFTER deploy.sh completes.
#
# Prerequisites:
#   - deploy.sh has already been run successfully against this org
#   - Org is authenticated with sufficient admin permissions
#
# Usage:
#   ./salesforce/scripts/seed-all.sh <org-alias>
#
# Examples:
#   ./salesforce/scripts/seed-all.sh beauty-demo-new
#
# To run a single script manually:
#   sf apex run --file salesforce/scripts/apex/<script>.apex --target-org <alias>

set -euo pipefail

ORG="${1:-}"
if [ -z "$ORG" ]; then
  echo "ERROR: Provide a target org alias or username."
  echo "Usage: $0 <org-alias>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APEX_DIR="$SCRIPT_DIR/apex"

# ─── Helper ───────────────────────────────────────────────────
run_apex() {
  local script="$1"
  local label="$2"
  local path="$APEX_DIR/$script"
  if [ -f "$path" ]; then
    printf "  %-55s" "Running: $label..."
    sf apex run --file "$path" --target-org "$ORG" --json > /dev/null 2>&1 \
      && echo " ✓" \
      || echo " ⚠ (check org logs if this matters)"
  else
    printf "  %-55s %s\n" "Skipping: $label" "(not found: $script)"
  fi
}

# ─── Banner ───────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   AGENTFORCE RETAIL ADVISOR — DEMO DATA SEED            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Target org : $ORG"
echo ""

# ─── Verify org ───────────────────────────────────────────────
echo "► Verifying org authentication..."
sf org display --target-org "$ORG" --json > /dev/null || {
  echo "ERROR: Org '$ORG' not authenticated. Run: sf org login web -a $ORG"
  exit 1
}
echo "  ✓ Org authenticated"
echo ""

# ══════════════════════════════════════════════════════════════
# PHASE 1 — CORE CONFIG (must run before data that depends on it)
# ══════════════════════════════════════════════════════════════
echo "── Phase 1: Core Configuration ──────────────────────────"
run_apex "setup-loyalty-program.apex"        "Loyalty program config"
run_apex "create-app-products.apex"          "Product catalog (brands, SKUs, prices)"
run_apex "seed-segment-definitions.apex"     "Segment definitions"
run_apex "seed-campaign-decodes.apex"        "Campaign decode mappings"
echo ""

# ══════════════════════════════════════════════════════════════
# PHASE 2 — CLIENTELLING PORTFOLIOS & CONTACTS
# ══════════════════════════════════════════════════════════════
echo "── Phase 2: Portfolios & Clientelling Data ───────────────"
run_apex "setup-demo-portfolios.apex"        "Demo portfolios"
run_apex "seed-clientelling-data.apex"       "Clientelling contacts & profiles"
run_apex "setup-product-affinities.apex"     "Product affinity scores"
echo ""

# ══════════════════════════════════════════════════════════════
# PHASE 3 — DATA CLOUD / MERKURY IDENTITY
# ══════════════════════════════════════════════════════════════
echo "── Phase 3: Data Cloud / Merkury Identity ────────────────"
run_apex "dc-connector-add-merkury-field.apex"      "Merkury field connector"
run_apex "dc-connector-add-merkury-hid.apex"        "Merkury HID connector"
run_apex "dc-connector-object-permissions.apex"     "DC object permissions"
run_apex "dc-connector-field-permissions-batch1.apex" "DC field permissions (batch 1)"
run_apex "dc-connector-field-permissions-batch2.apex" "DC field permissions (batch 2)"
run_apex "dc-verify-merkury-setup.apex"             "Verify Merkury setup"
echo ""

# ══════════════════════════════════════════════════════════════
# PHASE 4 — JOURNEYS & ENGAGEMENT
# ══════════════════════════════════════════════════════════════
echo "── Phase 4: Journeys & Engagement ───────────────────────"
run_apex "create-multi-step-journey.apex"    "Multi-step journey setup"
run_apex "award-purchase-points.apex"        "Award loyalty purchase points"
echo ""

# ══════════════════════════════════════════════════════════════
# PHASE 5 — SCHEDULED JOBS
# ══════════════════════════════════════════════════════════════
echo "── Phase 5: Scheduled Batch Jobs ────────────────────────"
run_apex "schedule-engagement-processor.apex"      "Schedule engagement processor"
run_apex "schedule-nightly-journey-processor.apex" "Schedule nightly journey processor"
echo ""

# ══════════════════════════════════════════════════════════════
# PHASE 6 — FIXES & PATCHES (run last)
# ══════════════════════════════════════════════════════════════
echo "── Phase 6: Fixes & Patches ─────────────────────────────"
run_apex "fix-demo-profile-field.apex"       "Fix demo profile field"
run_apex "fix-empty-prompts.apex"            "Fix empty prompt templates"
echo ""

echo "╔══════════════════════════════════════════════════════════╗"
echo "║   SEED COMPLETE                                         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Check org for any ⚠ warnings above and verify in Setup > Apex Jobs."
echo ""
echo "NEXT — Verify your setup:"
echo "  sf org open --target-org $ORG"
echo "  Then: Setup > Agentforce Agents → Activate agents"
echo "        Setup > Remote Site Settings → Update SelfOrgDomain URL"
echo "        See AGENTFORCE_SETUP_GUIDE.md for OAuth + env var setup"
echo ""
