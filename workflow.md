# Workflow and source inventory

Documentation baseline: 2026-11-10. Read [decisions](decisions.md) for authority and unresolved questions, [PRD](prd.md) for requirements, and [implementation plan](implementation-plan.md) for tests.

## 1. Source and interpretation

Primary source: [Sales Booking & Fulfilment Workflow Digitization.pdf](Sales%20Booking%20%26%20Fulfilment%20Workflow%20Digitization.pdf), **Version 1.0, 6 November 2026**, 10 pages.

SHA-256: `1d06f58bee296467e9d9e4fb339ce5e4f05febfe62bb63fbf6440ea8f07c2ebc`.

Page numbers below refer to physical PDF pages. Page 5 contains a raster workflow diagram; text extraction alone omits it. The inventory below paraphrases its content and preserves its numbered steps and annotations. It does not replace the PDF or claim to be a verbatim transcript. Consult the original when reading a label or interpreting an arrow matters.

**Source fact** means the PDF describes the current process or an opportunity. It does not mean that a proposed digital control already exists. **Confirmed target behaviour** comes from a decision in decisions.md. **Open** points identify rules that require the user's confirmation before implementation.

### Supporting customer-file reconstruction — 2026-11-10

The user supplied [file.pdf](file.pdf), a four-page photographed customer file, and explicitly requested a clean blank reconstruction. Its SHA-256 is `9782659ec5ac58ee4304806528c3ced3d436b64f0ba7f003ef6047faf2141602`; preserve the filled original locally.

The review artifact is [file-blank-fillable.pdf](file-blank-fillable.pdf), rebuilt from printed content with [generate_file_blank.py](generate_file_blank.py). It preserves page order, printed sections/formulas, all 16 registration-document checklist items, and blank signature/seal spaces. It contains no source photographs or handwritten entries. Field names follow `pN.section.entry`; selections start blank, and amounts are manually entered.

This standalone reconstruction is authorized by the user's form request. It does not change D-19's application boundary, assign departments/stages, establish mandatory fields, or resolve Q-01/Q-02. Those interpretations remain subject to review. Rebuild and validate locally with `python3 generate_file_blank.py --check`; synthetic validation copies are temporary by default.

### M2 evidence review: booking customer and registered owner

The user confirmed that the booking customer and registered owner may differ (D-25 / CHG-03). The blank reconstructed file's page 1 supports this separation: **Booking details** has its own customer name, communication address and contact person; **Registration** has a separate customer name, permanent/temporary addresses and registration-specific contact fields. The blank form also shows model/suffix/colour choices, external booking/enquiry identifiers, finance, insurance and allotment sections. Their presence does not establish which are mandatory at SO submission.

Page 4 labels the intimation form as **Intimation of changes in booking**, with old/new name, address, model and colour and Sales Executive/TL/SM signature spaces. Page 5 of the primary workflow mentions a signed intimation form but does not explain its applicability to unchanged bookings. Q-02/Q-05 still govern its applicability and gates; neither all bookings nor all registration-document checklist items are presumed mandatory before TL review. Filled customer values were not used in this implementation review.

## 2. Context, evidence, objectives, and constraints

