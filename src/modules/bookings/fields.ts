import type { Json } from '@/lib/database.types';

// Printed header + Booking Details on page 1 of the blank customer file.
// Requiredness and duplicate rules are not inferred from the presence of a box.
export const bookingFields = [
  { key: 'customer_code', label: 'Customer ID', group: 'File details' },
  { key: 'booking_number', label: 'Booking number', group: 'File details' },
  { key: 'enquiry_number', label: 'Enquiry number', group: 'File details' },
  { key: 'booking_date', label: 'Date', group: 'File details', type: 'date' },
  { key: 'tl_name', label: 'TL name on file', group: 'File details' },
  { key: 'gst_billing', label: 'GST billing', group: 'File details', options: [['yes','Yes'],['no','No']] },
  { key: 'registration_type', label: 'Registration type', group: 'File details', options: [['permanent','Permanent'],['temporary','Temporary']] },
  { key: 'customer_name', label: 'Booking customer name', group: 'Booking customer' },
  { key: 'communication_address', label: 'Communication address', group: 'Booking customer', type: 'textarea' },
  { key: 'contact_person', label: 'Contact person', group: 'Booking customer' },
  { key: 'pin', label: 'PIN', group: 'Booking customer' },
  { key: 'model', label: 'Model', group: 'Vehicle preferences' },
  { key: 'suffix_1', label: 'Suffix 1', group: 'Vehicle preferences' },
  { key: 'suffix_2', label: 'Suffix 2', group: 'Vehicle preferences' },
  { key: 'colour_1', label: 'Colour 1', group: 'Vehicle preferences' },
  { key: 'colour_2', label: 'Colour 2', group: 'Vehicle preferences' },
  { key: 'interior_colour', label: 'Interior colour', group: 'Vehicle preferences' },
  { key: 'special_request', label: 'Special request', group: 'Vehicle preferences', type: 'textarea' },
  { key: 'registration_name', label: 'Registered owner name', group: 'Registration details' },
  { key: 'registration_address', label: 'Registration address', group: 'Registration details', type: 'textarea' },
  { key: 'registration_pin', label: 'Registration PIN', group: 'Registration details' },
  { key: 'registration_model', label: 'Registration model', group: 'Registration details' },
  { key: 'registration_suffix', label: 'Registration suffix', group: 'Registration details' },
  { key: 'registration_colour', label: 'Registration colour', group: 'Registration details' },
] as const;
export type BookingData = Partial<Record<(typeof bookingFields)[number]['key'] | 'registration_same', string>>;
export function bookingData(data: Json): BookingData {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  return { ...Object.fromEntries(bookingFields.map(f => [f.key, typeof data[f.key] === 'string' ? data[f.key] : ''])), registration_same: data.registration_same==='yes' ? 'yes' : 'no' };
}
export const bookingGroups = ['File details', 'Booking customer', 'Vehicle preferences', 'Registration details'] as const;

export const registrationCopies = {
  registration_name: 'customer_name', registration_address: 'communication_address', registration_pin: 'pin',
  registration_model: 'model', registration_suffix: 'suffix_1', registration_colour: 'colour_1',
} as const;

export function generateSampleBookingData(): BookingData {
  const uniqueId = Math.floor(10000 + Math.random() * 90000);
  const today = new Date().toISOString().slice(0, 10);
  return {
    customer_code: `CUST-${uniqueId}`,
    booking_number: `BK-KL07-${uniqueId}`,
    enquiry_number: `ENQ-NT-${uniqueId}`,
    booking_date: today,
    tl_name: 'Suresh Kumar',
    gst_billing: 'no',
    registration_type: 'permanent',
    customer_name: 'Rahul Menon',
    communication_address: 'Flat 4B, Skyline Apts, Edappally, Kochi',
    contact_person: 'Rahul Menon',
    pin: '682024',
    model: 'Innova HyCross',
    suffix_1: 'ZX',
    suffix_2: '',
    colour_1: 'Blackish Ageha',
    colour_2: '',
    interior_colour: 'Dark Chestnut',
    special_request: 'Floor mats and mud flaps requested at delivery.',
    registration_same: 'yes',
    registration_name: 'Rahul Menon',
    registration_address: 'Flat 4B, Skyline Apts, Edappally, Kochi',
    registration_pin: '682024',
    registration_model: 'Innova HyCross',
    registration_suffix: 'ZX',
    registration_colour: 'Blackish Ageha',
  };
}
