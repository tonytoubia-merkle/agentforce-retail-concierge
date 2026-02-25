# In-Store Clientelling — Agent Architecture

## Overview

The in-store clientelling experience uses a **separate Agentforce agent** (`Clientelling_Copilot`) from the consumer-facing `Beauty_Concierge`. Both share underlying actions (Search Product Catalog, Create Meaningful Event, Update Contact Profile, Create Chat Summary) and prompt templates, but have fundamentally different behavior.

| | Beauty Concierge | Clientelling Copilot |
|---|---|---|
| **Audience** | Customer (direct) | Rep (advisor) |
| **Tone** | "Here's what I recommend for you" | "You could suggest to the customer..." |
| **Scene generation** | Yes (WELCOME_SCENE, CHANGE_SCENE, backgrounds) | No — product cards only |
| **Provenance** | Subtle (doesn't mention 3P to customer) | Strict guardrails (NEVER surfaces 3P to rep) |
| **Identity capture** | Yes (email opt-in flow) | No (handled by walkInCapture LWC) |
| **Checkout** | Yes (INITIATE_CHECKOUT, CONFIRM_ORDER) | No (POS is separate) |
| **Appointment context** | No | Yes (prep notes, talking points) |
| **Inventory check** | No | Yes (store stock lookup) |

## Agent Definition

- **Developer Name**: `Clientelling_Copilot`
- **Type**: `ExternalClientAgent`
- **Path**: `salesforce/force-app/main/default/agents/Clientelling_Copilot/`
- **Called via**: `AgentCopilotService.cls` → Agentforce REST API → `agentCopilotPanel` LWC

## Topics

| Topic | Purpose |
|-------|---------|
| `topic_selector` | Routes rep intent to appropriate topic |
| `customer_consultation` | Product recs, routines, gift ideas, complementary products, product knowledge |
| `appointment_prep` | Pre-consultation talking points from 360 profile |
| `inventory_check` | Store stock lookup with alternatives |
| `profile_enrichment` | Capture customer info reported by the rep |
| `consultation_summary` | End-of-consultation summary generation |
| `off_topic` | Redirect non-consultation questions |

## Shared Actions (same Apex/Flow targets as Beauty Concierge)

| Action | Target | Notes |
|--------|--------|-------|
| Search Product Catalog | `apex://ProductCatalogService` | Shared — same product catalog |
| Create Meaningful Event | `flow://Create_Meaningful_Event` | Shared — but clientelling makes `agentNote` REQUIRED |
| Update Contact Profile | `flow://Update_Contact_Profile` | Shared — same Contact fields |
| Create Chat Summary | `flow://Create_Chat_Summary` | Shared — same summary format |

## Prompt Templates (shared across agents)

| Template | Used By | Purpose |
|----------|---------|---------|
| `Conversational_Event_Capture` | Both | When/how to capture meaningful events with timing and agentNote |
| `Product_Card_UI_Directive` | Both | Product card JSON format and display rules |
| `Scene_Background_Directive` | Beauty Concierge only | Dynamic background generation rules |
| `Provenance_Data_Rules` | Both (critical for Clientelling) | 1P/3P data handling guardrails |
| `Customer_Identity_Personalization` | Both | How to personalize by identity tier |
| `Consultation_Prep_Notes` | Clientelling only | Prep note generation from 360 profile |

**Path**: `salesforce/force-app/main/default/genAiPromptTemplates/`

## Key Behavioral Differences

### 1. Rep-Facing Tone
All responses framed as advice to the rep:
- "You could suggest the LUMIERE Night Serum — it pairs well with the Cloud Cream they already use."
- "The customer might enjoy the new Renewal Collection given their interest in anti-aging."

### 2. No Scene Generation
Unlike Beauty Concierge, the Clientelling Copilot does NOT generate:
- `WELCOME_SCENE` directives
- `CHANGE_SCENE` directives
- `backgroundPrompt` or `sceneContext`
- Dynamic AI-generated backgrounds

Product cards are rendered via `SHOW_PRODUCTS` / `SHOW_PRODUCT` without scene context.

### 3. Provenance Guardrails (ABSOLUTE)
- **1P Declared/Stated**: Reference directly ("Profile shows sensitive skin")
- **1P Observed**: Reference purchases/loyalty ("Bought Cloud Cream last month")
- **1P Inferred**: Soft reference ("Previous notes suggest clean beauty preference")
- **3P Appended**: NEVER surface. Silently informs tier selection only. Frame as "staff favorites" or "popular picks"

### 4. Mandatory agentNote on Events
Every `Create Meaningful Event` call MUST include an `agentNote` explaining why the event matters for the consultation and future personalization.

### 5. Consultation Prep
The `appointment_prep` topic generates structured talking points from the customer's 360 profile:
1. Loyalty status & available rewards
2. Recent purchases & restock opportunities
3. Previous consultation notes
4. Meaningful events & life context
5. Browse signals (soft reference)
6. Beauty profile & preferences
7. Provenance-aware product recommendations
