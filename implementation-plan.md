# Implementation plan and validation

Documentation baseline: 2026-11-10. Current delivery: **local synthetic M1 foundation and M2 drafts, registered-owner uploads and SO-to-TL submission/receipt through CHG-08**. The documentation-only delivery (D-18) remains the historical baseline. M2 has started under CHG-03; its unresolved business prerequisites still control dependent features. M3–M6 have not started.

Read [PRD](prd.md), [workflow inventory](workflow.md), [architecture](architecture.md), and [decisions/open questions](decisions.md). [AGENTS.md](AGENTS.md) defines how agents use them.

## 1. Delivery rules

- Build the complete V1 in milestones. A booking-only feature is a development milestone, not the full operational trial selected in D-01.
- Resolve a question before implementing the behaviour it controls. Proceed with settled, independent work while other questions remain open. Do not replace a missing business answer with a guessed field or bypass.
- Use synthetic fixtures until hosting/data handling and live use are approved. Keep the source PDF unchanged.
- Give each task requirement IDs, source/decision IDs, prerequisites, expected behaviour, tests, and a completion record. Update specifications and tests with approved rule changes.
- Run the relevant checks for a change. Broaden them for new risks or cross-module effects; do not repeat unchanged tests without a reason.

## 2. Milestones

### M0: Specification and operational validation

**Deliver now:** the six documents, source inventory including the page-5 image, decision register, open questions, conceptual architecture, test catalogue, and agent instructions. Documentation can be complete while explicitly identified operational inputs remain open.

**Before dependent build work:** collect redacted OBF/document samples and validate the relevant questions with the user. Start with Q-01/Q-02/Q-03/Q-05/Q-11/Q-12/Q-17 for Sales and access. Then resolve Q-06–Q-10 for downstream steps. Department staff can provide evidence; the user settles conflicts.

**Acceptance:** meaningful source items have a disposition; all 24 user decisions appear; IDs/links resolve; blocking questions identify affected work; test scenarios cover all R identifiers. No invented document schema, signature, integration, or statutory gate.

**Current state:** documentation prepared in this delivery; operational validation remains pending. This status must not be interpreted as company sign-off.

### M1: Runnable foundation and access controls

**Depends on:** architecture direction D-10. Use synthetic scope assignments while validating Q-03; actual onboarding depends on Q-03/Q-17. Hosted live data is blocked by Q-04.

**Build:** initialize a single Next.js/TypeScript project, npm lockfile, local Supabase setup, SQL migrations, generated database types, and synthetic seed data. Establish domain modules, authenticated staff shell, invitation/deactivation, active memberships, role/scope checks, private storage baseline, audit/command pattern, and test scripts. Use the smallest schema required for the feature, not speculative full DDL.

**Interfaces:** protected read projections, narrow database command convention, normalized user-safe failures, revision/operation-identity handling, and placeholder-only environment examples. Document exact local commands after verifying them. Initialize version control when application setup is authorized; do not assume an existing repository or remote.

**Acceptance:** a fresh local setup works from documented steps; two synthetic branches prove isolation; unauthenticated/deactivated accounts fail; no public signup or service credentials in the browser; direct unauthorized database/storage requests fail. CI/local checks run type checking, lint, relevant tests, and a production build.

**Evidence:** T-02, T-19, T-22 transaction foundation, T-23, T-24 shell. Capture commands and results rather than claiming tests from their presence in this plan.

### M2: Booking, documents, Sales approvals, and amendments

**Depends on:** M1 and resolved Q-01/Q-02/Q-03/Q-05/Q-11 for implemented fields/actions. Exception grants require Q-12; unclassified gates stay non-overridable while exception design is pending.

**Build:** booking entry at confirmation, OBF/customer/vehicle details, external enquiry reference, waiting work, booking-fee evidence, allocation record, document upload/version/verification, checklists, physical-original tracking, TL then SM review, return/rework, and BO receipt. Add propose/approve amendments with the confirmed impact matrix. Implement eligible exception requests/decisions only after the user defines their scope.

**Interfaces:** booking create/edit/submit, approval/return, amendment proposal/decision, handoff/receipt, document reserve/finalize, and original transfer/receipt. Business commands validate the reviewed revision and commit history with their result.

**Acceptance:** one synthetic booking reaches BO with both approvals and the required evidence; TL/SM cannot approve out of order or against stale data; pending/rejected amendments leave approved values unchanged; approved amendments trigger the agreed revalidation; failed uploads never satisfy gates; digital handoff leaves original custody unchanged. New checklist publication preserves older bookings.

**Evidence:** T-01–T-07, T-16–T-20, T-22–T-24 as relevant. Include the exception authority and versioning scenarios before claiming those features complete.

### M3: BO, Insurance, Accounts, FASTag, and registration

**Depends on:** M2 and resolved Q-06/Q-07/Q-08 plus applicable document/access requirements.

**Build:** BO pre-list/PDI/preparation, VAHAN entry evidence, Form 20/disclaimer and signatures, uploads, Insurance verification and external broker steps, policy return/copy evidence, and assigned Tally follow-up. Add Accounts receipt/verification, invoice evidence, FASTag issuance, road-tax work, BO returns, separate Cashier collection/handover, and RTO registration tracking.

**Interfaces:** named departmental action completion with evidence, return/rework reasons, receipt confirmation, and view projections that expose only relevant data.

**Acceptance:** Insurance policy arrives before invoicing; road-tax completion precedes the depicted RTO registration step; invoice, FASTag, road tax, and actual registration remain distinct facts. All eleven Insurance source entries and seven Accounts source entries have implementation or an explicit approved external/manual treatment. Accounts archive itself completes in M4.

**Evidence:** T-08–T-12 and T-20; rerun access, amendment-impact, audit, and transaction checks affected by these new actions.

### M4: Accessories, bills, Security, delivery, and archive

**Depends on:** M3 and resolved Q-09/Q-10, including the policy for unfinished accessories at delivery/closure.

**Build:** preparation request and stock availability; available versus pending work; Cashier collection evidence; bills; restricted profit/loss data/evidence and signature; SO → BO → Accounts bill routing; discrepancy handling and financial closure; Accounts → Security gate-pass route; actual delivery evidence; final return/receipt and Accounts archive location.

**Acceptance:** complete the ten accessory steps and the Security return. A partial-stock scenario retains the unfinished work and owner even if an approved policy permits delivery. Invoice, financial closure, gate pass, delivery, and final archive cannot masquerade as each other. Security sees only approved release information.

**Evidence:** T-13–T-15 and a full T-01 through T-15 journey, including missing signatures, discrepancy returns, pending accessories, and missing physical return. Run affected authorization and concurrency checks.

### M5: Pilot readiness and one-branch trial

**Depends on:** M1–M4 acceptance and resolution of Q-04/Q-13–Q-18. Confirm departmental validations and approved treatment of cancellation/refund/reassignment/duplicate cases under Q-14. Readiness does not require automating every unusual scenario, but it requires an agreed way to handle it.