| Source ID | Page / section | Source content | V1 disposition / trace |
|---|---|---|---|
| SRC-01 | p. 1, §1.1 | Nippon Toyota operates across 13 branches in Kerala; sales runs from enquiry and booking through allocation, documentation, insurance, invoice, registration, and delivery. | R-01, R-02, R-08–R-15; D-02 pilots one branch while retaining branch boundaries. |
| SRC-02 | p. 1, §1.1 | SO records enquiries in iCrop, linked to CTDMS; physical files include OBF and supporting documents. | R-01, R-03, R-20; D-13 leaves pre-booking enquiry management external. |
| SRC-03 | p. 1, §1.1 | After allocation, TL/SM verify and approve; BO coordinates Insurance and Accounts. | R-05, R-08–R-10; D-14; allocation timing Q-05. |
| SRC-04 | pp. 1–2, §1.2 | Physical departmental transfers and repeated customer/vehicle data entry create repeated work and potential delays. | R-03, R-06, R-16, R-20, R-21; no unmeasured savings claim. |
| SRC-05 | p. 2, §1.2 | Waiting-period changes need manual updates and approvals; some registration documents need customer/bank signatures. | R-07, R-03, R-04; Q-02/Q-11. |
| SRC-06 | p. 2, §1.3 | Five objectives: document end-to-end process; understand responsibilities/documents/approvals; identify repetition/manual delays; evaluate digitization/centralization/tracking; assess feasibility under constraints. | This inventory, R-01–R-24, pilot baseline and M0 validation. These are discovery objectives, not proof of quantified problems. |
| SRC-07 | pp. 2–3, §1.3 | Study covers enquiry to delivery without assuming replacement of Toyota systems; consider dependencies, approvals, and departmental practice. | R-20; D-06/D-13/D-19 identify narrower application boundaries. |
| SRC-08 | p. 3, §2.1 | Discovery used employee discussions, physical OBF/files, and consideration of iCrop, CTDMS, Toyota Portal; some areas need verification. | Preserve evidence provenance and unresolved questions; no claim that the source is a final software specification. |
| SRC-09 | pp. 3–4, §2.2 | SO: enquiries/bookings/OBF/documents; Cashier: booking fees/payment records; TL: verification/approval; SM: allocation/amendment approval; BO: documentation/insurance/invoice/registration; Insurance: verification/policy; Accounts: invoicing/FASTag/road tax. | R-01, R-02, R-05, R-07–R-12; actor matrix below. |
| SRC-10 | p. 4, §2.3 | Evidence includes Sales/BO/Insurance discussions, physical OBF/file review, handoff observation, system usage information, and employee registration-process details. | Context only. Request redacted samples and validation under Q-01/Q-02; no interview transcripts supplied. |
| SRC-11 | pp. 6–7, §4.1 | Five pain points: physical movement, repeated information handling, manual amendments, signature dependencies, limited shared visibility. | R-03, R-06, R-07, R-16, R-21. |
| SRC-12 | p. 7, §4.2 | Root dependencies: shared physical file, multiple records/systems, manual approval documentation, document/signature/coordination delays, no shared progress view. | R-01, R-04–R-07, R-16, R-20. Measure rather than assume their relative severity. |
| SRC-13 | p. 7, §5 | iCrop, CTDMS, Toyota Portal are externally managed; database/API access may be limited. | R-20; D-06 excludes direct integrations. |
| SRC-14 | pp. 7–8, §5 | Follow VAHAN procedures, document formats, and RTO requirements. | R-08, R-12; Q-02/Q-06. This project does not define or certify statutory requirements. |
| SRC-15 | p. 8, §5 | Customer/bank/other signatures may require physical documentation. | R-03, R-04, R-06; D-07/Q-02. |
| SRC-16 | p. 8, §5 | Customer documents contain sensitive information; control access and store securely. | R-02, R-03, R-19, R-22, R-23; Q-03/Q-04/Q-13/Q-17. |
| SRC-17 | p. 8, §5 | Preserve departmental responsibilities and approvals; support adoption across all 13 branches; avoid disruption to current sales/registration. | R-02, R-05–R-18, R-22, R-24; phased rollout and manual fallback. |
| SRC-18 | p. 8, §6.1 items 1–2 | Centralize relevant customer/booking/vehicle information and store supporting records digitally. | R-01, R-03. |
| SRC-19 | p. 9, §6.1 items 3–6 | Track booking amendments with approval history; show stage/pending work; digitize handoffs/task notifications; use departmental document/signature/completion checklists. | R-04, R-06, R-07, R-16, R-19. |
| SRC-20 | p. 9, §6.2 | Process standardization: low effort and common procedures but limited reduction in paperwork/manual coordination. | Alternative considered; D-01/D-07 select a digital workflow. Keep common checklists as part of V1. |
| SRC-21 | p. 9, §6.2 | Partial digitization: selected storage/amendment/status improvements but remaining physical/manual handoffs. | Alternative considered; staged implementation does not redefine the full V1 scope as tracking only. |
| SRC-22 | p. 9, §6.2 | Centralized workflow: shared information, documents, approvals, visibility; higher maintenance/adoption/dependency effort. | Chosen direction D-01/D-07/D-10; architecture and pilot address these tradeoffs. |
| SRC-23 | p. 10, §7 | Recommend phased improvements alongside existing systems; validate opportunities and finalize implementation plan. | M0–M6 in implementation-plan.md; departmental evidence and user decisions remain required. |

## 3. Page-5 diagram inventory

### 3.1 Sales, leadership, and BO boxes

