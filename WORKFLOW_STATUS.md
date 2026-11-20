# Nippon Toyota — Sales Booking & Fulfilment Workflow Digitization
## End-to-End Status Report: Completed Features vs. Remaining Roadmap

**Document Version:** 1.0  
**Date:** 20 November 2026  
**Project Scope:** Digitization of customer car booking, departmental approvals, and fulfillment file movement across 13 Toyota dealership branches in Kerala.  
**Baseline Source:** *Sales Booking & Fulfilment Workflow Digitization.pdf* (v1.0) & [workflow.md](workflow.md)

---

## Executive Summary

The project replaces the physical movement of the paper **"customer file jacket"** with an authenticated, tamper-proof digital workflow. 

* **Overall Project Progress:** **~30% Complete**
* **Currently Delivered:** Core Foundation, Multi-Branch Security, Sales Officer Draft Engine, Cryptographic Document Vault (KYC), and the First Digital Handoff (SO $\rightarrow$ Team Leader Receipt).
* **Next Immediate Priority:** Team Leader Formal Approval and Sales Manager Approval with Vehicle Allocation (Chassis/VIN Number).

```
[COMPLETED & WORKING]                               [REMAINING / UPCOMING]
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│ 1. Multi-Branch Admin & Auth    │                 │ 5. TL Formal Checklist Approval │
│ 2. Sales Officer Booking Drafts │ ──────────────▶ │ 6. SM Approval & VIN Allocation │
│ 3. KYC Document Vault (HMAC)    │                 │ 7. Back Office & VAHAN Staging  │
│ 4. SO Submit ➔ TL File Receipt  │                 │ 8. Insurance Gate & Accounts Inv│
└─────────────────────────────────┘                 │ 9. Accessories Fitment & P&L    │
                                                    │ 10. Gate Pass & Final Archive   │
                                                    └─────────────────────────────────┘
```

---

## 1. What Is Completed & Fully Working (Live in Application)

All features listed below are **fully implemented in code, connected to PostgreSQL, and verified by 221 automated tests**.

### A. Core Architecture & Staff Identity
* **10 Dealership Account Roles:** Fully defined in database enums and UI shells:
  `Admin`, `SO` (Sales Officer), `TL` (Team Leader), `SM` (Sales Manager), `BO` (Back Office), `Insurance`, `Accounts`, `Cashier`, `Accessories`, and `Security`.
* **Multi-Branch & Team Partitioning:**
  * Strict Row-Level Security (RLS) ensures staff in one branch (e.g. *Kalamassery*) cannot see files from another (e.g. *Trivandrum*).
  * Sales Officers only see their **own assigned bookings**.
  * Team Leaders see all bookings in their **assigned team**.
  * Sales Managers see all bookings across the **entire branch**.
* **Administrative Staff Desk (`/staff`):**
  * Admins can invite and create staff accounts with assigned branches, teams, and initial passwords.
  * Staff account activation/deactivation without deleting historical audit attribution.
* **Persistent Test Suite:**
  * Dedicated CLI script (`npm run test:kalamassery`) provisions all 10 role accounts for the Kalamassery showroom.

### B. Sales Booking Capture & Customer Identity (Sales Officer)
* **Digital Order Booking Form (OBF) (`/bookings/new`):**
  * Captures 18+ official printed file fields: Booking Number, Booking Date, Enquiry Reference, Customer Name, Communication Address, PIN, Model, Suffixes, and Colours.
  * Form draft auto-preserves entered values and survives page refreshes.
* **Global Customer ID Integration (`CUST-XXXXX`):**
  * Links customer identification numbers cleanly across branch bookings without exposing cross-branch file access.
* **Registration Snapshot & Reuse:**
  * **"Same as customer details"** toggle auto-populates registered owner fields while preserving separate owner data in client state if unchecked.
* **Searchable Comboboxes (`SearchSelect`):**
  * Built-in model range and colour suggestions for *Innova HyCross*, *Fortuner*, *Urban Cruiser Hyryder*, and *Innova Crysta*.
* **Bookings Hub (`/bookings`):**
  * Fast search by **Customer ID** or **Customer Name** with pagination and real-time status badges (`Draft · v1`, `With TL · v2`).

### C. Cryptographic KYC Document Vault
* **Private Supabase Storage (`booking-documents` bucket):**
  * Buckets are completely private with zero public URL access.