**Prepare:** approved production/staging accounts and data locations; real staff role matrix; signed-off checklist/routing revisions; new-booking versus in-flight launch policy; measured baseline and target; training; support owner; backups and restore exercise; controlled fallback and reconciliation; tested release/monitoring process. The user records the go-live decision.

**Run:** use the agreed cohort at one branch, record actual physical movement including work outside the application, review blocked work and exceptions, and capture change requests with their effect on existing bookings. Do not run unrecorded experiments against live approval rules.

**Acceptance:** T-01–T-24 pass for the approved pilot configuration; restore and fallback drills meet agreed objectives; there are no unresolved blockers for the live path. Staff can complete the workflow, find missing work and originals, and report problems. Pilot observations support the agreed reduction measure with no missing required approvals/evidence.

### M6: Pilot review and controlled expansion

**Depends on:** pilot results and user's decision to expand.

Compare baseline/pilot physical transfers, show required-original movements separately, review exceptions, failures, staff feedback, and open work. Resolve change requests, update decisions and affected tests, and assess migration impact before changing active bookings. Rehearse the revised workflow before adding branches.

Expand in approved branch groups with explicit staff scopes, local checklist differences where approved, support capacity, and monitoring. Do not enable blanket all-branch access to simplify rollout. Reassess storage/cost/load using observed data before 13-branch operation.

## 3. Test catalogue

These are required scenarios, **not executed test results**. Tests must use the agreed rules; scenarios affected by open questions remain blocked rather than passing against guessed rules. Use unit tests for pure predicates, real local database/storage tests for permissions and transactions, and browser tests for critical staff journeys.

| Test | Requirement | Scenario and required outcome |
|---|---|---|
| T-01 | R-01 | Create confirmed booking from approved fields, attach OBF/reference/fee evidence, maintain waiting work, and record allocation. Reject invalid data; use approved duplicate rules; no pre-booking CRM or fabricated required values. |
| T-02 | R-02 | Use two branches, multiple teams, two SOs, and each department. Attempt unauthorized reads/writes through pages, server actions, direct API/RPC calls, joins, counts, downloads, and exports. Deny out-of-scope data/actions; permitted access still works. |
| T-03 | R-03 | Upload allowed synthetic files; interrupt upload; mismatch extension/content type; exceed size; replace a verified file; retry finalization; attempt overwrite/delete; request unauthorized access. Only verified finalized evidence counts; history and signatures remain version-specific. |
| T-04 | R-04 | Evaluate applicable/missing/inapplicable documents and required signatures against a published checklist revision. Missing evidence blocks the correct action with a useful explanation; staff cannot mark an item inapplicable without its approved rule. |
| T-05 | R-05 | Try SM before TL and BO before both; approve valid order; return with reason; resubmit corrected work; submit a stale approval twice. Correct tasks appear once, decisions remain attributable, stale/out-of-order actions fail. |
| T-06 | R-06 | Send/acknowledge/return digital work; independently offer/receive an original bundle; leave receipt pending; attempt competing transfers. Preserve true custody and unacknowledged status. A digital move creates no fabricated physical movement. |
| T-07 | R-07 | Propose/reject/approve amendment; compare pending values to approved values; conflict with another revision; exercise field-specific rework including post-invoice/registration scenarios if permitted. Apply once; preserve history; invalidate/revalidate only according to the approved matrix. |
| T-08 | R-08 | Receive BO work; complete pre-list/PDI, preparation, VAHAN, Form 20/disclaimer and uploads. Omit required signatures/evidence to prove correct gates. External-entry evidence does not prove registration. |
| T-09 | R-09 | Walk SRC-I01–SRC-I11: broker actions, verification/cross-check, policy number/copy, BO return, Tally follow-up. Missing policy blocks invoice; required bank/customer checks and Tally treatment follow approved rules. |
| T-10 | R-10 | Verify approved booking revision, record external invoice and tax evidence, return to BO. Missing/stale evidence prevents completion. Invoice/tax evidence do not execute payments or silently finalize the entire Accounts workflow. |
| T-11 | R-11 | Accounts issues/records FASTag; Cashier later collects/hands over under the approved rule. Issuance alone leaves Cashier work pending; unauthorized roles cannot mark the action complete. |
| T-12 | R-12 | Try registration before required tax/evidence; complete prerequisites and record external registration. Show pending physical signatures independently; VAHAN entry alone cannot mark registration complete. |
| T-13 | R-13 | Complete full-stock and partial-stock accessory scenarios, Cashier collection, bill uploads, and profit/loss signature. Pending work remains owned and visible; unauthorized roles cannot see restricted financial detail. Delivery/closure follows Q-09's approved answer. |
| T-14 | R-14 | Route bills SO → BO → Accounts; return discrepancies; correct and resubmit; verify closure. Missing bill evidence or unhandled partial work cannot disappear through a generic close action. |
| T-15 | R-15 | Apply gate-pass prerequisites; process Security action, actual delivery evidence, file return, and Accounts archive. Missing required release evidence/return stays pending. Security cannot read unrelated customer/bank/financial documents. |
| T-16 | R-16 | A handoff or return creates an in-app notification and correct work inbox entry. Mark notification read; task persists. Search/filter/status counts remain scoped; pending owner, reason, age, and original location are clear. |
| T-17 | R-17 | Eligible exception: request, user approval/rejection, scope and any expiry/revocation. Attempt unknown/non-overridable gate, different booking/revision, technical-admin and SM self-grants. Deny all unauthorized cases and record legitimate decisions. |
| T-18 | R-18 | Create booking A on revision 1; publish revision 2; create booking B; confirm A retains original requirements. Run a reviewed migration dry run; verify impact, application, history, and rollback/reconciliation. Routing code supports both active versions. |
| T-19 | R-19 | Inspect approval/document/amendment/role/configuration/custody history; attempt edits/deletes; deactivate actor; induce a failed transaction. Preserve attribution; routine history mutation fails; failed business transaction leaves no misleading success event. |
| T-20 | R-20 | Enter manual references/evidence for external systems, including broker/Tally. Verify no network integration or automatic issuance is implied. Replacing a reference/document requires the appropriate review; external facts stay distinguishable from internal approvals. |
| T-21 | R-21 | Use known transfer events, required-original labels, incomplete records, and a manual-fallback event. Reproduce cohort counts and baseline comparison; handle zero baseline and missing observations explicitly. |
| T-22 | R-22 | Race two reviewers or updates; retry after timeout; inject failure between state/history writes and between upload/finalization; run backup restoration of records and files; reconcile offline manual work. No silent overwrite, duplicate transition, false success, or lost evidence. |
| T-23 | R-23 | Invite/login/recover/deactivate staff, change scope, attempt self-role escalation and public signup. Verify access revocation with an existing session, audit attribution, and separation between technical administration and business approval. |
| T-24 | R-24 | Complete core actions on agreed desktop/mobile browsers, including phone upload, long checklists, keyboard navigation, readable error states, session expiry, and interrupted connection. Unsaved/failed work is clear; no false completion on reconnect. |

### Test-data requirements

