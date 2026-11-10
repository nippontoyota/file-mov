# Agent instructions

## Purpose and current scope

This project digitizes Nippon Toyota's sales booking and fulfilment file movement. The primary source is [Sales Booking & Fulfilment Workflow Digitization.pdf](Sales%20Booking%20%26%20Fulfilment%20Workflow%20Digitization.pdf), Version 1.0, 6 November 2026. Its page-5 diagram contains requirements that PDF text extraction misses.

The user requested “implement the plan” on 2026-11-10 (CHG-01). Local synthetic application implementation is authorized; M1 is implemented. Continue milestones only as their named prerequisites are resolved. This does not authorize hosted infrastructure, live customer data, deployment, or guessed business rules. Do not repeatedly ask to perform already authorized work.

## Reading order and ownership

1. [decisions.md](decisions.md): confirmed decisions, defaults, open questions, and authority.
2. [prd.md](prd.md): product requirements and acceptance criteria.
3. [workflow.md](workflow.md): source inventory, actors, documents, handoffs, and dependencies.
4. [architecture.md](architecture.md): technical boundaries, data, security, and operations.
5. [implementation-plan.md](implementation-plan.md): milestone dependencies and required tests.

Read the relevant PDF page when resolving a source detail, especially page 5. Preserve its bytes; the expected checksum is in workflow.md. Add new evidence with provenance rather than overwriting the source PDF.

## Requirements and conflicts

- Direct user instructions and explicit user decisions govern the work. The PDF remains the baseline for requirements not explicitly changed. The decision register records exceptions only for their named scope.
- Treat **confirmed**, **default**, and **open** as different statuses. Never report an engineering default as a fact stated in the PDF or a departmental validation.
- When evidence conflicts with an agreed business rule, show the conflicting sources, affected requirements, options, and recommendation to the user. The user is the final business decision owner (D-21). Do not silently choose a different approver, drop a document, change a gate, or introduce a bypass.
- A Q identifier blocks only the work listed for it. Continue independent authorized work. Ask for missing business facts when needed; do not guess mandatory fields, signatures, statutory requirements, or active-booking migration rules.
- Routine refactors, tests, implementation fixes, and document corrections within an agreed rule do not require renewed permission. Hosting constraints and the user's control of business-rule changes are real prerequisites, not a general approval requirement for coding.
- Record approved changes in decisions.md using its template, update affected requirements/workflow/architecture/tests, and retain superseded decisions. Identify consequences for bookings already in progress.

## Business invariants

- V1 begins at confirmed booking. Enquiries remain in external systems with recorded references.
- TL approval precedes SM approval; both are required before BO receives approved work.
- Insurance precedes invoicing. Accounts processes FASTag; Cashier handles the approved collection/handover action.
- Preserve the full Accessories flow: partial work, Cashier collection, bills, profit/loss and required signature, SO → BO → Accounts, and closure.
- Preserve Accounts → Security → Accounts and final archive receipt. Gate pass, actual delivery, financial closure, and archive are separate facts.
- Track physical originals independently of digital task ownership. Digital handoff never fabricates a physical transfer or signature.
- Pending amendments do not overwrite approved values. SM approval applies a change with the agreed downstream impact treatment.
- Only the user's designated account can grant eligible pilot exceptions. Technical admin and SM roles do not inherit this authority. Unknown gates cannot be overridden.
- New checklist/routing rules must not rewrite historical approvals or active-booking requirements. Use versioned configuration and explicit, reviewed migration where needed.
- Existing external systems produce their official results. No unrequested API integration, form generation, payment execution, or legal-validity claim.

## Engineering defaults

Use Next.js, TypeScript, and Supabase in one application. Keep internal modules clear and dependencies limited. Use SQL migrations and generated types as documented; do not add another ORM or separate backend by habit. Select and pin compatible stable versions during scaffolding, not by guessing from an old example.

Enforce access and transition rules at the server/database boundary. Test PostgreSQL command functions directly, including unauthorized callers. Core commands must atomically update state, history, and next work; reject stale revisions and deduplicate retries. Follow the architecture's RLS, sensitive-field separation, restricted command privileges, and private-storage design.

Use individual staff identities. Never use service credentials for routine user actions or expose them in browser code. Do not grant broad data access because it makes a UI query easier. Private files need authorization; finalized document versions must not be overwritten.

Use synthetic customer data for development, tests, previews, and screenshots. Keep production customer documents, credentials, bank details, and signed forms out of source control, logs, AI prompts, and public artifacts. An approved live-data task still needs the confirmed access/hosting/retention rules for its scope.

## Work and validation procedure

1. Inspect the current workspace and any existing changes. Use the verified application commands in architecture.md §10 and record actual results; do not report planned scenarios as executed checks.
2. Identify the milestone, R IDs, source/decision IDs, and prerequisite Q items. Use implementation-plan.md's task template for substantial work.
3. Make the smallest complete change that satisfies the agreed acceptance criteria. Do not simplify away signatures, approvals, partial work, security, failure handling, or audit history.
4. Run checks appropriate to the change. For logic/security/workflow changes, include the relevant T scenarios. Verify unauthorized and failure paths, not only successful screens. For documentation changes, check links, IDs, source coverage, and consistency.
5. Report what changed, what was actually checked, and remaining blockers. Planned scenarios are not executed results. Do not claim production readiness from a local test or scaffold.
6. Keep documentation aligned with the final behaviour. Do not erase open questions merely because a screen has been built around an assumption.

## Operational boundaries

Company hosting/data-location approval and budget are unresolved (Q-04/D-09). Use local synthetic work until the relevant hosting decision is recorded; no live customer data in unapproved hosted environments.

Backup database records and file objects separately, with a tested restore/reconciliation procedure. Treat a deployment rollback and a database restore as different operations; restoring old data can discard valid intervening work. Do not perform destructive production operations without explicit authorization for the concrete action and its recovery plan.

Do not send messages to staff or external parties unless the user explicitly requests it. Preparing interview questions, change proposals, and runbooks is authorized documentation work; contacting people is a separate action.

Do not create extra policy/specification files that duplicate these six documents. Add a file only when the task needs a distinct maintained artifact, and link it from the relevant owner document.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
