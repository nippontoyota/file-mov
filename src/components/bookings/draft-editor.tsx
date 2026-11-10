import { randomUUID } from 'node:crypto';
import { ActionForm } from '@/components/action-form';
import { Icon } from '@/components/workspace/icon';
import { saveBooking } from '@/modules/bookings/actions';
import { bookingFields, bookingGroups, type BookingData } from '@/modules/bookings/fields';
import styles from './booking.module.css';

type Scope = { id: string; label: string };
export function DraftEditor({ data = {}, id, revision, scopes, soName, editable = true }: {
  data?: BookingData; id?: string; revision?: number; scopes: Scope[]; soName: string; editable?: boolean;
}) {
  const fields = <>
    <div className={styles.scope}>
      <label>Sales Officer<input value={soName} readOnly /></label>
      <label>Branch and team{editable ? <select name="membership" aria-label="Branch and team" required defaultValue={scopes[0]?.id}>{scopes.map(scope => <option key={scope.id} value={scope.id}>{scope.label}</option>)}</select> : <input value={scopes[0]?.label || 'Assigned Sales team'} readOnly />}</label>
    </div>
    {bookingGroups.map(group => <section key={group} className={styles.section}>
      <h2>{group}</h2>
      {group==='Booking customer' && <p>This is the person making the booking. The registered owner is recorded separately.</p>}
      <div className={styles.fields}>{bookingFields.filter(f => f.group===group).map(field => {
        const multiline = 'type' in field && field.type==='textarea';
        return <label key={field.key} className={multiline ? styles.wide : undefined}>{field.label}
          {'options' in field ? <select name={field.key} aria-label={field.label} defaultValue={data[field.key] || ''} disabled={!editable}><option value="">Not recorded</option>{field.options.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
            : multiline ? <textarea aria-label={field.label} name={field.key} defaultValue={data[field.key] || ''} maxLength={2000} rows={3} readOnly={!editable} />
            : <input aria-label={field.label} name={field.key} defaultValue={data[field.key] || ''} type={'type' in field ? field.type : 'text'} maxLength={200} readOnly={!editable} autoComplete="off" />}
        </label>;
      })}</div>
    </section>)}
    <div className={styles.note}><Icon name="shield" /><span>Saving this section does not sign the file or approve it. SO and TL signatures are recorded separately from typed names.</span></div>
    {editable && <label className={styles.confirm}><input type="checkbox" name="confirmed" value="yes" required defaultChecked={Boolean(id)} />This file is for an existing confirmed booking.</label>}
  </>;
  return <div className={styles.editor}>{editable ? <ActionForm action={saveBooking} label={id ? 'Save changes' : 'Save draft'}>
    <input type="hidden" name="operation" value={randomUUID()} />
    {id && <><input type="hidden" name="booking" value={id} /><input type="hidden" name="revision" value={revision} /></>}
    {fields}
  </ActionForm> : fields}</div>;
}
