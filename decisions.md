# Decisions and open questions

Documentation baseline: 2026-11-10. Product: Nippon Toyota sales booking and fulfilment, V1.

This register separates the user's decisions from engineering defaults and missing operational facts. It records the planning conversation; it does not claim that departments have validated every detail or that hosting has company approval.

Read with [PRD](prd.md), [workflow and source inventory](workflow.md), [architecture](architecture.md), and [implementation plan](implementation-plan.md).

## 1. Authority and status

- **Confirmed:** the user selected this direction during planning.
- **Default:** an implementation choice in the approved documentation plan or a conservative engineering assumption. Change it with a recorded rationale; seek the user's decision if business behaviour changes.
- **Open:** information or a decision is missing. The listed dependency stays blocked; unrelated work can continue.
- **Superseded:** keep the old entry and link its replacement. Do not erase how a rule changed.

The PDF is the preserved source baseline. An explicit user decision overrides only the identified part of that baseline. A general request to implement a milestone does not resolve an unrelated open business question. When the PDF, current practice, and an approved rule disagree, present the conflict and its effect to the user. The user makes the final business decision (D-21).

## 2. Confirmed decisions

All entries below were confirmed by the user on 2026-11-10.

| ID | Decision | Consequence and boundary |
|---|---|---|
| D-01 | Plan the full workflow and build it in stages. | Full scope includes Accessories, Security, and Accounts archive. Early milestones alone are not a complete live pilot. |
| D-02 | Trial at one branch first. | Include branch separation from the foundation; expand to the other branches after pilot review. Pilot branch identity remains open. |
| D-03 | The user and AI agents will build and maintain the product. | Prefer a small stack, explicit instructions, reproducible setup, and recovery procedures. |
| D-04 | Hosting constraints are not confirmed. | Treat deployment provider and data location as provisional. Company approval is required before live customer data enters a hosted environment. |
| D-05 | Support online desktop and phone browsers. | Responsive web application, including phone uploads. Internet is required for updates; offline synchronization is outside V1. |
| D-06 | Use manual external references first. | Staff continue work in iCrop, CTDMS, Toyota Portal, and other existing systems. No direct integration or spreadsheet import is promised in V1. |
| D-07 | Departments work digitally and retain required originals. | Replace approved routine physical handoffs with digital work. Track signatures and physical custody separately; do not assume a scan removes the original requirement. |
| D-08 | The user's technical starting point is JavaScript/TypeScript. | Use TypeScript and explain deployment and database operations in the runbooks. No particular prior framework expertise was stated. |
| D-09 | The monthly budget is not set. | Show pilot and operational costs, storage limits, backups, and extra usage before selecting paid services. No purchase is authorized by this register. |
| D-10 | Use Next.js, TypeScript, and Supabase as the architecture direction. | Supabase supplies PostgreSQL, authentication, and private file storage. Production hosting remains subject to D-04. |
| D-11 | Admins can edit checklists and assignments; routing changes go through code. | Build bounded administration, not a visual workflow designer. Version changes and review their effect on existing work. |
| D-12 | Enforce gates with authorized exceptions. | Define eligible gates and record exception scope, approver, and reason. This is not blanket permission to bypass requirements. |
| D-13 | Create the application record at confirmed booking. | SO records the booking when the OBF is prepared, with the external enquiry reference. Pre-booking enquiry management remains outside V1. |
| D-14 | TL approves first, then SM; both are required before BO. | Resolves the combined TL/SM box and TL-to-BO handoff ambiguity in the PDF. Sender/receipt details still need validation. |
| D-15 | SO sees assigned bookings, TL sees their team, SM sees their branch. | Departments receive relevant work. Cross-branch and sensitive-field access need an explicit role matrix. |
| D-16 | Insurance precedes invoicing. | BO obtains the policy before invoice processing. Do not infer the timing of all other tasks from this single dependency. |
| D-17 | Accounts owns FASTag processing; Cashier handles collection or handover. | Preserves both Accounts and Cash Counter in the diagram. Exact evidence for collection versus handover remains to be confirmed. |
| D-18 | The immediate planning deliverable is documents only. **Delivery-only scope superseded by CHG-01.** | Historical planning boundary retained. The later implementation request authorizes local synthetic development; hosting and business prerequisites remain open. |
| D-19 | Store and track documents first. | Capture booking details, uploads, versions, and signature status. Existing processes produce official forms, invoices, and policies; no form generator in V1. |
| D-20 | Propose an amendment, obtain SM approval, then apply it. | Approved values remain active while a change is pending. Retain old/new values and reassess affected downstream tasks. Field-specific impact rules remain open. |
| D-21 | The user resolves conflicts and confirms final business rules. | Departmental feedback is evidence, not automatic permission to change a requirement. |
| D-22 | Use individual staff email accounts. Original invitation-only onboarding is superseded for the admin-created account flow by CHG-02. | Email/password login, no public registration or shared department accounts. Confirm actual roster and recovery setup before the pilot. |
| D-23 | The user authorizes permitted pilot exceptions. | Map this authority to the user's verified account. A technical admin or SM does not inherit it. |
| D-24 | Reduced paper movement is the primary pilot result. | Measure physical transfers per booking, separating avoidable transfers from required-original movements. Agree targets after measuring a baseline. |
| D-25 | The booking customer and registered owner can be different people. | Keep distinct booking and registration identities; a same-person convenience must not overwrite a separately entered registered owner. Confirmed during M2 on 2026-11-10. |

