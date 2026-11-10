# Product requirements: Sales booking and fulfilment V1

Documentation baseline: 2026-11-10. Status: **implementation blueprint with explicit operational validation gates**. This is not a statement of production readiness.

Authority: the [source inventory](workflow.md) preserves the PDF; [decisions](decisions.md) records the user's approved interpretation and open questions. Engineering design lives in [architecture](architecture.md); milestones and test cases live in [implementation plan](implementation-plan.md). Agents start with [AGENTS.md](AGENTS.md).

## 1. Problem and intended result

Nippon Toyota's booking and fulfilment work crosses Sales, Back Office, Insurance, Accounts, Cashier, Accessories, and Security. Departments depend on a physical customer file and information in external systems. The PDF identifies repeated entry, manual amendments, signature dependencies, and difficulty locating pending work; it does not quantify their frequency or cost.

V1 gives staff a shared digital booking file, controlled departmental tasks, document and signature evidence, recorded approvals, and a traceable location for required originals. The primary pilot outcome is fewer avoidable physical file transfers. Visibility and processing time support that outcome but do not replace it as the primary measure (D-24).

Pilot one branch, with a data model and permissions that preserve branch separation for the eventual 13-branch rollout. The user and AI agents will maintain the application. Prefer a system that they can understand, test, release, and recover during operational changes.

## 2. Users, scope, and boundaries

Staff roles: SO, TL, SM, BO, Insurance, Accounts, Cashier, Accessories, Security, and explicitly authorized administrators. The user is the business decision owner and permitted-exception approver for the pilot. See workflow.md §5 for responsibilities and limits.

V1 starts at **confirmed booking / OBF preparation**, then covers the waiting period, allocation, TL/SM approvals, BO coordination, Insurance, invoice/FASTag/road-tax evidence, registration tracking, Accessories, bill verification, gate pass, delivery evidence, and final return/archive in Accounts.

The application supports online desktop and phone browsers. Departments work digitally where approved, while retaining required signed originals. The same user may have multiple roles only through explicit assignments; a role name alone does not grant access across branches.

### Included

- Shared booking/customer/vehicle details relevant to the workflow; manual external IDs and supporting records.
- Private document uploads and versions, departmental checklists, signature/original tracking.
- Approval, amendment, exception, and handoff history with named actors.
- Departmental inboxes, pending-work visibility, in-app notifications, and pilot measurements.
- Admin-controlled assignments and versioned checklists; code-reviewed routing changes.

### Outside V1 unless a later decision adds them

- Pre-booking CRM/enquiry management, customer portals, native mobile apps, and offline synchronization.
- Replacing or directly integrating with iCrop, CTDMS, Toyota Portal, Toyota Insurance Broker, VAHAN, Tally, or RTO systems; spreadsheet bulk imports.
- Generating official/internal business forms, issuing policies/invoices, executing tax payments, processing cash or refunds, or full accounting/inventory software. Staff record externally produced results and evidence.
- Electronic-signature substitution for required original signatures; OCR or AI document verification.
- A visual workflow designer, operational WhatsApp/SMS/email campaigns, microservices, or a general enterprise workflow platform.

Cancellation, refunds, inter-branch moves, duplicates, and reopening are **unresolved scenarios (Q-14)** rather than silently excluded business needs. Before the pilot, approve either their V1 behaviour or an accountable manual treatment.

## 3. Core user journeys

1. **SO prepares a booking:** create the digital record, associate external references, add documents, identify required originals and location, record available fee evidence, and monitor waiting work. Allocation details follow the approved SM process. Submit an identifiable revision for TL review.
2. **TL and SM review:** TL approves or returns with reasons. After TL approval, SM reviews the applicable revision. BO work becomes available after both approvals and confirmed prerequisites. Do not infer allocation timing or intimation-form signatories before Q-05 is resolved.
3. **BO coordinates fulfilment:** receive approved work; track pre-list, PDI/preparation, VAHAN, Form 20/disclaimer, and uploads. Send Insurance work and receive the policy before Accounts invoices. Track invoice, FASTag, tax, registration evidence, and required returns as separate actions.
4. **Accessories and Cashier prepare delivery:** receive preparation requirements, record availability and completed/pending items, payment evidence, bills, and required profit/loss signature. SO submits bills to BO; BO forwards to Accounts for verification/financial closure.
5. **Security and Accounts finish the file:** process the gate pass under approved release prerequisites, record actual delivery through the confirmed actor/evidence, and acknowledge the file/original return to Accounts with an archive location. These are distinct completion events.
6. **Staff handle change:** propose amendments without overwriting approved values; SM decides. Reassess affected work using an approved impact matrix. Request an eligible exception from the user when needed. Checklist/routing changes preserve historical booking versions.