| Source ID | Diagram detail | Digital interpretation / trace |
|---|---|---|
| SRC-S01 | SO enters enquiry in iCrop, mapped to CTDMS. | R-20: record external references; do not reproduce enquiry management. |
| SRC-S02 | OBF completed; physical file prepared and held during waiting period. | R-01/R-03/R-06: booking record, OBF upload, waiting work, retained-original location. |
| SRC-S03 | TL/SM box: file verified. | R-05: TL then SM review under D-14. |
| SRC-S04 | TL/SM box: vehicle allotted. | R-01/R-05: record SM allocation and evidence; timing Q-05. |
| SRC-S05 | Intimation form signed. | R-03/R-04/R-05: document and signature evidence; signatory Q-02/Q-05. |
| SRC-S06 | Customer ledger filled. | R-03/R-05: record ledger completion/reference; no new accounting ledger engine. Owner/content Q-05. |
| SRC-B01 | BO: pre-list. | R-08: checklist/action; definition and fields Q-06. |
| SRC-B02 | BO: PDI and accessories. | R-08/R-13: preparation tasks/evidence; PDI contents and responsible actor Q-06. |
| SRC-B03 | BO: VAHAN entry. | R-08/R-12/R-20: external action, status, reference/evidence; no direct VAHAN integration. |
| SRC-B04 | BO: Form 20 and disclaimer signed. | R-03/R-04/R-08: track each document and required signature separately. |
| SRC-B05 | BO: documents uploaded. | R-03/R-08: internal uploads plus evidence of required external uploads; destination requirements Q-06. |
| SRC-B06 | RTO box: registration. | R-12: record external registration progress and proof; no RTO user role inferred. |
| SRC-C01 | Cash Counter box: FASTag. | R-11: Cashier collection/handover under D-17, separate from Accounts processing. |

### 3.2 Insurance, including its ten numbered steps

| Source ID | Diagram detail | Digital interpretation / trace |
|---|---|---|
| SRC-I01 | 1. Receives physical file from BO. | R-06/R-09: digital task receipt; record original transfer only if required. |
| SRC-I02 | 2. Enters chassis number in Toyota Insurance Broker. | R-09/R-20: staff perform external entry; record reference/evidence. |
| SRC-I03 | 3. Vehicle details fetched automatically. | External broker behaviour, not an integration promise for this application; R-20. |
| SRC-I04 | 4. Manually enters customer details. | External broker action; R-09/R-20. Make authorized booking details available to avoid asking other departments again. |
| SRC-I05 | 5. Verifies customer and bank details. | R-09/R-02: explicit verification action with restricted access to relevant data. |
| SRC-I06 | 6. Cross-checks entered information. | R-09: separate verification evidence, not just a policy upload. |
| SRC-I07 | 7. Issues insurance policy and obtains policy number. | R-09: external issuance, policy reference, status, evidence. |
| SRC-I08 | 8. Records policy number in physical file. | R-09: record digitally; continued physical notation depends on Q-02. |
| SRC-I09 | 9. Prints policy and retains a copy. | R-03/R-09: retain policy file/version; validate any continuing print-copy requirement under Q-02. |
| SRC-I10 | 10. Returns file to BO. | R-06/R-09: return/acknowledgment and custody event if originals moved. |
| SRC-I11 | Insurance box: insurance processed; Tally entry follows. | R-09/R-20: track an external Tally action once owner/timing/evidence are confirmed under Q-07. |

### 3.3 Accounts, including its seven numbered steps

| Source ID | Diagram detail | Digital interpretation / trace |
|---|---|---|
| SRC-A01 | 1. Receives physical customer file from BO. | R-06/R-10: digital receipt and any required original transfer. |
| SRC-A02 | 2. Verifies customer, vehicle, and booking details. | R-10: verification against the approved booking revision. |
| SRC-A03 | 3. Processes vehicle invoice using finalized details. | R-10/R-20: invoice remains external; capture its reference and document. Insurance precedes invoicing under D-16. |
| SRC-A04 | 4. Processes FASTag issuance and records relevant details. | R-10/R-11: Accounts issuance evidence and Cashier handover task are distinct. |
| SRC-A05 | 5. Processes road-tax payment through the applicable registration process. | R-10/R-12: record external payment status and evidence; do not collect/pay tax in this application. |
| SRC-A06 | 6. Attaches or records invoice, FASTag, and road-tax payment details. | R-03/R-10/R-11/R-12: retain all three evidence categories. |
| SRC-A07 | 7. Receives file from Security and stores it. | R-06/R-15: final acknowledgment and archive location; do not close at gate-pass issue alone. |

