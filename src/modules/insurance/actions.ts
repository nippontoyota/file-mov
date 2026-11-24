'use server';
import { randomUUID, createHmac } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/modules/identity/actions';
import { requireStaff } from '@/modules/identity/session';
import { safeError, uuid, textField } from '@/lib/errors';
import { inspectDocument } from '@/modules/bookings/documents';

export async function recordInsurancePolicy(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  let revision = Number(form.get('revision'));

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before saving insurance details.' };
  }

  const company = textField(form, 'company_name', 100);
  const policyNumber = textField(form, 'policy_number', 100);
  const policyType = textField(form, 'policy_type', 50) || 'comprehensive_1_3';
  const rawIdv = Number(form.get('idv_amount'));
  const rawPremium = Number(form.get('premium_amount'));
  const startDate = textField(form, 'policy_start_date', 10) || new Date().toISOString().split('T')[0];
  const endDate = textField(form, 'policy_end_date', 10);
  const nomineeName = textField(form, 'nominee_name', 100);
  const nomineeRelation = textField(form, 'nominee_relation', 50);
  const nomineeAge = Number(form.get('nominee_age')) || null;
  const hypothecation = textField(form, 'hypothecation_bank', 150);

  const addOns = form.getAll('add_ons').map(a => String(a).trim()).filter(Boolean);

  if (!company) return { error: 'Select or enter the insurance company name.' };
  if (!policyNumber) return { error: 'Enter the issued insurance policy or cover note number.' };
  if (!Number.isFinite(rawIdv) || rawIdv <= 0) return { error: 'Enter a valid positive Insured Declared Value (IDV).' };
  if (!Number.isFinite(rawPremium) || rawPremium <= 0) return { error: 'Enter a valid positive gross premium amount.' };

  // Optional policy file upload
  let documentId: string | null = null;
  const policyFile = form.get('policy_file');
  if (policyFile instanceof File && policyFile.size > 0) {
    if (!['application/pdf', 'image/jpeg'].includes(policyFile.type)) {
      return { error: 'Insurance policy must be a PDF or JPEG document.' };
    }
    const secret = process.env.DOCUMENT_VERIFICATION_SECRET;
    if (!secret) return { error: 'Document verification service unconfigured.' };

    try {
      const bytes = new Uint8Array(await policyFile.arrayBuffer());
      const hash = inspectDocument(bytes, policyFile.type);
      const filename = policyFile.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 200) || 'insurance_policy';

      const reserveOp = randomUUID();
      const reserved = await client.rpc('reserve_booking_document', {
        p_operation: reserveOp,
        p_booking: id,
        p_revision: revision,
        p_kind: 'insurance_policy',
        p_filename: filename,
        p_mime: policyFile.type,
        p_size: bytes.length,
        p_sha256: hash,
      });

      if (reserved.error || !reserved.data) {
        return { error: safeError(reserved.error) };
      }

      documentId = reserved.data;
      const uploaded = await client.storage.from('booking-documents').upload(documentId, bytes, {
        contentType: policyFile.type,
        upsert: false,
      });

      if (uploaded.error && !['409', '400'].includes(String(uploaded.error.statusCode))) {
        return { error: 'Policy upload did not complete. Please retry.' };
      }

      const attestation = createHmac('sha256', secret).update(`${documentId}:${hash}`).digest('hex');
      const finalized = await client.rpc('finalize_booking_document', {
        p_document: documentId,
        p_revision: revision,
        p_attestation: attestation,
      });

      if (finalized.error) {
        return { error: safeError(finalized.error) };
      }
      revision++;
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Invalid policy document file. Choose a valid PDF or JPEG.' };
    }
  }

  const result = await client.rpc('record_insurance_policy', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
    p_company_name: company,
    p_policy_number: policyNumber,
    p_policy_type: policyType,
    p_idv: rawIdv,
    p_premium: rawPremium,
    p_start_date: startDate,
    p_end_date: endDate || undefined,
    p_nominee_name: nomineeName || undefined,
    p_nominee_relation: nomineeRelation || undefined,
    p_nominee_age: nomineeAge || undefined,
    p_hypothecation_bank: hypothecation || undefined,
    p_add_ons: addOns,
    p_document_id: documentId || undefined,
  });

  if (result.error) return { error: safeError(result.error) };

  revalidatePath('/bookings');
  revalidatePath('/insurance');
  redirect(`/bookings/${id}?toast=policy_issued`);
}

export async function fillDemoInsurancePolicy(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  let revision = Number(form.get('revision'));

  if (!uuid.test(id) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before running demo pre-fill.' };
  }

  // Attach a synthetic sample policy PDF
  let documentId: string | undefined = undefined;
  const secret = process.env.DOCUMENT_VERIFICATION_SECRET;
  if (secret) {
    try {
      const dummyPdf = Buffer.from(
        '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n'
      );
      const { createHash } = await import('node:crypto');
      const hash = createHash('sha256').update(dummyPdf).digest('hex');

      const reserveOp = randomUUID();
      const reserved = await client.rpc('reserve_booking_document', {
        p_operation: reserveOp,
        p_booking: id,
        p_revision: revision,
        p_kind: 'insurance_policy',
        p_filename: 'motor_insurance_policy_icici_lombard.pdf',
        p_mime: 'application/pdf',
        p_size: dummyPdf.length,
        p_sha256: hash,
      });

      if (reserved.data) {
        documentId = reserved.data;
        await client.storage.from('booking-documents').upload(documentId, dummyPdf, {
          contentType: 'application/pdf',
          upsert: true,
        });
        const attestation = createHmac('sha256', secret).update(`${documentId}:${hash}`).digest('hex');
        await client.rpc('finalize_booking_document', {
          p_document: documentId,
          p_revision: revision,
          p_attestation: attestation,
        });
        revision++;
      }
    } catch {
      // Continue even if attachment fails
    }
  }

  const policyNumber = `POL-ICICI-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const startDate = new Date().toISOString().split('T')[0];
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const endDate = nextYear.toISOString().split('T')[0];

  const result = await client.rpc('record_insurance_policy', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
    p_company_name: 'ICICI Lombard General Insurance',
    p_policy_number: policyNumber,
    p_policy_type: 'comprehensive_1_3',
    p_idv: 1850000,
    p_premium: 46250,
    p_start_date: startDate,
    p_end_date: endDate,
    p_nominee_name: 'Anitha S.',
    p_nominee_relation: 'Spouse',
    p_nominee_age: 38,
    p_hypothecation_bank: 'HDFC Bank Ltd (Auto Loan Division)',
    p_add_ons: ['zero_dep', 'engine_protect', 'return_to_invoice', 'rsa', 'consumables'],
    p_document_id: documentId,
  });

  if (result.error) return { error: safeError(result.error) };

  revalidatePath('/bookings');
  revalidatePath('/insurance');
  redirect(`/bookings/${id}?toast=policy_issued`);
}