## 4. Functional requirements and acceptance criteria

R identifiers are stable. T identifiers refer to scenarios in implementation-plan.md. Each requirement includes the minimum acceptance behaviour; business-specific fields and gates remain blocked by the cited Q identifiers until resolved.

| ID | Requirement | Acceptance criteria | Evidence / dependencies | Test |
|---|---|---|---|---|
| R-01 | Digital booking and allocation record | SO can create an assigned booking at confirmed booking, retain an external enquiry reference, attach the OBF, and track waiting work. Authorized staff record customer/vehicle/booking details and SM allocation. Customer ID is the global customer key (D-26); booking IDs remain separate, and order numbers may repeat across branches. Customer-ID search must retain existing scope restrictions. SO can explicitly reuse matching booking details for registration or enter a separate owner; BO verification remains a separate action. Do not fabricate values for absent information. | SRC-01/SRC-02/SRC-S01/SRC-S02/SRC-S04/SRC-09; D-13; Q-01/Q-05 | T-01 |
| R-02 | Scoped access | SO can access assigned bookings, TL their team, SM their branch; departments see approved relevant work and fields. Requests outside scope fail at the data/service boundary, including documents, search, counters, and exports. Technical admin does not imply business approval. | SRC-09/SRC-16/SRC-17; D-15/D-23; Q-03 | T-02 |
| R-03 | Documents, versions, and signatures | Authorized staff upload allowed files; replace them by creating versions; record verification/signature/original state; and retrieve permitted versions. A failed/pending upload does not satisfy a checklist. A scan or checked box does not erase a physical-signature requirement. | SRC-05/SRC-15/SRC-18; diagram document inventory; D-07/D-19; Q-01/Q-02/Q-13 | T-03 |
| R-04 | Departmental checklists | Staff see applicable items, missing evidence, signature status, and blocked prerequisites for their work. Checklists reference the booking's published revision. Inapplicable items need an approved applicability rule, not an unrestricted bypass. | SRC-19/SRC-B01–SRC-B05; D-11/D-12; Q-02/Q-06 | T-04 |
| R-05 | Sales verification and approval | Submit a revision; TL decides before SM. BO cannot receive approved work until both approvals and required gates hold. Return/rejection records a reason and an accountable next action. Stale approval submissions fail without changing history. | SRC-S03–SRC-S06/SRC-H01/SRC-H02/SRC-T01/SRC-T02; D-14; Q-05/Q-11 | T-05 |
| R-06 | Digital handoffs and physical custody | Show sender, recipient, task scope, sent/received times, and return reasons. Track physical originals/bundles and actual transfers separately. Sending digital work alone never changes the physical holder. Unacknowledged transfers remain visible. | SRC-H01–SRC-H11/SRC-T01–SRC-T07; D-07; Q-02/Q-03 | T-06 |
| R-07 | Amendments | Record proposer, reason, base revision, proposed changes, and SM decision. Pending/rejected changes leave approved values intact. Approval applies changes once and records/reassesses affected tasks under the approved matrix. Preserve original external evidence and prior approvals as history. | SRC-05/SRC-19; D-20; Q-11 | T-07 |
| R-08 | BO preparation | BO receives approved bookings and records pre-list, PDI/preparation, accessory requirements, VAHAN entry, Form 20, disclaimer signatures, and required uploads. Missing dependencies show their owner and reason. | SRC-B01–SRC-B05/SRC-14; Q-02/Q-06 | T-08 |
| R-09 | Insurance processing | Track the ten diagram steps, including customer/bank checks and cross-checking, policy number/file, retained-copy requirement, and return to BO. Represent Tally follow-up once owner/evidence are confirmed. BO must obtain the policy before invoice processing. | SRC-I01–SRC-I11/SRC-T03; D-16; Q-02/Q-07 | T-09 |
| R-10 | Accounts invoice and tax work | Record receipt, verification of finalized booking/customer/vehicle details, external invoice evidence, road-tax payment evidence, relevant attachments, and returns to BO. These actions do not execute external financial transactions. | SRC-A01–SRC-A06/SRC-H05–SRC-H07/SRC-T04; D-06/D-16/D-19; Q-08 | T-10 |
| R-11 | FASTag processing and handover | Accounts records issuance details; Cashier records the approved collection/handover action. Do not mark handover complete just because issuance finished. | SRC-A04/SRC-C01/SRC-H09; D-17; Q-08 | T-11 |
| R-12 | Registration tracking | Track external road-tax and registration evidence and outstanding signatures/documents. The diagram's registration step follows road tax. Do not label a booking registered merely because someone completed VAHAN data entry. | SRC-B03/SRC-B06/SRC-H08/SRC-14; Q-02/Q-06/Q-08 | T-12 |
| R-13 | Accessory preparation | Record requested work, stock availability, completed and remaining items, Cashier collection evidence, bills, profit/loss evidence, and required signature before delivery. Partial fulfilment remains visible and owned; delivery/closure conditions follow Q-09. | SRC-X00–SRC-X06/SRC-T05; Q-02/Q-09 | T-13 |
| R-14 | Accessory bills and financial closure | Preserve SO → BO → Accounts submission/receipt/verification. Accounts records closure against bill evidence, with discrepancy return reasons and unresolved accessory work handled by the approved policy. | SRC-X07–SRC-X09/SRC-T06; Q-09/Q-10 | T-14 |
| R-15 | Gate pass, delivery, and archive | Track Accounts → Security → Accounts, gate-pass evidence, actual delivery evidence, final receipt, and archive location as separate events. Completion cannot hide required pending work or a missing file return. | SRC-X10/SRC-A07/SRC-T07; Q-09/Q-10/Q-13 | T-15 |
| R-16 | Work visibility and notifications | Authorized staff can find relevant bookings, see pending tasks/documents, blocked reasons, next responsible role/person, time waiting, and original location. Handoffs/returns create in-app notifications. Read/unread state does not determine whether work exists. | SRC-11/SRC-12/SRC-19; A-03/A-04 | T-16 |
| R-17 | Controlled pilot exceptions | Only the user's explicitly assigned authority can grant an eligible exception. Record the gate, booking/task/revision, reason, evidence, decision, scope, and applicable expiry/revocation. Denied requests do not bypass the gate; unclassified gates remain non-overridable. | D-12/D-23; Q-12 | T-17 |
| R-18 | Versioned trial configuration | Admin can draft/publish checklists and change permitted assignments. New bookings use the selected published revision. Existing bookings keep their versions unless an approved migration records exact changes and effects. Routing changes go through reviewed releases. | D-11; A-02/A-11 | T-18 |
| R-19 | Attributable history | Record relevant state changes, approvals, document versions/access actions, amendments, exceptions, assignment/configuration changes, and custody events with actor/time/reference. Routine application users cannot rewrite or delete history. Corrections add events. | SRC-19/SRC-16; A-06/A-12; Q-13 | T-19 |
| R-20 | External-system boundary | Record references and evidence for existing-system actions. UI labels state that staff completed external work; no invented data synchronization, automatic issuance, or regulatory certification. Preserve Toyota Insurance Broker and Tally steps even without integrations. | SRC-07/SRC-13/SRC-I02–SRC-I04/SRC-I11; D-06/D-19 | T-20 |
| R-21 | Pilot measurement | Record actual physical-transfer events and their purpose; compare completed-booking cohorts against a documented baseline. Show sample size, period, missing observations, pending work, and required-original movements separately. | SRC-04/SRC-11/SRC-23; D-24; Q-15 | T-21 |
| R-22 | Reliable updates and recovery | Reject stale writes, avoid duplicate transitions on retry, and retain business state plus history atomically. Show failed uploads/updates clearly. Demonstrate database and document restoration and outage reconciliation before live use. | SRC-16/SRC-17; Q-04/Q-13/Q-16 | T-22 |
| R-23 | Staff administration | Authorized admin creates individual accounts with preset email and a six-character initial password (CHG-02), assigns explicit scopes/roles, manages branch teams, and deactivates access without removing attribution. No public registration, shared staff identity, or client-editable privilege assignment. | D-22/D-23/CHG-02; Q-03/Q-17 | T-23 |
| R-24 | Desktop and phone usability | Staff can inspect work, upload from phone/file picker, review evidence, submit decisions, and understand failures on supported desktop/mobile browsers. Provide keyboard access, labelled inputs, and status meaning beyond colour. | D-05/SRC-17; browser set and performance thresholds Q-16 | T-24 |