The Accounts box repeats invoice, FASTag, and road tax as its three responsibilities; all three remain separate tracked actions.

### 3.4 Accessories, including its ten numbered steps

| Source ID | Diagram detail | Digital interpretation / trace |
|---|---|---|
| SRC-X00 | Annotation above Accessories: just before delivery. | R-13/R-15: preserve delivery proximity; exact entry gate Q-09/Q-10. |
| SRC-X01 | 1. Receives vehicle details / preparation requirements from BO. | R-06/R-13: assigned preparation task with authorized details. |
| SRC-X02 | 2. Checks accessory availability and stock. | R-13: record availability per requested item; no warehouse stock-management system implied. |
| SRC-X03 | 3. If only partial stock is available, completes available work and leaves remaining work pending. | R-13: keep pending quantities/items, ownership, and follow-up visible. Q-09 determines delivery/closure policy. |
| SRC-X04 | 4. Collects applicable accessory amount through Cashier. | R-13: payment evidence and Cashier responsibility; no payment gateway or replacement cash ledger. |
| SRC-X05 | 5. Prepares accessory bills and retains copies in physical customer file. | R-03/R-13/R-14: upload bills; physical copies follow Q-02. |
| SRC-X06 | 6. Before delivery, records profit/loss details and obtains required signature. | R-13: restricted record/evidence and signature; calculation, approver, and fields Q-09. |
| SRC-X07 | 7. SO collects bills and submits file to BO. | R-06/R-14: explicit SO submission and BO receipt, not direct SO financial closure. |
| SRC-X08 | 8. BO forwards file to Accounts. | R-06/R-14: Accounts bill-review task follows BO forwarding. |
| SRC-X09 | 9. Accounts verifies bills and completes closure process. | R-14: financial closure is distinct from delivery and final archive; conditions Q-09/Q-10. |
| SRC-X10 | 10. File goes to Security for gate pass, then returns to Accounts. | R-06/R-15: Security action, return, and Accounts archive acknowledgment. |

### 3.5 Numbered arrows and graphical annotations

These labels record the drawing. Numbering alone is not a complete dependency specification.

| Source ID | Drawing label / direction | Disposition |
|---|---|---|
| SRC-H01 | 1 Physical file: SO → TL/SM. | R-05/R-06, digital approval submission plus separate original custody. |
| SRC-H02 | 2 After approvals: TL/SM → BO. | R-05/R-08, both approvals required under D-14. |
| SRC-H03 | 3: BO → Insurance. | R-06/R-09, assign Insurance work. |
| SRC-H04 | 4: Insurance → BO. | R-06/R-09, policy return and receipt. |
| SRC-H05 | 5 Invoice, FASTag: BO → Accounts. | R-10/R-11, preserve both actions. |
| SRC-H06 | 6: red return arrow from Accounts toward BO. | R-06/R-10, Accounts return; exact returned evidence and stage Q-08. |
| SRC-H07 | 7 Road tax: BO → Accounts. | R-10/R-12, road-tax work separate from invoicing. |
| SRC-H08 | 8 After road tax: BO → RTO registration. | R-12, road-tax completion before this registration step. Detailed evidence Q-06/Q-08. |
| SRC-H09 | 9 FASTag: dashed route from BO area to Cash Counter. | R-11, Cashier task; dashed styling does not prove optionality. Q-08 defines timing. |
| SRC-H10 | 10 Forwarded: BO → Accessories. | R-13, preserve the just-before-delivery annotation. |
| SRC-H11 | Red SO annotation/return curve from Accessories toward Accounts. | R-14; follow explicit SRC-X07/SRC-X08 and page-6 SO → BO → Accounts routing. Preserve ambiguity under Q-09. |

## 4. Page-6 handoff summary

| Source ID | Source handoff and purpose | Target trace |
|---|---|---|
| SRC-T01 | SO → TL → SM: verification and approval. | R-05, D-14. |
| SRC-T02 | TL → BO: completed booking file transfer. | R-05/R-08; both approvals remain required. Actual sender Q-05. |
| SRC-T03 | BO → Insurance → BO: insurance and policy documentation. | R-06/R-09. |
| SRC-T04 | BO → Accounts → BO: invoice, FASTag, road tax. | R-06/R-10/R-11/R-12. |
| SRC-T05 | BO → Accessories → SO: preparation/accessory coordination. | R-06/R-13/R-14. |
| SRC-T06 | SO → BO → Accounts: accessory bill submission/verification. | R-06/R-14. |
| SRC-T07 | Accounts → Security → Accounts: gate pass and file return. | R-06/R-15. |

