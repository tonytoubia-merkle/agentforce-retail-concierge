# Merkury Identity Integration with Data Cloud

This guide explains how to configure Data Cloud to store and use Merkury PID (Personal ID) and HID (Household ID).

## Overview

Merkury provides **two levels of identity**:
- **PID (Personal ID)**: Individual-level identifier for cross-device matching — **used for identity resolution**
- **HID (Household ID)**: Household-level identifier shared across household members — **used for segmentation, NOT identity resolution**

Both are sent to Data Cloud via the Web Connector SDK and stored in the **Party Identification** DMO with different `IDType` values.

## Important: PID vs HID Purpose

| Identifier | Purpose | Identity Resolution? |
|------------|---------|---------------------|
| **PID** | Match records to the **same person** across devices/sources | ✅ YES — match rule |
| **HID** | Group **different people** in the same household for targeting | ❌ NO — grouping only |

**Why HID is NOT an identity resolution rule:**
- HID would incorrectly merge different household members into ONE unified individual
- Sarah and her partner are **different people** who happen to share a household
- They should remain **separate Unified Individuals** that can be queried by shared HID

Example: If a spouse browses products on their phone, the HID enables attribution to the household when the other spouse purchases on desktop — but they remain separate profiles.

## How It Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser                                                                │
│  ┌──────────────┐     ┌──────────────────────────────┐                 │
│  │ Merkury Tag  │────▶│ PID: PID-UC-20001            │                 │
│  └──────────────┘     │ HID: HID-H001                │                 │
│                       └──────────────────────────────┘                 │
│                              │                                          │
│                              ▼                                          │
│  ┌───────────────────────────────────────────────────────┐             │
│  │ SalesforceInteractions.sendEvent()                    │             │
│  │   partyIdentification: [                              │             │
│  │     { IDName: 'PID-UC-20001', IDType: 'MerkuryPID' }, │             │
│  │     { IDName: 'HID-H001', IDType: 'MerkuryHID' }      │             │
│  │   ]                                                   │             │
│  └───────────────────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Data Cloud                                                             │
│                                                                         │
│  Web Connector ──▶ Party Identification DMO                             │
│                    ┌────────────────────────────────────────────┐      │
│                    │ Record 1:                                   │      │
│                    │ ├── IdentificationNumber: PID-UC-20001      │      │
│                    │ ├── IdentificationType: MerkuryPID          │      │
│                    │ └── PartyId: → Individual (Sarah)           │      │
│                    ├────────────────────────────────────────────┤      │
│                    │ Record 2:                                   │      │
│                    │ ├── IdentificationNumber: HID-H001          │      │
│                    │ ├── IdentificationType: MerkuryHID          │      │
│                    │ └── PartyId: → Individual (Sarah)           │      │
│                    ├────────────────────────────────────────────┤      │
│                    │ Record 3:                                   │      │
│                    │ ├── IdentificationNumber: HID-H001          │  ◀── Same HID!
│                    │ ├── IdentificationType: MerkuryHID          │      │
│                    │ └── PartyId: → Individual (Partner)         │      │
│                    └────────────────────────────────────────────┘      │
│                                                                         │
│  Identity Resolution Ruleset (Individual-level ONLY)                    │
│  ├── Rule 1: Email Match (exact)                                        │
│  ├── Rule 2: Merkury PID Match (exact, IDType='MerkuryPID')            │
│  └── Rule 3: Phone Match (fuzzy)                                        │
│  ⚠️  NO HID RULE — HID is for grouping, NOT merging individuals         │
│                                                                         │
│  Result: Sarah → Unified Individual A                                   │
│          Partner → Unified Individual B                                 │
│          (Both have HID-H001 for household queries)                     │
│                                                                         │
│  Household Segment: WHERE HID = 'HID-H001' → Returns A and B           │
│                                                                         │
│  Activation to Merkury/LiveRamp (paid media)                            │
└─────────────────────────────────────────────────────────────────────────┘
```

## Contact Fields

| Field | Description | Unique? |
|-------|-------------|---------|
| `Contact.Merkury_Id__c` | Merkury Personal ID (PID) | Yes |
| `Contact.Merkury_HID__c` | Merkury Household ID (HID) | No (shared) |

## Data Cloud Configuration Steps

### 1. Party Identification DMO Setup

You've already added these fields to Party Identification in Data Cloud:
- `Merkury_PID__c` — Personal ID
- `Merkury_HID__c` — Household ID

Ensure they map to:
- `IDName` → `IdentificationNumber`
- `IDType` → `IdentificationType` (values: `MerkuryPID`, `MerkuryHID`)

### 2. Identity Resolution Ruleset (Individual-Level Only)

Navigate to **Data Cloud Setup → Identity Resolution → Rulesets**:

```
Priority | Rule Name            | Match Type | Field                         | Filter
---------|----------------------|------------|-------------------------------|---------------------------
1        | Email Match          | Exact      | ContactPointEmail.Email       | -
2        | Merkury PID Match    | Exact      | PartyIdentification.IDNumber  | IDType = 'MerkuryPID'
3        | Phone Match          | Fuzzy      | ContactPointPhone.Phone       | -
```

**⚠️ Important: HID is NOT a match rule.**

Do NOT add HID to identity resolution — it would incorrectly merge different household members into one unified individual. HID is stored in Party Identification for **segmentation and household queries only**.

### 3. Web Connector Schema

The `web-connector-schema.json` Identity record includes:

```json
{ "masterLabel": "merkuryPid", "developerName": "merkuryPid", "dataType": "Text" },
{ "masterLabel": "merkuryHid", "developerName": "merkuryHid", "dataType": "Text" }
```

### 4. Using HID for Household Segmentation

HID enables household-level targeting **without** merging individuals:

**Option A: Direct HID Query**
```sql
-- Find all individuals in a household
SELECT i.* FROM Individual__dlm i
JOIN PartyIdentification__dlm p ON i.Id = p.PartyId
WHERE p.IdentificationType = 'MerkuryHID'
  AND p.IdentificationNumber = 'HID-H001'