## 5. Access and data principles

Authorization combines identity, active membership, branch/team/assignment, department capability, and document/field sensitivity. Test both visibility and actions. A hidden button is not an access control. Restrict bank details, profit/loss information, and documents to the roles confirmed under Q-03; avoid placing those fields in generally readable booking summaries.

An approval refers to a known booking revision and evidence version. External actions and physical signatures stay attributable to their actual performer/signatory. A staff member uploading a signed form is not automatically the signer or approver.

Required, pending, uploaded, verified, signed, physically held, submitted externally, and externally accepted are different facts. The final field/status vocabulary follows approved checklists; do not collapse these into a generic completed flag.

Store only the customer data needed for confirmed workflow requirements. Use approved retention and access rules for documents, exports, audit records, backups, and originals. No retention period, statutory gate, or document requirement is established by guesswork.

## 6. Quality and operational acceptance

- **Integrity:** permissions, prerequisite checks, revision checks, state changes, and history must agree after success or failure. Repeated requests cannot create duplicate approvals or tasks.
- **Privacy:** private files and server/data authorization; production secrets and customer content excluded from source, previews, error payloads, and AI prompts. Access failures must not reveal another customer's metadata.
- **Resilience:** restore database records and file objects together; rehearse manual fallback and reconciliation. Agree recovery objectives under Q-16 rather than promising untested uptime or recovery times.
- **Maintainability:** one documented migration path, pinned dependencies at scaffolding, clear module ownership, and repeatable checks. Checklist changes preserve historical meaning.
- **Usability:** show the action, prerequisites, evidence, owner, and failure reason in staff language. Keep provider/database/implementation terminology out of operational screens.
- **Capacity:** measure against the agreed pilot workload, then reassess for 13 branches. No concurrency or response-time claim until Q-16 provides a test target.