* **Content-Sniffing & Magic-Byte Validation:**
  * Verifies binary file signatures: `%PDF-` and `%%EOF` for PDFs; SOI `0xFF, 0xD8, 0xFF` and EOI `0xFF, 0xD9` for JPEGs. Mismatched or fake extensions are rejected.
  * Maximum size enforced up to 10 MB.
* **Server-Side HMAC Attestation:**
  * Uploaded documents require a server-computed HMAC signature using a private verification secret (`DOCUMENT_VERIFICATION_SECRET`). PostgreSQL checks this secret before marking any document `ready`.
* **Tamper-Proof File Proxy (`/api/booking-documents/[id]`):**
  * Secure download endpoint adds Content Security Policy (`sandbox; default-src 'none'`) and `X-Content-Type-Options: nosniff`.
  * Every download logs an immutable access request in `audit_events`.

### D. First Digital Handoff (SO $\rightarrow$ TL Receipt)
* **SO Submission Command (`sendToTL`):**
  * Validates that all mandatory booking details are complete.
  * Validates that both registered-owner **Aadhaar** and **PAN** documents are uploaded and finalized.
  * Freezes the file revision, locks the draft from further edits, and transfers file custody to the Team Leader.
* **TL Receipt Command (`receiveFile`):**
  * Team Leader acknowledges receipt with verified staff ID and timestamp (`booking.received_by_tl`).
  * File status updates to `With TL · v2`.

---

## 2. What Is Left to Build (Upcoming Phases)

The remaining steps complete the journey from Team Leader review through vehicle handover and physical archiving.

---

### Phase 1: Sales Approvals & Allocation (Next Up — Tasks 8 & 9)
* **Team Leader (TL) Formal Checklist Approval:**
  * TL verifies booking parameters against the published dealership checklist.
  * TL clicks **"Approve file & forward to SM"** (or returns for rework with a mandatory reason).
  * Status moves from `With TL` $\rightarrow$ `With SM`.
* **Sales Manager (SM) Approval & Allocation Engine:**
  * SM reviews pricing, discounts, and payment mode (Cash/Loan).
  * SM inputs and locks the vehicle **Allocation Reference (VIN / Chassis Number)**.
  * SM clicks **"Approve & Send to Back Office"**.
  * Status moves from `With SM` $\rightarrow$ `With Back Office`.

---

### Phase 2: Back Office & Vehicle Preparation (Task 10)
* **Back Office (BO) File Docket Receipt:**
  * BO receives the approved sales file in their departmental inbox.
  * BO executes the preparation pre-list.
* **Statutory Form 20 & Disclaimers:**
  * Generates and tracks Form 20 (RTO registration application) and customer disclaimers.
  * Tracks physical customer ink signatures on paper originals.
* **VAHAN Staging & PDI Initiation:**
  * Logs vehicle entry into the government VAHAN portal.
  * Triggers vehicle **Pre-Delivery Inspection (PDI)** at the stockyard.

---

### Phase 3: Insurance Verification & Invoicing Gate (Tasks 11 & 12)
* **Strict Insurance Pre-Invoice Gate:**
  * Insurance Desk coordinates with external brokers to obtain policy cover notes.
  * **Core Invariant:** Accounts is locked from generating an invoice until the Insurance Desk confirms policy evidence.
* **Accounts Commercial Invoicing:**
  * Accounts reconciles customer margin money and bank loan disbursement receipts.
  * Generates the official commercial **GST Tax Invoice**.
* **FASTag Processing & Cashier Handover:**
  * Accounts assigns the electronic FASTag tag ID to the chassis.
  * Cashier counter records customer tag payment and physical handover of the RFID tag.

---

### Phase 4: Accessories Fitment & P&L Audit (Tasks 13 & 14)
* **Accessory Requisitions & Stock Verification:**
  * Forwarded by BO to the Accessories department just before delivery.
  * Accessories technician checks parts inventory.
* **Partial-Work Tracking:**
  * If an accessory is out of stock, logs **partial completion** so vehicle delivery is not blocked, while keeping pending parts tracked under the customer file.
* **Cashier Payment Collection:**
  * Customer pays for fitted accessories at the Cashier counter.
* **Accessories P&L Sign-off:**
  * Computes the accessories Profit & Loss margin.
  * Requires digital sign-off from both the Sales Manager and Accounts before file forwarding.
* **Bill Routing:**
  * $\text{Accessories} \longrightarrow \text{Sales Officer (SO)} \longrightarrow \text{Back Office (BO)} \longrightarrow \text{Accounts}$ for financial clearance.

