# Architecture: Sales booking and fulfilment V1

Documentation baseline: 2026-11-10. **M1 local foundation implemented under CHG-01/CHG-02. M2 drafts, registered-owner uploads and first SO-to-TL submission/receipt are implemented through CHG-08; later approvals and departmental handoffs remain incomplete.**

Business behaviour comes from [PRD](prd.md) and [workflow](workflow.md). [Decisions](decisions.md) distinguishes confirmed choices from defaults and unresolved inputs. [Implementation plan](implementation-plan.md) defines build and release gates.

## 1. Architecture direction

Use one TypeScript application with Next.js App Router and Supabase PostgreSQL, Auth, and private Storage (D-10/A-01). Organize code around bookings, documents, workflow, and administration. Keep domain actions out of page components. Do not add a separate API server, ORM, queue service, or workflow engine without a demonstrated requirement.

The system records and coordinates external work; it does not replace Toyota or registration systems. Staff enter references and upload evidence. Preserve that boundary in UI labels and command names.

| Layer | Choice / responsibility | Status |
|---|---|---|
| Staff interface | Responsive Next.js App Router application; React, TypeScript strict mode; accessible HTML and CSS Modules for initial screens. | Stack confirmed; CSS Modules is a small initial default, not a requirement for a component library. |
| Server entry points | Server Actions for application mutations; Route Handlers where file delivery or an HTTP callback requires them. Validate session and inputs on each entry point. | Engineering default. No public partner API in V1. |
| Data access | Supabase JavaScript SDK, generated database types, committed SQL migrations. Read through explicit projections and RLS; mutate workflow through authorized database commands. | A-09; no Prisma/Drizzle alongside this migration path. |
| Data and transactions | PostgreSQL relations, foreign keys, uniqueness/check constraints, and transactional functions for state transitions. | Engineering default; detailed fields depend on Q-01 and departmental evidence. |
| Identity | Supabase Auth, admin-created individual email/password accounts (CHG-02). Active membership and roles live in protected application tables. | D-22; email service, roster, recovery/MFA details Q-17. |
| Files | Private Supabase Storage buckets with document-version metadata and independent backups. | D-10; allowed types/size and retention Q-02/Q-13. |
| Notifications | Persistent in-app notifications created with workflow events; work inbox queries authoritative task records. | A-04; no external operational messaging provider. |
| Tests | Vitest, Playwright, and database integration/permission tests against local Supabase. | A-10; scripts established in M1. |
| App hosting | Node.js-capable deployment; Vercel Pro is one managed candidate. | Provisional, Q-04 and D-09; see cost section. |

Use npm with a committed lockfile. At M1, select mutually compatible stable Next.js, Node.js LTS, Supabase SDK/SSR helper, TypeScript, and test versions using official documentation; record versions and commands in this document. Use stable pinned packages and record compatibility checks. See §10 for the installed versions.

### Boundaries and data flow

1. Staff authenticate with Supabase Auth through the application. The server verifies the session using the supported SSR/server verification flow for the installed SDK.
2. For reads, the server uses the user's session and explicit field projections. PostgreSQL RLS limits records; separate sensitive tables/projections limit fields. Never cache private responses across users.
3. For writes, the server parses inputs and sends a named command using the user's JWT. The database command derives the actor from authenticated identity, verifies active scope/capability and current revision, checks prerequisites, and commits the change plus history and next tasks together.
4. File uploads use a reserved document-version record and a restricted private object destination. Completion requires server verification and metadata finalization; an upload response alone cannot satisfy a workflow gate.
5. After a successful command, refresh the authorized booking/inbox view. If a request times out, retrieve its outcome or retry with the same operation identity; do not assume failure and create a second action.

## 2. Application modules and responsibility

| Module | Owns | Must not own |
|---|---|---|
| Identity and access | Staff profile, membership, capability checks, invite/deactivate workflows. | Business approvals merely because a person is an admin. |
| Bookings | Approved booking revisions, draft/proposed changes, allocation/external references. | Arbitrary customer master/CRM or accounting logic. |
| Documents | Upload lifecycle, version metadata, checklist evidence, signature/original associations, authorized downloads. | Declaring legal validity of a scan or silently changing gate state. |
| Workflow | Task prerequisites, TL/SM decisions, departmental handoffs, exceptions, versioned route transitions. | UI state as the authority for permission or completion. |
| Fulfilment | Department-specific records for Insurance, Accounts, registration, Accessories, gate pass and archive. | External issuance/payment/API integration. |
| Administration and reporting | Checklist revisions, assignments, pilot metrics, permitted audit views. | A general route designer or uncontrolled cross-branch exports. |

Do not build an abstraction for hypothetical alternative providers. Keep database/file access in a few domain-oriented modules so a later approved hosting change has known boundaries.

## 3. Conceptual data model

Names below describe concepts, not final DDL. Exact fields, requiredness, customer/vehicle cardinality, and uniqueness rules require Q-01. Normalize relationships that carry independent ownership/history; use bounded JSON only where a validated snapshot or amendment diff needs it.

