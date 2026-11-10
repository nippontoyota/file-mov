import { randomUUID } from 'node:crypto';
import { ActionForm } from '@/components/action-form';
import { Icon } from '@/components/workspace/icon';
import { saveBooking } from '@/modules/bookings/actions';
import { type BookingData } from '@/modules/bookings/fields';
import { BookingFields } from './booking-fields';
import { SearchSelect } from '@/components/search-select';
import type { BookingSuggestions } from '@/modules/bookings/options';
import styles from './booking.module.css';

type Scope = { id: string; label: string };
export function DraftEditor({ data = {}, id, revision, scopes, soName, editable = true, suggestions = {} }: {
  data?: BookingData; id?: string; revision?: number; scopes: Scope[]; soName: string; editable?: boolean; suggestions?: BookingSuggestions;
}) {
  const fields = <>
    <div className={styles.scope}>
      <label>Sales Officer<input value={soName} readOnly /></label>
      <label>Branch and team{editable ? <SearchSelect name="membership" label="Branch and team" required defaultValue={scopes[0]?.id} options={scopes.map(scope=>({value:scope.id,label:scope.label}))} /> : <input value={scopes[0]?.label || 'Assigned Sales team'} readOnly />}</label>
    </div>
    <BookingFields data={data} editable={editable} suggestions={suggestions} />
    <div className={styles.note}><Icon name="shield" /><span>Saving this section does not sign the file or approve it. SO and TL signatures are recorded separately from typed names.</span></div>
  </>;
  return <div className={styles.editor}>{editable ? <ActionForm action={saveBooking} label={id ? 'Save changes' : 'Save draft'}>
    <input type="hidden" name="operation" value={randomUUID()} />
    {id && <><input type="hidden" name="booking" value={id} /><input type="hidden" name="revision" value={revision} /></>}
    {fields}
  </ActionForm> : fields}</div>;
}