## 3. Engineering defaults

These are implementation defaults, not statements found in the PDF.

| ID | Default | Reason / reconsider when |
|---|---|---|
| A-01 | One Next.js application with internal domain modules and one PostgreSQL database. | Keeps releases and troubleshooting manageable. Split services only for a demonstrated operational need. |
| A-02 | Pin workflow version and checklist revision to each booking. | Later edits must not rewrite prior approvals or requirements. Existing bookings change only through an explicit migration with impact review. |
| A-03 | Separate overall progress, departmental tasks, and physical-original custody. | A single status cannot explain outstanding documents, accessory work, and original location. |
| A-04 | Provide an in-app work inbox and handoff notifications first. | Required coordination works without another messaging provider. Email for account invitations/recovery remains necessary; operational SMS, WhatsApp, and email alerts are outside the initial build. |
| A-05 | Record offered and acknowledged handoffs. | A task sent to a department is not proof that a person received an original. Exact team assignment and substitute rules need Q-03/Q-11. |
| A-06 | Keep business history append-only through application permissions. | Corrections add new events; they do not replace recorded approvals. Approved retention rules may later require a controlled deletion process. |
| A-07 | Use synthetic data in development, tests, and deployment previews. | Prevent production documents and identifiers entering demos, logs, or AI context. |
| A-08 | Use UTC timestamps in storage and Asia/Kolkata for operational display. | Supports consistent event ordering and local reporting. Record business dates separately when a source document uses a date without time. |
| A-09 | Use TypeScript strict checks, SQL migrations, generated database types, and the Supabase SDK; no additional ORM initially. | One database migration source and fewer overlapping abstractions. See architecture for transaction and authorization boundaries. |
| A-10 | Use Vitest for domain checks and Playwright for critical browser journeys, plus database permission/integration checks. | Tests should prove workflow and security behaviour, not mirror implementation details. Exact compatible package versions are chosen and locked at scaffolding. |
| A-11 | Gate publication of operational configuration; drafts do not affect active work. | Makes checklist changes reviewable and reversible. Publishing new configuration does not migrate old bookings. |
| A-12 | No destructive booking/document removal from routine operational screens. | Keep corrections and document replacement traceable. Retention and authorized deletion require Q-13. |

## 4. Open questions and blocking dependencies

The user is the final decision-maker for all business questions. Suggested evidence providers below do not confer approval authority. Resolve items as the relevant milestone approaches; do not hold unrelated work for a question that affects only later stages.