```

**Option B: Household Expansion in Segmentation**
1. Create segment with individual criteria (e.g., "purchased moisturizer")
2. Expand segment to include household members via HID join
3. Activate to paid media with both PID and HID for cross-device targeting

**Option C: Household-Level Attribution**
```sql
-- Aggregate purchases by household
SELECT p.IdentificationNumber AS HouseholdId,
       COUNT(DISTINCT o.IndividualId) AS BuyingMembers,
       SUM(o.TotalAmount) AS HouseholdSpend
FROM Order__dlm o
JOIN PartyIdentification__dlm p ON o.IndividualId = p.PartyId
WHERE p.IdentificationType = 'MerkuryHID'
GROUP BY p.IdentificationNumber
```

## Code Integration

### syncIdentity Function

The `syncIdentity()` function in `src/services/personalization/index.ts` sends both PID and HID:

```typescript
syncIdentity(
  customer.email,
  customer.id,
  {
    pid: customer.merkuryIdentity?.merkuryPid,
    hid: customer.merkuryIdentity?.merkuryHid,
  }
);
```

This sends **two separate Party Identification events**:
1. `{ IDName: 'PID-xxx', IDType: 'MerkuryPID' }` → Used for identity resolution (matching same person)
2. `{ IDName: 'HID-xxx', IDType: 'MerkuryHID' }` → Stored for household queries (NOT used in identity resolution)

### Mock Data Household Groupings

For demo purposes, these archetypes share households:

| Household ID | Members | Relationship |
|--------------|---------|--------------|
| `HID-H001` | Clean Beauty Urbanite + Male Grooming Minimalist | Partners |
| `HID-H002` | Wellness Mom + Active Outdoors SPF | Partners |
| `HID-H003` | Luxury Suburban Parent + Premium Retiree | Mother/Daughter |

## IDType Values

| IDType | Description | Uniqueness | Identity Resolution? |
|--------|-------------|------------|---------------------|
| `MerkuryPID` | Merkury Personal ID | Unique per individual | ✅ Yes — match rule |
| `MerkuryHID` | Merkury Household ID | Shared across household | ❌ No — grouping only |
| `LoyaltyId` | Loyalty program member ID | Unique | ✅ Yes — match rule |
| `EmailHash` | SHA-256 hashed email | Unique | ✅ Yes — match rule |
| `CustomerId` | CRM Contact ID | Unique | ✅ Yes — match rule |

## Query Examples

### Find all household members

```sql
SELECT
  i.UnifiedIndividualId,
  i.FirstName,
  i.LastName,
  p.IdentificationNumber AS HouseholdId
FROM Individual__dlm i
JOIN PartyIdentification__dlm p ON i.UnifiedIndividualId = p.PartyId
WHERE p.IdentificationType = 'MerkuryHID'
  AND p.IdentificationNumber = 'HID-H001'
```

### Find individual by PID

```sql
SELECT
  i.UnifiedIndividualId,
  i.FirstName,
  i.LastName,
  i.Email
FROM Individual__dlm i
JOIN PartyIdentification__dlm p ON i.UnifiedIndividualId = p.PartyId
WHERE p.IdentificationType = 'MerkuryPID'
  AND p.IdentificationNumber = 'PID-UC-20001'
```

### Household-level purchase attribution

```sql
SELECT
  hid.IdentificationNumber AS HouseholdId,
  COUNT(DISTINCT e.UnifiedIndividualId) AS HouseholdMembers,
  SUM(e.OrderTotal) AS HouseholdLTV
FROM EngagementEvent__dlm e
JOIN PartyIdentification__dlm hid ON e.UnifiedIndividualId = hid.PartyId
WHERE hid.IdentificationType = 'MerkuryHID'
GROUP BY hid.IdentificationNumber
```

## Verification Scripts

### Check Salesforce Core fields

```bash
sf apex run -f salesforce/scripts/dc-verify-merkury-setup.apex -o my-org
```

### Add HID field permission to Data Cloud connector

```bash
sf apex run -f salesforce/scripts/dc-connector-add-merkury-hid.apex -o my-org
```
