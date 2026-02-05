import type { DemoContact } from '@/types/customer';

const API_BASE = 'http://localhost:3001';

export async function fetchDemoContacts(): Promise<DemoContact[]> {
  try {
    const response = await fetch(`${API_BASE}/api/demo/contacts`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.contacts || [];
  } catch {
    return [];
  }
}

export async function createContact(data: {
  firstName?: string;
  lastName?: string;
  email: string;
  merkuryId?: string;
  demoProfile?: string;
  leadSource?: string;
  beautyFields?: Record<string, string>;
}): Promise<{ contactId: string; accountId: string } | null> {
  try {
    const response = await fetch(`${API_BASE}/api/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) return null;
    const result = await response.json();
    return result.success ? { contactId: result.contactId, accountId: result.accountId } : null;
  } catch {
    return null;
  }
}
