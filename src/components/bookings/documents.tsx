'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Database } from '@/lib/database.types';
import styles from './booking.module.css';
type Document=Database['public']['Tables']['booking_documents']['Row'];
export function BookingDocuments({booking,revision,documents,editable,owner}:{booking:string;revision:number;documents:Document[];editable:boolean;owner:{name:string;address:string;pin:string}}){
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [success,setSuccess]=useState('');
 const operations=useRef<Record<string,string>>({});
 async function upload(form:FormData,key:string){
  setBusy(true);setError('');setSuccess('');
  form.set('booking',booking);form.set('revision',String(revision));
  operations.current[key] ||= crypto.randomUUID();form.set('operation',operations.current[key]);
  try {const response=await fetch('/api/booking-documents',{method:'POST',body:form});const result=await response.json();
   if(!response.ok) {setError(result.error || 'Upload failed. Please retry.');return;}
   delete operations.current[key];setSuccess('Document attached to the booking file.');router.refresh();
  }catch{setError('Connection interrupted. Refresh to check the upload, then retry if needed.');}finally{setBusy(false);}
 }
 function matches(d:Document){const s=d.owner_snapshot as typeof owner;return s.name===owner.name && s.address===owner.address && s.pin===owner.pin;}
 return <section id="documents" className={styles.documents}><h2>Registered-owner documents</h2><p>Attach the registered owner’s Aadhaar and PAN copies. Both are required before sending to TL. PDF or JPEG, up to 10 MB each.</p>
 {editable && <p className={styles.note}>Save any booking or registration changes before uploading. Registered owner: {owner.name || 'not entered yet'}.</p>}
 <div className={styles.documentGrid}>{(['aadhaar','pan'] as const).map(kind=>{
  const versions=documents.filter(d=>d.kind===kind);const current=versions.find(d=>d.status==='ready');const valid=current && matches(current);
  return <section key={kind} className={styles.documentCard}><h3>{kind==='aadhaar'?'Aadhaar card':'PAN card'} <span className={styles.status}>{valid?'Attached':'Required'}</span></h3>
   {current && <p>{valid?'Saved for this registered owner.':'Registered-owner details changed. Attach a new copy.'}</p>}
   {editable && <form onSubmit={e=>{e.preventDefault();void upload(new FormData(e.currentTarget),kind);}}><fieldset disabled={busy || !owner.name}><input type="hidden" name="kind" value={kind}/><label>{current?'Upload a new version':'Choose document'}<input name="file" type="file" accept="application/pdf,image/jpeg,.pdf,.jpg,.jpeg" required onChange={()=>{delete operations.current[kind];}}/></label><button type="submit">{busy?'Please wait…':`Upload ${kind==='aadhaar'?'Aadhaar':'PAN'}`}</button></fieldset></form>}
   <ul>{versions.map(d=><li key={d.id}><div><strong>{d.filename}</strong><small>Version {d.version} · {d.status==='ready'?'Attached':'Upload incomplete'}</small></div>{d.status==='ready'?<a href={`/api/booking-documents/${d.id}`}>Download</a>:editable?<button type="button" disabled={busy} onClick={()=>{const f=new FormData();f.set('document',d.id);void upload(f,d.id);}}>Finish upload</button>:null}</li>)}</ul>
  </section>;
 })}</div>{error && <p role="alert">{error}</p>}{success && <p role="status">{success}</p>}
 <p className={styles.note}>Document versions stay with this file. Uploading a copy does not record verification, a signature or receipt of the physical original.</p></section>;
}
