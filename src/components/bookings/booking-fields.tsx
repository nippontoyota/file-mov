'use client';
import { useState } from 'react';
import { SearchSelect } from '@/components/search-select';
import { bookingFields,bookingGroups,registrationCopies,type BookingData } from '@/modules/bookings/fields';
import { toyotaModels,modelColours,type BookingSuggestions } from '@/modules/bookings/options';
import styles from './booking.module.css';
export function BookingFields({data,editable,suggestions}:{data:BookingData;editable:boolean;suggestions:BookingSuggestions}) {
  const [values,setValues]=useState(data);
  const [same,setSame]=useState(data.registration_same==='yes');
  const effective={...values};
  if(same) for(const [target,source] of Object.entries(registrationCopies)) effective[target as keyof BookingData]=values[source] || '';
  function update(key:keyof BookingData,value:string) {setValues(previous=>({...previous,[key]:value}));}
  function choices(key:string) {
    if(key==='model' || key==='registration_model') return [...new Set([...toyotaModels,...(suggestions.model || [])])];
    if(key.includes('colour') && key!=='interior_colour') return [...new Set([...(modelColours[effective[key==='registration_colour'?'registration_model':'model'] || ''] || []),...(suggestions[key] || []),...(suggestions.colour_1 || []),...(suggestions.colour_2 || [])])];
    if(key.includes('suffix')) return [...new Set([...(suggestions.suffix_1 || []),...(suggestions.suffix_2 || []),...(suggestions.registration_suffix || [])])];
    return suggestions[key] || [];
  }
  return <>
    <input type="hidden" name="registration_same" value={same?'yes':'no'} />
    {bookingGroups.map(group=><section key={group} className={styles.section}>
      <h2>{group}</h2>
      {group==='File details' && <p>Customer ID identifies the customer across all branches. Order numbers can repeat between branches.</p>}
      {group==='Booking customer' && <p>The person making the booking. The registered owner can be someone else.</p>}
      {group==='Vehicle preferences' && <p>Search the suggestions or enter the value from the booking file.</p>}
      {group==='Registration details' && <>
        <label className={styles.confirm}><input type="checkbox" checked={same} onChange={event=>setSame(event.target.checked)} disabled={!editable} />Registration details are the same as booking details</label>
        <p>{same ? 'Uses the booking name, address, PIN, model, first suffix and first colour. Updates here follow the booking details above.' : 'Enter the registered owner’s details separately.'} BO verifies registration information later.</p>
      </>}
      <div className={styles.fields}>{bookingFields.filter(f=>f.group===group).map(field=>{
        const multiline='type' in field && field.type==='textarea';
        const readOnly=!editable || (group==='Registration details' && same);
        const options='options' in field ? [{value:'',label:'Not recorded'},...field.options.map(([value,label])=>({value,label}))] : choices(field.key).map(value=>({value,label:value}));
        const suggest=['model','suffix_1','suffix_2','colour_1','colour_2','interior_colour','tl_name','registration_model','registration_suffix','registration_colour'].includes(field.key);
        const value=effective[field.key] || '';
        return <label key={field.key} className={multiline?styles.wide:undefined}>{field.label}
          {!readOnly && ('options' in field || suggest) ? <SearchSelect name={field.key} label={field.label} options={options} allowCustom={!('options' in field)} value={value} onChange={v=>update(field.key,v)} />
            : multiline ? <textarea aria-label={field.label} name={field.key} value={value} onChange={event=>update(field.key,event.target.value)} maxLength={2000} rows={3} readOnly={readOnly} />
            : <input aria-label={field.label} name={field.key} value={'options' in field && readOnly ? field.options.find(([v])=>v===value)?.[1] || 'Not recorded' : value} onChange={event=>update(field.key,event.target.value)} type={'type' in field ? field.type:'text'} maxLength={200} readOnly={readOnly} autoComplete="off" />}
        </label>;
      })}</div>
    </section>)}
  </>;
}