Use synthetic bookings spanning two branches and multiple teams even during a one-branch pilot. Include missing/unsigned documents, duplicate requests, a returned approval, waiting allocation, an amendment, partial accessories, one allowed and one forbidden exception, old/new checklist revisions, an unacknowledged original transfer, and final Accounts archive. Include bank/finance-related document variants only after applicability is confirmed.

Synthetic files should exercise allowed formats, invalid/mislabeled content, size limits, and replaced versions. Do not copy real customer documents into fixtures, browser screenshots, snapshots, or AI prompts.

## 4. Runbooks to make executable during the build

The procedures below define the required operating behaviour. Fill in verified commands, account locations, contacts, thresholds, and recovery objectives once infrastructure is selected; never present placeholders as working operations.

### Release and configuration change

1. Identify affected R/D/Q IDs, active workflow versions, database changes, and existing-booking impact. Resolve business-rule changes with the user before implementation.
2. Run relevant automated checks and a staging walkthrough with synthetic data. Review migrations and permission changes. Confirm backups/restore procedure for any production data change.
3. Publish checklist changes as a new revision; do not edit published historical rows. Review any active-booking migration separately from the code release.
4. Deploy a compatible application/database change, then verify login, scoped reads, a safe operational action, storage access, inboxes, and error monitoring. Record release ID and verification evidence.
5. If a release is faulty, stop the affected actions and restore compatible application code where safe. Prefer a forward data correction; a database restore must not erase valid work performed after deployment without a reconciliation plan.

### Outage and controlled manual fallback

1. The named operator records the incident, affected actions, last known successful operations, and staff notice through the company's agreed channel. Avoid repeating a timed-out action until its recorded outcome is checked.
2. If operations must continue, use the approved manual procedure and retain actor, actual time, booking identity, documents, approval evidence, and physical transfer details. Manual fallback does not waive a business prerequisite.
3. After recovery, reconcile by a designated person: preserve actual event time separately from entry time, link supporting evidence, check duplicates, identify stale tasks, and resolve conflicts with the user. Do not invent approvals to make statuses match.
4. Compare paper and digital pending work, original locations, and exceptions before declaring recovery. Include manual transfers in pilot measurements.

### Backup and restore drill

1. Set the approved recovery point/time objectives and backup/retention schedule under Q-13/Q-16. Verify database recovery plus independent document-object backup and manifest.
2. Restore into an isolated environment. Restore necessary identity/configuration, then compare booking/document records to object manifests/checksums and verify access controls.
3. Replay representative scenarios and reconcile records/files created outside a common recovery point. Report missing evidence; do not hide it with completion flags.
4. Record observed recovery duration, recoverable data range, failures, and corrective work. Repeat after changes that materially alter the recovery design. Perform a controlled production recovery only under the actual incident procedure.

### Pilot operating review

At the agreed cadence, the user and branch representatives review missing evidence, blocked work, unacknowledged transfers, outstanding accessories, exception use, amendment rework, support issues, storage/backup health, and physical handoff counts. Separate software defects from requests to change the business process. Record changes through the decisions.md template.

## 5. Task and completion templates

```text
Task ID / milestone:
Outcome:
Requirements and source/decision IDs:
Resolved prerequisites / remaining blockers:
Inputs, commands, state transitions, and permissions affected:
Acceptance scenarios / test IDs:
Data migration and active-booking impact:
Implementation changes:
Validation commands and observed results:
Documentation updated:
Limitations / rollout and recovery notes:
```

Before calling a task complete, confirm that its acceptance criteria passed, source steps remain covered, access and audit behaviour still hold, and any open question affecting that task was resolved rather than guessed. Do not require a new business approval for ordinary implementation work already authorized within the agreed rules.

## 6. Documentation delivery verification

Validate the six files for local links, unique defining IDs, referenced-ID existence, coverage of D-01–D-24 and R-01–R-24, matching T-01–T-24, source-inventory row counts, and the unchanged PDF checksum. Review the page-5 image against the inventory separately; a link/ID checker cannot prove semantic fidelity.

The historical delivery checks below describe their original task. Record current application verification separately; M1 evidence appears in §7.

### Delivery check: 2026-11-10

| Check | Observed result |
|---|---|
| Deliverable set | Exactly the six agreed Markdown files, alongside the original PDF. No application scaffold or cloud resources created. |
| Defining IDs | 83 source inventory entries; 24 confirmed decisions; 12 engineering defaults; 18 open questions; 24 requirements; 24 test scenarios. No duplicate defining IDs or undefined referenced IDs. |
| Requirement/test mapping | R-01–R-24 each reference the corresponding T-01–T-24 scenario; all scenarios identify their requirement. |
| Local Markdown links and structure | All local file links resolve. Code fences balance and table column counts are consistent. |
| Source preservation | PDF SHA-256 matches the baseline recorded in workflow.md. |
| Source content review | Read all ten PDF pages and visually inspected the page-5 diagram. Inventory retains the Insurance 1–10 steps plus Tally, Accounts 1–7, Accessories 1–10 plus timing annotation, numbered arrows, SO return annotation, and page-6 handoffs. |
| Business consistency | Confirmed choices remain separate from engineering defaults and operational questions. Unresolved gates have explicit dependencies; the documentation does not claim company/departmental validation. |
| Application verification | Not run: no application exists in this delivery. T-01–T-24 are future acceptance scenarios. |

### Supporting form delivery: 2026-11-10

- **Task / milestone:** FORM-01, standalone source reconstruction supporting M0 review; no application milestone implemented.
- **Outcome / authority:** the user's explicit request for a blank fillable PDF and reproducible generator; [artifact and provenance](workflow.md#supporting-customer-file-reconstruction--2026-11-10).
- **Requirements / decisions:** evidence relevant to R-01/R-03/R-04/R-07 and D-19; their behaviour remains unchanged. Q-01/Q-02 and departmental mapping remain open; no unreadable printed label required clarification during reconstruction.
- **Inputs / changes:** local `file.pdf` pages 1–4; generated `file-blank-fillable.pdf` and `generate_file_blank.py`. No state transitions, permissions, data migration, or active-booking changes.
- **Acceptance / checks:** `python3 generate_file_blank.py --check` passed: four A4 pages; 234 unique fields (54/86/50/44 by page), including 17 unchecked checkboxes, 8 blank dropdowns, and 12 multiline fields. All initial text values are empty; signature/seal spaces have no signature widgets.
- **Verification evidence:** visually compared each reconstructed page with its original; checked printed labels, formulas, table rows, and all 16 checklist entries. Synthetic dates, names, amounts, multiline entries and selections persisted after save/reopen. Every text/selection appearance survived flattening within its field bounds; checkbox appearance changed when checked. Blank PDF contains no images, attachments, non-widget annotations, calculation scripts, source metadata, or filled entries. Both source PDF checksums match their recorded baselines.
- **Documentation:** linked artifact/generator and source provenance in workflow.md; recorded delivery here. Existing business rules and department assignments are unchanged.
- **Limits / recovery:** local PyMuPDF rendering and flattened print appearance checked; no physical print or cross-viewer certification. Financial values remain manual, signature/seal areas remain for paper signing. Regenerate the blank output from the script; preserve the original. Application T-01–T-24 were not executed by this task.