| Entity group | Relationships and required meaning |
|---|---|
| Branches, teams, staff profiles, memberships | Staff profile references Auth identity. Membership ties active staff to explicit branch/team/role scopes. Preserve historical actor references after deactivation. |
| Bookings and booking revisions | Booking has stable internal ID, branch, SO/team assignment, workflow/checklist versions, current approved revision, and concurrency revision. Business fields follow approved OBF inventory. Keep assignment history. |
| Customer/vehicle information and allocations | Associate required customer/vehicle snapshots and allocation history with the booking. Use Customer ID as the global customer primary key under D-26, with a booking foreign key. Keep personal details as scoped booking snapshots; a shared identifier grants no cross-branch access. Do not assume vehicle cardinality. |
| External references and evidence | Associate system, reference type/value, recorded actor/time, and relevant booking revision/document. Formatting/uniqueness comes from approved evidence. |
| Document records and immutable versions | A logical document has versions with opaque storage key, original filename as restricted metadata, media type, size, integrity checksum, uploader, status, and evidence associations. Retain previous versions. |
| Original documents/bundles and custody events | Identify required originals or bundles; reference constituent documents, holder/location, offered and acknowledged transfers, and movement purpose. Do not infer physical custody from a task assignee. |
| Checklist definitions/revisions and booking items | Published revisions are immutable. Booking items reference their revision, applicability rule, required evidence/signature, state, and verifier. New definitions do not rewrite old instances. |
| Workflow versions, tasks, handoffs, approvals | Version identifies supported code rules. Tasks record department/person, prerequisites, revision, status, and timestamps. Approval records reference the reviewed booking/evidence revision; handoffs record offers/receipts/returns. |
| Amendments and impact/revalidation records | Amendment references base revision, proposed changes, reason, proposer, SM decision, and affected downstream tasks/documents according to Q-11. |
| Exception requests and grants | Grant identifies approved gate, booking/task/revision, reason/evidence, designated approver, and Q-12 scope/duration/revocation. Not a global bypass boolean. |
| Department work/evidence | Track Insurance verification/policy/Tally follow-up; invoice/tax/FASTag; registration; accessory requested/completed/pending items, collection, bills, profit/loss/signature; financial closure; gate pass/delivery/archive. Restrict financial/bank details separately. |
| Audit events and notifications | Append events in the same transaction as their business changes; associate affected aggregate/revision and actor. Notifications reference events/tasks and recipients; read state is separate. |
| Operation deduplication | Persist action identity, actor/target, input fingerprint, and result where mutations may be retried. Reuse with changed input fails rather than replaying the wrong action. |

Use relational constraints to prevent orphaned evidence and mismatched booking/branch relationships. A client-supplied branch ID is a filter/input, never proof of authorization. Application IDs should be opaque; the customer-facing booking-number convention awaits Q-01.

Record monetary values as exact decimals or integer minor units once fields/currencies are approved; never floating-point arithmetic. Store event instants in UTC and display Asia/Kolkata; preserve document business dates separately (A-08).

## 4. Interfaces and transaction boundaries

These are internal capabilities, not a frozen HTTP/API contract. Give each implemented capability a typed input/result and tests in its milestone. Avoid a generic `updateAnything` or unrestricted `setStatus` endpoint.

| Capability family | Input intent | Result / invariant |
|---|---|---|
| Booking create/edit/submit | Approved form data, expected revision where applicable, operation identity. | New/current revision and actionable validation errors; no silent overwrite. |
| Review/approve/return | Booking/task revision, decision, required reason/evidence. | Recorded actor decision, resulting task state, next authorized work. |
| Propose/decide amendment | Base revision, proposed changes/reason; SM decision. | Approved values change only on approval; impact/revalidation records follow Q-11. |
| Send/receive/return work | Current task, intended recipient scope, reason when returning. | Offer and receipt remain distinct; no automatic physical transfer. |
| Transfer/receive originals | Document/bundle identity, current custody revision, target holder/location. | Attributable custody events; do not overwrite an unacknowledged movement. |
| Complete departmental action | Named action, current revision, required evidence. | Prerequisites checked; external results recorded without executing external transactions. |
| Request/decide exception | Specific eligible gate/revision, reason/evidence, authorized decision. | Scoped grant or rejection, preserving the ordinary prerequisite record. |
| Reserve/finalize document version | Booking/document context, declared upload metadata; verified upload result. | Immutable finalized version or explicit failed/pending state. |
| Publish configuration / change assignment | Reviewed revision or authorized new assignment. | Audited publication/change; existing bookings retain configuration unless explicitly migrated. |

Expected errors include invalid input, unauthenticated, forbidden, stale revision, unsatisfied prerequisites, and retryable infrastructure failure. Return user-safe reasons without raw SQL, storage keys, secrets, or another booking's data.

### PostgreSQL command boundary

Core workflow writes must run in one database transaction: lock/check the relevant current revision, validate the transition and evidence, change records, insert history, create next tasks/notifications, and store a deduplicated result. A series of SDK writes without a transaction does not satisfy this requirement.