## 5. Target actors and access boundaries

| Actor | V1 work | Visibility boundary / unresolved detail |
|---|---|---|
| SO | Create assigned bookings, provide documents, propose changes, coordinate customer signatures, submit accessory bills. | Assigned bookings (D-15); fields and post-approval edits Q-01/Q-11. |
| TL | Review team bookings and approve or return with reasons. | Team visibility, followed by SM approval. Delegation Q-03. |
| SM | Record allocation, approve after TL, approve amendments. | Branch visibility. SM has no automatic pilot exception authority. |
| BO | Receive approved work; coordinate preparation, documents, Insurance, Accounts, registration, and Accessories. | Relevant authorized branch work. Exact fields and centralized BO arrangements Q-03. |
| Insurance | Perform external broker/policy work, verification, and return evidence. | Relevant assigned/department work; bank/customer details only where required. |
| Accounts | Invoice, FASTag, road-tax tracking, accessory-bill verification, financial closure, and final archive. | Relevant financial work; sensitive data and exports Q-03/Q-13. |
| Cashier / Cash Counter | Booking-fee records, accessory payment evidence, FASTag collection/handover. | Use one business role unless Q-03 establishes separate staff/permissions. |
| Accessories | Preparation requirements, availability, completed/pending work, bills, profit/loss evidence and signature. | Relevant vehicles/tasks; no blanket customer-document access. |
| Security | Gate-pass action and original/file return. | Minimum release/task data; no general financial/customer-file access. Exact fields Q-10. |
| Business owner (user) | Resolve rule conflicts and authorize permitted pilot exceptions. | Map to a verified individual account; visibility and grants must be explicit. |
| Technical/configuration admin | Staff/role setup, checklist drafts/publication, permitted assignments, system support. | Administration does not itself confer approval rights or universal document access. |
| Customer, bank, RTO | External participants providing signatures, evidence, or registration actions. | No customer/bank/RTO portal or login included in V1. |

## 6. Proposed stage and dependency model

The following stages are operational groupings, not a frozen database enum. Departmental task state and original custody remain independent of these labels (A-03). The confirmed dependencies below must hold; unanswered gates cannot be invented to complete a diagram.

| Stage | Entry / activity | Exit and remaining validation |
|---|---|---|
| Booking / waiting | Confirmed booking, SO assignment, OBF/supporting records, external references, fee evidence, original location. | Ready for TL after approved checklist conditions. Allocation timing Q-05; waiting duration is not an SLA assumption. |
| TL review | SO submits a booking revision; TL checks and records a decision. | Approval permits SM review. Returned work carries a reason and remains visible to SO. |
| SM review | Valid TL approval on the applicable revision. | SM approval permits BO receipt. Capture allocation/intimation/ledger prerequisites once Q-05 is resolved. |
| BO preparation | BO acknowledges approved booking and required materials. | Track pre-list, PDI, preparation, VAHAN, Form 20, disclaimer, and uploads. Internal sequencing Q-06. |
| Insurance | BO sends Insurance work; Insurance performs and records SRC-I01–SRC-I11. | Policy returns to BO before invoicing (D-16). Tally owner/gating Q-07. |
| Accounts / registration | Accounts verifies finalized details; records invoice, FASTag issuance, tax evidence, and returns work as required. | Road tax precedes the depicted RTO step. Cashier FASTag handover tracked separately. Other dependencies Q-08. |
| Delivery preparation | BO sends requirements to Accessories just before delivery; available work completed, remainder tracked. | Bills, collection evidence, profit/loss and signature. Whether remaining items block delivery/closure requires Q-09. |
| Bills / financial closure | SO → BO → Accounts; Accounts verifies bills. | Closure evidence and unresolved-item policy Q-09/Q-10. |
| Gate pass / delivery / archive | Accounts routes to Security; Security processes gate pass and returns file; Accounts receives/stores it. | Gate pass does not prove actual delivery. Confirm delivery evidence, final completion, and archive prerequisites under Q-10. |

### Handoffs and originals

A digital handoff records booking revision, work/document scope, sender, receiving department/person, sent time, receipt time, and any return reason. An unacknowledged handoff remains pending. Define queue claiming and absence coverage under Q-03.