---

### Phase 5: RTO Registration, Gate Pass & Physical Archiving (Tasks 15, 16, 17)
* **RTO Road Tax Payment:**
  * Accounts records external road tax clearance through VAHAN.
  * Vehicle receives official registration number.
* **Delivery Gate Pass Generation:**
  * Accounts checks that customer balance, loan disbursement, and accessory bills equal zero.
  * Generates the digital **Gate Pass**.
* **Security Guard Showroom Exit Verification:**
  * Security guards at the showroom gate verify the digital Gate Pass before the car physically drives out.
  * Records the exact vehicle exit timestamp.
* **Central Physical File Archive:**
  * The physical file jacket containing all ink-signed originals (OBF, Form 20, insurance copy, delivery receipt, gate pass copy) is returned to Accounts.
  * Accounts logs the file in the **Central Archive Box**, closing the booking file permanently.

---

### Phase 6: Live Pilot Rollout (Task 18)
* **Kalamassery Showroom Pilot:**
  * Run a live branch trial on a cohort of 50 new car bookings.
  * Measure turnaround time reduction and eliminate physical file loss.
* **Controlled 13-Branch Expansion:**
  * Roll out to remaining branches (Nettoor, Trivandrum, Thrissur, Kottayam, Kollam, etc.) following pilot review.

---

## 3. Master Feature Status Matrix

| ID | Feature / Milestone | Role Involved | Status | Location in Codebase |
|:---:|---|:---:|:---:|---|
| **M1.1** | Multi-Branch & Team Scoping (RLS) | Admin / All | **Completed** | `supabase/migrations/20261110000100_foundation.sql` |
| **M1.2** | Staff Account Management & Invitations | Admin | **Completed** | `src/app/staff/page.tsx` & `src/modules/identity/` |
| **M1.3** | Global Customer ID Linking | SO | **Completed** | `supabase/migrations/20261110000400_customer_identity.sql` |
| **M1.4** | Booking Form Drafting & Validation | SO | **Completed** | `src/components/bookings/draft-editor.tsx` |
| **M1.5** | Private Document Vault & HMAC Attestation | SO / Admin | **Completed** | `src/app/api/booking-documents/route.ts` |
| **M1.6** | SO Submit to TL & TL Receipt Command | SO / TL | **Completed** | `supabase/migrations/20261110000700_sales_submission.sql` |
| **M2.1** | TL Formal Checklist Review & Approval | TL | ⏳ **Next Up** | *Scheduled Task #8* |
| **M2.2** | SM Approval & Chassis Allocation Engine | SM | ⏳ **Next Up** | *Scheduled Task #9* |
| **M3.1** | Back Office File Docket & VAHAN Staging | BO | 📋 *Planned* | *Scheduled Task #10* |
| **M3.2** | Insurance Verification Gate | Insurance | 📋 *Planned* | *Scheduled Task #11* |
| **M3.3** | Accounts Invoicing & FASTag System | Accounts / Cashier | 📋 *Planned* | *Scheduled Task #12* |
| **M4.1** | Accessories Requisition & Partial Fitment | Accessories | 📋 *Planned* | *Scheduled Task #13* |
| **M4.2** | Accessories P&L Audit & Bill Sign-off | Accessories / SM | 📋 *Planned* | *Scheduled Task #14* |
| **M4.3** | RTO Road Tax & Registration Tracking | BO / Accounts | 📋 *Planned* | *Scheduled Task #15* |
| **M4.4** | Delivery Gate Pass & Security Exit | Accounts / Security | 📋 *Planned* | *Scheduled Task #16* |
| **M4.5** | Custody Return & Central Archive Vault | Accounts | 📋 *Planned* | *Scheduled Task #17* |
| **M5.1** | Kalamassery Showroom Live Pilot Trial | All Roles | 📋 *Planned* | *Scheduled Task #18* |

---

## 4. Current Quality & Verification Metrics

* **TypeScript Compilation:** `next typegen && tsc --noEmit` $\rightarrow$ **0 Errors**
* **Linting:** ESLint 9 $\rightarrow$ **0 Warnings / 0 Errors**
* **Production Build:** Next.js Turbopack $\rightarrow$ **Compiled successfully in 1.1s**
* **Database Integration Tests:** `npm run test:db` $\rightarrow$ **221 / 221 Tests Passed**
* **Local Test Accounts:** 10 Showroom roles provisioned and active in Kalamassery branch.
