import type { CustomerProfile } from '@/types/customer';

export const MOCK_CUSTOMER: CustomerProfile = {
  id: 'cust-12345',
  name: 'Alex',
  email: 'alex@example.com',
  hydrationProfile: {
    primaryUse: 'fitness',
    waterPreferences: ['still', 'sparkling'],
    preferredBrands: ['Primo Water', 'Pure Life'],
    dailyIntakeGoalOz: 100,
    deliveryFrequency: 'weekly',
    householdSize: 2,
    hasDispenser: true,
  },
  purchaseHistory: [
    {
      productId: 'primo-5gal-delivery-weekly',
      productName: 'Primo 5-Gallon Weekly Delivery',
      purchaseDate: '2024-11-15',
      quantity: 2,
      rating: 5,
    },
  ],
  savedPaymentMethods: [
    {
      id: 'pm-1',
      type: 'card',
      last4: '4242',
      brand: 'visa',
      isDefault: true,
    },
  ],
  shippingAddresses: [
    {
      id: 'addr-1',
      name: 'Alex Rivera',
      line1: '123 Lake Shore Dr',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60601',
      country: 'US',
      isDefault: true,
    },
  ],
  orders: [],
  chatSummaries: [],
  meaningfulEvents: [],
  browseSessions: [],
  loyalty: null,
};
