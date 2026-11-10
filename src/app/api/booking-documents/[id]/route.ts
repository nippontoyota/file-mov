import { userClient } from '@/lib/supabase/server';
import { uuid } from '@/lib/errors';
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}) {
 const {id}=await params;
 if(!uuid.test(id)) return new Response('Not found',{status:404});
 const client=await userClient();
 if(!(await client.auth.getUser()).data.user) return new Response('Sign in required',{status:401});
 const {data:d,error}=await client.from('booking_documents').select('filename,mime_type,status').eq('id',id).single();
 if(error || !d || d.status!=='ready') return new Response('Not found',{status:404});
 const file=await client.storage.from('booking-documents').download(id);
 if(file.error) return new Response('Document unavailable',{status:404});
 const audit=await client.rpc('record_document_download',{p_document:id});
 if(audit.error) return new Response('Document unavailable',{status:403});
 return new Response(file.data,{headers:{'Content-Type':d.mime_type,'Content-Disposition':`attachment; filename="document.${d.mime_type==='application/pdf'?'pdf':'jpg'}"; filename*=UTF-8''${encodeURIComponent(d.filename).replace(/['()*]/g,c=>`%${c.charCodeAt(0).toString(16)}`)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});
}
