# deploy.ps1
#
# Full ordered deployment of ALL metadata to a target Salesforce org.
# PowerShell equivalent of deploy.sh for Windows.
#
# Usage:
#   .\salesforce\scripts\deploy.ps1 -Org beauty-demo-new
#   .\salesforce\scripts\deploy.ps1 -Org beauty-demo-new -DryRun
#
# Prerequisites:
#   - Salesforce CLI installed:  npm install -g @salesforce/cli
#   - Authenticated to target:   sf org login web -a beauty-demo-new

param(
    [Parameter(Mandatory=$true)]
    [string]$Org,

    [switch]$DryRun
)

$ErrorActionPreference = "Continue"

$SfDir   = Resolve-Path (Join-Path $PSScriptRoot "..\force-app\main\default")
$DryRunFlag = if ($DryRun) { "--dry-run" } else { "" }

# ─── Helpers ──────────────────────────────────────────────────
function Step($n, $label) {
    Write-Host ""
    Write-Host "═══ Step $n`: $label ═══" -ForegroundColor Cyan
}

function Deploy-Dir($label, $dir) {
    Write-Host "  Deploying: $label"
    if (Test-Path $dir) {
        $args = @("project", "deploy", "start", "--source-dir", $dir, "--target-org", $Org, "--wait", "20")
        if ($DryRun) { $args += "--dry-run" }
        sf @args
    } else {
        Write-Host "  ⚠ Not found (skipping): $dir" -ForegroundColor Yellow
    }
}

# ─── Banner ───────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║   AGENTFORCE RETAIL ADVISOR — FULL ORG DEPLOY           ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Target org  : $Org"
if ($DryRun) {
    Write-Host "  Mode        : DRY RUN / VALIDATE ONLY" -ForegroundColor Yellow
} else {
    Write-Host "  Mode        : DEPLOY"
}
Write-Host ""

# ─── Verify org ───────────────────────────────────────────────
Write-Host "► Verifying org authentication..." -ForegroundColor Cyan
sf org display --target-org $Org --json | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Org '$Org' not authenticated. Run: sf org login web -a $Org" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Org authenticated" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════
# PHASE 1 — SCHEMA
# ══════════════════════════════════════════════════════════════
Step 1 "Custom Objects (all 20 custom objects)"
$customObjects = @(
    "Agent_Activity__c", "Agent_Captured_Profile__c", "Agentforce_Config__c",
    "Browse_Session__c", "Campaign_Decode__c", "Chat_Summary__c",
    "Consultation_Note__c", "Contact_Product_Affinity__c", "Firefly_Settings__c",
    "Journey_Approval__c", "Journey_Send_Request__e", "Marketer_Portfolio__c",
    "Marketing_Agent_Settings__c", "Marketing_Flow__c", "Meaningful_Event__c",
    "Portfolio_Member__c", "Scene_Asset__c", "Segment_Definition__c",
    "Store_Appointment__c", "Tooling_API_Config__c"
)
foreach ($obj in $customObjects) {
    Deploy-Dir $obj "$SfDir\objects\$obj"
}

Step 2 "Standard Object Customizations (Contact, Campaign, Order, Product2, Case, CampaignMember)"
foreach ($obj in @("Contact", "Campaign", "CampaignMember", "Case", "Order", "Product2")) {
    Deploy-Dir $obj "$SfDir\objects\$obj"
}

# ══════════════════════════════════════════════════════════════
# PHASE 2 — NETWORK & SECURITY
# ══════════════════════════════════════════════════════════════
Step 3 "Remote Site Settings"
Deploy-Dir "Remote Sites" "$SfDir\remoteSiteSettings"

Step 4 "CSP Trusted Sites"
Deploy-Dir "CSP Trusted Sites" "$SfDir\cspTrustedSites"

Step 5 "Named Credentials & External Credentials"
Deploy-Dir "Named Credentials"    "$SfDir\namedCredentials"
Deploy-Dir "External Credentials" "$SfDir\externalCredentials"

Step 6 "Custom Labels"
Deploy-Dir "Custom Labels" "$SfDir\labels"

# ══════════════════════════════════════════════════════════════
# PHASE 3 — APEX CLASSES
# ══════════════════════════════════════════════════════════════
Step 7 "Apex Classes (30 classes)"
Deploy-Dir "Apex Classes" "$SfDir\classes"

