/**
 * Seed Salesforce CRM with demo persona data.
 *
 * Usage:
 *   node scripts/seed-salesforce.js
 *
 * Prerequisites:
 *   - The Express proxy server must be running (npm run dev)
 *   - .env.local must have valid VITE_AGENTFORCE_CLIENT_ID / SECRET / INSTANCE_URL
 *
 * What it creates (for each "known" persona):
 *   1. Account → Contact (with custom beauty profile fields)
 *   2. Chat_Summary__c records
 *   3. Meaningful_Event__c records
 *   4. Agent_Captured_Profile__c records
 *   5. Browse_Session__c records
 *
 * The CRM Connector in Data Cloud will sync these to Data Cloud automatically.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE = 'http://localhost:3001';

// ─── Load env ───────────────────────────────────────────────────
function loadEnv() {
  const env = {};
  try {
    const content = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
  } catch { /* .env.local not found */ }
  return env;
}

const env = loadEnv();

// ─── OAuth ──────────────────────────────────────────────────────
async function getAccessToken() {
  const clientId = env.VITE_AGENTFORCE_CLIENT_ID;
  const clientSecret = env.VITE_AGENTFORCE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Missing VITE_AGENTFORCE_CLIENT_ID or SECRET in .env.local');

  const res = await fetch(`${API_BASE}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) throw new Error(`OAuth failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

// ─── Salesforce REST helpers ────────────────────────────────────
async function sfCreate(token, sobject, fields) {
  const res = await fetch(`${API_BASE}/api/datacloud/sobjects/${sobject}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`  ✗ Create ${sobject} failed (${res.status}): ${text}`);
    return null;
  }
  const result = JSON.parse(text);
  console.log(`  ✓ Created ${sobject}: ${result.id}`);
  return result.id;
}

async function sfUpdate(token, sobject, id, fields) {
  const res = await fetch(`${API_BASE}/api/datacloud/sobjects/${sobject}/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    console.error(`  ✗ Update ${sobject}/${id} failed (${res.status}): ${text}`);
    return false;
  }
  return true;
}

async function sfQuery(token, soql) {
  const res = await fetch(`${API_BASE}/api/datacloud/query?q=${encodeURIComponent(soql)}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    console.error(`  ✗ Query failed (${res.status}): ${await res.text()}`);
    return { records: [] };
  }
  return res.json();
}

async function cleanupOrphanedAccounts(token) {
  console.log('\n🧹 Cleaning up orphaned Accounts from previous run...');
  const names = [
    'Sarah Chen Household', 'James Rodriguez Household', 'Maya Thompson Household',
    'David Kim Household', 'Marcus Williams Household',
  ];
  for (const name of names) {
    const data = await sfQuery(token, `SELECT Id FROM Account WHERE Name = '${name}'`);
    for (const record of data.records || []) {
      const res = await fetch(`${API_BASE}/api/datacloud/sobjects/Account/${record.Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok || res.status === 204) {
        console.log(`  ✓ Deleted orphaned Account: ${record.Id} (${name})`);
      } else {
        console.log(`  ✗ Failed to delete ${record.Id}: ${res.status}`);
      }
    }
  }
}

// ─── Lookup Product2 IDs by product name ────────────────────────
async function buildProductMap(token) {
  const data = await sfQuery(token, "SELECT Id, Name FROM Product2 WHERE IsActive = true");
  const map = {};
  for (const r of data.records || []) {
    map[r.Name] = r.Id;
  }
  console.log(`  Found ${Object.keys(map).length} active products in org`);
  return map;
}

// ─── Persona Data ───────────────────────────────────────────────
const personas = [
  {
    name: { first: 'Sarah', last: 'Chen' },
    email: 'sarah.chen@example.com',
    merkuryId: 'MRK-SC-90210',
    skinType: 'Sensitive',
    concerns: 'hydration;redness;anti-aging',
    allergies: 'fragrance',
    preferredBrands: 'SERENE;LUMIERE',
    address: { street: '123 Main St', city: 'San Francisco', state: 'CA', zip: '94102', country: 'US' },
    orders: [
      { id: 'ORD-2025-0847', date: '2025-06-12', channel: 'online', status: 'Activated', total: 94, items: [{ name: 'Cloud Cream Cleanser', qty: 1, price: 36 }, { name: 'Hydra-Calm Sensitive Moisturizer', qty: 1, price: 58 }] },
      { id: 'ORD-2025-1203', date: '2025-09-08', channel: 'in-store', status: 'Activated', total: 45, items: [{ name: 'Deep Dew Hydrating Mask', qty: 1, price: 45 }] },
      { id: 'ORD-2025-1456', date: '2025-11-15', channel: 'online', status: 'Activated', total: 94, items: [{ name: 'Cloud Cream Cleanser', qty: 1, price: 36 }, { name: 'Hydra-Calm Sensitive Moisturizer', qty: 1, price: 58 }] },
      { id: 'ORD-2025-1789', date: '2025-12-20', channel: 'mobile-app', status: 'Activated', total: 70, items: [{ name: 'Invisible Shield SPF 50', qty: 1, price: 42 }, { name: 'Cooling Facial Mist', qty: 1, price: 28 }] },
    ],
    loyalty: { tier: 'Gold', points: 2450, lifetime: 4800, since: '2024-11-01', expires: '2026-11-01' },
    chatSummaries: [
      { date: '2025-09-08', summary: 'Asked about overnight hydration for sensitive skin. Recommended Deep Dew Hydrating Mask. Confirmed she avoids all fragranced products.', sentiment: 'positive', topics: 'overnight hydration;sensitive skin;fragrance allergy' },
      { date: '2025-12-18', summary: 'Asked for travel-friendly skincare for work trip to Mumbai. Recommended SPF 50 and Cooling Mist. Also interested in retinol but worried about sensitivity.', sentiment: 'positive', topics: 'travel skincare;hot climate;SPF;retinol interest' },
    ],
    meaningfulEvents: [
      { type: 'preference', desc: 'Strictly fragrance-free — allergic reaction to fragranced products', at: '2025-09-08', note: 'Never recommend fragranced products' },
      { type: 'life-event', desc: 'Work trip to Mumbai, India (2 weeks, hot/humid climate)', at: '2025-12-18', note: 'Purchased travel SPF kit before departure', meta: { destination: 'Mumbai, India', climate: 'hot' } },
      { type: 'concern', desc: 'Interested in retinol but concerned about irritation on sensitive skin', at: '2025-12-18', note: 'Consider recommending encapsulated retinol' },
    ],
    capturedProfile: [
      { field: 'workEnvironment', value: 'Office, travels frequently for work', at: '2025-12-18', from: 'chat', confidence: 'stated' },
      { field: 'morningRoutineTime', value: 'Has about 10 minutes in the morning, prefers to do more at night', at: '2025-09-08', from: 'chat', confidence: 'stated' },
      { field: 'beautyPriority', value: 'Ingredient-conscious, prioritizes gentle/clean formulations', at: '2025-09-08', from: 'chat', confidence: 'inferred' },
    ],
    browseSessions: [
      { date: '2026-01-22', categories: 'serum', products: 'serum-retinol;serum-anti-aging', duration: 8, device: 'mobile' },
      { date: '2026-01-28', categories: 'eye-cream;serum', products: 'eye-cream;serum-vitamin-c', duration: 5, device: 'desktop' },
    ],
  },
  {
    name: { first: 'James', last: 'Rodriguez' },
    email: 'james.rodriguez@example.com',
    merkuryId: 'MRK-JR-78701',
    skinType: 'Oily',
    concerns: 'acne;oil control;pores',
    allergies: '',
    preferredBrands: 'DERMAFIX',
    address: { street: '456 Oak Ave', city: 'Austin', state: 'TX', zip: '78701', country: 'US' },
    orders: [
      { id: 'ORD-2025-0612', date: '2025-07-10', channel: 'online', status: 'Activated', total: 32, items: [{ name: 'Clear Start Salicylic Cleanser', qty: 1, price: 32 }] },
    ],
    loyalty: null,
    chatSummaries: [
      { date: '2025-07-10', summary: 'New to skincare, asked for help with oily skin and breakouts. Recommended Clear Start Salicylic Cleanser.', sentiment: 'positive', topics: 'oily skin;acne;beginner routine' },
      { date: '2026-01-25', summary: 'Looking for fragrance gift for partner — anniversary coming up. Browsed Jardin de Nuit and Bois Sauvage. Also wants to expand skincare routine.', sentiment: 'positive', topics: 'fragrance;gifting;anniversary;skincare routine expansion' },
    ],
    meaningfulEvents: [
      { type: 'intent', desc: 'Wants to build a proper skincare routine beyond just a cleanser', at: '2025-07-10', note: 'Good candidate for serum + moisturizer step-up' },
      { type: 'intent', desc: 'Anniversary coming up — looking for fragrance gift for partner', at: '2026-01-25', note: 'Drawn to floral scents for gifting', meta: { occasion: 'anniversary', giftFor: 'partner' } },
    ],
    capturedProfile: [
      { field: 'anniversary', value: 'Coming up in February', at: '2026-01-25', from: 'chat', confidence: 'stated' },
      { field: 'giftsFor', value: 'partner', at: '2026-01-25', from: 'chat', confidence: 'stated', dataType: 'array' },
      { field: 'beautyPriority', value: 'Wants to keep it simple, new to skincare', at: '2025-07-10', from: 'chat', confidence: 'stated' },
    ],
    browseSessions: [
      { date: '2026-01-25', categories: 'fragrance', products: 'fragrance-floral;fragrance-woody', duration: 12, device: 'mobile' },
      { date: '2026-01-20', categories: 'serum', products: 'serum-niacinamide', duration: 4, device: 'desktop' },
    ],
  },
  {
    name: { first: 'Maya', last: 'Thompson' },
    email: 'maya.thompson@example.com',
    merkuryId: 'MRK-MT-30302',
    skinType: 'Normal',
    concerns: 'brightening;glow',
    allergies: '',
    preferredBrands: 'LUMIERE;MAISON',
    address: { street: '789 Elm St', city: 'Los Angeles', state: 'CA', zip: '90028', country: 'US' },
    orders: [
      { id: 'ORD-2025-0301', date: '2025-03-14', channel: 'online', status: 'Activated', total: 118, items: [{ name: 'Skin Glow Serum Foundation', qty: 1, price: 52 }, { name: 'Silk Petal Blush', qty: 1, price: 38 }, { name: 'Lash Drama Volume Mascara', qty: 1, price: 28 }] },
      { id: 'ORD-2025-0589', date: '2025-06-02', channel: 'in-store', status: 'Activated', total: 159, items: [{ name: 'Velvet Matte Lip Color', qty: 1, price: 34 }, { name: 'Jardin de Nuit Eau de Parfum', qty: 1, price: 125 }] },
      { id: 'ORD-2025-0940', date: '2025-09-18', channel: 'online', status: 'Activated', total: 124, items: [{ name: 'Glow Boost Vitamin C Serum', qty: 1, price: 72 }, { name: 'Skin Glow Serum Foundation', qty: 1, price: 52 }] },
      { id: 'ORD-2025-1501', date: '2025-12-01', channel: 'online', status: 'Draft', total: 95, items: [{ name: 'Peptide Lift Pro Serum', qty: 1, price: 95 }] },
      { id: 'ORD-2026-0088', date: '2026-01-10', channel: 'mobile-app', status: 'Activated', total: 66, items: [{ name: 'Bond Repair Shampoo', qty: 1, price: 32 }, { name: 'Silk Hydration Conditioner', qty: 1, price: 34 }] },
    ],
    loyalty: { tier: 'Platinum', points: 5200, lifetime: 12400, since: '2024-03-01', expires: '2027-03-01' },
    chatSummaries: [
      { date: '2025-06-02', summary: 'In-store, found signature fragrance Jardin de Nuit. Said jasmine-sandalwood blend felt "like her." Also picked up lip color.', sentiment: 'positive', topics: 'fragrance;in-store experience;lipstick' },
      { date: '2025-12-05', summary: 'Returning Peptide Lift Pro — felt too heavy, wants lighter anti-aging alternative.', sentiment: 'neutral', topics: 'product return;anti-aging;serum texture' },
      { date: '2026-01-10', summary: 'Asked about haircare for color-treated hair. Recently got highlights, worried about damage. Purchased Bond Repair duo.', sentiment: 'positive', topics: 'haircare;color-treated hair;damage repair' },
    ],
    meaningfulEvents: [
      { type: 'preference', desc: 'Jardin de Nuit is her signature fragrance', at: '2025-06-02', note: 'Use for personalized scent recommendations' },
      { type: 'concern', desc: 'Returned Peptide Lift Pro — too heavy, wants lighter anti-aging', at: '2025-12-05', note: 'Avoid heavy serums. Try Vitamin C or encapsulated retinol.' },
      { type: 'life-event', desc: 'Recently got hair highlights, concerned about color damage', at: '2026-01-10', note: 'Recommend bond-repair and color-safe formulas' },
    ],
    capturedProfile: [
      { field: 'beautyPriority', value: 'Loves makeup and fragrance, views beauty as self-expression', at: '2025-06-02', from: 'chat', confidence: 'inferred' },
      { field: 'priceRange', value: 'Willing to spend on premium but expects results', at: '2025-12-05', from: 'chat', confidence: 'inferred' },
      { field: 'makeupFrequency', value: 'Daily — foundation, blush, mascara are staples', at: '2025-06-02', from: 'purchase pattern', confidence: 'inferred' },
    ],
    browseSessions: [
      { date: '2026-01-20', categories: 'foundation;blush', products: 'foundation-dewy;blush-silk', duration: 6, device: 'mobile' },
    ],
  },
  {
    name: { first: 'David', last: 'Kim' },
    email: 'david.kim@example.com',
    merkuryId: 'MRK-DK-60614',
    skinType: 'Combination',
    concerns: 'pores;texture;oil control',
    allergies: '',
    preferredBrands: 'DERMAFIX;SERENE',
    address: { street: '321 Lake Shore Dr', city: 'Chicago', state: 'IL', zip: '60614', country: 'US' },
    orders: [
      { id: 'ORD-2025-0720', date: '2025-08-15', channel: 'online', status: 'Activated', total: 70, items: [{ name: 'Clear Start Salicylic Cleanser', qty: 1, price: 32 }, { name: 'Pore Refine Niacinamide Serum', qty: 1, price: 38 }] },
      { id: 'ORD-2025-1320', date: '2025-11-22', channel: 'online', status: 'Activated', total: 76, items: [{ name: 'Glow Tonic AHA Toner', qty: 1, price: 34 }, { name: 'Invisible Shield SPF 50', qty: 1, price: 42 }] },
    ],
    loyalty: { tier: 'Silver', points: 980, lifetime: 1460, since: '2025-08-15', expires: '2026-08-15' },
    chatSummaries: [
      { date: '2025-08-15', summary: 'Asked for help building a routine for combination skin. Wanted to address pores and oiliness. Very methodical — asked about ingredient interactions.', sentiment: 'positive', topics: 'combination skin;pores;routine building;ingredient interactions' },
    ],
    meaningfulEvents: [
      { type: 'preference', desc: 'Very methodical about skincare — wants to understand ingredient interactions', at: '2025-08-15', note: 'Provide detailed ingredient explanations' },
    ],
    capturedProfile: [
      { field: 'beautyPriority', value: 'Science-driven, wants to understand how ingredients interact', at: '2025-08-15', from: 'chat', confidence: 'stated' },
      { field: 'morningRoutineTime', value: 'Has time for a full routine — not rushed', at: '2025-08-15', from: 'chat', confidence: 'inferred' },
    ],
    browseSessions: [
      { date: '2026-01-15', categories: 'serum;moisturizer', products: 'serum-retinol;moisturizer-sensitive', duration: 11, device: 'desktop' },
      { date: '2026-01-27', categories: 'eye-cream', products: 'eye-cream', duration: 3, device: 'mobile' },
    ],
  },
  {
    name: { first: 'Marcus', last: 'Williams' },
    email: 'marcus.w@example.com',
    merkuryId: 'MRK-MW-11201',
    skinType: 'Dry',
    concerns: 'hydration;dullness',
    allergies: '',
    preferredBrands: '',
    address: { street: '55 W 46th St', city: 'New York', state: 'NY', zip: '10036', country: 'US' },
    orders: [
      { id: 'ORD-2026-0102', date: '2026-01-24', channel: 'online', status: 'Activated', total: 36, items: [{ name: 'Cloud Cream Cleanser', qty: 1, price: 36 }] },
    ],
    loyalty: null,
    chatSummaries: [
      { date: '2026-01-24', summary: 'Brand new to skincare. A friend recommended this brand. Has dry, dull skin. Purchased Cloud Cream Cleanser as first step. Asked what to add next.', sentiment: 'positive', topics: 'beginner skincare;dry skin;first purchase;next steps' },
    ],
    meaningfulEvents: [
      { type: 'intent', desc: 'Complete skincare beginner — wants to know what to add next', at: '2026-01-24', note: 'Recommend moisturizer then SPF. Keep it simple.' },
    ],
    capturedProfile: [
      { field: 'beautyPriority', value: 'Total beginner, friend recommended the brand', at: '2026-01-24', from: 'chat', confidence: 'stated' },
    ],
    browseSessions: [],
  },
];

// ─── Seed Logic ─────────────────────────────────────────────────
async function seedPersona(token, persona, productMap) {
  console.log(`\n══════════════════════════════════════`);
  console.log(`Seeding: ${persona.name.first} ${persona.name.last} (${persona.merkuryId})`);
  console.log(`══════════════════════════════════════`);

  // 1. Create Account
  const accountId = await sfCreate(token, 'Account', {
    Name: `${persona.name.first} ${persona.name.last} Household`,
  });
  if (!accountId) return;

  // 2. Create Contact (standard fields only — custom fields can be populated manually in Setup)
  const contactFields = {
    FirstName: persona.name.first,
    LastName: persona.name.last,
    Email: persona.email,
    AccountId: accountId,
    MailingStreet: persona.address.street,
    MailingCity: persona.address.city,
    MailingState: persona.address.state,
    MailingPostalCode: persona.address.zip,
    MailingCountry: persona.address.country,
  };

  const contactId = await sfCreate(token, 'Contact', contactFields);
  if (!contactId) return;

  // 3. Create Orders (with OrderItems)
  for (const order of persona.orders) {
    // Standard Price Book
    const pbData = await sfQuery(token, "SELECT Id FROM Pricebook2 WHERE IsStandard = true LIMIT 1");
    const pricebookId = pbData.records?.[0]?.Id;

    // Create Order as Draft first (Salesforce requires this)
    const orderId = await sfCreate(token, 'Order', {
      AccountId: accountId,
      EffectiveDate: order.date,
      Status: 'Draft',
      Pricebook2Id: pricebookId,
      Channel__c: order.channel,
      OrderReferenceNumber: order.id,
    });
    if (!orderId) continue;

    // Create OrderItems
    for (const item of order.items) {
      const product2Id = productMap[item.name];
      if (!product2Id) {
        console.log(`    ⚠ Product not found: "${item.name}" — skipping line item`);
        continue;
      }

      // Check for PricebookEntry
      const pbeData = await sfQuery(token, `SELECT Id FROM PricebookEntry WHERE Product2Id = '${product2Id}' AND Pricebook2Id = '${pricebookId}' LIMIT 1`);
      let pbeId = pbeData.records?.[0]?.Id;

      // Create PricebookEntry if it doesn't exist
      if (!pbeId) {
        pbeId = await sfCreate(token, 'PricebookEntry', {
          Pricebook2Id: pricebookId,
          Product2Id: product2Id,
          UnitPrice: item.price,
          IsActive: true,
        });
      }
      if (!pbeId) continue;

      await sfCreate(token, 'OrderItem', {
        OrderId: orderId,
        Product2Id: product2Id,
        PricebookEntryId: pbeId,
        Quantity: item.qty,
        UnitPrice: item.price,
      });
    }

    // Activate the Order if the desired status is Activated
    if (order.status === 'Activated') {
      const activated = await sfUpdate(token, 'Order', orderId, { Status: 'Activated' });
      if (activated) {
        console.log(`    ✓ Order ${order.id} activated`);

        // Add tracking/shipping data for past orders
        const carriers = ['UPS', 'FedEx', 'USPS'];
        const carrier = carriers[Math.floor(Math.random() * carriers.length)];
        const trackingNumber = `1Z${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
        const orderDate = new Date(order.date);
        const shippedDate = new Date(orderDate.getTime() + 2 * 86400000).toISOString().split('T')[0];
        const deliveredDate = new Date(orderDate.getTime() + 5 * 86400000).toISOString().split('T')[0];

        await sfUpdate(token, 'Order', orderId, {
          Tracking_Number__c: trackingNumber,
          Carrier__c: carrier,
          Shipping_Status__c: 'Delivered',
          Shipped_Date__c: shippedDate,
          Delivered_Date__c: deliveredDate,
          Estimated_Delivery__c: deliveredDate,
          Payment_Method__c: 'Visa ending in 4242',
        });
      }
    }
  }

  // 4. Create Chat Summaries
  for (const chat of persona.chatSummaries) {
    await sfCreate(token, 'Chat_Summary__c', {
      Customer_Id__c: contactId,
      Session_Date__c: chat.date,
      Summary_Text__c: chat.summary,
      Sentiment__c: chat.sentiment,
      Topics_Discussed__c: chat.topics,
    });
  }

  // 5. Create Meaningful Events
  for (const event of persona.meaningfulEvents) {
    await sfCreate(token, 'Meaningful_Event__c', {
      Customer_Id__c: contactId,
      Event_Type__c: event.type,
      Description__c: event.desc,
      Captured_At__c: event.at,
      Agent_Note__c: event.note,
      Metadata_JSON__c: event.meta ? JSON.stringify(event.meta) : null,
    });
  }

  // 6. Create Agent Captured Profile fields
  for (const field of persona.capturedProfile) {
    await sfCreate(token, 'Agent_Captured_Profile__c', {
      Customer_Id__c: contactId,
      Field_Name__c: field.field,
      Field_Value__c: typeof field.value === 'object' ? JSON.stringify(field.value) : field.value,
      Captured_At__c: field.at,
      Captured_From__c: field.from,
      Confidence__c: field.confidence,
      Data_Type__c: field.dataType || 'string',
    });
  }

  // 7. Create Browse Sessions
  for (const browse of persona.browseSessions) {
    await sfCreate(token, 'Browse_Session__c', {
      Customer_Id__c: contactId,
      Session_Date__c: browse.date,
      Categories_Browsed__c: browse.categories,
      Products_Viewed__c: browse.products,
      Duration_Minutes__c: browse.duration,
      Device__c: browse.device,
    });
  }

  console.log(`  ✅ Done: ${persona.name.first} ${persona.name.last}`);
  return contactId;
}

// ─── Main ───────────────────────────────────────────────────────
async function main() {
  console.log('🔐 Authenticating with Salesforce...');
  const token = await getAccessToken();
  console.log('  ✓ Token acquired');

  // Clean up orphaned Accounts from previous failed runs
  await cleanupOrphanedAccounts(token);

  console.log('\n📦 Loading Product2 catalog...');
  const productMap = await buildProductMap(token);

  const contactMap = {};
  for (const persona of personas) {
    const contactId = await seedPersona(token, persona, productMap);
    if (contactId) {
      contactMap[persona.merkuryId] = contactId;
    }
  }

  console.log('\n\n══════════════════════════════════════');
  console.log('📋 Merkury ID → Contact ID mapping:');
  console.log('══════════════════════════════════════');
  for (const [merkuryId, contactId] of Object.entries(contactMap)) {
    console.log(`  ${merkuryId} → ${contactId}`);
  }
  console.log('\nUpdate your customerProfile.ts to query by Contact fields (Email or Merkury_Id__c)');
  console.log('instead of the SSOT /ssot/customers/ endpoint.\n');
  console.log('If the CRM Connector is set up, these records will sync to Data Cloud automatically.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