| ID | Source / ambiguity | Decision or evidence needed | Suggested evidence provider | Blocks |
|---|---|---|---|---|
| Q-01 | PDF pp. 1, 3–5 names the OBF and customer/vehicle details but gives no field inventory. | Redacted OBF and supporting-form samples; required fields, types, validation, external IDs, duplicate matching, and booking-number convention. Confirm whether a booking can contain more than one vehicle or buyer. | SO, TL, user | Final booking schema, form validation, duplicate handling; M2. |
| Q-02 | PDF pp. 2, 5, 8 names documents and signatures without a complete applicability matrix. | Department-wise document checklist, conditional requirements, signature owners, original retention, upload formats/size, verification evidence, and gates. Confirm bank/finance-specific conditions. | BO and department representatives | Checklist publication, document gates, replacing physical handoffs; M2–M4 and live release. |
| Q-03 | D-15 defines Sales visibility but not all permissions. | Branch/team roster; permitted fields/documents/actions for each department; branch-wide or centralized departments; multi-role staff; delegation; absence coverage; reassignment and transfers. | User, SM, department leads | Complete authorization matrix and pilot accounts; M1 onward. |
| Q-04 | D-04 and D-09 leave hosting and costs open. | Approved providers/accounts, data location, allowed subprocessors, recurring budget, billing owner, document storage growth. | Company IT/management, user | Production infrastructure and any hosted live customer data; local synthetic development can proceed. |
| Q-05 | PDF page 5 groups verification, allocation, intimation form, and ledger; page 1 suggests allocation before approval. | Allocation timing relative to TL submission/approval, allocation proof, who signs the intimation form and fills the ledger, and who initiates BO handoff after SM approval. | SO, TL, SM | Detailed Sales transition predicates; M2. D-14 itself is settled. |
| Q-06 | PDF page 5 names BO pre-list, PDI, accessories, VAHAN, Form 20, and disclaimer. | Meaning and required contents of pre-list/PDI, internal preparation dependencies, VAHAN evidence, signatories, applicability, and exact RTO registration completion evidence. | BO | BO gate matrix and registration tasks; M3. |
| Q-07 | PDF page 5 Insurance box says Tally entry follows. | Who makes the Tally entry, when, and what reference/evidence closes it? Confirm policy verification fields and file/policy copy requirements. | Insurance, Accounts, BO | Insurance completion criteria; M3. Do not assume the application posts to Tally. |
| Q-08 | PDF page 5 arrows 5–9 and D-17. | Invoice/road-tax dependencies, Accounts-to-BO returns, FASTag collection/handover meaning and receipts, and conditional order of Cashier versus RTO work. | Accounts, Cashier, BO | Accounts/FASTag/registration routing; M3. Insurance before invoicing is settled. |
| Q-09 | PDF page 5 Accessories steps 3, 6, 9, 10. | Profit/loss calculation or external evidence, signatories and visibility; partial-stock follow-up; whether unresolved accessory work can coexist with delivery, financial closure, or archive. | Accessories, Accounts, SO, user | Accessory gates and permitted completion states; M4. Partial work must remain visible regardless of the answer. |
| Q-10 | PDF page 5 gate pass and final return do not define delivery confirmation. | Delivery evidence, gate-pass prerequisites/issuer, Security access, person recording actual delivery, archive acceptance, and distinction between invoice, financial closure, delivery, and archive. | Security, Accounts, BO, SO | Final gate and archive workflow; M4. |
| Q-11 | D-20 gives an approval pattern, not field-specific effects. | Fields editable before/after approval; amendment-sensitive documents/tasks; revalidation and notification rules; post-invoice/post-registration corrections; rejection and resubmission rules. | User with affected departments | Amendment implementation beyond draft capture; M2/M3. |
| Q-12 | D-12/D-23 permit specific exceptions only. | Eligible gates, non-overridable requirements, evidence, duration/scope, revocation, and mapping of the user's authority to a verified staff account. | User with process owners | Exception grants; M2 onward. An unclassified gate cannot be overridden. |
| Q-13 | PDF page 8 requires secure customer-data handling. | Approved retention/deletion periods, original archive location, legal holds if applicable, backup retention, export access, and audit access. | Company policy owner, user | Production retention and destruction behaviour; M5. No legal periods inferred. |
| Q-14 | PDF does not describe cancellation, refund, duplicate merges, reopened files, or inter-branch moves. | Which cases must V1 support and what controlled manual fallback is acceptable for the others? | User, Sales, Accounts | Those features and pilot readiness; M5 must record an approved treatment, not silently drop them. |
| Q-15 | D-02/D-24 select a pilot but no baseline or target. | Pilot branch, staff, booking cohort, duration, baseline observation, reduction target, review cadence, and stop/expand criteria. | User, pilot branch lead | Pilot measurement and go-live decision; M5. |
| Q-16 | Usage and recovery tolerance are unknown. | Users/concurrency, bookings/month, documents/booking, typical and maximum sizes, retention growth, acceptable data loss (RPO), recovery time (RTO), and performance thresholds. | User, branch lead, IT | Capacity/cost estimates and recovery acceptance; M5. Here RTO means recovery time, distinct from the registration office. |
| Q-17 | D-22 assumes individual email identities. | CHG-02 resolves admin-set email/initial password for the current application. Remaining: actual staff roster, recovery email delivery, MFA expectations, offboarding owner, lost-account recovery, and identity for Security/Cashier. | User, IT | Live authentication and staff onboarding; M1/M5. |
| Q-18 | Existing bookings will be in flight at launch. | Pilot new bookings only or a reviewed manual entry process for in-flight bookings; how to preserve their pre-system approvals and custody evidence. | User, BO | Opening pilot cohort; M5. No fabricated historical events. |

