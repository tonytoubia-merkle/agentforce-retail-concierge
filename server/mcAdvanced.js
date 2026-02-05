/**
 * MC Advanced (Marketing Cloud) REST API Client
 *
 * Handles OAuth token management and journey entry event firing
 * for lifecycle journeys (welcome, post-purchase, ship confirm, etc.).
 *
 * Requires env vars:
 *   SFMC_CLIENT_ID, SFMC_CLIENT_SECRET, SFMC_SUBDOMAIN, SFMC_ACCOUNT_ID
 */

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Check if MC Advanced is configured (all required env vars present).
 */
export function isMcConfigured(env) {
  return !!(env.SFMC_CLIENT_ID && env.SFMC_CLIENT_SECRET && env.SFMC_SUBDOMAIN);
}

/**
 * Get an OAuth token for MC Advanced REST API.
 * Caches the token in-memory and refreshes 30s before expiry.
 */
export async function getMcToken(env) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 30000) {
    return cachedToken;
  }

  const tokenUrl = `https://${env.SFMC_SUBDOMAIN}.auth.marketingcloudapis.com/v2/token`;

  const body = {
    grant_type: 'client_credentials',
    client_id: env.SFMC_CLIENT_ID,
    client_secret: env.SFMC_CLIENT_SECRET,
  };
  if (env.SFMC_ACCOUNT_ID) {
    body.account_id = env.SFMC_ACCOUNT_ID;
  }

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MC Advanced token error ${res.status}: ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // MC tokens typically expire in 1080s (18 min)
  tokenExpiresAt = now + (data.expires_in || 1080) * 1000;

  console.log('[mc] Token acquired, expires in', data.expires_in, 's');
  return cachedToken;
}

/**
 * Fire a journey entry event in MC Advanced.
 *
 * @param {object} env - Environment variables
 * @param {string} eventDefinitionKey - The API event key (e.g., 'APIEvent-welcome')
 * @param {string} contactKey - Unique contact identifier (typically email or SF Contact ID)
 * @param {object} data - Event data payload
 */
export async function fireJourneyEntry(env, eventDefinitionKey, contactKey, data = {}) {
  if (!isMcConfigured(env)) {
    console.log('[mc] Skipped journey entry (not configured):', eventDefinitionKey);
    return null;
  }

  const token = await getMcToken(env);
  const restUrl = `https://${env.SFMC_SUBDOMAIN}.rest.marketingcloudapis.com/interaction/v1/events`;

  const payload = {
    ContactKey: contactKey,
    EventDefinitionKey: eventDefinitionKey,
    Data: {
      ContactKey: contactKey,
      ...data,
    },
  };

  console.log('[mc] Firing journey entry:', eventDefinitionKey, 'for', contactKey);

  const res = await fetch(restUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[mc] Journey entry failed:', res.status, text);
    throw new Error(`MC journey entry error ${res.status}: ${text}`);
  }

  const result = await res.json();
  console.log('[mc] Journey entry success:', eventDefinitionKey, result.eventInstanceId);
  return result;
}

/**
 * Fire a transactional send (triggered email) via MC Advanced.
 *
 * @param {object} env - Environment variables
 * @param {string} triggeredSendKey - The triggered send definition key
 * @param {string} email - Recipient email
 * @param {object} attributes - Subscriber attributes for email personalization
 */
export async function fireTransactionalSend(env, triggeredSendKey, email, attributes = {}) {
  if (!isMcConfigured(env)) {
    console.log('[mc] Skipped transactional send (not configured):', triggeredSendKey);
    return null;
  }

  const token = await getMcToken(env);
  const restUrl = `https://${env.SFMC_SUBDOMAIN}.rest.marketingcloudapis.com/messaging/v1/email/messages`;

  const payload = {
    definitionKey: triggeredSendKey,
    recipients: [
      {
        contactKey: email,
        to: email,
        attributes,
      },
    ],
  };

  console.log('[mc] Firing transactional send:', triggeredSendKey, 'to', email);

  const res = await fetch(restUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[mc] Transactional send failed:', res.status, text);
    throw new Error(`MC transactional send error ${res.status}: ${text}`);
  }

  const result = await res.json();
  console.log('[mc] Transactional send success:', triggeredSendKey);
  return result;
}
