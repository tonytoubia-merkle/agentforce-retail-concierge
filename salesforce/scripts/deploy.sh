#!/usr/bin/env bash
# deploy.sh
#
# Full ordered deployment of ALL metadata to a target Salesforce org.
# Deploys in dependency order so nothing fails due to missing references.
#
# Prerequisites:
#   - Salesforce CLI (sf) v2+ installed  →  npm install -g @salesforce/cli
#   - Authenticated to target org        →  sf org login web -a <alias>
#   - Target org has Agentforce/Einstein enabled (Developer or Enterprise edition)
#
# Usage:
#   ./salesforce/scripts/deploy.sh <org-alias> [--dry-run]
#
# Examples:
#   ./salesforce/scripts/deploy.sh beauty-demo-new
#   ./salesforce/scripts/deploy.sh staging@company.com
#   ./salesforce/scripts/deploy.sh beauty-demo-new --dry-run   # validate only, no deploy

set -euo pipefail

ORG="${1:-}"
DRY_RUN="${2:-}"
VALIDATE_ONLY=""
if [ "$DRY_RUN" = "--dry-run" ] || [ "$DRY_RUN" = "--validate" ]; then
  VALIDATE_ONLY="--dry-run"
fi

if [ -z "$ORG" ]; then
  echo "ERROR: Provide a target org alias or username."
  echo "Usage: $0 <org-alias> [--dry-run]"
  echo ""
  echo "Authenticated orgs:"
  sf org list
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SF_DIR="$ROOT_DIR/salesforce/force-app/main/default"
SCRIPTS_DIR="$ROOT_DIR/salesforce/scripts"
MANIFEST="$ROOT_DIR/salesforce/manifest/package.xml"

# ─── Helper ───────────────────────────────────────────────────
step() { echo ""; echo "═══ Step $1: $2 ═══"; }
ok()   { echo "  ✓ $1"; }
warn() { echo "  ⚠ $1"; }

deploy_dir() {
  local label="$1"
  local dir="$2"
  echo "  Deploying: $label"
  sf project deploy start \
    --source-dir "$dir" \
    --target-org "$ORG" \
    --wait 20 \
    $VALIDATE_ONLY \
    2>&1 | grep -E "(Deploy ID|Status|Deployed|Error|Warning|✓|✗)" || true
}

deploy_meta() {
  local label="$1"
  shift
  echo "  Deploying: $label"
  sf project deploy start \
    --metadata "$@" \
    --target-org "$ORG" \
    --wait 20 \
    $VALIDATE_ONLY \
    2>&1 | grep -E "(Deploy ID|Status|Deployed|Error|Warning|✓|✗)" || true
}

run_apex() {
  local script="$1"
  local label="$2"
  if [ -f "$SCRIPTS_DIR/$script" ]; then
    echo "  Running: $label"
    sf apex run \
      --file "$SCRIPTS_DIR/$script" \
      --target-org "$ORG" \
      2>&1 | tail -3 || warn "Script had warnings: $script"
  else
    warn "Script not found (skipping): $script"
  fi
}

# ─── Banner ───────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   AGENTFORCE RETAIL ADVISOR — FULL ORG DEPLOY           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Target org  : $ORG"
echo "  Source dir  : $SF_DIR"
[ -n "$VALIDATE_ONLY" ] && echo "  Mode        : DRY RUN / VALIDATE ONLY" || echo "  Mode        : DEPLOY"
echo ""

# ─── Verify org ───────────────────────────────────────────────
echo "► Verifying org authentication..."
sf org display --target-org "$ORG" --json > /dev/null || {
  echo "ERROR: Org '$ORG' not authenticated. Run: sf org login web -a $ORG"
  exit 1
}
ok "Org authenticated"

