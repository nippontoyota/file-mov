import { createHash } from 'node:crypto';
export const documentLimit = 10 * 1024 * 1024;
export function inspectDocument(bytes: Uint8Array, mime: string) {
  const b=Buffer.from(bytes);
  if(!b.length || b.length>documentLimit) throw new Error('Choose a file up to 10 MB.');
  const pdf=mime==='application/pdf' && b.subarray(0,5).toString()==='%PDF-' && b.subarray(-1024).includes(Buffer.from('%%EOF'));
  const jpeg=mime==='image/jpeg' && b[0]===255 && b[1]===216 && b[2]===255 && b[b.length-2]===255 && b[b.length-1]===217;
  if(!pdf && !jpeg) throw new Error('Choose a PDF or JPEG file. The file contents must match its type.');
  return createHash('sha256').update(b).digest('hex');
}
export const requiredBookingFields = {
  customer_code:'Customer ID', booking_number:'Booking number', booking_date:'Booking date',
  enquiry_number:'Enquiry reference', customer_name:'Customer name', communication_address:'Customer address',
  contact_person:'Contact person', pin:'PIN', model:'Model', suffix_1:'First suffix', colour_1:'First colour',
};
