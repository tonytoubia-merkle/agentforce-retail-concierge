import { useState } from 'react';
import { motion } from 'framer-motion';
import { useCustomer } from '@/contexts/CustomerContext';
import { useStore } from '@/contexts/StoreContext';

const STORE_LOCATIONS = [
  { value: 'Flagship Store', label: 'Flagship Store — 5th Avenue' },
  { value: 'Mall Location', label: 'Mall Location — Westfield' },
  { value: 'Downtown Boutique', label: 'Downtown Boutique — SoHo' },
];

const CONSULTATION_TYPES = [
  { value: 'Skincare Consultation', label: 'Skincare Consultation', desc: 'Personalized skin analysis and routine building' },
  { value: 'Makeup Application', label: 'Makeup Application', desc: 'Professional makeup application for events or daily look' },
  { value: 'Color Match', label: 'Color Match', desc: 'Find your perfect foundation, concealer, and lip shades' },
  { value: 'Product Demo', label: 'Product Demo', desc: 'Hands-on demo of new or featured products' },
  { value: 'Follow-up', label: 'Follow-up', desc: 'Check in on your routine and adjust recommendations' },
];

// Generate time slots for the next 7 days
function getAvailableSlots(): { date: string; label: string; slots: string[] }[] {
  const days: { date: string; label: string; slots: string[] }[] = [];
  const now = new Date();

  for (let d = 1; d <= 7; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split('T')[0];
    const dayLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    const slots: string[] = [];
    for (let h = 10; h <= 17; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
      if (h < 17) slots.push(`${h.toString().padStart(2, '0')}:30`);
    }

    days.push({ date: dateStr, label: dayLabel, slots });
  }

  return days;
}

export const AppointmentBooking: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { customer } = useCustomer();
  const { goBack } = useStore();

  const [storeLocation, setStoreLocation] = useState(STORE_LOCATIONS[0].value);
  const [consultationType, setConsultationType] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ appointmentId: string; dateTime: string } | null>(null);

  const availableDays = getAvailableSlots();
  const selectedDaySlots = availableDays.find(d => d.date === selectedDate)?.slots || [];

  const canSubmit = storeLocation && consultationType && selectedDate && selectedTime && customer?.id && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit || !customer) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const appointmentDateTime = `${selectedDate}T${selectedTime}:00.000Z`;

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: customer.id,
          storeLocation,
          appointmentDateTime,
          appointmentType: consultationType,
          customerNotes: customerNotes || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setConfirmation({
          appointmentId: data.appointmentId,
          dateTime: appointmentDateTime,
        });
      } else {
        setError(data.error || 'Failed to book appointment');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirmation View
  if (confirmation) {
    const dateObj = new Date(confirmation.dateTime);
    const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg mx-auto p-8 text-center"
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-medium text-stone-900 mb-2">Appointment Booked!</h2>
        <p className="text-stone-500 mb-6">We look forward to seeing you.</p>

        <div className="bg-stone-50 rounded-xl p-6 text-left space-y-3 mb-6">
          <div className="flex justify-between">
            <span className="text-sm text-stone-500">Store</span>
            <span className="text-sm font-medium text-stone-900">{storeLocation}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-stone-500">Date</span>
            <span className="text-sm font-medium text-stone-900">{formattedDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-stone-500">Time</span>
            <span className="text-sm font-medium text-stone-900">{formattedTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-stone-500">Type</span>
            <span className="text-sm font-medium text-stone-900">{consultationType}</span>
          </div>
        </div>

        <button
          onClick={onClose || goBack}
          className="px-8 py-3 bg-stone-900 text-white text-sm font-medium rounded-full hover:bg-stone-800 transition-colors"
        >
          Done
        </button>
      </motion.div>
    );
  }

  // Booking Form
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button
        onClick={onClose || goBack}
        className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-medium text-stone-900 mb-1">Book a Consultation</h1>
        <p className="text-stone-500 text-sm mb-8">
          Schedule a personalized 1:1 consultation with one of our beauty experts.
        </p>

        <div className="space-y-6">
          {/* Store Location */}
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
              Store Location
            </label>
            <div className="grid gap-2">
              {STORE_LOCATIONS.map(store => (
                <button
                  key={store.value}
                  onClick={() => setStoreLocation(store.value)}
                  className={`text-left px-4 py-3 rounded-xl border transition-all ${
                    storeLocation === store.value
                      ? 'border-stone-900 bg-stone-50'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <span className="text-sm font-medium text-stone-900">{store.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Consultation Type */}
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
              Consultation Type
            </label>
            <div className="grid gap-2">
              {CONSULTATION_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => setConsultationType(type.value)}
                  className={`text-left px-4 py-3 rounded-xl border transition-all ${
                    consultationType === type.value
                      ? 'border-stone-900 bg-stone-50'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <span className="text-sm font-medium text-stone-900">{type.label}</span>
                  <span className="block text-xs text-stone-500 mt-0.5">{type.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date Selection */}
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
              Date
            </label>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {availableDays.map(day => (
                <button
                  key={day.date}
                  onClick={() => { setSelectedDate(day.date); setSelectedTime(''); }}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm transition-all ${
                    selectedDate === day.date
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Slots */}
          {selectedDate && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
                Time
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedDaySlots.map(slot => (
                  <button
                    key={slot}
                    onClick={() => setSelectedTime(slot)}
                    className={`px-4 py-2 rounded-full text-sm transition-all ${
                      selectedTime === slot
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="Anything you'd like your consultant to know..."
              className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 resize-none"
              rows={3}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3 bg-stone-900 text-white text-sm font-medium rounded-full hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Booking...' : 'Book Appointment'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