## 7. M1 implementation record: FOUNDATION-01

- **Outcome / authority:** local runnable Next.js/Supabase staff foundation, authorized by “implement the plan” (CHG-01). Git initialized on `main`; no remote, deployment, purchase, staff message, or live-data import.
- **Requirements / sources:** foundation portions of R-02/R-19/R-22/R-23/R-24; SRC-16/SRC-17; D-03/D-05/D-10/D-15/D-22, A-01/A-06–A-10. No business-rule exception granted.
- **Prerequisites:** D-10 settled. Synthetic scopes permitted by M1; live Q-03/Q-17 and hosting Q-04 remain open. M2 needs Q-01/Q-02/Q-03/Q-05/Q-11 for its fields/actions; exception grants require Q-12. The user's “^” reply does not resolve these facts.
- **Inputs / commands / permissions:** named invitation creation/acceptance and membership activation/deactivation RPCs; user-derived actors, active scope, optimistic revision and operation identity; append-only audit; current-user Auth email check. Auth link creation is a separate privileged external-to-PostgreSQL step and cannot itself grant membership.
- **Implementation:** pinned dependencies and lockfiles, SSR login/logout/recovery, responsive staff shell, scoped administration, SQL migration and generated types, two-branch/multiple-team synthetic seed, private deny-by-default storage, unit/database/browser checks and CI definition.
- **Migration impact:** new local database only. No historical approvals, physical originals, customer records, or active bookings modified. Published workflow/checklist configuration remains unimplemented.
- **Acceptance evidence:** see the command results below. Foundation slices do not constitute full T-02/T-19/T-22/T-23/T-24 operational acceptance.
- **Documents updated:** AGENTS.md, decisions.md, prd.md, architecture.md, workflow.md, and this record. Existing source PDFs retained byte-for-byte.
- **Recovery / limits:** setup and stop/reset commands in architecture.md §10. Native stack runtime is experimental. A synthetic database reset is not a restore drill; M5 database/object restore, pilot load and company hosting checks remain unexecuted.

| Command / check | Observed result |
|---|---|
| `npm ci` and `npm run db:env` | Clean lockfile installation and fresh local environment generation passed. Existing environment files remain protected. |
| Native Supabase start and local reset | PostgreSQL/Auth/REST/Storage/Mailpit started; migration and synthetic seed applied. No Docker installation required. |
| `npm run db:types` | Generated from the actual local schema; TypeScript compilation passed. |
| `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` | Passed; two Vitest trust-boundary checks and optimized Next build. |
| `npm run test:db` | 66 checks passed against actual local PostgreSQL/Auth/REST/Storage. Tests cover branch/team/profile isolation, direct SQL/API write denial, self-escalation, unknown actor, revoked scope with existing JWT, append-only history, failure rollback, retry deduplication, changed payload rejection, concurrent updates, denied private-file operations, closed signup, verified invitation acceptance, and password recovery. |
| `npm run test:e2e` | Six Chromium journeys passed against both development and production servers: desktop and phone checks for login errors/scoped shell/logout, branch-scoped administration, and invite → acceptance → password setup → deactivation with an existing session. Phone emulation does not certify Safari or a physical device. |
| Browser credential boundary | All 15 generated browser assets checked; none contains the local service-role credential. |
| Dependency audit | Zero known vulnerabilities after compatible pins and the narrow minimatch override; ESLint 9 support status remains documented. |

**Still blocked:** final booking fields/duplicates/cardinality (Q-01), checklist/signature rules (Q-02), operational permissions (Q-03), Sales gates/handoff sender (Q-05), amendment impacts (Q-11), exception eligibility/identity (Q-12), and actual staff/recovery policy (Q-17). Downstream Q-06–Q-10 and pilot Q-04/Q-13–Q-18 retain their original blocking scopes. No complete fulfilment journey or pilot readiness is claimed.

Visual inspection of the desktop and phone login screenshots found readable labels, working narrow layouts, and no horizontal overflow. Local Markdown links, code fences and R/T/D/Q reference coverage passed; both source PDF checksums match workflow.md. The page-5 inventory was not reinterpreted or changed during M1.

## 8. Login design implementation: UI-01

- **Milestone / outcome:** M1 presentation refinement; login layout based on the user's three screenshots, with a white sign-in card on a pale-grey canvas, Toyota red accents, local variable typography, and rotating Fortuner/HyCross/Hyryder imagery.
- **Authority / trace:** explicit user request for the login redesign, font reference and seamless automatic vehicle transitions; R-24/T-24 and D-05. No changes to business decisions, account authorization, database commands, or outstanding Q items.
- **Inputs / implementation:** `src/app/login/page.tsx`, its CSS Module and `vehicle-showcase.tsx`; images/font under `public`; sources and font substitution recorded in architecture.md. No new npm dependencies. Preserve email/password actions, errors, recovery links and credential boundaries.
- **Acceptance / executed checks:** lint, type check and production build passed. Eight desktop/phone Chromium journeys passed, including login/permissions/invitation regressions and new coverage for automatic rotation, wraparound, pause/resume, manual selection, reduced motion, image loading, preserved email entry and no horizontal overflow. Visually reviewed desktop, phone and alternate-vehicle screenshots; corrected font weight and image background blending.
- **Data / migration:** none. No production content or source-PDF modifications. No hosted publication or external messages.
- **Limitations:** Hanken Grotesk approximates the HK Guise direction; the actual commercial HK Guise font was not installed. Phone emulation is not a physical-device or Safari certification. Unrelated database tests were not rerun for this presentation change.
- **Recovery:** restore the prior login page/CSS and remove the new showcase import to revert the presentation; no database rollback needed.

## 9. Login refinement: UI-02

- **Milestone / authority:** M1 presentation refinement requested by the user: larger text, password visibility, HyCross first, less whitespace, no tiles, and a clear file-management identity. R-24/T-24 and D-05; no business-rule changes or newly resolved Q items.
- **Implementation:** continuous full-screen layout with modest outer gutters; revised font weights, spacing and sizes; booking-document, approval and file-movement copy; native password visibility control; HyCross-first slideshow with sequential fades. Changes are confined to the login components/CSS and browser checks; no new dependencies.
- **Acceptance / executed checks:** lint, TypeScript and production build passed. All ten desktop/phone Chromium journeys passed, covering password visibility by keyboard, value preservation, rotation order and controls, reduced motion, image loading, login errors, invitations and branch-scoped access. Screenshots captured at 1850×974, 1440×900, 1366×768 and 390×844; desktop page heights matched their viewports and all four sizes had no horizontal overflow. Wide desktop, laptop and phone screenshots were visually reviewed. Phone content scrolls vertically, with the form before the vehicle showcase.
- **Data / limits:** no database, permissions, active-booking, hosting or source-PDF changes. No claim of physical-device or Safari certification; database tests were not rerun for this presentation-only change.
- **Documentation / recovery:** architecture.md records the final presentation and transition behaviour. Revert the login page, CSS, showcase and password-field changes to restore the earlier presentation; no database rollback is needed.