## 5. Known source tensions and their disposition

| Tension | Disposition |
|---|---|
| Combined TL/SM box versus SO → TL → SM and TL → BO summary. | D-14 requires TL then SM. Q-05 still covers allocation timing and actual handoff sender. |
| Accounts and Cash Counter both mention FASTag. | D-17 allocates processing to Accounts and collection/handover to Cashier. Q-08 covers evidence and exact timing. |
| The page-5 drawing lays out numbered routes without formal gate conditions. | Preserve all labels in workflow.md. D-16 settles Insurance before invoicing; Q-06/Q-08 govern remaining dependencies. |
| Red SO arrow visually points toward Accounts; the accessory text and page-6 summary route SO → BO → Accounts. | Use the explicit text route, preserve the graphic annotation in the inventory, and validate detailed handoff mechanics under Q-09. |
| Physical files/copies are part of the current process, while D-07 targets digital work. | Preserve each original step and identify its digital equivalent. Q-02 determines which physical movements/copies may cease. |
| The PDF studies enquiry through delivery; D-13 starts this application at confirmed booking and the diagram ends at Accounts storage. | Enquiry remains external context. Cover post-delivery file return/archive so the final physical custodian is known. |
| Partial accessories and Accounts closure appear in the same flow without a policy for remaining work. | Keep outstanding items visible; Q-09 must decide whether delivery or closure is allowed. |

## 6. Change record template

Use this structure when resolving an open question or changing a rule. Append the result and update the affected specifications in the same change.

```text
ID: CHG-<next number>
Date:
Status: proposed | approved | rejected | implemented | superseded
Requested by / evidence provider:
Problem observed in operations:
Source requirements and decisions affected:
Proposed before/after behaviour:
Options and recommendation:
User decision and evidence of explicit confirmation:
Affected roles, documents, gates, reports, and tests:
New-booking behaviour:
Existing-booking impact / migration or no migration:
Data, security, and original-document impact:
Implementation milestone / release:
Verification and rollback or reconciliation procedure:
Supersedes / superseded by:
```

A request to adjust a label or fix an implementation bug within an agreed rule does not require reopening the business decision. A change that weakens access, changes approval authority, removes a document gate, or affects existing bookings does.

## 7. Implementation authorization: CHG-01

- **Date / status:** 2026-11-10; approved implementation scope, M1 local foundation implemented. Later milestones remain dependent on their Q items.
- **Requested by / evidence:** user, “implement the plan.” The subsequent “^” reply supplied no booking fields, signatories, scope matrix, or amendment rules.
- **Problem / affected decisions:** D-18 limited the previous task to documentation. D-01/D-03/D-10 now govern staged implementation; R-02/R-19/R-22/R-23/R-24 apply to M1. Source: SRC-16/SRC-17.
- **Before / after:** documentation-only workspace becomes a local Next.js/Supabase application with synthetic identities, scoped staff access, invitations, deactivation, audit records, and executable checks.
- **Options / recommendation:** implement settled M1 work while requesting M2 inputs. Do not infer answers to Q-01/Q-02/Q-03/Q-05/Q-11/Q-12/Q-17.
- **User decision:** implementation authorized by the quoted request; no separate production, hosting, pilot, or business-rule decision supplied.
- **Engineering treatment:** synthetic branch administrators manage non-admin assignments in their branch. SO/TL assignments require a team; other synthetic roles use branch scopes. Admin creation remains a controlled setup operation. Original implementation: invitation expiry is seven days and passwords require 12 characters for local testing (password/onboarding defaults superseded by CHG-02); Q-03/Q-17 must establish the live policy. These are defaults, not departmental validation.
- **New / existing bookings:** no booking schema or operational gates implemented; no active-booking migration. No changes to TL → SM approval, Insurance-before-invoice, Accessories, original custody, or archive requirements.
- **Data / security:** local synthetic data only; private document bucket denies application access pending Q-02/Q-03. Filled source forms and photographs remain local and Git-ignored. No external messages sent; invitations prepare a private link for authorized distribution.
- **Milestone / verification:** M1; commands, results, limitations, and recovery notes in implementation-plan.md and architecture.md §10.
- **Rollback / reconciliation:** stop local processes; rebuild the disposable synthetic database with the recorded reset command. Reset is not a production restore or a file backup.
- **Supersedes:** D-18's restriction on the next application task only. All other decisions and Q blockers retain their scope.