# ══════════════════════════════════════════════════════════════
# PHASE 4 — LIGHTNING WEB COMPONENTS
# ══════════════════════════════════════════════════════════════
Step 8 "Lightning Web Components (19 components)"
Deploy-Dir "LWC" "$SfDir\lwc"

# ══════════════════════════════════════════════════════════════
# PHASE 5 — FLOWS
# ══════════════════════════════════════════════════════════════
Step 9 "Flows"
Deploy-Dir "Flows" "$SfDir\flows"

# ══════════════════════════════════════════════════════════════
# PHASE 6 — GENAI / AGENTFORCE PROMPT TEMPLATES
# ══════════════════════════════════════════════════════════════
Step 10 "GenAI Prompt Templates (7 templates)"
Deploy-Dir "GenAI Prompt Templates" "$SfDir\genAiPromptTemplates"

# ══════════════════════════════════════════════════════════════
# PHASE 7 — CONNECTED APP
# ══════════════════════════════════════════════════════════════
Step 11 "Connected App (AgentforceConcierge)"
Deploy-Dir "Connected App" "$SfDir\connectedApps"

# ══════════════════════════════════════════════════════════════
# PHASE 8 — UI
# ══════════════════════════════════════════════════════════════
Step 12 "Pages & Tabs"
Deploy-Dir "Apex Pages"  "$SfDir\pages"
Deploy-Dir "Custom Tabs" "$SfDir\tabs"

# ══════════════════════════════════════════════════════════════
# PHASE 9 — PERMISSION SETS
# ══════════════════════════════════════════════════════════════
Step 13 "Permission Sets (4 sets)"
Deploy-Dir "Permission Sets" "$SfDir\permissionsets"

Step 14 "Assign Permission Sets to current user"
$permsets = @("Agent_Custom_Object_Access", "Marketing_Concierge", "Portfolio_Admin", "Portfolio_Owner")
foreach ($ps in $permsets) {
    sf org assign permset --name $ps --target-org $Org 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Assigned: $ps" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Could not assign (may need manual assignment): $ps" -ForegroundColor Yellow
    }
}

# ══════════════════════════════════════════════════════════════
# PHASE 10 — AGENTFORCE AGENTS
# ══════════════════════════════════════════════════════════════
Step 15 "Agentforce Agents (Beauty_Concierge, Clientelling_Copilot)"
$agentsDir = "$SfDir\agents"
if (Test-Path $agentsDir) {
    Write-Host "  Attempting agent deploy (requires manual activation after)..."
    $agentArgs = @("project", "deploy", "start", "--source-dir", $agentsDir,
                   "--target-org", $Org, "--wait", "30", "--ignore-warnings")
    if ($DryRun) { $agentArgs += "--dry-run" }
    sf @agentArgs
    Write-Host "  ✓ Agent deploy attempted — activate in Setup > Agentforce Agents" -ForegroundColor Green
} else {
    Write-Host "  ⚠ agents\ directory not found — activate agents manually in Setup" -ForegroundColor Yellow
}

# ══════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
if ($DryRun) {
    Write-Host "║   VALIDATION COMPLETE (no changes deployed)             ║" -ForegroundColor Green
} else {
    Write-Host "║   DEPLOYMENT COMPLETE                                   ║" -ForegroundColor Green
}
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "MANUAL STEPS REQUIRED AFTER DEPLOY:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Agentforce Agents:"
Write-Host "     Setup > Agentforce Agents > Activate Beauty_Concierge & Clientelling_Copilot"
Write-Host "     Assign EinsteinServiceAgent user the 'Agent_Custom_Object_Access' permset"
Write-Host ""
Write-Host "  2. Connected App:"
Write-Host "     Setup > App Manager > AgentforceConcierge > View > Consumer Key + Secret"
Write-Host "     Update .env.local with SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET"
Write-Host ""
Write-Host "  3. Remote Site — update SelfOrgDomain to your org's My Domain URL:"
Write-Host "     Setup > Remote Site Settings > SelfOrgDomain"
Write-Host ""
Write-Host "  4. Seed demo data (optional):"
Write-Host "     .\salesforce\scripts\seed-all.ps1 -Org $Org"
Write-Host ""
