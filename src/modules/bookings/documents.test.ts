import { describe, expect, it } from 'vitest';
import { inspectDocument, documentLimit } from './documents';
describe('document validation boundary',()=>{
 it('checks bytes, declared type, truncation and size',()=>{
  const pdf=Buffer.from('%PDF-1.4\nSynthetic test only\n%%EOF\n');
  expect(inspectDocument(pdf,'application/pdf')).toMatch(/^[a-f0-9]{64}$/);
  for(const [bytes,mime] of [[pdf,'image/jpeg'],[Buffer.from('<script>bad</script>'),'application/pdf'],[Buffer.from('%PDF-1.4'),'application/pdf'],[Buffer.alloc(0),'image/jpeg'],[Buffer.alloc(documentLimit+1),'application/pdf']] as const) expect(()=>inspectDocument(bytes,mime)).toThrow();
 });
});