# ══════════════════════════════════════════════════════════════
# PHASE 1 — SCHEMA (objects must exist before code references them)
# ══════════════════════════════════════════════════════════════
step 1 "Custom Objects (all 20 custom objects + standard customizations)"
# Deploy each custom object individually to avoid cross-dependency failures
CUSTOM_OBJECTS=(
  "Agent_Activity__c"
  "Agent_Captured_Profile__c"
  "Agentforce_Config__c"
  "Browse_Session__c"
  "Campaign_Decode__c"
  "Chat_Summary__c"
  "Consultation_Note__c"
  "Contact_Product_Affinity__c"
  "Firefly_Settings__c"
  "Journey_Approval__c"
  "Journey_Send_Request__e"
  "Marketer_Portfolio__c"
  "Marketing_Agent_Settings__c"
  "Marketing_Flow__c"
  "Meaningful_Event__c"
  "Portfolio_Member__c"
  "Scene_Asset__c"
  "Segment_Definition__c"
  "Store_Appointment__c"
  "Tooling_API_Config__c"
)
for obj in "${CUSTOM_OBJECTS[@]}"; do
  [ -d "$SF_DIR/objects/$obj" ] && deploy_dir "$obj" "$SF_DIR/objects/$obj" || warn "Object dir not found: $obj"
done

step 2 "Standard Object Customizations (Contact, Campaign, Order, Product2, Case, CampaignMember)"
for obj in Contact Campaign CampaignMember Case Order Product2; do
  [ -d "$SF_DIR/objects/$obj" ] && deploy_dir "$obj" "$SF_DIR/objects/$obj" || warn "No customizations for: $obj"
done

# ══════════════════════════════════════════════════════════════
# PHASE 2 — NETWORK & SECURITY (needed before code that calls out)
# ══════════════════════════════════════════════════════════════
step 3 "Remote Site Settings"
[ -d "$SF_DIR/remoteSiteSettings" ] && deploy_dir "Remote Sites" "$SF_DIR/remoteSiteSettings" || warn "No remote site settings found"

step 4 "CSP Trusted Sites"
[ -d "$SF_DIR/cspTrustedSites" ] && deploy_dir "CSP Trusted Sites" "$SF_DIR/cspTrustedSites" || warn "No CSP trusted sites found"

step 5 "Named Credentials & External Credentials"
[ -d "$SF_DIR/namedCredentials"    ] && deploy_dir "Named Credentials"    "$SF_DIR/namedCredentials"    || warn "No named credentials found"
[ -d "$SF_DIR/externalCredentials" ] && deploy_dir "External Credentials" "$SF_DIR/externalCredentials" || warn "No external credentials found"

step 6 "Custom Labels"
[ -d "$SF_DIR/labels" ] && deploy_dir "Custom Labels" "$SF_DIR/labels" || warn "No custom labels found"

# ══════════════════════════════════════════════════════════════
# PHASE 3 — APEX CLASSES
# ══════════════════════════════════════════════════════════════
step 7 "Apex Classes (30 classes)"
[ -d "$SF_DIR/classes" ] && deploy_dir "Apex Classes" "$SF_DIR/classes" || warn "No Apex classes found"

# ══════════════════════════════════════════════════════════════
# PHASE 4 — LIGHTNING WEB COMPONENTS
# ══════════════════════════════════════════════════════════════
step 8 "Lightning Web Components (19 components)"
[ -d "$SF_DIR/lwc" ] && deploy_dir "LWC" "$SF_DIR/lwc" || warn "No LWC components found"

# ══════════════════════════════════════════════════════════════
# PHASE 5 — FLOWS
# ══════════════════════════════════════════════════════════════
step 9 "Flows"
[ -d "$SF_DIR/flows" ] && deploy_dir "Flows" "$SF_DIR/flows" || warn "No flows found"

# ══════════════════════════════════════════════════════════════
# PHASE 6 — GENAI / AGENTFORCE PROMPT TEMPLATES
# ══════════════════════════════════════════════════════════════
step 10 "GenAI Prompt Templates (7 templates)"
[ -d "$SF_DIR/genAiPromptTemplates" ] && deploy_dir "GenAI Prompt Templates" "$SF_DIR/genAiPromptTemplates" || warn "No GenAI prompt templates found"