## 10. Login cleanup: UI-03

- **Milestone / authority:** M1 presentation refinement explicitly requested by the user through six marked screenshots; R-24/T-24 and D-05. Remove the highlighted copy, workspace header label, footer and entire vehicle caption/control strip; enlarge the remaining headings and cars, with model names behind the imagery.
- **Implementation:** removed unused markup/styles and manual slideshow state; retained automatic HyCross → Fortuner → Hyryder rotation, sequential fades, hidden-tab handling and reduced-motion support. Model names now transition with their images. Password visibility and sign-in behaviour remain intact. No dependencies or business-rule changes.
- **Executed checks:** lint, TypeScript and optimized production build passed. All ten desktop/phone Chromium tests passed against the production server, including automatic rotation/wraparound without controls, reduced motion, image loading, preserved form values, keyboard password visibility and existing identity/access journeys. Screenshots at 1850×974, 1366×768 and 390×844 showed no horizontal overflow; desktop heights matched the viewport. Reviewed wide, phone and alternate-vehicle layouts.
- **Data / documentation / recovery:** architecture.md describes the revised presentation. Local synthetic environment only; no deployment, database migration, historical-booking impact or source-PDF changes. Database tests were not rerun for these UI changes. Revert the login presentation and corresponding browser-test changes to restore UI-02; no database rollback is required.

### UI-03 follow-up: model-name depth

- User requested the model name behind the vehicle, with partial lettering visibility. Lowered and enlarged the background names, with a phone-specific position. Transparent cars now occlude the names normally; HyCross uses an SVG body clip over its blended white-backed source to prevent text showing through the body. Original assets remain unchanged.
- Production build and lint passed; desktop/phone screenshots were reviewed. Four focused browser checks passed after fixing a reduced-motion timing race exposed by the first run: the interval callback now checks the current media preference directly before advancing. No business rules, database changes or deployment; architecture.md records the layering. Revert these presentation changes to restore the prior model-name placement.

### UI-03 follow-up: HyCross background seam

- Fixed the white frame reported by the user around the HyCross image. Replaced backdrop-dependent multiplication with a source-alpha-constrained SVG shadow filter and near-white edge removal on the clipped body. The name remains occluded by the car; original image files are unchanged.
- Lint and production build passed. All four focused desktop/phone browser checks passed. Desktop and phone screenshots were reviewed; five samples along the former frame and adjacent background matched the page's #f2f3f4 exactly. No database, account or business-rule changes; architecture.md records the final compositing approach. Revert the HyCross filter/CSS changes to restore the previous rendering.


## 11. Staff workspace redesign: UI-04

- **Milestone / authority:** M1 presentation refinement, explicitly requested by the user using the supplied sidebar/rail reference. Apply the login typography and palette to administrator and all nine operational-role workspaces, with appropriate navigation icons. R-02/R-23/R-24 and T-02/T-23/T-24 foundation slices; D-05/D-15/D-22/D-23, workflow.md §5. No business-rule decisions changed.
- **Implementation:** shared workspace shell with desktop icon rail/sidebar, native mobile navigation dialog, branch/role assignments, role descriptions, administration shortcuts and consistent loading state. Staff access has scoped summary counts, restyled invitation forms, expandable assignments/invitations and access history. Reused local Hanken Grotesk app-wide, aligned base colors, and introduced a small native SVG icon set with no new dependencies.
- **Boundaries / prerequisites:** operational entries are visibly not enabled, derived from assigned roles for presentation only. Working admin navigation requires Admin membership; existing server/database checks remain authoritative. No booking/approval screens, fake metrics, new permission grants or resolved Q items are claimed. Existing role/branch queries, command operations, stale revisions, invitation flow and audit history remain intact.
- **Executed validation:** lint, TypeScript and optimized production build passed. All 28 Chromium browser tests passed against the production server on desktop and phone: login/slideshow/password regressions; staff invitation → acceptance → password setup → deactivation; branch isolation; each of the nine operational roles' labels, disabled future tools, lack of admin links and rejected direct `/staff` access; mobile Escape/focus return and navigation closure. The initial phone admin tests exposed a test synchronization issue before the workspace loaded; the helper now waits for the signed-in heading before opening navigation.
- **Visual evidence:** captured administrator, Sales Officer, Accounts and phone workspace screens plus desktop/phone staff access. Reviewed administrator, Sales and phone layouts and the mobile drawer. Checked widths at 1850, 1440, 1366 and 390 pixels with no horizontal page overflow; verified the computed Hanken font. Phone Chromium emulation is not Safari or physical-device certification.
- **Data / documentation / recovery:** local synthetic data only. No source-PDF, schema, hosting, customer-data or historical-booking changes; no messages sent. architecture.md records components, presentation boundaries and count semantics. Database tests were not rerun because queries/commands/policies are unchanged. Restore the prior workspace/staff presentation, shared font imports and loading component to revert; no database rollback is required.

## 12. Workspace cleanup, account creation and responsive hardening: UI-05 / ACCESS-02