Track physical originals by document or identified bundle, with holder/location and transfer history. Record original transfers only when they occur; a digital send must not move the recorded physical custodian. A returned digital task must not fabricate a physical return. Physical transfers should show the sender, receiver, time, receipt, and required-original versus avoidable purpose for pilot measurement.

### Amendments, exceptions, and version changes

An amendment contains proposed old/new values, reason, proposer, base booking revision, and SM decision. Pending/rejected amendments leave approved data unchanged. On approval, apply the change and identify affected verifications/tasks in the same controlled operation. Do not automatically erase or silently preserve a now-stale approval: Q-11 must define revalidation by field and stage.

An exception request identifies one permitted prerequisite, the booking/task/revision it applies to, supporting evidence, and reason. The user grants or rejects it under D-23. No unknown or non-overridable gate can be bypassed. The ordinary route remains available when an exception is rejected. Scope, duration, and revocation require Q-12.

Admins draft new checklist revisions and publish them for new bookings. Existing bookings keep their referenced workflow/checklist versions. An explicit migration must enumerate affected bookings and revalidation effects; retain prior versions and migration history. Assignment changes take effect as audited authorization/work ownership changes without rewriting prior actors.

## 7. Document and external-action register

This is the minimum source-derived inventory, not the final mandatory-field checklist. Q-01/Q-02 supply redacted samples and applicability. Do not add document types such as particular identity proofs solely from industry assumptions.

| Record / evidence | Source and operational owner | V1 treatment / open detail |
|---|---|---|
| Enquiry and booking references | SRC-02/SRC-S01; SO | Manual iCrop/CTDMS references. Formats/uniqueness Q-01. |
| OBF and customer supporting documents | SRC-S02; SO/TL | Upload/version, required fields and signatures Q-01/Q-02. |
| Booking fee and payment records | SRC-09; Cashier | External receipt/reference/evidence; no payment collection engine. |
| Allocation details | SRC-S04; SM | Vehicle allocation record and evidence, exact fields/timing Q-01/Q-05. |
| Intimation form | SRC-S05; TL/SM box | Signed document; signatory and owner Q-05. |
| Customer ledger | SRC-S06; TL/SM box | Completion/reference/document; ownership Q-05. |
| Pre-list and PDI | SRC-B01/SRC-B02; BO coordination | Checklist and evidence, meaning/content/performer Q-06. |
| Preparation/accessory requirements | SRC-B02/SRC-X01; BO → Accessories | Requested items/work and later completion/pending evidence. |
| VAHAN entry and required uploads | SRC-B03/SRC-B05; BO | External action record and internal evidence; no automatic submission. |
| Form 20 and disclaimer | SRC-B04; BO coordination | Separate documents/signature status and original location. |
| Customer/bank signature evidence | SRC-05/SRC-15; responsible department | Physical dependency tracking; scope/applicability Q-02. |
| Insurance verification and policy | SRC-I02–SRC-I09; Insurance | Broker reference, policy number/file/version and verification; paper copy rules Q-02. |
| Tally entry | SRC-I11; owner open | External status/reference, owner and completion gate Q-07. |
| Vehicle invoice | SRC-A03/SRC-A06; Accounts | External invoice document/reference tied to booking revision. |
| FASTag issuance and handover | SRC-A04/SRC-C01; Accounts/Cashier | Separate processing and collection/handover evidence; Q-08. |
| Road-tax payment | SRC-A05/SRC-A06; Accounts | External payment evidence/reference, prerequisites Q-08. |
| RTO registration | SRC-B06/SRC-H08; BO coordination | External registration status/evidence; no assertion of statutory validity. |
| Accessory availability, work and payment | SRC-X02–SRC-X04; Accessories/Cashier | Availability per item, remaining work, payment evidence. |
| Accessory bills | SRC-X05/SRC-X07–SRC-X09; Accessories → SO → BO → Accounts | Uploaded copies and submission/verification history. |
| Profit/loss and required signature | SRC-X06; Accessories, signatory open | Restricted evidence/values; calculation and approver Q-09. |
| Gate pass and delivery evidence | SRC-X10; Security, delivery actor open | Track gate-pass processing; actual delivery confirmation defined by Q-10. |
| Accounts archive receipt/location | SRC-A07; Accounts | Final acknowledgment, original/bundle storage location, retention Q-13. |

## 8. Evidence rules for future implementation