# ══════════════════════════════════════════════════════════════
# PHASE 7 — CONNECTED APP
# ══════════════════════════════════════════════════════════════
step 11 "Connected App (AgentforceConcierge)"
[ -d "$SF_DIR/connectedApps" ] && deploy_dir "Connected App" "$SF_DIR/connectedApps" || warn "No connected apps found"

# ══════════════════════════════════════════════════════════════
# PHASE 8 — UI (pages, tabs)
# ══════════════════════════════════════════════════════════════
step 12 "Pages & Tabs"
[ -d "$SF_DIR/pages" ] && deploy_dir "Apex Pages" "$SF_DIR/pages" || warn "No pages found"
[ -d "$SF_DIR/tabs"  ] && deploy_dir "Custom Tabs"  "$SF_DIR/tabs"  || warn "No tabs found"

# ══════════════════════════════════════════════════════════════
# PHASE 9 — PERMISSION SETS (depend on objects, classes, LWC)
# ══════════════════════════════════════════════════════════════
step 13 "Permission Sets (4 sets)"
[ -d "$SF_DIR/permissionsets" ] && deploy_dir "Permission Sets" "$SF_DIR/permissionsets" || warn "No permission sets found"

step 14 "Assign Permission Sets to current user"
PERMSETS=("Agent_Custom_Object_Access" "Marketing_Concierge" "Portfolio_Admin" "Portfolio_Owner")
for ps in "${PERMSETS[@]}"; do
  sf org assign permset --name "$ps" --target-org "$ORG" 2>/dev/null \
    && ok "Assigned: $ps" \
    || warn "Could not assign (may need manual assignment): $ps"
done

# ══════════════════════════════════════════════════════════════
# PHASE 10 — AGENTFORCE AGENTS
# Note: Bot/BotVersion metadata has deploy limitations.
# Agents typically require activation in Setup > Agents after deploy.
# ══════════════════════════════════════════════════════════════
step 15 "Agentforce Agents (Beauty_Concierge, Clientelling_Copilot)"
if [ -d "$SF_DIR/agents" ]; then
  echo "  ⚠ Agent metadata found in force-app/main/default/agents/"
  echo "    Attempting deploy (may require --ignore-warnings)..."
  sf project deploy start \
    --source-dir "$SF_DIR/agents" \
    --target-org "$ORG" \
    --wait 30 \
    --ignore-warnings \
    $VALIDATE_ONLY \
    2>&1 | grep -E "(Deploy ID|Status|Deployed|Error|Warning|✓|✗)" || true
  ok "Agent deploy attempted — verify activation in Setup > Agentforce Agents"
else
  warn "agents/ directory not found under force-app/main/default/"
  echo "    Agents may be excluded by .forceignore — see NOTE at end of script"
fi

# ══════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
if [ -n "$VALIDATE_ONLY" ]; then
  echo "║   VALIDATION COMPLETE (no changes deployed)             ║"
else
  echo "║   DEPLOYMENT COMPLETE                                   ║"
fi
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "MANUAL STEPS REQUIRED AFTER DEPLOY:"
echo ""
echo "  1. Agentforce Agents:"
echo "     Setup > Agentforce Agents → Activate Beauty_Concierge & Clientelling_Copilot"
echo "     Assign agent user (EinsteinServiceAgent) the 'Agent_Custom_Object_Access' permset"
echo ""
echo "  2. Connected App:"
echo "     Setup > Connected Apps > AgentforceConcierge → note Consumer Key/Secret"
echo "     Update .env.local with SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET"
echo ""
echo "  3. Remote Sites:"
echo "     Update SelfOrgDomain remote site with YOUR org's My Domain URL"
echo "     Setup > Remote Site Settings > SelfOrgDomain"
echo ""
echo "  4. Agentforce Base URL & Agent ID:"
echo "     See AGENTFORCE_SETUP_GUIDE.md for full OAuth + agent ID setup"
echo ""
echo "  5. Seed demo data (optional):"
echo "     ./salesforce/scripts/seed-all.sh $ORG"
echo ""
