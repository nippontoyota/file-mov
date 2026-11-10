import { createHmac } from 'node:crypto';
import { userClient } from '@/lib/supabase/server';
import { safeError, uuid } from '@/lib/errors';
import { documentLimit, inspectDocument } from '@/modules/bookings/documents';
export const runtime='nodejs';
export async function POST(request:Request) {
  const configured=new URL(process.env.APP_ORIGIN || request.url);
  const allowed=new Set([configured.origin]);
  if(['localhost','127.0.0.1'].includes(configured.hostname)) { for(const host of ['localhost','127.0.0.1']) { const local=new URL(configured);local.hostname=host;allowed.add(local.origin); } }
  if(!allowed.has(request.headers.get('origin') || '')) return Response.json({error:'Request origin not allowed.'},{status:403});
  const client=await userClient();
  if(!(await client.auth.getUser()).data.user) return Response.json({error:'Sign in to upload documents.'},{status:401});
  const secret=process.env.DOCUMENT_VERIFICATION_SECRET;
  if(!secret) return Response.json({error:'Document verification is not configured.'},{status:503});
  try {
    // Bound the actual body, not just the caller-controlled Content-Length header.
    const reader=request.body?.getReader();
    if(!reader) throw new Error('Choose a document.');
    let size=0;const chunks:Uint8Array[]=[];
    while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>documentLimit+65536){await reader.cancel();return Response.json({error:'Choose a file up to 10 MB.'},{status:413});}chunks.push(chunk.value);}
    const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':request.headers.get('content-type') || ''}}).formData();
    const revision=Number(form.get('revision'));
    if(!Number.isSafeInteger(revision) || revision<1) throw new Error('Refresh this booking before uploading.');
    let id=String(form.get('document') || '');
    if(!id){
      const booking=String(form.get('booking'));const operation=String(form.get('operation'));const kind=String(form.get('kind'));
      const file=form.get('file');
      if(!uuid.test(booking) || !uuid.test(operation) || !['aadhaar','pan'].includes(kind) || !(file instanceof File)) throw new Error('Choose an Aadhaar or PAN document.');
      const bytes=new Uint8Array(await file.arrayBuffer());
      const hash=inspectDocument(bytes,file.type);
      const filename=file.name.replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,200) || 'document';
      const reserved=await client.rpc('reserve_booking_document',{p_operation:operation,p_booking:booking,p_revision:revision,p_kind:kind,p_filename:filename,p_mime:file.type,p_size:bytes.length,p_sha256:hash});
      if(reserved.error || !reserved.data) return Response.json({error:safeError(reserved.error)},{status:409});
      id=reserved.data;
      const uploaded=await client.storage.from('booking-documents').upload(id,bytes,{contentType:file.type,upsert:false});
      // A duplicate can be a retried upload; verify the immutable stored bytes below.
      if(uploaded.error && !['409','400'].includes(String(uploaded.error.statusCode))) return Response.json({error:'Upload did not complete. Retry with the same file.'},{status:409});
    }
    if(!uuid.test(id)) throw new Error('Invalid document.');
    const {data:d,error}=await client.from('booking_documents').select('*').eq('id',id).single();
    if(error || !d) return Response.json({error:'Document unavailable.'},{status:404});
    const stored=await client.storage.from('booking-documents').download(id);
    if(stored.error) return Response.json({error:'The file has not finished uploading. Choose the file and upload again.'},{status:409});
    const bytes=new Uint8Array(await stored.data.arrayBuffer());
    if(bytes.length!==d.byte_size || inspectDocument(bytes,d.mime_type)!==d.sha256) throw new Error('Stored file verification failed. Upload a new copy.');
    const result=await client.rpc('finalize_booking_document',{p_document:id,p_revision:revision,p_attestation:createHmac('sha256',secret).update(`${id}:${d.sha256}`).digest('hex')});
    if(result.error) return Response.json({error:safeError(result.error)},{status:409});
    return Response.json({ok:true});
  } catch(error) {
    const message=error instanceof Error && /^(Choose|Stored file|Refresh this|Invalid document)/.test(error.message) ? error.message : 'Upload could not be confirmed. Refresh the file and retry.';
    return Response.json({error:message},{status:400});
  }
}
