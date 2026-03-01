# Packaging Strategy: Agentforce Retail Advisor Accelerator

> How to take what we've built for BEAUTE and deploy it to any client — retail or otherwise — and be 75%+ of the way there.

---

## Table of Contents

1. [Solution Inventory](#1-solution-inventory)
2. [Packaging Approach: Source Deploy, Not Managed Package](#2-packaging-approach-source-deploy-not-managed-package)
3. [Salesforce Metadata: Core vs. Vertical Overlay](#3-salesforce-metadata-core-vs-vertical-overlay)
4. [Frontend: Vertical Abstraction Strategy](#4-frontend-vertical-abstraction-strategy)
5. [API / Infrastructure Layer](#5-api--infrastructure-layer)
6. [Data Cloud Configuration Kit](#6-data-cloud-configuration-kit)
7. [Agent Configuration Kit](#7-agent-configuration-kit)
8. [Post-Deploy Automation](#8-post-deploy-automation)
9. [What Cannot Be Automated (Manual UI Steps)](#9-what-cannot-be-automated-manual-ui-steps)
10. [New Vertical Playbook](#10-new-vertical-playbook)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Target Directory Structure](#12-target-directory-structure)

---

## 1. Solution Inventory

### Salesforce Metadata (90+ deployable items)

| Type | Count | Deployable via CLI? |
|------|-------|---------------------|
| Custom Objects (fully custom) | 18 | Yes |
| Standard Objects w/ Custom Fields | 7 (Contact, Campaign, CampaignMember, Case, Order, Product2) | Yes |
| Apex Classes | 27 | Yes |
| LWC Components | 17 | Yes |
| GenAI Prompt Templates | 6 | Yes |
| Flows | 3 | Yes |
| Permission Sets | 4 | Yes |
| Connected Apps | 1 | Partial (no Consumer Secret) |
| Remote Site Settings | 4 | Yes (but URLs are org-specific) |
| CSP Trusted Sites | 1 | Yes (but URL is org-specific) |
| Agents (shell metadata) | 2 | Yes (shell only) |
| Agent Topics | 8 | Partial (deploy creates topic, but instructions need UI) |
| Agent Scripts | - | No (Agent Builder Studio format only) |

### React Frontend (116 source files)

| Area | Files | Generic? |
|------|-------|----------|
| Components (Storefront, Chat, Product, Media Wall, etc.) | 40+ | Mostly generic, some beauty-specific copy |
| Services (Agentforce, Data Cloud, Personalization, Merkury, Firefly/Imagen) | 20+ | Generic (pluggable via config) |
| Contexts (Cart, Conversation, Scene, Store, Campaign, Customer) | 6 | Generic framework, some beauty-specific fields |
| Types (product, customer, agent, campaign, scene) | 6 | Mixed — product/customer types are beauty-specific |
| Mocks (products, personas, ad creatives, Merkury profiles) | 5 | Client-specific demo data |
| Hooks (generative background, exit intent, browse tracking, product staging) | 4 | Generic |

### API / Infrastructure

| Component | Description |
|-----------|-------------|
| `api/proxy.js` | Universal API gateway (OAuth, Agentforce, Data Cloud, CMS, Imagen, Firefly, Gemini) |
| `api/generate-journey-image.js` | Composite image generation for email campaigns |
| `server/index.js` | Local dev server mirroring serverless functions |
| `vercel.json` | Vercel deployment config (SPA routing, serverless functions) |
| `.env.example` | 25+ environment variables |

### Seed Scripts

| Script | Purpose |
|--------|---------|
| `scripts/seed-salesforce.js` | Create demo personas (Accounts, Contacts, Chat_Summary__c) |
| `scripts/seed-products.js` | Load Product2 catalog |
| `scripts/seed-custom-objects.js` | Create custom object records |
| `salesforce/scripts/seed-campaign-decodes.apex` | Seed Campaign_Decode__c records |
| `scripts/sync-sf-products.mjs` | Sync 130 Product2 IDs to MOCK_PRODUCTS |

---

## 2. Packaging Approach: Source Deploy, Not Managed Package

### Recommendation: Source-format metadata deploy via `sf project deploy start`

### Why NOT a managed package (1GP or 2GP)?

| Concern | Impact |
|---------|--------|
| **Namespace prefix** | All custom objects/fields get prefixed (e.g., `ns__Campaign_Decode__c`). Breaks all Apex SOQL, LWC imports, and React API calls. |
| **Customization lock** | Managed packages restrict subscribers from editing Apex, LWC, or flow logic. Consulting accelerators need full customization. |
| **Standard object fields** | Custom fields on Contact, Product2, Order can't be removed on uninstall from unmanaged packages — they orphan. Managed packages can't add fields to standard objects in some contexts. |
| **Agent metadata** | Agent topics and scripts are UI-managed. They can't be included in a package regardless. |
| **Data Cloud / Personalization** | No metadata types exist for personalization decisions, DLO mappings, or data graphs. |
| **Dev Hub requirement** | 2GP requires a Dev Hub org and package versioning workflow — overkill for a consulting accelerator. |

### Why source deploy works better:

- **Full control** — client team can modify anything after deployment
- **Layered deployment** — deploy core framework first, then vertical overlay on top
- **No namespace issues** — API names stay clean
- **Incremental updates** — push individual metadata components without full package versioning
- **Works today** — no additional Salesforce licensing or Dev Hub setup required

### Manifest-based approach:

Three `package.xml` manifests controlling what gets deployed:

```
salesforce/manifests/
  core-package.xml              -- Generic framework (always deploy)
  beauty-overlay-package.xml    -- Beauty vertical additions (optional)
  _template-overlay-package.xml -- Skeleton for new verticals
```

Deploy with:
```bash
# Core framework
sf project deploy start -x salesforce/manifests/core-package.xml --target-org client-org

# Vertical overlay
sf project deploy start -x salesforce/manifests/beauty-overlay-package.xml --target-org client-org
```

---

## 3. Salesforce Metadata: Core vs. Vertical Overlay

### Core Framework (deploy to every client)

#### Custom Objects (18 — all vertical-agnostic)

| Object | Purpose |
|--------|---------|
| `Agentforce_Config__c` | Stores Agent IDs, OAuth client credentials per org |
| `Agent_Activity__c` | Agent interaction logging |
| `Agent_Captured_Profile__c` | Conversational profile enrichment (generic: Data_Type__c, Field_Name__c, Field_Value__c, Confidence__c) |
| `Browse_Session__c` | Web browsing session tracking (Products_Viewed__c, Categories_Browsed__c, UTM params) |
| `Campaign_Decode__c` | Campaign attribution decode table (UTM → campaign context for agents) |
| `Chat_Summary__c` | AI-generated conversation summaries |
| `Consultation_Note__c` | In-store/virtual consultation notes |
| `Contact_Product_Affinity__c` | Product affinity scoring |
| `Journey_Approval__c` | Human-in-the-loop journey approval workflow (37 fields) |
| `Journey_Send_Request__e` | Platform event for journey triggers |
| `Marketer_Portfolio__c` | Marketer portfolio assignments |
| `Marketing_Agent_Settings__c` | Marketing Cloud integration credentials |
| `Marketing_Flow__c` | Journey flow tracking |
| `Meaningful_Event__c` | Life events, preferences, intents captured from conversations |
| `Portfolio_Member__c` | Portfolio membership |
| `Scene_Asset__c` | AI-generated scene asset cache |
| `Segment_Definition__c` | Data Cloud segment metadata |
| `Store_Appointment__c` | In-store appointment bookings |

#### Standard Object Custom Fields (generic subset)

**Contact (14 generic fields):**
- Identity: `Merkury_Id__c`, `Merkury_HID__c`, `Demo_Profile__c`
- Preferences: `Preferred_Brands__c`, `Preferred_Rep__c`, `Preferred_Store__c`, `Price_Range__c`, `Sustainability_Preference__c`
- Communication: `Email_Opt_In__c`, `SMS_Opt_In__c`, `Push_Opt_In__c`
- Clientelling: `Clientelling_Tier__c`, `Last_Store_Visit__c`, `Total_Store_Visits__c`

**Order (7 generic fields):**
- `Carrier__c`, `Delivered_Date__c`, `Estimated_Delivery__c`, `Payment_Method__c`, `Shipped_Date__c`, `Shipping_Status__c`, `Tracking_Number__c`

**Product2 (9 generic fields):**
- `Brand__c`, `Category__c`, `Description__c`, `Image_URL__c`, `In_Stock__c`, `Price__c`, `Rating__c`, `Price_Tier__c`, `Store_Stock_Level__c`

**Campaign (5 custom fields):**
- `Agent_Autonomy__c`, `Escalation_Config__c`, `Is_Portfolio__c`, `Portfolio_Owner__c`, `Portfolio_Type__c`

**CampaignMember (6 custom fields):**
- `Action_Due_Date__c`, `Agent_Suggestion__c`, `Last_Agent_Action__c`, `Lifetime_Value__c`, `Pending_Action_Type__c`, `Priority__c`

**Case (3 custom fields):**
- `Agent_Suggestion__c`, `Escalation_Trigger__c`, `Portfolio_Campaign__c`

#### Apex Classes (23 generic)

| Class | Purpose |
|-------|---------|
| `AgentCopilotService` | REST API proxy for Agentforce sessions (OAuth, init, send, end) |
| `AppointmentService` | Store appointment CRUD |
| `CampaignAgentService` | Campaign operations for agents |
| `CampaignDecodeService` | UTM → Campaign_Decode__c lookup (invocable for agents + REST for frontend) |
| `CaptureKeyEventsService` | Life event and milestone capture |
| `ChatSummaryService` | Conversation summary creation |
| `ClientellingProfileService` | In-store rep profile and Merkury archetype data |
| `ContentWorkspaceService` | Content library integration |
| `DailyEngagementProcessor` | Batch processor for browse-based re-engagement campaigns |
| `DataCloudEngagementController` | Data Cloud query orchestration |
| `DataCloudProfileService` | Data Cloud identity resolution and profile building |
| `DataCloudSegmentService` | Segment evaluation and membership checks |
| `JourneyApprovalService` | Marketing journey approval workflow (suggest/approve/decline) |
| `JourneyBatchProcessor` | Scheduled batch processor for journey sends |
| `JourneyPromptBuilder` | Dynamic prompt construction for journey generation |
| `JourneyStepService` | Individual journey step/email processing |
| `MeaningfulEventService` | Event creation and journey triggering (invocable) |
| `MultiStepJourneyBuilder` | Multi-step journey orchestration |
| `PortfolioAssignmentService` | Dynamic portfolio membership assignment |
| `PortfolioController` | Portfolio dashboard logic |
| `ProductPickerService` | Product selection helper |
| `ProfileEnrichmentService` | Contact profile enrichment from agent captures |
| `SegmentEvaluationService` | Segment membership evaluation |

#### LWC Components (all 17 — already generic)

**Rep Console:**
- `agentCopilotPanel` — AI co-pilot chat panel in Service Cloud
- `appointmentSidebar` — Store appointment sidebar
- `clientellingConsole` — Full console for in-store consultations
- `customerProfilePanel` — Customer 360 profile view
- `walkInCapture` — Walk-in customer capture

**Marketing:**
- `marketingConciergeHome` — Marketing agent home page
- `marketerInbox` — Marketer inbox for approvals

**Journey/Workflow:**
- `journeyApprovalCard` — Individual journey approval card
- `journeyApprovalDashboard` — Dashboard for pending approvals
- `journeyEmailPreview` — Email preview renderer
- `journeyFlowOverview` — Visual flow builder

**Product/Portfolio:**
- `productPickerModal` — Product selection modal
- `portfolioManagement` — Portfolio assignment management
- `profileSection360` — Customer profile section

**Utilities:**
- `consultationNoteCapture` — Note-taking component
- `customerLookup` — Contact lookup
- `provenanceBadge` — Data provenance indicator (1P/3P badge)

#### Flows (3 — all generic)

| Flow | Type | Purpose |
|------|------|---------|
| `Create_Meaningful_Event` | Auto-launched | Creates Meaningful_Event__c from agent conversations |
| `Create_Chat_Summary` | Auto-launched | Creates Chat_Summary__c at session end |
| `Update_Contact_Profile` | Auto-launched | Updates Contact fields from captured data |

#### Permission Sets (4 — all generic)

| Permission Set | Purpose |
|----------------|---------|
| `Agent_Custom_Object_Access` | FLS for all custom objects — assign to EinsteinServiceAgent user |
| `Marketing_Concierge` | Marketing team access |
| `Portfolio_Admin` | Portfolio administrator access |
| `Portfolio_Owner` | Portfolio owner access |

#### GenAI Prompt Templates (3 generic)

| Template | Purpose |
|----------|---------|
| `Customer_Identity_Personalization` | Rules for personalizing by identity tier (known/appended/anonymous) |
| `Product_Card_UI_Directive` | JSON format instructions for product card UI directives |
| `Provenance_Data_Rules` | Rules for handling 1P vs 3P data provenance in agent responses |

#### Agent Shells (2)

| Agent | Type | Notes |
|-------|------|-------|
| `Retail_Advisor` (rename from Beauty_Concierge) | ExternalClientAgent | Consumer-facing. Shell deploys; topics need Agent Builder UI. |
| `Clientelling_Copilot` | ExternalClientAgent | Rep-facing. Shell deploys; topics need Agent Builder UI. |

---

### Beauty Vertical Overlay (deploy on top of core for beauty demos)

#### Additional Contact Fields (5)
- `Skin_Type__c`, `Skin_Concerns__c`, `Allergies__c`, `Beauty_Priority__c`, `Climate_Context__c`

#### Additional Product2 Fields (10)
- `Concerns__c`, `Skin_Types__c`, `Key_Ingredients__c`
- `Is_Cruelty_Free__c`, `Is_Vegan__c`, `Is_Paraben_Free__c`, `Is_Fragrance_Free__c`
- `Is_Hypoallergenic__c`, `Is_Dermatologist_Tested__c`, `Is_Travel__c`

#### Apex Classes (4 beauty-specific)
- `ProductCatalogService` — Has beauty-specific SOQL filters (`Skin_Types__c`, `Concerns__c`)
- `SceneAssetService` — Beauty scene settings
- `SceneGeneratorService` — Beauty scene generation prompts
- `FireflyApexService` — Adobe Firefly integration (beauty-focused prompt construction)

#### GenAI Prompt Templates (3 beauty-specific)
- `Scene_Background_Directive` — References "beauty storefront", scene settings
- `Conversational_Event_Capture` — References beauty event types
- `Consultation_Prep_Notes` — References "beauty rep", "skincare", brand names

---

### What Stays OUT of All Manifests (org-specific, generate at deploy time)

| Item | Why | How to Handle |
|------|-----|---------------|
| Connected App (`AgentforceConcierge`) | Consumer Secret is generated at creation time | Document manual creation steps |
| Remote Site Settings (4) | Hardcoded URLs: `api.salesforce.com`, Vercel app URL, org domain, S3 | Generate from env vars via script |
| CSP Trusted Site | Hardcoded Vercel app URL | Generate from env vars via script |
| `Firefly_Settings__c` custom setting | Adobe credentials are org/account-specific | Populate via post-deploy script |

---

## 4. Frontend: Vertical Abstraction Strategy

### Current State: Beauty-specific code is interleaved in 3 places

1. **Type definitions** — `ProductCategory` is a hardcoded beauty union type; `ProfilePreferences` has `skinType`, `concerns`, `allergies`
2. **Mock data** — 130 BEAUTE products, 5 beauty personas, 10 beauty ad creatives
3. **UI copy** — Hero banner fallback content, exit intent discount codes, storefront section titles

### Target State: Central brand config + vertical data modules

#### `src/config/brand.ts` — Single source of truth for all client-specific values

```typescript
export const BRAND_CONFIG = {
  // Brand identity
  name: 'BEAUTE',
  tagline: 'Curated beauty for the modern you',
  logoUrl: '/assets/brand/logo.svg',

  // Tailwind color theme
  colors: {
    primary: 'rose',       // Used for CTAs, highlights
    accent: 'amber',       // Used for secondary elements
    neutral: 'stone',      // Used for backgrounds, text
  },

  // Product vertical
  vertical: 'beauty',
  productCategories: [
    'moisturizer', 'cleanser', 'serum', 'sunscreen', 'mask',
    'toner', 'travel-kit', 'eye-cream', 'foundation', 'lipstick',
    'mascara', 'blush', 'fragrance', 'shampoo', 'conditioner',
    'hair-treatment', 'spot-treatment',
  ] as const,

  // Customer profile schema (vertical-specific fields beyond the generic ones)
  profileFields: {
    primary: { key: 'skinType', label: 'Skin Type', options: ['dry', 'oily', 'combination', 'sensitive', 'normal'] },
    concerns: { key: 'concerns', label: 'Concerns', freeForm: true },
    allergies: { key: 'allergies', label: 'Allergies', freeForm: true },
  },

  // Scene settings for generative backgrounds
  sceneSettings: ['neutral', 'bathroom', 'travel', 'outdoor', 'lifestyle', 'bedroom', 'vanity', 'gym', 'office'],

  // SF Personalization channel name
  personalizationChannel: 'beaute-web',

  // Hero banner fallback content (when no SF Personalization decision matches)
  heroBanner: {
    badge: 'New Season Collection',
    headlineTop: 'Discover Your',
    headlineBottom: 'Perfect Glow',
    subtitle: 'Curated skincare and beauty essentials, personalized to your unique needs.',
  },

  // Exit intent fallback content
  exitIntent: {
    headline: "Wait! Here's a special offer",
    bodyText: 'Get 10% off your first order when you shop today.',
    discountCode: 'BEAUTE10',
    discountPercent: 10,
    ctaText: 'Claim My Discount',
  },
};
```

A new client engagement creates their own `brand.ts` and the entire app re-skins.

#### `src/verticals/` — Client-specific demo data

```
src/verticals/
  beauty/                   -- Current BEAUTE demo data
    products.ts             -- 130 products (moved from src/mocks/products.ts)
    personas.ts             -- Customer personas (moved from src/mocks/customerPersonas.ts)
    adCreatives.ts          -- 10 ad creatives (moved from src/mocks/adCreatives.ts)
    merkuryProfiles.ts      -- Merkury archetypes (moved from src/mocks/merkuryProfiles.ts)
    brand.ts                -- Beauty brand config (exported as BRAND_CONFIG)
  _template/                -- Starter files for new verticals
    products.ts             -- 5 example products with comments
    personas.ts             -- 2 example personas
    adCreatives.ts          -- 3 example ad creatives
    brand.ts                -- Blank brand config template with all fields documented
```

The existing `src/mocks/*.ts` files become thin re-exports:
```typescript
// src/mocks/products.ts
export { MOCK_PRODUCTS } from '@/verticals/beauty/products';
```

#### Type refactoring

**`src/types/product.ts`** — Make `ProductCategory` config-driven:
```typescript
import { BRAND_CONFIG } from '@/config/brand';
export type ProductCategory = typeof BRAND_CONFIG.productCategories[number];
```

**`src/types/customer.ts`** — Make `ProfilePreferences` extensible:
```typescript
export interface ProfilePreferences {
  primaryAttribute?: string;     // Was skinType — now driven by brand config
  concerns?: string[];
  allergies?: string[];
  communicationPrefs?: { email: boolean; sms: boolean; push: boolean };
  preferredBrands?: string[];
  ageRange?: string;
  [key: string]: unknown;        // Vertical-specific extensions
}
```

#### Component refactoring

- `HeroBanner.tsx` — Fallback variant reads from `BRAND_CONFIG.heroBanner` instead of hardcoded copy
- `ExitIntentOverlay.tsx` — `FALLBACK_DECISION` reads from `BRAND_CONFIG.exitIntent`
- `StoreHeader.tsx` — Brand name/logo from `BRAND_CONFIG.name` and `BRAND_CONFIG.logoUrl`

### What's already generic (no changes needed)

- `CartContext`, `StoreContext`, `CampaignContext` — fully vertical-agnostic
- `ChatInterface/*` — renders agent responses dynamically
- `ProductShowcase/*` — renders any product data
- `GenerativeBackground/*` — setting-agnostic image generation
- `MediaWall/*` — renders any ad creative data
- All services (`agentforce`, `datacloud`, `personalization`, `merkury`)
- All hooks (`useExitIntent`, `useBrowseTracking`, `useProductStaging`)
- UIDirective protocol — generic agent-to-UI communication

---

## 5. API / Infrastructure Layer

### Serverless Functions (fully generic, no changes needed)

| Function | Purpose | Client Config |
|----------|---------|---------------|
| `api/proxy.js` | Universal gateway for SF OAuth, Agentforce, Data Cloud, CMS, Imagen, Firefly, Gemini | Reads secrets from Vercel env vars |
| `api/generate-journey-image.js` | Composite product images for email campaigns | Firefly credentials from env vars |

### Vercel Configuration (generic)

`vercel.json` is vertical-agnostic — SPA routing and function timeouts work for any deployment.

### Environment Variables

Create a well-documented `.env.template`:

```bash
# ========================================================================
# AGENTFORCE RETAIL ADVISOR — Environment Configuration
# ========================================================================
# Copy this file to .env.local and fill in your org-specific values.
# Lines marked [REQUIRED] must be set. [OPTIONAL] can be left blank.
# ========================================================================

# ─── VERTICAL ────────────────────────────────────────────────────────────
# Which vertical's demo data to load (matches src/verticals/{name}/)
VITE_VERTICAL=beauty

# ─── SALESFORCE AGENTFORCE [REQUIRED] ────────────────────────────────────
VITE_AGENTFORCE_INSTANCE_URL=         # e.g., https://myorg.my.salesforce.com
VITE_AGENTFORCE_AGENT_ID=             # Consumer agent UUID from Agent Builder
VITE_AGENTFORCE_CLIENT_ID=            # Connected App consumer key
VITE_AGENTFORCE_CLIENT_SECRET=        # Connected App consumer secret
VITE_AGENTFORCE_BASE_URL=https://api.salesforce.com/einstein/ai-agent/v1

# ─── DATA CLOUD [REQUIRED] ──────────────────────────────────────────────
VITE_DATACLOUD_BASE_URL=              # Usually same as instance URL
VITE_DATACLOUD_CLIENT_ID=             # Usually same as Agentforce client
VITE_DATACLOUD_CLIENT_SECRET=         # Usually same as Agentforce secret

# ─── SF PERSONALIZATION (Einstein Personalization) [OPTIONAL] ────────────
VITE_SFP_BEACON_URL=                  # SDK URL from Data Cloud > Websites & Mobile Apps
VITE_SFP_DATASET=                     # Dataset name from web connector

# ─── IMAGE GENERATION [REQUIRED — pick one] ──────────────────────────────
VITE_IMAGE_PROVIDER=none              # 'firefly' | 'imagen' | 'gemini' | 'cms-only' | 'none'
VITE_ENABLE_GENERATIVE_BACKGROUNDS=false
# If firefly:
VITE_FIREFLY_CLIENT_ID=
VITE_FIREFLY_CLIENT_SECRET=
# If imagen or gemini:
VITE_IMAGEN_API_KEY=                  # Google AI API key

# ─── SALESFORCE CMS [OPTIONAL] ──────────────────────────────────────────
VITE_CMS_CHANNEL_ID=                  # For scene asset caching
VITE_CMS_SPACE_ID=

# ─── COMMERCE CLOUD [OPTIONAL] ──────────────────────────────────────────
VITE_COMMERCE_BASE_URL=
VITE_COMMERCE_CLIENT_ID=
VITE_COMMERCE_SITE_ID=
VITE_COMMERCE_ACCESS_TOKEN=

# ─── APP CONFIGURATION ──────────────────────────────────────────────────
VITE_USE_MOCK_DATA=true               # 'true' for demo mode, 'false' for live SF
VITE_ENABLE_PRODUCT_TRANSPARENCY=true # Show ingredient/attribute details
```

---

## 6. Data Cloud Configuration Kit

Data Cloud has **no metadata API** for DLO mappings, data graphs, identity resolution, or personalization. This must be documentation-driven.

### 6a. Web Connector Schema

**Reference file:** `salesforce/data-cloud/web-connector-schema.json`

This defines the 10 external data objects that the SF Personalization Web SDK streams into Data Cloud:

| Category | Objects | Key Fields |
|----------|---------|------------|
| **Engagement** | cart, cartItem, catalog, order, orderItem | eventId, eventType, dateTime, sessionId, productId, productName, price, quantity |
| **Profile** | identity, contactPointEmail, contactPointAddress, contactPointPhone | emailAddress, customerId, firstName, lastName |
| **Consent** | consentLog | consentType, consentValue, consentDate |
| **Party ID** | partyIdentification | identificationType, identificationNumber |

**Merkury-specific fields on Identity object:**
- `merkuryPid`, `merkuryHid`, `merkuryInterests`, `merkuryAgeRange`, `merkuryGender`
- `merkuryHouseholdIncome`, `merkuryLifestyle`, `merkuryGeoRegion`
- `merkurySkinType`, `merkurySkinConcerns`, `merkuryPreferredBrands`, `identityTier`

**Setup steps:**
1. Data Cloud > Data Streams > New > Web Connector
2. Upload `web-connector-schema.json`
3. Map each DLO to the appropriate DMO (see 6b)

### 6b. DLO-to-DMO Mapping

| DLO (Data Lake Object) | Target DMO | Key Mappings |
|-------------------------|------------|--------------|
| Web Engagement (catalog) | Product Browse Engagement | productId → CatalogObjectId, eventType → EngagementType |
| Web Engagement (cart) | Shopping Cart Engagement | productId → CatalogObjectId, quantity → Quantity |
| Web Engagement (order) | Purchase / Transaction | orderId → TransactionId, total → TotalAmount |
| Identity | Individual | emailAddress → PersonEmail, firstName → FirstName, merkury* fields → custom attributes |
| Contact Point Email | Contact Point Email | emailAddress → EmailAddress |
| Party Identification | Party Identification | merkuryPid/merkuryHid → IdentificationNumber |

### 6c. Identity Resolution

Configure identity resolution rulesets:
1. **Email match** — Match on `PersonEmail` (most common)
2. **Merkury PID match** — Match on party identification where type = 'MERKURY_PID'
3. **Merkury HID match** — Match on party identification where type = 'MERKURY_HID' (household-level)

### 6d. Data Graph

The "Individuals for Customer Engagement" data graph is system-managed. Fields appear in it (and become available for personalization targeting rules) after:
1. The field is mapped in the DLO → DMO mapping
2. Data has flowed through the field at least once
3. The data graph auto-includes the populated field

If fields don't appear, consider creating a **custom data graph** that explicitly selects the fields you need.

### 6e. Personalization Points

Two personalization points are referenced in the code:

**Hero_Banner:**
- Response template attributes: `badge`, `headlineTop`, `headlineBottom`, `subtitle`, `heroImage`, `imageAlt`
- Targeting rules: UTM Parameter > Campaign, Direct Attributes > Identity Tier, Related Attributes > Interests
- Code reference: `src/services/personalization/index.ts` → `getHeroCampaignDecision()`

**Exit_Intent_Capture:**
- Response template attributes: `headline`, `bodyText`, `discountCode`, `discountPercent`, `ctaText`, `imageUrl`, `backgroundColor`
- Targeting rules: UTM Parameter > Source (instagram, tiktok, google, youtube, pinterest, hulu, email)
- Code reference: `src/services/personalization/index.ts` → `getExitIntentDecision()`

**Important:** Einstein Personalization decisions/points/targeting rules have **NO API for programmatic creation**. All `PersonalizationDecision`, `PersonalizationPoint`, and `PersonalizationSchema` SObjects are read-only (`Createable: false`). They must be configured manually in the Salesforce UI.

---

## 7. Agent Configuration Kit

### What Deploys vs. What Doesn't

| Component | Deploys via CLI? | Approach |
|-----------|-----------------|----------|
| Agent shell (`.agent-meta.xml`) | Yes | Include in core-package.xml |
| Agent topics (`.agentTopic-meta.xml`) | Partial | Deploy creates topic, but instructions may need Agent Builder refresh |
| Topic instructions (natural language) | No | Document in topic-reference.md — copy-paste into Agent Builder |
| Topic actions (Apex/Flow wiring) | No | Document which actions to wire per topic |
| Agent scripts (`.agentScript`) | No | Agent Builder Studio format only |

### Consumer Agent Topics (Beauty Concierge / Retail Advisor)

| Topic | Scope | Actions to Wire |
|-------|-------|-----------------|
| `WelcomeGreeting` | Session initialization, identity resolution | `DataCloudProfileService` (invocable) |
| `ProductDiscovery` | Product browsing and exploration | `ProductCatalogService.searchProducts` |
| `ProductRecommendation` | Personalized recommendations | `ProductCatalogService.searchProducts`, `CampaignDecodeService.decodeCampaign` |
| `CheckoutAssistance` | Checkout flow guidance | — |
| `IdentityCapture` | Email/identity collection | Flow: `Update_Contact_Profile` |
| `ProfileEnrichmentCapture` | Conversational profile building | `ProfileEnrichmentService`, `CaptureKeyEventsService` |
| `TravelConsultation` | Travel-specific recommendations | `ProductCatalogService.searchProducts` (filter: Is_Travel__c) |
| `PostConversationSummary` | End-of-session summary | Flow: `Create_Chat_Summary`, `MeaningfulEventService` |

### GenAI Prompt Templates — Making Them Vertical-Agnostic

The 3 generic templates work as-is for any vertical:
- `Customer_Identity_Personalization` — Identity tier handling
- `Product_Card_UI_Directive` — JSON directive format
- `Provenance_Data_Rules` — 1P/3P data handling

The 3 beauty-specific templates need placeholder substitution per vertical:

| Template | Beauty-Specific References | Generic Replacement |
|----------|---------------------------|---------------------|
| `Consultation_Prep_Notes` | "beauty rep", "skincare", "SERENE and BOTANICA" brands | `{{REP_ROLE}}`, `{{VERTICAL}}`, `{{BRAND_NAMES}}` |
| `Scene_Background_Directive` | "beauty storefront", bathroom/vanity settings | `{{STOREFRONT_TYPE}}`, `{{SCENE_SETTINGS}}` |
| `Conversational_Event_Capture` | Beauty-specific event types | `{{EVENT_TYPES}}` |

Create generic versions with placeholders alongside the beauty reference versions.

---

## 8. Post-Deploy Automation

### `scripts/post-deploy-fls.mjs`

**Problem:** `sf project deploy start` reports "Succeeded" but fields are invisible without Field-Level Security grants. This is a known Salesforce platform behavior — metadata deploy does NOT auto-grant FLS.

**Solution:**
1. Query all custom fields across deployed objects via Tooling API
2. Get the System Administrator PermissionSet ID (varies per org)
3. Create `FieldPermissions` records via REST API for each field
4. Assign permission sets to deploying user and EinsteinServiceAgent user
5. Validate with `sf sobject describe`

### `scripts/generate-remote-sites.mjs`

**Problem:** Remote Site Settings and CSP Trusted Sites have hardcoded URLs that vary per org.

**Solution:**
1. Read SF instance URL, Vercel app URL from `.env.local`
2. Generate `.remoteSite-meta.xml` files from templates
3. Generate `.cspTrustedSite-meta.xml` files
4. Deploy via `sf project deploy start`

### `scripts/setup.sh` — Main Orchestrator

```bash
Usage: ./scripts/setup.sh [--org alias] [--vertical beauty] [--skip-frontend] [--seed-data]

Steps:
 1. Validate prerequisites (sf CLI v2+, node 18+, npm)
 2. sf org login web (if not already authenticated)
 3. sf project deploy start -x salesforce/manifests/core-package.xml
 4. sf project deploy start -x salesforce/manifests/{vertical}-overlay-package.xml
 5. node scripts/post-deploy-fls.mjs
 6. node scripts/generate-remote-sites.mjs
 7. Populate Agentforce_Config__c via anonymous Apex
 8. [If --seed-data] Run seed scripts (products, personas, campaign decodes)
 9. npm install && copy .env.template → .env.local (prompt for values)
10. Print manual steps checklist
```

---

## 9. What Cannot Be Automated (Manual UI Steps)

These must be done manually in the Salesforce UI after deployment. The documentation should provide step-by-step instructions with screenshots.

### Must Do (P0)

| Step | Where | Time Est. |
|------|-------|-----------|
| Create Connected App (OAuth client credentials) | Setup > App Manager | 10 min |
| Configure Agent in Agent Builder (topics, instructions, actions) | Setup > Agents | 30 min |
| Assign EinsteinServiceAgent user the `Agent_Custom_Object_Access` perm set | Setup > Permission Sets | 2 min |
| Populate `Agentforce_Config__c` with Agent ID + Connected App credentials | Custom object record | 5 min |

### Should Do (P1)

| Step | Where | Time Est. |
|------|-------|-----------|
| Create Data Cloud Web Connector + upload schema | Data Cloud > Data Streams | 15 min |
| Map DLO fields to DMO objects | Data Cloud > Data Model | 20 min |
| Configure Identity Resolution rulesets | Data Cloud > Identity Resolution | 15 min |
| Create Personalization Points + Response Templates | Data Cloud > Personalization | 20 min |
| Create Personalization Decisions + Targeting Rules | Data Cloud > Personalization | 30 min per decision |

### Nice to Have (P2)

| Step | Where | Time Est. |
|------|-------|-----------|
| Create Data Cloud Segments for portfolio targeting | Data Cloud > Segments | 15 min each |
| Configure Marketing Cloud journey integration | Marketing Agent Settings | 30 min |
| Set up Adobe Firefly credentials | Firefly_Settings__c + env vars | 10 min |

---

## 10. New Vertical Playbook

When deploying for a new client (e.g., fashion, electronics, food):

### Step 1: Salesforce (30-60 min)

1. Deploy core package: `sf project deploy start -x salesforce/manifests/core-package.xml`
2. Create vertical-specific custom fields on Contact and Product2 (e.g., `Fit_Preference__c`, `Style_Category__c` for fashion)
3. Clone `ProductCatalogService.cls` and update SOQL filters for new field names
4. Update GenAI prompt templates with vertical-specific content
5. Run FLS grant script
6. Seed product data

### Step 2: Frontend (30-60 min)

1. Copy `src/verticals/_template/` to `src/verticals/fashion/`
2. Edit `brand.ts` with client brand name, colors, product categories, profile fields
3. Populate `products.ts` with product catalog (or use live SF data)
4. Create `personas.ts` with 2-5 demo personas
5. Create `adCreatives.ts` with campaign gallery data
6. Set `VITE_VERTICAL=fashion` in `.env.local`
7. `npm run build` — verify it compiles

### Step 3: Data Cloud (45-90 min, manual UI)

1. Create web connector with schema (may need to adjust fields for vertical)
2. Map DLO → DMO
3. Configure identity resolution
4. Create personalization points and decisions

### Step 4: Agent (30-60 min, manual UI)

1. Create agent in Agent Builder (or clone existing)
2. Configure topics from `docs/agents/topic-reference.md`
3. Wire invocable actions
4. Update prompt template content for vertical

### Step 5: Deploy Frontend

1. Set up Vercel project (or alternative hosting)
2. Configure env vars in Vercel dashboard
3. Deploy: `npx vercel --prod`

**Total time to new vertical: ~3-5 hours** (vs. building from scratch: weeks/months)

---

## 11. Implementation Roadmap

### Phase 1 — Packaging Foundation (P0)

| Task | Effort | Output |
|------|--------|--------|
| Create `salesforce/manifests/core-package.xml` | S | Manifest file |
| Create `salesforce/manifests/beauty-overlay-package.xml` | S | Manifest file |
| Create `scripts/post-deploy-fls.mjs` | M | Automation script |
| Create `scripts/generate-remote-sites.mjs` | S | Automation script |
| Create `scripts/setup.sh` orchestrator | M | Main entry point |
| Create `.env.template` | S | Config template |
| Write `docs/QUICKSTART.md` | M | 15-min setup guide |
| Extract agent topics → `docs/agents/topic-reference.md` | M | Agent setup guide |

### Phase 2 — Frontend Templating (P1)

| Task | Effort | Output |
|------|--------|--------|
| Create `src/config/brand.ts` | S | Brand config file |
| Move mocks → `src/verticals/beauty/` + create `_template/` | M | Directory restructure |
| Refactor `src/types/product.ts` to use brand config | S | Type update |
| Refactor `src/types/customer.ts` for extensibility | S | Type update |
| Update HeroBanner + ExitIntentOverlay to use brand config | S | Component updates |
| Write `docs/CUSTOMIZATION_GUIDE.md` | M | Vertical creation guide |
| Write `docs/data-cloud/` guides (3 files) | L | Data Cloud setup docs |
| Create generic prompt template versions | M | Template files |

### Phase 3 — Automation & Polish (P2)

| Task | Effort | Output |
|------|--------|--------|
| Create `scripts/setup-env.mjs` interactive wizard | S | CLI tool |
| Create `.github/workflows/deploy.yml` | M | CI/CD pipeline |
| Write `docs/DEPLOYMENT_GUIDE.md` + `docs/ARCHITECTURE.md` | L | Comprehensive docs |
| Create a second vertical (e.g., fashion) as proof | L | Validates the approach |

---

## 12. Target Directory Structure

```
agentforce-retail-advisor/
  salesforce/
    force-app/main/default/        -- All Salesforce metadata (existing)
    manifests/                      -- NEW: Deploy manifests
      core-package.xml
      beauty-overlay-package.xml
      _template-overlay-package.xml
    data-cloud/
      web-connector-schema.json    -- Existing reference schema
    scripts/
      seed-campaign-decodes.apex   -- Existing seed script
  src/
    config/
      brand.ts                     -- NEW: Central brand configuration
    verticals/                     -- NEW: Vertical-specific data
      beauty/
        products.ts
        personas.ts
        adCreatives.ts
        merkuryProfiles.ts
        brand.ts
      _template/
        products.ts
        personas.ts
        adCreatives.ts
        brand.ts
    components/                    -- Existing (minor refactors for brand config)
    contexts/                      -- Existing (generic)
    hooks/                         -- Existing (generic)
    services/                      -- Existing (generic)
    types/                         -- Existing (refactor for brand config)
    mocks/                         -- Existing → thin re-exports from verticals/
  api/                             -- Existing serverless functions (generic)
  server/                          -- Existing dev server (generic)
  scripts/
    setup.sh                       -- NEW: Main orchestrator
    setup-env.mjs                  -- NEW: Interactive env var wizard
    post-deploy-fls.mjs            -- NEW: FLS automation
    generate-remote-sites.mjs      -- NEW: Remote site generation
    seed-products.js               -- Existing
    seed-salesforce.js             -- Existing
  docs/
    QUICKSTART.md                  -- NEW
    DEPLOYMENT_GUIDE.md            -- NEW
    CUSTOMIZATION_GUIDE.md         -- NEW
    ARCHITECTURE.md                -- NEW
    ENV_VARS.md                    -- NEW
    PACKAGING_STRATEGY.md          -- THIS FILE
    data-cloud/
      web-connector-schema.md      -- NEW
      dlo-dmo-mapping.md           -- NEW
      personalization-setup.md     -- NEW
    agents/
      topic-reference.md           -- NEW
      prompt-templates/
        generic/                   -- NEW: Vertical-agnostic versions
        beauty/                    -- NEW: Beauty reference versions
  .env.template                    -- NEW: Documented env var template
  .github/workflows/
    deploy.yml                     -- NEW: CI/CD pipeline
  vercel.json                      -- Existing (generic)
  package.json                     -- Existing
  sfdx-project.json                -- Existing
```

---

## Risk Summary

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent topics/scripts are UI-managed | High — manual setup per org | Comprehensive `topic-reference.md` with copy-paste instructions |
| Data Cloud has no metadata API | High — manual setup per org | Detailed setup guide with screenshots |
| ProductCatalogService has beauty SOQL | Medium — search breaks for other verticals | Clone and customize per vertical (or refactor to read field names from Custom Metadata) |
| SF Personalization decisions are UI-managed | Medium — personalization won't work OOB | Document targeting rules; client-side mock decisions work as fallback |
| FLS grants fail silently | Medium — fields invisible after deploy | `post-deploy-fls.mjs` with validation step |
| Connected App requires manual creation | Low — standard SF admin task | Step-by-step in QUICKSTART.md |