- **Milestone / authority:** M1 follow-up, explicitly requested by the user: remove dummy details/accounts, use Kerala Nippon Toyota locations, adapt every current role portal to different screens, and let administrators preset staff email/password. CHG-02 records the six-character initial password within the requested 4–6 range and Supabase's minimum. R-02/R-19/R-22/R-23/R-24 and foundation slices of T-02/T-19/T-22/T-23/T-24; D-05/D-15/D-22/D-23. Booking and fulfilment rules are unchanged.
- **Catalog / cleanup:** the default seed now contains 20 showroom/service location entries verified against [Nippon Toyota's public contact directory](https://www.nippontoyota.co.in/contact) on 2026-11-10, with no seeded employees or invented teams. The local cleanup refused non-demo identities and stored objects, wrote a private database dump, and removed synthetic application/Auth records. One setup administrator remains, explicitly assigned to all 20 catalog entries. Its rotated credentials are saved in ignored, mode-0600 `.local/admin-login.txt`; a personal company owner identity was not supplied. Actual operational branch/team routing remains subject to Q-03.
- **Commands / permissions:** migration `20261110000200_admin_accounts.sql` adds narrow prepared-identity completion and branch-team creation commands. Only the initiating, currently authorized branch administrator may complete a request. Auth-owned metadata and matching email identify the prepared login; application profile, scope, completion and audit commit atomically under the user JWT. Retries do not change passwords, claim unrelated accounts or reactivate access. Existing invitation links remain supported. Staff/team forms use authorized branch rows and SO/TL team choices follow the selected branch.
- **Responsive implementation:** shared min-width/wrapping fixes, constrained form controls, 16px mobile inputs, keyboard-scrollable audit history, larger menu targets and automatic drawer closure at the desktop breakpoint. The current admin and all nine operational role shells share the login typography/colors. No new operational screens or fabricated queues are implied.
- **Test isolation:** moved synthetic seed identities into `tests/fixtures/identity.sql`. Database/browser suites install them temporarily in separate branches under a suite lock and remove their records afterward. Cleanup excludes unrelated identities and memberships outside fixture branches. The persistent local administrator and public catalog survive test runs. `db:bootstrap` refuses to overwrite existing staff; that refusal path was verified.
- **Executed validation:** lint, TypeScript, two Vitest checks and the optimized production build passed. Database checks passed: 66 existing checks plus 21 account/team checks covering unauthorized callers, prepared-identity matching, concurrent completion, retries, revoked access, failure rollback, scoped team creation and password exclusion from command results. All 68 browser tests passed against the production server across desktop/phone Chromium, phone WebKit and desktop Firefox. Coverage includes all nine roles, branch isolation, admin-set account creation/login/deactivation, team filtering, password visibility, automatic vehicles, widths 320–2560, portrait/landscape, form control bounds, text/control collisions and resizing an open drawer into desktop navigation. A WebKit multi-account test was corrected to foreground the appropriate tab; the focused journey also passed three repetitions.
- **Visual evidence:** reviewed the real setup administrator's 320px account form and the 1440px WebKit login, including the HyCross transparency/name layering. Owner branch selectors contain all 20 authorized catalog entries. Additional owner screenshots at 320, 390, 768, 1024 and 1850 pixels showed no horizontal page overflow. Documentation links/code fences passed; both original source PDF checksums still match workflow.md.
- **Final workspace verification:** after both suites cleaned up, PostgreSQL contained one Auth identity, one staff profile, 20 branches, zero teams, zero account requests, zero application audit events and zero `@example.test` accounts. The setup administrator login was verified again.
- **Data / recovery / limits:** private pre-cleanup database backup is retained in `.local/backups`; no document objects existed. Backup restore/reconciliation has not been tested. Reverting UI code does not undo account or catalog changes; inspect the dump in a separate local recovery database before any deliberate restore and account for newer work. No hosting, deployment, live customer import or external messages. Browser emulation is not physical-device certification. Q-01/Q-02/Q-03/Q-05/Q-11 and downstream workflow/hosting/pilot prerequisites retain their scope; Q-17 is only partially resolved by this onboarding change.

### UI-05 follow-up: punctuation cleanup

- User requested removal of all UI em dashes. Branch location types now use parentheses in the seed and all 20 existing local catalog records. Empty revision/reason history cells use `Not recorded`. Branch IDs, memberships and historical records are unchanged.
- Source scan found no em dashes or encoded equivalents in UI source/assets, seed labels or email templates. ESLint and the production build passed. Browser inspection found no em dashes on seven public/authenticated pages and confirmed all 20 admin branch options use parentheses. Restarted the local production server with the updated build. No new workflow rules, permissions or deployment.

### UI-05 follow-up: assignment section navigation

- User reported inaccessible assignment navigation and supplied a URL with a duplicated assignment fragment. Replaced fragment-bearing framework links in the shared rail/sidebar and workspace/admin shortcuts with native anchors. Section destinations accept programmatic focus. A shared client effect focuses and scrolls to the target after streamed content mounts and when the fragment changes; this also addresses cross-page fragment destinations that initially arrive before their content.
- Added a regression journey for a malformed starting fragment, repeated keyboard activation, the access rail, all admin section links, mobile drawer closure, cross-page section navigation and browser back/forward. All 40 navigation and nine-role browser checks passed across desktop/phone Chromium, phone WebKit and Firefox. ESLint and production build passed; the local server runs the updated build. Temporary test records were removed. No schema, account, permission or business-rule changes.


## 13. Sales booking milestone: M2-01 (in progress)

- **Outcome / authority:** implement the SO booking list, file preparation, TL → SM review and BO receipt authorized by “ok lets build the same.” D-25 confirms separate booking-customer and registered-owner identities. CHG-03 records the remaining proposals and prerequisites.
- **Requirements / evidence:** R-01–R-07/R-16/R-19/R-20/R-22/R-24; D-13/D-14/D-15/D-19/D-20/D-25; source PDF page 5 reviewed visually, and blank reconstructed customer-file fields inspected without copying filled customer content.
- **Dependencies:** Q-01 mandatory fields/duplicates/cardinality, Q-02 documents/signers, Q-03 unconfirmed operational scope, Q-05 allocation and handoff, Q-11 amendments. No approval bypass for an unanswered gate. Continue independent implementation while collecting answers.
- **Data / recovery:** preserve existing staff, teams and branch assignments. No database reset or live data import. Record migrations, tests, limitations and recovery after implementation.

### M2-01 preparation status

- Drafted the reusable booking-customer/registered-owner editor with separate inputs and an explicit same-person checkbox, unchecked by default. Toggling the checkbox hides/disables the registered-owner fields without destroying their entered values. This component is not connected to a route or persistence yet; no new SO booking action is claimed.
- The user selected “I’ll specify different rules” for the proposed required-field and duplicate rules. The replacement rules, vehicle cardinality, document/signature gates and allocation/BO handoff details are still awaited through the pending questions. Dependent booking schema, validation and approval commands have not been implemented against the rejected proposal.
- ESLint and TypeScript checks passed for the preparation. Both original PDF checksums still match the recorded values. Existing staff, user-created teams, branches and the running application were not changed by this preparation.

## 14. Kalamassery role acceptance check: QA-01

- **Authority / scope:** CHG-04, user's explicit request to create and retain one `test<role, branch>` account per role and test the intended workflow. Covers the Kalamassery showroom/service branch, ten roles, and one dedicated SO/TL test team. Existing staff and teams were preserved. This is a local synthetic check, not a pilot approval.
- **Executed:** `node --env-file=.env.local scripts/check-kalamassery-roles.mjs` (also available as `npm run test:kalamassery`) and ESLint on the script. **71 checks passed, 0 failed; 8 operational workflow stages remain unimplemented.** Setup created nine operational accounts through scoped account-request/completion RPCs and a technical Admin through controlled local setup, with audit attribution.
- **What passed:** every role signed in/out on desktop (1440×900) and phone (390×844) Chromium; showed its correct role/branch; navigated to its assignment; closed mobile navigation; had no horizontal page overflow; and respected `/staff` access. Direct API checks confirmed exactly one active Kalamassery membership per test identity, other-branch filtering, denied direct role escalation, denied unauthorized team commands and fail-closed document storage. SO/TL share only the dedicated test team. The Admin branch selector contains only Kalamassery and shows all ten test accounts. An existing SO session lost scope when deactivated; its assignment was then restored through the Admin command.
- **Meaning of pass:** these are identity/access/navigation checks. Confirming a disabled menu or denied upload does not mean the corresponding business function works. No booking was created, no document was handed over and no business approval was recorded.

| Role | Verified working | Operational features not implemented |
|---|---|---|
| Admin | Scoped staff page, test-team/account provisioning, deactivation/reactivation and audit | Checklist configuration/publication |
| SO | Login, own branch/team and navigation | Booking creation/list, document uploads, amendments, accessory bills |
| TL | Login, team assignment and restricted admin access | Team booking review, approval and return |
| SM | Login, branch assignment and restricted admin access | Allocation, booking approval, amendments |
| BO | Login, branch assignment and restricted admin access | Approved-file receipt, preparation/PDI, handoffs, registration |
| Insurance | Login, branch assignment and restricted admin access | Insurance verification, policy evidence and return to BO |
| Accounts | Login, branch assignment and restricted admin access | Invoice/tax, FASTag, bill verification, closure and archive |
| Cashier | Login, branch assignment and restricted admin access | Collections, accessory receipts and FASTag handover |
| Accessories | Login, branch assignment and restricted admin access | Preparation, partial-work tracking, bills and signatures |
| Security | Login, branch assignment and restricted admin access | Gate pass, file receipt and return to Accounts |

**Intended workflow availability:** SO file preparation; SO → TL; TL → SM; approved file → BO receipt; BO → Insurance → BO; Accounts/Cashier/registration; Accessories → SO → BO → Accounts; and Accounts → Security → Accounts archive were all classified **not implemented**. Observed evidence: the public schema contains only `branches`, `teams`, `staff`, `memberships`, `staff_invitations` and `audit_events`; role business menus remain disabled. Ordering, evidence gates and physical custody could not be exercised, and no bypass or fabricated handover was introduced.

**Retained database state:** ten new active test identities with ten Kalamassery memberships; one new test team; nine completed account requests; 22 attributed setup/test audit events (including SO deactivation/reactivation). Total staff: 12; total teams: 2; stored document objects: 0. The two earlier staff accounts and their existing team remain. Accounts are named `test<Admin, Kalamassery>`, `test<SO, Kalamassery>`, `test<TL, Kalamassery>`, `test<SM, Kalamassery>`, `test<BO, Kalamassery>`, `test<Insurance, Kalamassery>`, `test<Accounts, Kalamassery>`, `test<Cashier, Kalamassery>`, `test<Accessories, Kalamassery>` and `test<Security, Kalamassery>`.

**Artifacts / limits:** ignored `.local/kalamassery-role-check/results.json` holds per-check results and per-role unavailable tools; the same directory holds 20 screenshots. The Accessories phone screenshot was visually reviewed for long-name wrapping. Six-character test passwords are in ignored mode-0600 `.local/kalamassery-test-logins.txt` and `.local/kalamassery-test-accounts.json`, not in source or this report. No full operational journey, physical-device certification, database restore, hosted publication or live-customer handling is claimed. M2 remains dependent on the pending business inputs listed in CHG-03.


## 15. SO booking form and section ownership: M2-02

- **Authority / scope:** CHG-05, the user requested the first part of the printed customer file as an SO booking form and confirmed the departmental section split. R-01/R-02/R-19/R-20/R-22/R-24 foundation slices; D-13/D-14/D-15/D-19/D-25; SRC-S01–SRC-S06. Reviewed the blank file's four pages and the workflow PDF including its page-5 drawing. The ownership map is in workflow.md §10.
- **Delivered:** SO can create, list, search, reopen and edit the printed header and Booking Details as a draft, preserving both suffix and colour preferences. TL reads team drafts and SM reads branch drafts. The form uses the existing sidebar, typography and responsive controls. Saved text/select choices have stable accessible labels. An incomplete draft is permitted; the user must confirm it represents an existing confirmed booking.
- **Database boundary:** forward migration `20261110000300_booking_drafts.sql` adds bounded draft snapshots, immutable save versions and a scoped save command. Each save atomically records data, version, audit and retry outcome. Invalid section keys, unauthorized callers, altered retries and stale revisions are rejected. No direct application writes or service-role customer reads are granted. Generated types were refreshed from the local database. Existing accounts, assignments and teams were retained without a reset.
- **Executed checks:** ESLint, TypeScript/optimized production build and both Vitest checks passed. Database suite passed **136 checks** (66 foundation, 21 account/team, 49 draft checks), including scope isolation, revocation with existing sessions, concurrent retry/revision races, immutable history and injected audit failure rollback. The initial 80-test browser regression passed 76 checks and exposed field-label failures in the four new SO journeys. After fixing those labels and scoping the stale-save assertion to the form rather than Next's separate route announcer, **all eight focused booking browser tests passed** across desktop/phone Chromium, phone WebKit and desktop Firefox. These cover saving/reopening, both suffix/colour choices, stale edits, search, TL read-only access, non-Sales route denial and form bounds at 320/390/768/1440 pixels.
- **Retained Kalamassery evidence:** one synthetic draft, `TEST-KAL-SO-001`, named `Kalamassery test booking`, was created through the persistent test SO's actual form and retained with its version/audit. Its TL can read but cannot edit; BO is redirected away from the unapproved draft. Reviewed desktop and 320px phone screenshots; 1440/390/320px checks found no page overflow. The existing ten test-role accounts remain. Private screenshots and the retained file URL are under ignored `.local/`; no credentials are included in source or this report.
- **Availability / remaining inputs:** the first SO form works. Registration, finance/hypothecation, departmental financial/checklist editors, uploads, submission, TL/SM approval and handover are not implemented in this slice. The confirmed handoff is SO preparation → TL approval → SM approval → TL sends to BO. Required submission fields/duplicates, mandatory evidence/signatures, allocation timing, receipt scope and amendment impacts retain their unresolved Q-01/Q-02/Q-03/Q-05/Q-11 dependencies. The Kalamassery checker now reports draft preparation as partial when the draft tables exist, while identifying the missing workflow stages; its earlier QA-01 result remains historical evidence.
- **Recovery / limits:** both original PDF checksums remain unchanged. All work uses local synthetic records; no deployment, production readiness, physical-device certification or completed operational handover is claimed. Keep saved drafts and history if reverting the UI; disable the routes and use a compatible forward migration to repair schema rather than resetting the database. Temporary test fixtures were removed after validation.

## 16. Global customer identity: M2-03

- **Authority / requirements:** CHG-06 / D-26, explicit user confirmation that Customer ID uniquely identifies the customer system-wide while order IDs can repeat across branches. R-01/R-02/R-16/R-19/R-22, T-01/T-02/T-16/T-19/T-22. Q-01 is resolved only for this identity distinction; requiredness, case/format rules, other duplicate handling and within-branch order uniqueness remain open.
- **Delivered:** global `customers.customer_id` primary key, indexed booking foreign key and atomic linkage through the existing save transaction. Customer ID is foregrounded in the form, list, accessible file-link label and detail header; exact Customer ID is the default search, with an explicit customer-name option. Bookings keep independent internal UUIDs and scoped snapshots. No uniqueness constraint mistakes a customer for a single booking or makes order numbers globally unique.
- **Existing-data treatment:** migration `20261110000400_customer_identity.sql` links existing nonblank customer codes without changing source snapshots, revisions or history. Blank drafts remain blank, with no manufactured IDs. ID corrections remain attributed draft saves and do not rekey other files. Existing staff, teams and the retained Kalamassery draft are preserved. Test cleanup removes only newly created, unreferenced fixture identities, preserving pre-existing customers and identifiers still referenced by non-fixture files/history.
- **Executed validation:** 152 database checks passed (66 foundation, 21 account/team, 65 booking/customer checks). Added coverage proves one global identity under concurrent branch saves, repeated order numbers across branches, leading-zero preservation, scoped customer lookup/search, no cross-file detail overwrite, correction history and atomic customer rollback when audit fails. Anonymous/service/direct customer writes and unrelated-role reads are denied. All eight booking browser tests passed across desktop/phone Chromium, phone WebKit and Firefox, including Customer ID and name search. Lint and TypeScript/production build passed. Search/list controls fit at 320/390/768/1440px; reviewed the 320px screenshot.
- **Limits / recovery:** local synthetic change only, no new submission/approval/handover gate and no live customer import. Source PDFs remain untouched. The new migration is additive; revert presentation separately and retain linked customer/file history. Use a forward fix rather than resetting the database. Case-insensitive matching, merging identities and branch transfer are not inferred from the global identifier decision.

## 17. Registration reuse and searchable dropdowns: M2-04 / UI-06

- **Authority / scope:** CHG-07, user's explicit request to replace the acknowledgment checkbox with a same-registration-details choice and make available role-form options searchable. R-01/R-02/R-12/R-19/R-22/R-23/R-24 foundation slices; D-13/D-25/D-26. Reviewed blank-file page 1's Booking Details and Registration sections. All other section ownership and unknown gates retain their scope.
- **Delivered:** explicit registration choice with six matching fields (name, address, PIN, model, first suffix and first colour); live copies while checked; separate owner entry when unchecked; unsaved separate values retained through toggling; saved values/version history on reopening. Existing confirmed-booking scope is stated by the form rather than a redundant checkbox. BO verification is not implied. New draft saves use form version 2; existing version-1 snapshots are preserved.
- **Searchable forms:** one shared combobox replaces current select controls for Sales scope, GST billing, registration type, booking search mode, Admin branch/role/team and team creation. Model, suffix, colours, interior colour and paper TL-name fields offer searchable suggestions with manual entry. Thirteen models use Nippon Toyota's published range; HyCross/Crysta colour provenance is in architecture.md. Prior-value suggestions come only from the latest 500 visible files; internal suffix codes and unavailable departmental choices are not invented. Required ID/role choices remain constrained and authorized server-side.
- **Database validation:** 157 checks passed (66 foundation, 21 account/team, 70 booking/customer). The added checks cover v2 registration snapshots, rejecting forged same-details values and unknown flags, separate-owner changes preserving earlier history, and continued BO exclusion before handoff. One test expectation was corrected because adding a second same-customer fixture legitimately creates two SO-visible files; it now checks both exact permitted IDs and excludes the other branch.
- **Browser validation:** 79 of the 84 regression tests passed before the runner was terminated (exit 143), with no assertion failure. Removed only the abandoned fixture data using the existing scoped cleanup logic, then ran the five remaining Firefox role checks separately. All five remaining checks passed, giving 84 distinct passing browser checks across the two runs. Registration reuse/separate-owner persistence, model keyboard selection, scoped Customer ID/name search, stale saves, Admin account creation/deactivation, branch/role/team choices and navigation passed in desktop/phone Chromium, phone WebKit and desktop Firefox. TypeScript, ESLint, production build and both Vitest tests passed.
- **Visual / device checks:** reviewed desktop registration and the expanded 320px model dropdown. Form widths 320/390/768/1440px had no page overflow; the dropdown stayed within the phone width and touch selection worked. Existing all-role responsive checks continue to cover wider screens and orientation changes. Browser emulation does not certify every physical device.
- **Limits / recovery:** this implements common registration fields, not PAN/mobile/RTO completion, BO verification or departmental handoff. No live data, messages or deployment. Retain v1/v2 history and use forward corrections rather than a reset. The previous persistent Kalamassery test booking and accounts remain; source PDFs were not altered.


## 18. Registered-owner documents and first digital handoff: M2-05

- **Authority / prerequisites:** CHG-08, exact user confirmations for both owner documents and required Booking Details fields. R-01/R-02/R-03/R-04/R-06/R-16/R-19/R-22/R-23/R-24 partial scope; D-07/D-14/D-15/D-19/D-25/D-26 and SRC-S01/SRC-S02/SRC-S03/SRC-16/SRC-18/SRC-19. Unresolved signatures, allocation, live departmental scopes, amendments and hosting still block their dependent actions.
- **Delivered:** PDF/JPEG upload controls on saved SO files, private versioned registered-owner Aadhaar/PAN, bounded body/type/hash verification and attested finalization, retryable pending uploads, authorized attachment downloads, exact required-field/document gates, atomic frozen SO-to-TL submission and attributed TL receipt. Desktop/mobile file sections use the existing visual system. Submitted SO files are read-only; list/detail show “With TL.” No signature, approval, original custody or BO receipt is fabricated.
- **Existing data / recovery:** additive migrations preserve all staff, branches, existing drafts and history. Incomplete drafts can still save but must meet CHG-08 on first send. Retain document objects and metadata; application rollback is not database restore. Temporary test cleanup removes only fixture-branch objects via Storage API and fixture-owned records. Production restore/retention/malware scanning remain outside this local slice.
- **Executed validation:** `npm run check` passed ESLint, TypeScript, all three Vitest checks and production build. `npm run test:db` passed 221 checks: 66 foundation, 21 account/team, 70 draft/customer and 64 new document/handoff checks. These exercise scope/revocation, immutable storage, forged finalization, missing objects, stale revisions, transactional rollback, required fields individually, wrong-owner copies, one-document blocking, concurrent send retry, exact bundle IDs, attributed receipt and no BO access before approval.
- **Browser results:** all 16 booking/draft/document tests passed across desktop/phone Chromium, phone WebKit and desktop Firefox. After adding named receipt evidence, all four document journeys passed again. Four SO workspace/navigation tests also passed after removing the obsolete locked document entry, for 20 distinct passing browser checks. Upload routes rejected fake PDF bytes and foreign origins; authorized downloads retained exact bytes and no-store attachment headers; anonymous downloads failed. Browser tests covered SO send lock, separate registered owner, TL download/receipt, stale draft saves and registration reuse.
- **Responsive / limits:** document-form bounds checked at 320/390/768/1440px; SO shell checked at 13 widths from 320 to 2560px in Chromium, with mobile navigation checks in all projects. No overflow was observed in those checks. Browser emulation is not a claim about every physical device. Initial browser failures identified a route-announcer locator ambiguity and a localhost/127.0.0.1 origin mismatch; corrected the locator and explicit configured local-origin handling, then reran successfully. The old storage test fixture was updated from text/plain to permitted synthetic PDF. Existing booking write denial correctly uses `22023` for a non-draft transition; its test expectation was corrected.
- **Retained state:** temporary fixtures and their storage objects were removed after tests. Existing Kalamassery accounts/draft were preserved; source PDF checksums match the recorded baseline. No deployment, live upload, staff message, production readiness or completed TL/SM approval is claimed.
