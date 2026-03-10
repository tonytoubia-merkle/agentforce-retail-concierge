#!/usr/bin/env bash
# retrieve.sh
#
# Retrieves ALL org metadata into salesforce/force-app using package.xml.
# Run this against a SOURCE org to capture its current state for re-deployment.
#
# Prerequisites:
#   - Salesforce CLI (sf) v2+ installed  →  npm install -g @salesforce/cli
#   - Authenticated to source org        →  sf org login web -a <alias>
#
# Usage:
#   ./salesforce/scripts/retrieve.sh <org-alias>
#
# Examples:
#   ./salesforce/scripts/retrieve.sh beauty-demo-prod
#   ./salesforce/scripts/retrieve.sh myorg@company.com

set -euo pipefail

ORG="${1:-}"
if [ -z "$ORG" ]; then
  echo "ERROR: Provide an org alias or username."
  echo "Usage: $0 <org-alias>"
  echo ""
  echo "Authenticated orgs:"
  sf org list
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MANIFEST="$ROOT_DIR/salesforce/manifest/package.xml"
OUTPUT_DIR="$ROOT_DIR/salesforce/force-app"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   AGENTFORCE RETAIL ADVISOR — ORG METADATA RETRIEVE     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Source org  : $ORG"
echo "  Manifest    : $MANIFEST"
echo "  Output dir  : $OUTPUT_DIR"
echo ""

# ─── Verify org is authenticated ──────────────────────────────
echo "► Verifying org authentication..."
sf org display --target-org "$ORG" --json > /dev/null || {
  echo "ERROR: Org '$ORG' not authenticated. Run: sf org login web -a $ORG"
  exit 1
}
echo "  ✓ Org authenticated"
echo ""

# ─── Retrieve metadata via manifest ───────────────────────────
echo "► Retrieving metadata from org..."
echo "  (This may take 2-5 minutes depending on org size)"
echo ""

sf project retrieve start \
  --manifest "$MANIFEST" \
  --target-org "$ORG" \
  --output-dir "$OUTPUT_DIR" \
  --wait 30

echo ""
echo "  ✓ Metadata retrieved to: $OUTPUT_DIR"
echo ""

# ─── Retrieve agents separately (may be excluded by .forceignore) ─
echo "► Attempting agent metadata retrieve (Bot/BotVersion)..."
sf project retrieve start \
  --metadata "Bot:*" "BotVersion:*" \
  --target-org "$ORG" \
  --output-dir "$OUTPUT_DIR" \
  --wait 30 \
  2>/dev/null && echo "  ✓ Agent metadata retrieved" \
  || echo "  ⚠ Agent metadata not available via source retrieve (may need manual export — see NOTE below)"
echo ""

echo "══════════════════════════════════════════════════════════"
echo "  RETRIEVE COMPLETE"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Review changes:  git diff salesforce/force-app/"
echo "  2. Commit changes:  git add salesforce/force-app/ && git commit -m 'chore: retrieve org metadata'"
echo "  3. Deploy to target: ./salesforce/scripts/deploy.sh <target-org-alias>"
echo ""
echo "NOTE — Agentforce Agent limitations:"
echo "  Agentforce agents (Bot/BotVersion) have limited source-retrieve support."
echo "  If agents did not retrieve, export manually:"
echo "    sf project retrieve start --metadata 'Bot' --target-org $ORG"
echo "  Or use Metadata API directly:"
echo "    sf org generate manifest --metadata Bot --output-dir salesforce/manifest"
echo ""
