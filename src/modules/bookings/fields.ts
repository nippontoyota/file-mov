import type { Json } from '@/lib/database.types';

// Printed header + Booking Details on page 1 of the blank customer file.
// Requiredness and duplicate rules are not inferred from the presence of a box.
export const bookingFields = [
  { key: 'customer_code', label: 'Customer code', group: 'File details' },
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
] as const;
export type BookingData = Partial<Record<(typeof bookingFields)[number]['key'], string>>;
export function bookingData(data: Json): BookingData {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  return Object.fromEntries(bookingFields.map(f => [f.key, typeof data[f.key] === 'string' ? data[f.key] : '']));
}
export const bookingGroups = ['File details', 'Booking customer', 'Vehicle preferences'] as const;