- Reference a source ID and requirement ID in each milestone task and test scenario.
- A source record describing an external action means staff perform it externally and record evidence; it does not authorize integration or reimplementation.
- Preserve both the current-state step and its approved digital replacement. Record why a printout or physical handoff can cease instead of deleting the original step.
- Unknown checklist items, signatories, or completion predicates remain open. A fake checkbox or generic “complete” button is not a resolution.
- Test the numbered steps and returns, not just the major departmental boxes. See T-01–T-24 in the implementation plan.

## 9. Implementation coverage note (CHG-01)

M1 provides the local identity, scope, audit and private-storage foundation for SRC-16/SRC-17. It does not implement the page-5 departmental steps or change their interpretation. The source inventory remains the baseline for later milestones. Staff role fixtures and invitation defaults are synthetic engineering choices pending Q-03/Q-17. Executed checks and remaining gates appear in implementation-plan.md.


M1 follow-up CHG-02 replaces persistent synthetic branches/accounts with a public Kerala location catalog and an explicit local setup administrator. Individual staff can be created with administrator-set credentials and scoped teams. This changes onboarding only; none of the departmental workflow steps above are enabled or reinterpreted. Public location provenance and account/recovery boundaries are recorded in architecture.md and decisions.md.


## 10. Customer-file section ownership (CHG-05)

The workflow PDF supplies the handoff responsibilities; the blank reconstructed customer file supplies the printed sections. The following ownership decisions were confirmed by the user on 2026-11-10. An entry owner is not automatically a required signer or approval authority. The first SO section is implemented as a draft; later sections below are the agreed implementation split.

| Form section | Entry / responsibility | Review or handoff boundary |
|---|---|---|
| Page 1 header and Booking Details | SO | TL then SM review remains required before BO; current editor saves drafts only. |
| Registration customer information | SO supplies information | BO verifies registration; registered owner may differ from booking customer (D-25). |
| Finance source / hypothecation | SO enters | BO verifies. |
| Insurance preferences, nominee and insurance work | Insurance | SO supplies relevant customer information; policy returns to BO before invoicing. |
| Delivery / delivery-in-charge | SO is delivery-in-charge | Actual-delivery proof and release gates remain Q-10; planned date/time is not proof of delivery. |
| Allotment | SM | Timing relative to review remains the unresolved allocation part of Q-05. |
| Customer ledger, prices and posting payment references | Accounts | Cashier retains the workflow's collection/payment-record duties; ledger entries do not execute payments. |
| Provisional approval / discount note | SM | Printed signature spaces do not establish a complete digital approval/signature gate. |
| Finance commission/subvention calculation | BO | Includes source/company and calculation consolidation, distinct from SO-entered hypothecation facts. |
| Insurance calculation | Insurance | Supplies its figures for BO consolidation. |
| TKM support and department incentives | BO | User explicitly confirmed this calculation ownership. |
| Invoice references (TDMS / Tally boxes) | Accounts invoicing responsibility from source | Insurance's separate Tally follow-up actor/timing remains Q-07. |
| Accessory sales / margin / bills | Accessories | Cashier collects; SO submits bills to BO, then Accounts verifies/handles closure. |
| Interest calculation and final net | BO | Consolidates figures from the owning departments. |
| Intimation of booking changes | SO proposal; TL review and SM decision are the proposed form split | D-20 confirms SM applies approved amendments; field impacts, signature gates and detailed TL amendment participation remain Q-11/Q-02. |
| Registration-document checklist | BO | Applicability, mandatory uploads and signatures remain Q-02/Q-06. |
| Delivery remarks | Accessories, SO and SM for their respective work | SO is delivery-in-charge; Security records its own check. |
| Security checking | Security | Accounts → Security → Accounts; gate pass, actual delivery and archive remain separate events. |

**Confirmed Sales handoff:** SO prepares → TL approves → SM approves → TL sends directly to BO. Digital receipt and actual physical-original custody are tracked separately in the intended design. BO coordinates Insurance, Accounts/registration and Accessories. Insurance returns its policy before invoicing; accessory bills follow SO → BO → Accounts; the final physical-file path is Accounts → Security → Accounts/archive. Only the SO draft editor is currently operational, not those handoffs.

The personal cheque/DD responsibility statement has printed SO/TL and SM signature spaces, but its entry owner and evidence/signature gate are still to be confirmed. No signature or finance-risk acceptance is inferred from typing a name.
