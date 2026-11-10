import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

test('SO uploads registered-owner documents and TL receives the same frozen file',async({page,browser})=>{
 const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false}});
 const auth=await client.auth.signInWithPassword({email:'so2@example.test',password:'Local-demo-only-2026!'});expect(auth.error).toBeNull();
 const data={customer_code:`UP-${randomUUID()}`,customer_name:'Synthetic booking customer',booking_number:'UPLOAD-TEST',booking_date:'2026-11-10',enquiry_number:'SYN-ENQ',communication_address:'Synthetic address',contact_person:'Synthetic contact',pin:'682001',model:'Innova HyCross',suffix_1:'Synthetic suffix',colour_1:'White',registration_same:'no',registration_name:'Synthetic registered owner',registration_address:'Synthetic owner address',registration_pin:'682002'};
 const created=await client.rpc('save_booking_draft',{p_operation:randomUUID(),p_membership:'d4000000-0000-0000-0000-000000000002',p_data:data,p_confirmed:true});expect(created.error).toBeNull();
 await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill('so2@example.test');await page.getByLabel('Password',{exact:true}).fill('Local-demo-only-2026!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/workspace/);
 await page.goto(`/bookings/${created.data}`);
 await page.getByRole('button',{name:'Send to TL',exact:true}).click();await expect(page.locator('form').getByRole('alert')).toContainText('attach both');
 const aadhaar=page.locator('section').filter({has:page.getByRole('heading',{name:'Aadhaar card Required',exact:true})}).last();
 const bad=await page.request.post('/api/booking-documents',{headers:{origin:'http://127.0.0.1:3000'},multipart:{booking:created.data,revision:'1',operation:randomUUID(),kind:'aadhaar',file:{name:'fake.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a PDF')}}});expect(bad.status()).toBe(400);
 const cross=await page.request.post('/api/booking-documents',{headers:{origin:'https://untrusted.example'},multipart:{}});expect(cross.status()).toBe(403);
 const pdf=Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
 await aadhaar.locator('input[type=file]').setInputFiles({name:'synthetic-registered-owner-aadhaar.pdf',mimeType:'application/pdf',buffer:pdf});await aadhaar.getByRole('button',{name:'Upload Aadhaar',exact:true}).click();
 await expect(page.getByText('Draft · v2',{exact:true})).toBeVisible();
 const pan=page.locator('section').filter({has:page.getByRole('heading',{name:'PAN card Required',exact:true})}).last();
 const jpeg=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdAB//2Q==','base64');
 await pan.locator('input[type=file]').setInputFiles({name:'synthetic-registered-owner-pan.jpg',mimeType:'image/jpeg',buffer:jpeg});await pan.getByRole('button',{name:'Upload PAN',exact:true}).click();await expect(page.getByText('Draft · v3',{exact:true})).toBeVisible();
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:850});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(width===320 || width===1440) await page.screenshot({path:test.info().outputPath(`documents-${width}.png`),fullPage:true});}
 const docs=await client.from('booking_documents').select('id,kind,status').eq('booking_id',created.data);expect(docs.error).toBeNull();expect(docs.data?.every(d=>d.status==='ready')).toBe(true);
 const doc=docs.data!.find(d=>d.kind==='aadhaar')!;
 const download=await page.request.get(`/api/booking-documents/${doc.id}`);expect(download.ok()).toBe(true);expect(await download.body()).toEqual(pdf);expect(download.headers()['content-disposition']).toContain('attachment;');expect(download.headers()['cache-control']).toContain('no-store');
 await page.getByRole('button',{name:'Send to TL',exact:true}).click();await expect(page.getByText('With TL · v4',{exact:true})).toBeVisible();await expect(page.getByText('Awaiting TL receipt.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Save changes',exact:true})).toHaveCount(0);await expect(page.locator('input[type=file]')).toHaveCount(0);
 const context=await browser.newContext();try{
  const tl=await context.newPage();await tl.goto('http://127.0.0.1:3000/login');await tl.getByLabel('Email',{exact:true}).fill('tl3@example.test');await tl.getByLabel('Password',{exact:true}).fill('Local-demo-only-2026!');await tl.getByRole('button',{name:'Sign in',exact:true}).click();await expect(tl).toHaveURL(/workspace/);await tl.goto(`http://127.0.0.1:3000/bookings/${created.data}`);
  await expect(tl.getByLabel('Registered owner name',{exact:true})).toHaveValue('Synthetic registered owner');await expect(tl.getByRole('link',{name:'Download',exact:true})).toHaveCount(2);
  const same=await tl.request.get(`/api/booking-documents/${doc.id}`);expect(await same.body()).toEqual(pdf);
  await tl.getByRole('button',{name:'Acknowledge file receipt',exact:true}).click();await expect(tl.getByText(/TL receipt recorded by Demo TL 3 on/)).toBeVisible();await expect(tl.getByText('With TL · v4',{exact:true})).toBeVisible();
 }finally{await context.close();}
 const anon=await browser.newContext();try{expect((await anon.request.get(`http://127.0.0.1:3000/api/booking-documents/${doc.id}`)).status()).toBe(401);}finally{await anon.close();}
});