## 7. Pilot outcomes and acceptance

The user confirms the branch, cohort, period, and numerical target under Q-15. Observe the current process before switching it. Record paper movement outside the application during outages and reconcile it so the measurement does not undercount transfers.

| Measure | Definition / use |
|---|---|
| Avoidable transfers per completed booking | Number of observed physical transfers classified as avoidable, divided by comparable completed bookings. Count all departments through final Accounts return. |
| Reduction against baseline | `(baseline mean - pilot mean) / baseline mean × 100`, only when baseline is nonzero and cohorts are comparable; otherwise report absolute difference and explain. |
| Required-original transfers | Report separately so genuine signature/original dependencies are not treated as failures or hidden to improve the metric. |
| Digital completion coverage | Count relevant departmental actions completed with acceptable digital evidence. A document upload alone does not prove a physical handoff stopped. |
| Supporting signals | Stage waiting times, unacknowledged transfers, pending accessory work, exceptions, amendment rework, missing evidence, and staff feedback. No automatic SLA/escalation policy without a decision. |

Go live only after the relevant blockers are resolved, critical scenarios pass, staff can use the workflow, backup/restore and fallback are rehearsed, and the user records readiness. Expand after the pilot review demonstrates the agreed reduction without losing required evidence, approval accountability, or operational continuity.

## 8. Release boundary

CHG-01 authorizes staged local implementation. M1 implements the staff-access foundation and a responsive shell using synthetic data. M2 now persists the SO-owned printed header and Booking Details as drafts under CHG-05. Registered-owner entry, documents, approvals and fulfilment remain unimplemented pending their named inputs. D-25 keeps the booking customer and registered owner separate, and workflow.md records the confirmed section owners. The presence of a requirement here does not claim that the software implements it. Implementation status and executed evidence live in implementation-plan.md. Unresolved questions have named dependencies in decisions.md; resolve each before claiming its feature complete.