Use narrowly scoped PostgreSQL command functions for operations that require writing protected tables. Revoke routine direct writes to those tables from application roles. Because a privileged function can bypass RLS, explicitly validate authenticated actor, active membership, capability, booking scope, and row relationships inside each privileged command. Never trust caller-supplied actor IDs. Pin an empty `search_path`, qualify relation names, restrict function ownership, revoke default/public/anonymous execution, and grant only intended entry points. Prefer invoker rights for functions that do not need elevated table access. Test commands by calling them directly as hostile/unauthorized clients. These precautions follow the [Supabase database-function security guidance](https://supabase.com/docs/guides/database/functions).

Keep SQL commands as the authoritative transition enforcement. TypeScript may provide early validation and explain available actions, but UI checks cannot weaken database gates. Do not make ordinary user mutations with a service-role client.

## 5. Authentication, authorization, and audit

Use Supabase Auth for identity, not as the complete business permission model. Only an authorized administrator can create/invite staff, add branch teams or alter role assignments. Disable public registration. A deactivated membership must deny new reads/writes even if the user's token remains valid. Q-17 defines email delivery and recovery/MFA procedures before live use.

Enable RLS on application tables exposed through the Data API, with explicit read policies for approved scopes. RLS filters rows, not all sensitive columns: keep bank/profit/loss data and sensitive document metadata in separately protected relations or limited projections with no broader base-table grants. Test functions, views, joined queries, counts, and storage access as well as individual rows. Consult the [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) when implementing policies.

Derive approval powers from protected role/capability assignments. Technical administration does not grant SM approval, unrestricted customer-file reading, or pilot exception authority. Grant D-23 only to the user's verified account once Q-12 is resolved. Keep service/admin credentials server-only for narrowly required account-management or maintenance operations, with separate authorization and audit.

Audit business commands in their transaction. Record actor, timestamp, action, target/revision, reason where needed, and changed-field/evidence references. Restrict detailed before/after values by the same sensitivity as their source; avoid copying entire customer files into logs. Audit privileged role/configuration changes and authorized document access grants/download requests. Application history is append-only to application roles, not a claim of tamper-proof storage against database administrators.

Do not persist private pages in shared caches or service-worker offline storage. Return private/no-store responses for sensitive content; prevent private data from entering URLs, analytics, public error trackers, or preview deployments.

## 6. File lifecycle and storage

Use private buckets. File paths use opaque identifiers, not customer names, phone numbers, or document numbers. Storage policies must verify document/booking access and the allowed action; a path prefix alone is insufficient. Supabase Storage supports authorization through RLS policies on its object metadata. [Storage access-control documentation](https://supabase.com/docs/guides/storage/security/access-control)

1. Authorize a new upload and reserve a document-version ID plus destination. Check the applicable file type/size policy from Q-02.
2. Permit upload only to that destination in private storage, without upsert/overwrite rights on a finalized object. Uploads remain unavailable as workflow evidence while pending.
3. Verify existence, size, actual content type/file signature, and integrity checksum before finalizing. Enforce the approved content policy; do not execute uploaded content. Serve permitted previews safely and untrusted content as downloads. A filename or browser MIME label is not validation.
4. Finalize metadata and associated evidence transactionally after file checks. If the object upload succeeds but finalization fails, retain a recoverable pending record; retry or reconcile it rather than falsely completing the checklist.
5. Authorize document reads at request time. Use authenticated delivery or short-lived signed links only after authorization; do not store signed URLs as permanent document references. Record the access action. A signed link is a temporary bearer credential; expiry limits, but does not provide instant revocation of already issued links.
6. Replacement creates a new object/version. Checklist evidence references the exact verified version; replacement does not silently approve the new content. Routine users cannot delete prior evidence. Clean abandoned uploads only through a scoped maintenance procedure and approved retention policy.

Object storage and PostgreSQL do not share a transaction. The pending/finalized lifecycle and reconciliation procedure are required to handle their partial failures. Test interrupted uploads, duplicate finalize calls, stale signed access, prohibited content, and orphan cleanup with synthetic files.

## 7. Workflow evolution

Store workflow-version identifiers and checklist revisions on bookings. Support all versions still used by active bookings when releasing routing changes. A version identifier with no corresponding executable rules is not version support.

Checklist edits create a draft, then a new published revision. Existing booking items retain their revision. Assignment changes alter current ownership/access with history; they do not rewrite old approval actors or automatically move physical originals.

For a migration, list affected bookings and their states, old/new rules, evidence differences, approvals needing revalidation, and rollback/reconciliation strategy. Preview the impact before applying it. The user must approve a business-rule change and any migration that changes active bookings. An engineering bug fix within an approved rule can proceed with tests and a documented impact assessment.

An approved amendment changes the booking revision, not historical evidence. Its impact matrix determines which tasks are stale, require rework, or remain valid. Block implementation of that matrix until Q-11 is resolved; do not assume all prior approvals survive or that every change restarts the entire process.

## 8. Deployment, costs, and operating setup

### Environment defaults

- **Local development:** local Next.js and local Supabase with synthetic fixtures. Use Docker-backed Supabase tooling when available; document prerequisites in M1.
- **Test/staging:** separate database/auth/storage and credentials from production. Use synthetic data. Verify migrations and full role journeys here before live releases.
- **Production:** approved provider/region and company-owned accounts, restricted access, known billing owner, verified backups, and named operator. Q-04 blocks provisioning/live data until confirmed.

At M1 create environment examples with placeholders, a lockfile, migration/reset/seed/type-generation instructions, and scripts for lint, type checking, unit tests, database tests, browser tests, and production build. Record actual commands after they work; §10 records the M1 commands and setup. No credentials in Git or documentation.

Next.js can run on a Node.js server or in a Docker container, so the framework does not commit the company to Vercel. Self-hosting transfers patching, monitoring, TLS, and operational work to the maintainer. [Next.js self-hosting guidance](https://nextjs.org/docs/app/guides/self-hosting)

### Reference costs, checked 2026-11-10

| Candidate | Current advertised starting point | Planning consequence |
|---|---|---|
| Local synthetic development | No managed hosting subscription required; local compute/tool prerequisites still apply. | Suitable while company hosting approval is pending. |
| Supabase Pro | From US$25/month; pricing lists one included project, 8 GB database disk, 100 GB file storage, and seven days of daily database backups. Additional projects start at US$10/month. | Useful managed candidate; usage, compute, staging, and backup needs can change the bill. [Supabase pricing](https://supabase.com/pricing) |
| Vercel Pro | Advertised US$20/month starting price; usage and team configuration can add charges. | Candidate for the Next.js application. [Vercel pricing](https://vercel.com/pricing) |
| Combined starting subscriptions | Approximately US$45/month for the two starting plans, before tax and additions. | Reference only, not an approved all-inclusive operating budget. |

Vercel Hobby is limited to non-commercial personal use, so do not budget the company pilot on that plan. [Vercel Hobby documentation](https://vercel.com/docs/plans/hobby)

The final budget must also account for staging, an independent document backup destination, transactional invitation/recovery email, domain, monitoring, tax/currency conversion, and extra usage. Estimate monthly file growth as bookings × average files/booking × average size, then include retained versions, existing files, and backup copies. Obtain inputs under Q-16 before presenting a capacity forecast. Supabase's spend cap covers selected usage items, not every possible charge. [Cost-control documentation](https://supabase.com/docs/guides/platform/cost-control)

Supabase lists Mumbai as a selectable project region. Treat this as one data-location option, not proof of company or regulatory approval; evaluate app processing, logs, backups, email, and other subprocessors as well. [Region documentation](https://supabase.com/docs/guides/platform/regions)

### Backups and recovery

Supabase database backups do **not** include Storage API objects, only their metadata. The Pro daily-backup retention does not solve document recovery or a stricter recovery-point target. [Database backup documentation](https://supabase.com/docs/guides/platform/backups)

Maintain database recovery plus an approved, independent file-object backup and manifest of object keys, versions, checksums, and timestamps. Set frequency/retention and destination under Q-04/Q-13/Q-16. Restore into an isolated environment, verify object checksums against restored metadata, identify any gap between database and file recovery points, and reconcile missing/pending objects before reopening writes. Include Auth/configuration and credential restoration steps for the chosen provider setup. Do not count an untested backup as recovery readiness.

Observe error rates, failed/aged uploads, command conflicts, pending handoffs, missing evidence, backup success/age, storage growth, and billing usage. Record thresholds and who responds when Q-15/Q-16 settle pilot operating expectations. Keep business audit separate from short-lived diagnostic logs.

## 9. Engineering acceptance and remaining gates

The build must demonstrate authorization and direct-database-command tests, upload failure recovery, transactional approval/amendment tests, version-preservation tests, and one full browser journey through Accounts archive. See T-01–T-24 in implementation-plan.md.

Open business inputs do not justify speculative schemas or placeholder bypasses. In particular, Q-01/Q-02/Q-03/Q-05/Q-11/Q-12 gate the corresponding Sales behaviours; Q-06–Q-10 gate downstream predicates. Q-04/Q-13/Q-15–Q-18 gate production and pilot readiness. Work that only requires synthetic data and settled rules can continue while later questions are resolved.

The default stack is intentionally sufficient for the agreed V1. Add real-time subscriptions, background workers, external messaging, separate APIs, or new providers only when a measured need or approved requirement warrants their operational cost.

## 10. Executable M1 foundation (2026-11-10)

### Versions and local runtime

The npm registry and official [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), and [CLI runtime](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes) documentation informed these pins. package-lock.json records the dependency graph.

| Package | Pinned version |
|---|---|
| Node.js | 22.22.1 (.nvmrc; installed LTS runtime) |
| Next.js / React / React DOM | 16.4.6 / 19.3.1 / 19.3.1 |
| TypeScript | 6.0.3 |
| Supabase JS / SSR / CLI | 2.119.0 / 0.12.7 / 3.1.0 |
| ESLint / eslint-config-next | 9.39.5 / 16.4.6 |
| Vitest / Playwright | 5.1.0 / 1.65.0 |

ESLint 9 is the compatible major for the installed Next lint plugins; npm marks it out of support. Upgrade with a compatible Next lint configuration. TypeScript 7 exceeds those plugins' supported range, so use TypeScript 6. A narrow minimatch 11.0.1 override for typescript-estree removes GHSA-g3hv-75wg-m249; lint and type checks cover compatibility. The final npm audit reports zero known vulnerabilities.

This machine has no Docker. The stable CLI's **experimental native stack runtime** runs local PostgreSQL 17, Auth, REST, private Storage, and Mailpit. supabase/supabase.lock pins service artifacts. Native runtime is a local development choice, not a hosting decision. Docker remains an alternative for a new local stack; the CLI cannot switch an existing stack's runtime in place. No hosted resource was created.

### Local setup and commands

Run from this project directory with Node 22.22.1, npm, tar, and network access for the first dependency/service downloads. The native runtime needs Linux with glibc 2.35+ or a supported Apple-silicon macOS host. Use a non-root user.

```sh
npm ci
npm run db:start -- --runtime native --eager
npm run db:env
npm run db:types
npm run db:bootstrap  # once, only when no staff exist
npm run dev
```

Open http://127.0.0.1:3000. `db:env` creates an ignored, mode-0600 .env.local from local CLI status; it preserves an existing file. .env.example contains placeholders only. Use the same host as APP_ORIGIN for invitation confirmation. Generated database types come from the applied migrations, not a handwritten interface.

The default seed contains the 20 location names/types published in [Nippon Toyota's contact directory](https://www.nippontoyota.co.in/contact), checked on 2026-11-10. Location types appear in parentheses, for example `Kalamassery (Showroom & Service Centre)`. UI copy uses no em dashes; empty history values read `Not recorded`. It contains no users or teams. `db:bootstrap` creates one local setup administrator only when there are no staff, explicitly assigns it to the catalog branches, and saves its generated login in ignored, mode-0600 `.local/admin-login.txt`. It never replaces an existing account. Ordinary staff accounts are created in `/staff`; administrators set their email, six-character initial password and authorized scope. Add actual team names before assigning SO/TL staff.

```sh
npm run check           # lint, TypeScript, Vitest, production build
npm run test:db         # requires .env.local and running local Supabase
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e        # Chromium, Firefox and phone WebKit; starts a local app when needed
npm run db:stop
```

`npm run db:reset -- --yes` destroys the **entire local workspace database**, including any staff setup, and reloads only the public branch catalog. It is not a routine cleanup command; use it only for an explicitly disposable local database. It does not restore real work, back up Storage objects, or authorize a hosted reset. Run `npm run db:types` after schema changes. The tests reject non-loopback database/API addresses. Database/browser suites create temporary, separately identified fixture users/branches via `scripts/test-fixtures.mjs` and remove their records on teardown, including failed tests. Suites use a local advisory lock to prevent concurrent fixture runs and refuse existing fixture IDs/emails. Test artifacts stay ignored; a forcibly killed process can require inspection of leftover fixture records before another run. The GitHub Actions workflow describes the same checks; no remote workflow execution is claimed.

### Implemented boundaries

- `src/modules/identity` owns user-session checks and staff commands. Every protected page/action verifies Auth identity and active database scopes. Proxy refreshes SSR cookies; it is not the authorization boundary. Private responses use no-store.
- `supabase/migrations/20261110000100_foundation.sql` defines branches, teams, staff, memberships, pending invitations, audit history, and private operation results. It deliberately contains no customer/booking schema.
- The non-login command owner owns protected application tables and narrow RPCs. API roles cannot become that owner. It inherits the authenticated role's schema usage because Supabase bootstrap reasserts Auth schema permissions. A separate, migration-owner scalar function reads only the current verified account email from Auth; API roles cannot execute it or read Auth tables through it.
- Commands derive the actor from the JWT, check scope, reject stale revisions, and store state/history/results in one transaction. Operation IDs deduplicate concurrent retries and reject changed payloads. Routine direct writes and audit edits/deletes fail.
- RLS limits memberships, branches, teams, invitations and access history. Staff can read their own profile; scoped branch admins can read names for staff with assignments in their branch. No general customer-document permission follows from Admin, SM, or Security. Q-03 still blocks the operational matrix.
- Administrators save an invitation under their own JWT. A separately authorized, server-only Auth client prepares its single-use link. The application sends no invitation email. Failed Auth link preparation leaves a pending invitation with no staff access; existing accounts can sign in and accept the invitation ID at `/no-access`. Acceptance rechecks the verified email, issuer's active authority, expiry, and existing assignments. It never reactivates a revoked assignment.
- Deactivation affects the selected membership, including an existing JWT. Other explicit memberships remain active. Global staff deactivation and initial administrator assignment remain controlled database maintenance. Admins cannot change their own or another Admin assignment through routine commands.
- `/recover`, `/auth/confirm`, and `/password` support password recovery and invitation acceptance. GET requests show an interstitial so link scanners do not consume tokens. POST confirmation checks the configured origin. The local recovery template delivers only to Mailpit at http://127.0.0.1:54324; live mail/recovery policy remains Q-17.
- M1 baseline: `booking-documents` denied routine application operations. CHG-08 now adds reserved uploads and scoped downloads for the first Sales file; listing, reusable signed links, overwrites and user deletion remain denied. See §13 for the current lifecycle and limits.

The local shell states that booking work is unavailable. It creates no placeholder approvals or fabricated physical transfers. M2–M6, live authentication policy, real role scopes, hosting, backups/restore acceptance and pilot readiness remain governed by the original dependencies.

### Login presentation and local assets (UI-01–UI-03)

The login route uses an isolated CSS Module and locally served Hanken Grotesk variable font. The same local font is shared through `src/lib/fonts.ts`; signed-in routes use the workspace shell described below. The user's references are the supplied Nike-style login screenshot, Toyota service-page screenshots, and [HK Guise specimen](https://www.awwwards.com/inspiration/hk-guise). [HK Guise](https://hanken.co/collections/all-fonts/products/hk-guise) is a commercial font; no licensed file was supplied. Hanken Grotesk is the implemented alternative, not an assertion that HK Guise is installed.

| Local asset | Provenance |
|---|---|
| `public/fonts/hanken-grotesk.ttf` | [Google Fonts Hanken Grotesk variable source](https://github.com/google/fonts/tree/main/ofl/hankengrotesk); bundled SIL OFL in `public/fonts/OFL-HankenGrotesk.txt`. Verified the font contains its variable-font table. |
| `public/images/toyota/fortuner.png` | [Vehicle image from the user's reference site](https://billdesk-rho.vercel.app/images/toyota-fortuner.png). |
| `public/images/toyota/innova-hycross.webp` | [Toyota Bharat HyCross image](https://static3.toyotabharat.com/images/showroom/innova-hycross/super-white.webp). |
| `public/images/toyota/hyryder.webp` | [Toyota Bharat Hyryder image](https://static3.toyotabharat.com/images/showroom/urbancruiser-hyryder/colors/cafe-white.webp). |

The login uses a continuous, full-screen canvas with a divided desktop layout, larger text and controls, and a compact row identifying booking documents, approvals and file movement. The user-requested cleanup removes the header workspace label, introductory description and eyebrows, footer, and vehicle caption/control strip. Larger model names sit lower behind the car imagery and are intentionally partly obscured by the vehicles. Transparent vehicle assets render normally; the white-backed HyCross uses a clipped SVG body layer to occlude lettering. SVG color filters convert its white-backed shadow to transparent black and remove near-white edge pixels, avoiding blend-mode seams outside the slide bounds. Filter output is constrained to source alpha so transparent regions remain transparent. Source image bytes are unchanged. It has no floating sign-in card or inset outer tile. Hanken Grotesk uses revised weights and spacing. The keyboard-accessible password eye button switches the native input between masked and visible text without submitting the form or storing the password in component state.

Innova HyCross appears first, followed by Fortuner and Urban Cruiser Hyryder. The client component changes vehicles every 6.5 seconds: the outgoing image fades over 280 milliseconds before the incoming image fades in after a 300-millisecond delay, avoiding overlapping silhouettes. Rotation is automatic, with no visible slideshow controls. Reduced-motion preference disables automatic rotation and transitions. Hidden browser tabs do not advance the slide. Model names and images transition together without changing layout height, and changing vehicles preserves form inputs. All vehicle images load locally through Next Image; runtime requests to the source sites or Google Fonts are unnecessary. On phones the form precedes the vehicle display.


### Signed-in workspace presentation (UI-04)

`src/components/workspace` owns the shared server-rendered shell, local SVG icons, presentation-only role descriptions and CSS Module. `/workspace` and `/staff` retain their existing server-side `requireStaff` / `requireAdmin` checks and user-session queries. The presentation registry is not an authorization matrix. It uses the role descriptions in workflow.md §5 and grants no capabilities.

Desktop navigation uses an icon rail and sidebar with the login's Hanken Grotesk, Toyota red, charcoal text and light-grey surfaces. The app-wide font and base colors also cover account and recovery pages. Phones use a native modal dialog for navigation, including focus containment, Escape dismissal and return to the menu button. Selecting a navigation link closes the drawer. Section links use native anchors, with focusable section targets. `SectionNavigation` restores fragment focus and scrolling after streamed page content mounts and on hash changes, including browser history navigation. The loading state avoids flashing the old staff layout during transitions.

All active memberships appear in the workspace; a multi-role account gets the union of its presentation entries. Only administrators see working staff-access, assignment, account-request and access-history links. SO, TL and SM now also receive working scoped booking links as described under CHG-05 below. Remaining operational features appear as future tool labels with icons under **Upcoming tools / Not enabled**. These entries are non-interactive, have no fabricated queues or counts, and do not imply permission to access booking data. Q-01/Q-02/Q-03/Q-05/Q-11 and downstream prerequisites remain open.

Staff administration provides direct account creation, actual branch-team creation, activation/deactivation and audit forms. Summary counts use distinct active staff IDs, pending requests within the latest 50 returned requests, and distinct administered branches. History remains limited to the latest 30 entries. Branch selectors use authorized database rows; team options are filtered by branch and shown only for SO/TL. The server still rejects cross-branch/team submissions.


### Account creation, branch catalog and responsive behaviour (CHG-02 / UI-05)

`20261110000200_admin_accounts.sql` adds `complete_staff_account` and `create_staff_team`. The account action first reserves an immutable request through the existing invitation RPC under the administrator's JWT. A server-only Auth client creates an email/password identity with Auth-owned metadata tying it to that request. Email confirmation is administrative for this local onboarding flow; it is not evidence of inbox ownership. No message is sent. A restricted scalar helper checks that metadata, email and confirmation before the initiating administrator's completion RPC atomically inserts the staff profile, membership, request completion and audit event. No routine service-role application writes are introduced.

A failed/uncertain Auth or completion step leaves the saved request available for recovery. “Finish account setup” retries only that prepared request; it cannot claim another existing identity, reset its password, or reactivate an inactive membership. Expired or differently owned requests are rejected. Passwords are sent only to Auth, never application history, logs or action results. The six-character initial-password rule implements CHG-02; Auth's minimum is six and self-service recovery permits longer passwords. The existing private-link acceptance route remains supported for previously issued links.

The public directory seed is a location catalog, not a validated operational roster. It retains showroom/service distinctions for duplicated city names and does not infer actual team names, central departments or physical-file routing. The one-time `scripts/clean-local-workspace.mjs` refused non-test identities/files, wrote a private full database dump, removed the synthetic application/auth records, and replaced the setup login. The backup has not been presented as a tested production restore.

Responsive hardening covers min-width constraints, long staff/branch wrapping, scrollable audit tables with keyboard focus, 16px mobile inputs, larger drawer controls, and closing the modal when resizing into desktop navigation. Native dialog focus handling, Escape dismissal and form values survive navigation/resizing. Automated checks cover all operational roles, 320–2560 CSS-pixel widths, portrait/landscape transitions and supported test browser engines; this is bounded browser coverage, not a guarantee for every physical device.


### Persistent Kalamassery role check (CHG-04)

`npm run test:kalamassery` runs the explicitly authorized local check in `scripts/check-kalamassery-roles.mjs`. It provisions/reuses ten dedicated `test<role, Kalamassery>` identities and one test team, verifies scope and permitted account operations, and checks each role in desktop/phone Chromium. Unlike the normal fixture suites, it retains these accounts and their history. It never resets unrelated identities; an existing identity must carry the suite's Auth-owned metadata before it can be reused. Admin creation stays within the controlled local setup procedure. This is not part of automatic CI.

Credentials live in ignored `.local/kalamassery-test-accounts.json` and the readable `.local/kalamassery-test-logins.txt`, both mode 0600. Results and screenshots are under `.local/kalamassery-role-check/`. The report distinguishes passed identity/navigation checks from unimplemented business stages; a denied upload before document implementation is an access-boundary pass, not a working document-upload feature. Rerunning this command retains existing passwords and uses saved operation IDs for provisioning retries. Revoke these named assignments through staff administration when testing ends; preserve attribution rather than deleting their audit records.


### SO booking drafts (CHG-05)

Migration `20261110000300_booking_drafts.sql` adds `bookings`, immutable `booking_versions` and `save_booking_draft`. `data` is a bounded, allowlisted snapshot of the printed file header and Booking Details only, pinned to form version 1. All business fields may be incomplete in a draft; names, address, contact, both suffix/colour choices and other printed labels are preserved independently. Invalid JSON types, unknown keys, oversize values, invalid calendar dates and invalid select values fail at the database boundary. No submitted/approved state or registered-owner, finance, signature or handoff field is accepted in this command. No duplicate-booking rule is invented.

The active SO membership determines branch/team/owner and is locked while saving. A per-actor operation lock deduplicates concurrent retries; changed payload reuse fails. Existing drafts are row-locked and checked against their expected revision. Draft, version, audit and command outcome commit together. Revocation applies to existing JWTs. SO reads assigned drafts, TL reads team drafts and SM reads branch drafts; Admin and downstream roles have no new customer-data permission. Versions follow the same RLS and cannot be mutated through application roles.

`/bookings` provides a scoped, paginated list and customer-name search; `/bookings/new` creates drafts; `/bookings/[id]` reopens the file with SO edit controls or TL/SM read-only details and save history. Unknown/out-of-scope IDs reveal no file data. Native inputs retain draft values after rejected saves; stale edits report the conflict. The header's TL name is informational and never creates a signature or approval. Existing official documents are still produced externally. Registration/customer ownership, document verification, TL/SM approvals, allocation and TL → BO handoff will use separate confirmed sections/commands in later slices.


### Global Customer ID (CHG-06)

Migration `20261110000400_customer_identity.sql` creates `customers(customer_id text primary key)` and adds the indexed `bookings.customer_id` foreign key. This identifier-only table stores no shared personal profile. The printed snapshot key `customer_code` is retained for existing form/version compatibility; a constraint and trigger keep its trimmed value consistent with the foreign key. The trigger executes inside `save_booking_draft` and inserts or reuses the identifier atomically, so audit failure rolls back a new identity too. Routine direct writes remain revoked. Customer reads require at least one booking visible through existing booking RLS; knowing an ID never broadens file access.

Backfill only links existing nonblank IDs. Blank drafts stay unlinked without fabricated identifiers. IDs preserve leading zeros and case; an exact Customer ID search is the default, with name search available explicitly. Order numbers remain file attributes and have no global uniqueness constraint. Booking URLs, revisions, audit targets and documents continue using opaque booking UUIDs. Correcting a draft's ID changes that booking's reference and appends a version; earlier references and unrelated branch snapshots remain unchanged. Customer merge/rekey and other duplicate rules remain Q-01/Q-14.


### Registration reuse and searchable controls (CHG-07)

`20261110000500_registration_details.sql` extends draft validation with `registration_same` and six common registration fields. New saves and save versions use form version 2; prior version-1 rows remain readable and unchanged. When the flag is `yes`, the database checks equality against the explicit booking-field mapping. Registration values are still customer-file snapshots under existing SO/TL/SM scopes; no approval/BO receipt, tax identifier, finance field or additional access is introduced. SO creation through the confirmed-booking route no longer asks for a redundant acknowledgment checkbox, while the database command still rejects enquiry-only requests (`p_confirmed=false`).

`BookingFields` keeps booking and independent registration values separately in client state so toggling the checkbox does not erase unsaved separate-owner entries. In same mode it renders live read-only copied values; saving includes the selected snapshot. `SearchSelect` provides one dependency-free accessible combobox for constrained IDs and optional free-entry suggestions, with filtering, keyboard navigation, listbox selection, invalid-choice feedback, reset handling and wrapping dropdown options. Authorization and allowed role/enumeration checks stay in server/database commands. Account teams still depend on branch and SO/TL role. The component is shared by current Sales/Admin forms and booking filters; other role business editors remain future milestones.

Model suggestions were verified on 2026-11-10 against [Nippon Toyota's model range](https://www.nippontoyota.co.in/). Colour suggestions for [Innova HyCross](https://www.toyotabharat.com/showroom/innova/) and [Innova Crysta](https://www.toyotabharat.com/showroom/innova-crysta/) come from Toyota's showroom pages. These local suggestions are not a live availability feed or an authoritative suffix-code master. Other repeated field values come only from the latest 500 RLS-visible bookings, excluding customer identities, addresses and contact details from suggestions. Manual entry preserves values outside these suggestions. Future catalog changes must not rewrite saved file values.


## 13. CHG-08 local document and submission implementation

- Migrations `20261110000600`–`20261110000800` add private document metadata, immutable file-version document IDs, SO submission/receipt commands and requirements-version/actor evidence. `sales_submissions.file_revision` references the actual saved bundle. Current states are `draft` and `tl_review`; no approval is represented by the latter.
- `POST /api/booking-documents` requires an authenticated cookie and permitted origin. It bounds the streamed body, accepts PDF/JPEG up to 10 MiB, checks format signatures/termination and SHA-256, reserves via the user's command, uploads with no overwrite, reads back and verifies the object, then finalizes. Format checks are not antivirus, full PDF parsing or document-content verification. Those operational controls and live hosting remain unresolved.
- Database finalization requires HMAC attestation over document UUID/hash plus matching stored metadata and registered-owner snapshot. The key is in `private.document_verifier`, inaccessible to application roles, and the server-only `DOCUMENT_VERIFICATION_SECRET`. `npm run db:env` synchronizes this secret from the local database without printing it, preserving other settings. Run it after a local reset/restore and restart Next.js. Never expose the key to browsers or use a service key for business commands.
- Storage paths are opaque document UUIDs. Insert requires a pending reservation and current owning SO draft scope. Get/info operations check active file scope; list/sign/update/delete are not granted to users. Pending objects are visible only to their uploader. `GET /api/booking-documents/[id]` serves ready files through a no-store attachment response and records an access-request audit. Storage authorization still applies to direct authenticated requests; the application audit is of proxy download requests, not proof that the human read the bytes.
- Current Sales visibility remains own SO, assigned-team TL and branch SM. Admin/BO/other departments have no new document access. Later department grants must follow their separately confirmed scope. Finalized metadata is not directly mutable. Each attached document creates a new booking revision; the version snapshots the latest ready IDs. Owner changes leave history intact and block submission with mismatched copies.
- Recoverable pending state: when upload succeeds but finalization fails, refresh and use **Finish upload** against the latest booking revision. If the object never arrived or its owner/hash no longer matches, upload a new copy; the pending record remains excluded from gates. No automatic deletion of user objects is implemented. Before a backup/restore, preserve database rows and storage objects independently, reconcile every ready document ID against size/hash, and treat missing objects as a recovery failure. No production restore or complete storage-backup drill is claimed here.
- SO send locks the draft and records the immutable version, team recipient, timestamp and gate version in one transaction. TL receipt is a separate idempotent command, preserving the actor label without opening a staff directory. Missing active TL, stale revision, missing required fields or ready owner documents block send. No return/approval route or gate bypass exists yet. Later gate versions must preserve historical submissions and explicitly handle active files.