## 8. Workspace cleanup and administrator-created accounts: CHG-02

- **Date / status:** 2026-11-10; approved by the user, implemented locally.
- **Authority / evidence:** user requested removal of dummy details/accounts, Kerala Nippon Toyota branches in admin selectors, and responsive portals. The user then specified that administrators preset staff email and password, with a password of 4–6 characters. The implementation uses six characters within that range, matching Supabase's minimum.
- **Before / after:** persistent Demo North/South fixtures and thirteen seed identities are retired. The default seed contains 20 public directory entries from [Nippon Toyota's contact directory](https://www.nippontoyota.co.in/contact), verified on 2026-11-10, with showroom/service labels preserved to distinguish entries in the same city. No employee roster, invented teams, customer data or operational branch routing is inferred from this public catalog.
- **Administrator continuity:** no personal owner name/email was supplied. Retain one local setup identity, labelled Workspace Administrator, at `admin@filesdigi.local`, with a newly generated six-character password saved only in ignored local storage. Its explicit Admin memberships cover the catalog entries to support setup. This is a local bootstrap account, not a company-verified identity or a universal Admin capability. Other administrators remain limited to their assigned branches.
- **Account behaviour:** authorized administrators set an individual email, six-character initial password, branch, role and (for SO/TL) actual team. They can add real team names within their authorized branches. Auth creation is a narrow server-only operation; a separate user-JWT command verifies the prepared identity and atomically creates profile, scope, request completion and history. No email is sent. Existing accounts/passwords are never overwritten by this flow. Retry completion cannot reactivate revoked access. Self-service password setup/recovery permits 6–128 characters.
- **Affected scope:** D-22 onboarding method; R-02/R-19/R-22/R-23/R-24, T-02/T-19/T-22/T-23/T-24; M1. Q-17 remains open for the named live roster/recovery/MFA matters. Q-03 operational permissions, hosting Q-04, customer/workflow gates and pilot exception authority remain unchanged.
- **Data / history / migration:** one-time cleanup is restricted to the original local synthetic dataset, with a private database dump first. It refuses non-demo identities or stored document objects. There are no customer bookings or historical approvals to migrate. Removing synthetic history is not a permission to erase real audit records. Temporary test identities now install and tear down in separate fixture branches.
- **Verification / recovery:** validation and cleanup results are recorded in implementation-plan.md. The pre-cleanup dump is in ignored `.local/backups`; no production restore is authorized. Restore only to a separate local recovery database for inspection, or deliberately replace the local database after accounting for any newer work. Original PDF sources are unchanged.
- **Supersedes:** CHG-01's persistent demo seed, invitation-only primary UI and 12-character local password default. All unrelated decisions remain in force.


## 9. Sales booking milestone: CHG-03

- **Date / status:** 2026-11-10; implementation authorized, in progress. Business prerequisites remain scoped below.
- **Authority / evidence:** user said “ok lets build the same” after the proposed SO booking → TL → SM → BO milestone, then confirmed “booking can be from one person while as registration can be for other one.”
- **Confirmed change:** D-25 separates booking customer from registered owner. Q-01 is partially clarified; this does not confirm mandatory fields, duplicates, vehicle cardinality or a booking-number convention.
- **Proposal not adopted:** the proposed required-field list and branch/OBF duplicate rule were presented for confirmation. The user selected “I’ll specify different rules.” Await the replacement requiredness, duplicate and vehicle-cardinality rules; do not implement the proposal. Q-02 document/signature gates and Q-05 allocation/BO handoff details were also requested and remain unanswered.
- **Scope / trace:** M2; R-01–R-07/R-16/R-19/R-20/R-22/R-24; D-13/D-14/D-15/D-19/D-20/D-25; SRC-01/SRC-02/SRC-05/SRC-09/SRC-18/SRC-19 and page-5 Sales inventory. Source forms show separate booking/registration sections but do not establish requiredness.
- **Existing data / boundaries:** no booking records existed at milestone start. Retain user-created staff/teams and current branches. Local synthetic work only; no hosted publication, live-customer import or messages. Approval/exception/document rules are not inferred from the general implementation request.
- **Verification / recovery:** record completed slices and actual checks in implementation-plan.md; use forward migrations without resetting the workspace.


## 10. Persistent Kalamassery role test accounts: CHG-04

- **Date / status:** 2026-11-10; explicitly authorized by the user and executed locally.
- **Authority:** user requested one dummy account per role named `test<role, branch>`, retained in the database, and checks against the intended workflow for Kalamassery.
- **Scope:** ten named synthetic identities (Admin plus nine operational roles), each with exactly one Kalamassery membership. SO/TL share a dedicated `test<Kalamassery team>`. The technical Admin uses the existing controlled setup boundary and has no other branch scope. Operational accounts use the existing account-request/Auth/completion commands. No credentials are committed; generated six-character passwords are saved in ignored mode-0600 local artifacts.
- **Data / existing accounts:** existing two staff accounts and the existing team were preserved. Accounts, assignments, account requests and their audit history are retained, overriding the earlier dummy-cleanup request only for this named test set. The normal transient fixture cleanup does not own these identities. The tested SO assignment was deactivated and reactivated with attributed reasons; it remains active.
- **Results / limits:** implementation-plan.md records actual results. No booking, document, approval or handover success is inferred from account-access checks; those features remain unimplemented. This request does not resolve Q-01/Q-02/Q-03/Q-05/Q-11 or authorize a gate bypass, live customer import or hosted deployment.


## 11. SO booking section and departmental ownership: CHG-05

- **Date / status:** 2026-11-10; user-approved ownership decisions, first SO draft slice implemented locally; remaining departmental editors/handoffs are not yet implemented.
- **Authority / evidence:** user requested the first part of the customer file as an SO-filled booking form and a section-by-section assignment based on the workflow PDF. For page 1, user accepted the proposed SO customer-information / BO registration-verification / Insurance / SM-allotment split. Subsequent answers assigned ledger/prices to Accounts; approval/discount to SM; insurance to Insurance; accessories to Accessories; calculations and final net to BO. User explicitly confirmed BO handles finance commission/subvention, TKM support, incentives and interest calculations; SO is delivery-in-charge; SO enters finance/hypothecation and BO verifies it; BO owns the registration-document checklist; delivery remarks belong to the respective Accessories/SO/SM role; Security owns its check.
- **Handoff resolution:** user explicitly selected “TL sends to BO after SM approval.” TL remains the sender, TL approval precedes SM approval, and neither approval can be skipped. This resolves the sender portion of Q-05 only. Allocation timing, mandatory evidence/signatures and receipt scope remain governed by their unanswered parts.
- **Initial implementation:** the printed file header and Booking Details on blank-file page 1 are captured as a saved, revisioned SO draft. The draft contains no registration identity, bank, insurance commission or downstream financial fields. The registered owner remains a separate future section under D-25; no copied customer identity or signature is fabricated. SO/team/branch identity comes from the active account; typed TL name is a paper-file label, not an approval identity.
- **Validation boundary:** no required submission fields or duplicate matching rule is inferred from these ownership answers. Optional draft fields follow the printed source, with type/size constraints for safe storage. The earlier rejected mandatory-field/duplicate proposal remains unadopted. Creating a draft requires the SO to identify it as an existing confirmed booking (D-13), not an enquiry. Internal UUIDs identify drafts; no customer-facing number generator or business uniqueness rule was introduced.
- **Access / transaction:** SO can create/edit its assigned drafts; TL can read its team's drafts; SM can read branch drafts under D-15. Admin, BO and other departments do not gain draft-customer access from these new screens. Each save atomically updates the draft, immutable version, audit and retry result, rejects stale revisions and accepts only the printed section's allowed keys. No submit/approve/handoff command exists in this slice.
- **Scope / trace:** R-01/R-02/R-19/R-20/R-22/R-24 foundation slices, D-13/D-14/D-15/D-19/D-25, SRC-S01–SRC-S06 and source form page 1. Owner map and provenance are in workflow.md. Q-01/Q-02/Q-03/Q-05/Q-11 retain unresolved dependencies.
- **Data / migration:** forward migration adds draft/version tables and one scoped command. Existing staff, teams, public branches and the user's persistent Kalamassery test roles remain. No booking records existed before this migration. Local synthetic work only; no deployment, official PDF/form generation or live data import.
- **Verification / recovery:** executed evidence in implementation-plan.md; retain drafts/history during rollback, disable draft routes if reverting the application, and use a compatible forward fix rather than resetting the workspace.
