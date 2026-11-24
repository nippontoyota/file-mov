export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "accessories_records": {
                  Row: {
                    "bill_date": string | null,"bill_document_id": string | null,"bill_number": string | null,"billed_at": string | null,"billed_by": string | null,"bo_forwarded_at": string | null,"bo_forwarded_by": string | null,"booking_id": string,"branch_id": string,"cost_amount": number | null,"created_at": string,"id": string,"items": NonNullable<Json>,"labour_amount": number | null,"margin_percentage": number | null,"margin_signed": boolean,"margin_signed_at": string | null,"margin_signed_by": string | null,"parts_amount": number | null,"payment_status": string,"profit_loss_amount": number | null,"so_collected_at": string | null,"so_collected_by": string | null,"status": string,"stock_status": string,"total_bill_amount": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bill_date"?: string | null,"bill_document_id"?: string | null,"bill_number"?: string | null,"billed_at"?: string | null,"billed_by"?: string | null,"bo_forwarded_at"?: string | null,"bo_forwarded_by"?: string | null,"booking_id": string,"branch_id": string,"cost_amount"?: number | null,"created_at"?: string,"id"?: string,"items"?: NonNullable<Json>,"labour_amount"?: number | null,"margin_percentage"?: number | null,"margin_signed"?: boolean,"margin_signed_at"?: string | null,"margin_signed_by"?: string | null,"parts_amount"?: number | null,"payment_status"?: string,"profit_loss_amount"?: number | null,"so_collected_at"?: string | null,"so_collected_by"?: string | null,"status"?: string,"stock_status"?: string,"total_bill_amount"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "bill_date"?: string | null,"bill_document_id"?: string | null,"bill_number"?: string | null,"billed_at"?: string | null,"billed_by"?: string | null,"bo_forwarded_at"?: string | null,"bo_forwarded_by"?: string | null,"booking_id"?: string,"branch_id"?: string,"cost_amount"?: number | null,"created_at"?: string,"id"?: string,"items"?: NonNullable<Json>,"labour_amount"?: number | null,"margin_percentage"?: number | null,"margin_signed"?: boolean,"margin_signed_at"?: string | null,"margin_signed_by"?: string | null,"parts_amount"?: number | null,"payment_status"?: string,"profit_loss_amount"?: number | null,"so_collected_at"?: string | null,"so_collected_by"?: string | null,"status"?: string,"stock_status"?: string,"total_bill_amount"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "accessories_records_bill_document_id_fkey"
      columns: ["bill_document_id"]
isOneToOne: false
      referencedRelation: "booking_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accessories_records_billed_by_fkey"
      columns: ["billed_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accessories_records_bo_forwarded_by_fkey"
      columns: ["bo_forwarded_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accessories_records_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: true
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accessories_records_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accessories_records_margin_signed_by_fkey"
      columns: ["margin_signed_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accessories_records_so_collected_by_fkey"
      columns: ["so_collected_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"accounts_records": {
                  Row: {
                    "booking_id": string,"branch_id": string,"created_at": string,"ex_showroom_amount": number | null,"fastag_bank": string | null,"fastag_handover_at": string | null,"fastag_handover_by": string | null,"fastag_handover_notes": string | null,"fastag_handover_status": string,"fastag_issued_at": string | null,"fastag_issued_by": string | null,"fastag_security_deposit": number | null,"fastag_tag_id": string | null,"fastag_wallet_balance": number | null,"id": string,"invoice_date": string | null,"invoice_document_id": string | null,"invoice_number": string | null,"invoiced_at": string | null,"invoiced_by": string | null,"road_tax_amount": number | null,"road_tax_document_id": string | null,"road_tax_paid_date": string | null,"road_tax_payment_mode": string | null,"road_tax_receipt_no": string | null,"road_tax_recorded_at": string | null,"road_tax_recorded_by": string | null,"status": string,"tcs_amount": number | null,"total_invoice_amount": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"branch_id": string,"created_at"?: string,"ex_showroom_amount"?: number | null,"fastag_bank"?: string | null,"fastag_handover_at"?: string | null,"fastag_handover_by"?: string | null,"fastag_handover_notes"?: string | null,"fastag_handover_status"?: string,"fastag_issued_at"?: string | null,"fastag_issued_by"?: string | null,"fastag_security_deposit"?: number | null,"fastag_tag_id"?: string | null,"fastag_wallet_balance"?: number | null,"id"?: string,"invoice_date"?: string | null,"invoice_document_id"?: string | null,"invoice_number"?: string | null,"invoiced_at"?: string | null,"invoiced_by"?: string | null,"road_tax_amount"?: number | null,"road_tax_document_id"?: string | null,"road_tax_paid_date"?: string | null,"road_tax_payment_mode"?: string | null,"road_tax_receipt_no"?: string | null,"road_tax_recorded_at"?: string | null,"road_tax_recorded_by"?: string | null,"status"?: string,"tcs_amount"?: number | null,"total_invoice_amount"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "booking_id"?: string,"branch_id"?: string,"created_at"?: string,"ex_showroom_amount"?: number | null,"fastag_bank"?: string | null,"fastag_handover_at"?: string | null,"fastag_handover_by"?: string | null,"fastag_handover_notes"?: string | null,"fastag_handover_status"?: string,"fastag_issued_at"?: string | null,"fastag_issued_by"?: string | null,"fastag_security_deposit"?: number | null,"fastag_tag_id"?: string | null,"fastag_wallet_balance"?: number | null,"id"?: string,"invoice_date"?: string | null,"invoice_document_id"?: string | null,"invoice_number"?: string | null,"invoiced_at"?: string | null,"invoiced_by"?: string | null,"road_tax_amount"?: number | null,"road_tax_document_id"?: string | null,"road_tax_paid_date"?: string | null,"road_tax_payment_mode"?: string | null,"road_tax_receipt_no"?: string | null,"road_tax_recorded_at"?: string | null,"road_tax_recorded_by"?: string | null,"status"?: string,"tcs_amount"?: number | null,"total_invoice_amount"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "accounts_records_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: true
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accounts_records_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accounts_records_fastag_handover_by_fkey"
      columns: ["fastag_handover_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accounts_records_fastag_issued_by_fkey"
      columns: ["fastag_issued_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accounts_records_invoice_document_id_fkey"
      columns: ["invoice_document_id"]
isOneToOne: false
      referencedRelation: "booking_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accounts_records_invoiced_by_fkey"
      columns: ["invoiced_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accounts_records_road_tax_document_id_fkey"
      columns: ["road_tax_document_id"]
isOneToOne: false
      referencedRelation: "booking_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accounts_records_road_tax_recorded_by_fkey"
      columns: ["road_tax_recorded_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_events": {
                  Row: {
                    "action": string,"actor_id": string,"branch_id": string,"id": number,"occurred_at": string,"reason": string | null,"revision": number | null,"target_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id": string,"branch_id": string,"id"?: never,"occurred_at"?: string,"reason"?: string | null,"revision"?: number | null,"target_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string,"branch_id"?: string,"id"?: never,"occurred_at"?: string,"reason"?: string | null,"revision"?: number | null,"target_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_events_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    }
                  ]
                },"bo_preparations": {
                  Row: {
                    "accessories_completed_at": string | null,"accessories_completed_by": string | null,"accessories_dispatched_at": string | null,"accessories_dispatched_by": string | null,"accounts_completed_at": string | null,"accounts_completed_by": string | null,"accounts_dispatched_at": string | null,"accounts_dispatched_by": string | null,"booking_id": string,"branch_id": string,"created_at": string,"disclaimer_signed": boolean,"documents_completed_at": string | null,"documents_completed_by": string | null,"form20_signed": boolean,"hsrp_status": string,"insurance_completed_at": string | null,"insurance_completed_by": string | null,"insurance_dispatched_at": string | null,"insurance_dispatched_by": string | null,"pdi_completed_at": string | null,"pdi_completed_by": string | null,"pdi_inspector_name": string | null,"pdi_notes": string | null,"pdi_status": string,"rc_status": string,"rto_completed_at": string | null,"rto_completed_by": string | null,"rto_location": string | null,"rto_registration_date": string | null,"rto_registration_no": string | null,"updated_at": string,"vahan_app_no": string | null,"vahan_entered_at": string | null,"vahan_entered_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accessories_completed_at"?: string | null,"accessories_completed_by"?: string | null,"accessories_dispatched_at"?: string | null,"accessories_dispatched_by"?: string | null,"accounts_completed_at"?: string | null,"accounts_completed_by"?: string | null,"accounts_dispatched_at"?: string | null,"accounts_dispatched_by"?: string | null,"booking_id": string,"branch_id": string,"created_at"?: string,"disclaimer_signed"?: boolean,"documents_completed_at"?: string | null,"documents_completed_by"?: string | null,"form20_signed"?: boolean,"hsrp_status"?: string,"insurance_completed_at"?: string | null,"insurance_completed_by"?: string | null,"insurance_dispatched_at"?: string | null,"insurance_dispatched_by"?: string | null,"pdi_completed_at"?: string | null,"pdi_completed_by"?: string | null,"pdi_inspector_name"?: string | null,"pdi_notes"?: string | null,"pdi_status"?: string,"rc_status"?: string,"rto_completed_at"?: string | null,"rto_completed_by"?: string | null,"rto_location"?: string | null,"rto_registration_date"?: string | null,"rto_registration_no"?: string | null,"updated_at"?: string,"vahan_app_no"?: string | null,"vahan_entered_at"?: string | null,"vahan_entered_by"?: string | null
                  }
                  Update: {
                    "accessories_completed_at"?: string | null,"accessories_completed_by"?: string | null,"accessories_dispatched_at"?: string | null,"accessories_dispatched_by"?: string | null,"accounts_completed_at"?: string | null,"accounts_completed_by"?: string | null,"accounts_dispatched_at"?: string | null,"accounts_dispatched_by"?: string | null,"booking_id"?: string,"branch_id"?: string,"created_at"?: string,"disclaimer_signed"?: boolean,"documents_completed_at"?: string | null,"documents_completed_by"?: string | null,"form20_signed"?: boolean,"hsrp_status"?: string,"insurance_completed_at"?: string | null,"insurance_completed_by"?: string | null,"insurance_dispatched_at"?: string | null,"insurance_dispatched_by"?: string | null,"pdi_completed_at"?: string | null,"pdi_completed_by"?: string | null,"pdi_inspector_name"?: string | null,"pdi_notes"?: string | null,"pdi_status"?: string,"rc_status"?: string,"rto_completed_at"?: string | null,"rto_completed_by"?: string | null,"rto_location"?: string | null,"rto_registration_date"?: string | null,"rto_registration_no"?: string | null,"updated_at"?: string,"vahan_app_no"?: string | null,"vahan_entered_at"?: string | null,"vahan_entered_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bo_preparations_accessories_completed_by_fkey"
      columns: ["accessories_completed_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bo_preparations_accessories_dispatched_by_fkey"
      columns: ["accessories_dispatched_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bo_preparations_accounts_completed_by_fkey"
      columns: ["accounts_completed_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bo_preparations_accounts_dispatched_by_fkey"
      columns: ["accounts_dispatched_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bo_preparations_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: true
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bo_preparations_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bo_preparations_documents_completed_by_fkey"
      columns: ["documents_completed_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bo_preparations_insurance_completed_by_fkey"
      columns: ["insurance_completed_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bo_preparations_insurance_dispatched_by_fkey"
      columns: ["insurance_dispatched_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bo_preparations_pdi_completed_by_fkey"
      columns: ["pdi_completed_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bo_preparations_rto_completed_by_fkey"
      columns: ["rto_completed_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bo_preparations_vahan_entered_by_fkey"
      columns: ["vahan_entered_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_documents": {
                  Row: {
                    "booking_id": string,"byte_size": number,"filename": string,"finalized_at": string | null,"id": string,"kind": string,"mime_type": string,"owner_snapshot": NonNullable<Json>,"sha256": string,"status": string,"uploaded_at": string,"uploaded_by": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"byte_size": number,"filename": string,"finalized_at"?: string | null,"id"?: string,"kind": string,"mime_type": string,"owner_snapshot": NonNullable<Json>,"sha256": string,"status"?: string,"uploaded_at"?: string,"uploaded_by": string,"version": number
                  }
                  Update: {
                    "booking_id"?: string,"byte_size"?: number,"filename"?: string,"finalized_at"?: string | null,"id"?: string,"kind"?: string,"mime_type"?: string,"owner_snapshot"?: NonNullable<Json>,"sha256"?: string,"status"?: string,"uploaded_at"?: string,"uploaded_by"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_documents_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_payments": {
                  Row: {
                    "amount": number,"booking_id": string,"branch_id": string,"created_at": string,"created_by": string,"id": string,"payment_method": string,"payment_type": string,"proof_document_id": string | null,"receipt_no": string | null,"reference_no": string,"status": string,"updated_at": string,"verified_at": string | null,"verified_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"booking_id": string,"branch_id": string,"created_at"?: string,"created_by": string,"id"?: string,"payment_method": string,"payment_type"?: string,"proof_document_id"?: string | null,"receipt_no"?: string | null,"reference_no": string,"status"?: string,"updated_at"?: string,"verified_at"?: string | null,"verified_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"booking_id"?: string,"branch_id"?: string,"created_at"?: string,"created_by"?: string,"id"?: string,"payment_method"?: string,"payment_type"?: string,"proof_document_id"?: string | null,"receipt_no"?: string | null,"reference_no"?: string,"status"?: string,"updated_at"?: string,"verified_at"?: string | null,"verified_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_payments_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_payments_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_payments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_payments_proof_document_id_fkey"
      columns: ["proof_document_id"]
isOneToOne: false
      referencedRelation: "booking_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_payments_verified_by_fkey"
      columns: ["verified_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_versions": {
                  Row: {
                    "actor_id": string,"actor_name": string,"booking_id": string,"data": NonNullable<Json>,"document_ids": (string)[],"form_version": number,"recorded_at": string,"revision": number
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"actor_name": string,"booking_id": string,"data": NonNullable<Json>,"document_ids"?: (string)[],"form_version"?: number,"recorded_at"?: string,"revision": number
                  }
                  Update: {
                    "actor_id"?: string,"actor_name"?: string,"booking_id"?: string,"data"?: NonNullable<Json>,"document_ids"?: (string)[],"form_version"?: number,"recorded_at"?: string,"revision"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_versions_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_versions_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "branch_id": string,"created_at": string,"customer_id": string | null,"data": NonNullable<Json>,"form_version": number,"id": string,"revision": number,"so_id": string,"so_name": string,"state": string,"team_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"created_at"?: string,"customer_id"?: string | null,"data": NonNullable<Json>,"form_version"?: number,"id"?: string,"revision"?: number,"so_id": string,"so_name": string,"state"?: string,"team_id": string,"updated_at"?: string
                  }
                  Update: {
                    "branch_id"?: string,"created_at"?: string,"customer_id"?: string | null,"data"?: NonNullable<Json>,"form_version"?: number,"id"?: string,"revision"?: number,"so_id"?: string,"so_name"?: string,"state"?: string,"team_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["customer_id"]
    },{
      foreignKeyName: "bookings_so_id_fkey"
      columns: ["so_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_team_id_branch_id_fkey"
      columns: ["team_id","branch_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id","branch_id"]
    }
                  ]
                },"branches": {
                  Row: {
                    "id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name": string
                  }
                  Update: {
                    "id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"customers": {
                  Row: {
                    "customer_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "customer_id": string
                  }
                  Update: {
                    "customer_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"delivery_records": {
                  Row: {
                    "archive_location": string | null,"archive_physical_audit": NonNullable<Json>,"archived_at": string | null,"archived_by": string | null,"booking_id": string,"branch_id": string,"created_at": string,"delivered_at": string | null,"delivered_by": string | null,"delivery_document_id": string | null,"delivery_notes": string | null,"financial_closure_at": string | null,"financial_closure_by": string | null,"financial_closure_notes": string | null,"gate_pass_document_id": string | null,"gate_pass_issued_at": string | null,"gate_pass_issued_by": string | null,"gate_pass_no": string | null,"id": string,"keys_handed_over": boolean,"odometer_reading": number | null,"recipient_name": string | null,"recipient_relationship": string | null,"security_file_returned_at": string | null,"security_file_returned_by": string | null,"security_officer_name": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archive_location"?: string | null,"archive_physical_audit"?: NonNullable<Json>,"archived_at"?: string | null,"archived_by"?: string | null,"booking_id": string,"branch_id": string,"created_at"?: string,"delivered_at"?: string | null,"delivered_by"?: string | null,"delivery_document_id"?: string | null,"delivery_notes"?: string | null,"financial_closure_at"?: string | null,"financial_closure_by"?: string | null,"financial_closure_notes"?: string | null,"gate_pass_document_id"?: string | null,"gate_pass_issued_at"?: string | null,"gate_pass_issued_by"?: string | null,"gate_pass_no"?: string | null,"id"?: string,"keys_handed_over"?: boolean,"odometer_reading"?: number | null,"recipient_name"?: string | null,"recipient_relationship"?: string | null,"security_file_returned_at"?: string | null,"security_file_returned_by"?: string | null,"security_officer_name"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "archive_location"?: string | null,"archive_physical_audit"?: NonNullable<Json>,"archived_at"?: string | null,"archived_by"?: string | null,"booking_id"?: string,"branch_id"?: string,"created_at"?: string,"delivered_at"?: string | null,"delivered_by"?: string | null,"delivery_document_id"?: string | null,"delivery_notes"?: string | null,"financial_closure_at"?: string | null,"financial_closure_by"?: string | null,"financial_closure_notes"?: string | null,"gate_pass_document_id"?: string | null,"gate_pass_issued_at"?: string | null,"gate_pass_issued_by"?: string | null,"gate_pass_no"?: string | null,"id"?: string,"keys_handed_over"?: boolean,"odometer_reading"?: number | null,"recipient_name"?: string | null,"recipient_relationship"?: string | null,"security_file_returned_at"?: string | null,"security_file_returned_by"?: string | null,"security_officer_name"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "delivery_records_archived_by_fkey"
      columns: ["archived_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_records_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: true
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_records_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_records_delivered_by_fkey"
      columns: ["delivered_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_records_delivery_document_id_fkey"
      columns: ["delivery_document_id"]
isOneToOne: false
      referencedRelation: "booking_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_records_financial_closure_by_fkey"
      columns: ["financial_closure_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_records_gate_pass_document_id_fkey"
      columns: ["gate_pass_document_id"]
isOneToOne: false
      referencedRelation: "booking_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_records_gate_pass_issued_by_fkey"
      columns: ["gate_pass_issued_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_records_security_file_returned_by_fkey"
      columns: ["security_file_returned_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"insurance_policies": {
                  Row: {
                    "add_ons": NonNullable<Json>,"booking_id": string,"branch_id": string,"company_name": string | null,"created_at": string,"document_id": string | null,"hypothecation_bank": string | null,"id": string,"idv_amount": number | null,"issued_at": string | null,"issued_by": string | null,"nominee_age": number | null,"nominee_name": string | null,"nominee_relation": string | null,"policy_end_date": string | null,"policy_number": string | null,"policy_start_date": string | null,"policy_type": string,"premium_amount": number | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "add_ons"?: NonNullable<Json>,"booking_id": string,"branch_id": string,"company_name"?: string | null,"created_at"?: string,"document_id"?: string | null,"hypothecation_bank"?: string | null,"id"?: string,"idv_amount"?: number | null,"issued_at"?: string | null,"issued_by"?: string | null,"nominee_age"?: number | null,"nominee_name"?: string | null,"nominee_relation"?: string | null,"policy_end_date"?: string | null,"policy_number"?: string | null,"policy_start_date"?: string | null,"policy_type"?: string,"premium_amount"?: number | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "add_ons"?: NonNullable<Json>,"booking_id"?: string,"branch_id"?: string,"company_name"?: string | null,"created_at"?: string,"document_id"?: string | null,"hypothecation_bank"?: string | null,"id"?: string,"idv_amount"?: number | null,"issued_at"?: string | null,"issued_by"?: string | null,"nominee_age"?: number | null,"nominee_name"?: string | null,"nominee_relation"?: string | null,"policy_end_date"?: string | null,"policy_number"?: string | null,"policy_start_date"?: string | null,"policy_type"?: string,"premium_amount"?: number | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "insurance_policies_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: true
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "insurance_policies_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "insurance_policies_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "booking_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "insurance_policies_issued_by_fkey"
      columns: ["issued_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "active": boolean,"branch_id": string,"id": string,"revision": number,"role": Database["public"]['Enums']["staff_role"],"staff_id": string,"team_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"branch_id": string,"id"?: string,"revision"?: number,"role": Database["public"]['Enums']["staff_role"],"staff_id": string,"team_id"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"branch_id"?: string,"id"?: string,"revision"?: number,"role"?: Database["public"]['Enums']["staff_role"],"staff_id"?: string,"team_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_team_id_branch_id_fkey"
      columns: ["team_id","branch_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id","branch_id"]
    }
                  ]
                },"sales_submissions": {
                  Row: {
                    "allocated_at": string | null,"allocated_by": string | null,"allocation_ref": string | null,"allocator_name": string | null,"booking_id": string,"customer_intimated_at": string | null,"customer_intimated_by": string | null,"customer_intimation_notes": string | null,"file_revision": number,"received_at": string | null,"received_by": string | null,"receiver_name": string | null,"requirements_version": number,"sender_name": string,"sent_at": string,"sent_by": string,"sm_approved_at": string | null,"sm_approved_by": string | null,"sm_approver_name": string | null,"tl_approved_at": string | null,"tl_approved_by": string | null,"tl_approver_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "allocated_at"?: string | null,"allocated_by"?: string | null,"allocation_ref"?: string | null,"allocator_name"?: string | null,"booking_id": string,"customer_intimated_at"?: string | null,"customer_intimated_by"?: string | null,"customer_intimation_notes"?: string | null,"file_revision": number,"received_at"?: string | null,"received_by"?: string | null,"receiver_name"?: string | null,"requirements_version"?: number,"sender_name": string,"sent_at"?: string,"sent_by": string,"sm_approved_at"?: string | null,"sm_approved_by"?: string | null,"sm_approver_name"?: string | null,"tl_approved_at"?: string | null,"tl_approved_by"?: string | null,"tl_approver_name"?: string | null
                  }
                  Update: {
                    "allocated_at"?: string | null,"allocated_by"?: string | null,"allocation_ref"?: string | null,"allocator_name"?: string | null,"booking_id"?: string,"customer_intimated_at"?: string | null,"customer_intimated_by"?: string | null,"customer_intimation_notes"?: string | null,"file_revision"?: number,"received_at"?: string | null,"received_by"?: string | null,"receiver_name"?: string | null,"requirements_version"?: number,"sender_name"?: string,"sent_at"?: string,"sent_by"?: string,"sm_approved_at"?: string | null,"sm_approved_by"?: string | null,"sm_approver_name"?: string | null,"tl_approved_at"?: string | null,"tl_approved_by"?: string | null,"tl_approver_name"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_submissions_allocated_by_fkey"
      columns: ["allocated_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_submissions_booking_id_file_revision_fkey"
      columns: ["booking_id","file_revision"]
isOneToOne: false
      referencedRelation: "booking_versions"
      referencedColumns: ["booking_id","revision"]
    },{
      foreignKeyName: "sales_submissions_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: true
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_submissions_customer_intimated_by_fkey"
      columns: ["customer_intimated_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_submissions_received_by_fkey"
      columns: ["received_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_submissions_sent_by_fkey"
      columns: ["sent_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_submissions_sm_approved_by_fkey"
      columns: ["sm_approved_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_submissions_tl_approved_by_fkey"
      columns: ["tl_approved_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"staff": {
                  Row: {
                    "active": boolean,"display_name": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"display_name": string,"id": string
                  }
                  Update: {
                    "active"?: boolean,"display_name"?: string,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"staff_invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"branch_id": string,"created_at": string,"display_name": string,"email": string,"expires_at": string,"id": string,"invited_by": string,"role": Database["public"]['Enums']["staff_role"],"team_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"branch_id": string,"created_at"?: string,"display_name": string,"email": string,"expires_at"?: string,"id"?: string,"invited_by": string,"role": Database["public"]['Enums']["staff_role"],"team_id"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"branch_id"?: string,"created_at"?: string,"display_name"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string,"role"?: Database["public"]['Enums']["staff_role"],"team_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_invitations_accepted_by_fkey"
      columns: ["accepted_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_invitations_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_invitations_team_id_branch_id_fkey"
      columns: ["team_id","branch_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id","branch_id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "branch_id": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"id"?: string,"name": string
                  }
                  Update: {
                    "branch_id"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_branch_id_fkey"
      columns: ["branch_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_staff_invitation":
{ Args: { "p_invitation": string }; Returns: string
                           },
"acknowledge_fastag_handover":
{ Args: { "p_booking": string,"p_notes"?: string,"p_operation": string,"p_revision": number }; Returns: string
                           },
"allocate_vehicle_sm":
{ Args: { "p_allocation_ref": string,"p_booking": string,"p_operation": string,"p_revision": number }; Returns: string
                           },
"approve_booking_sm":
{ Args: { "p_allocation_ref": string,"p_booking": string,"p_operation": string,"p_revision": number }; Returns: string
                           },
"approve_booking_tl":
{ Args: { "p_booking": string,"p_operation": string,"p_revision": number }; Returns: string
                           },
"complete_accounts_clearance":
{ Args: { "p_booking": string,"p_operation": string,"p_revision": number }; Returns: string
                           },
"complete_staff_account":
{ Args: { "p_invitation": string }; Returns: string
                           },
"create_staff_invitation":
{ Args: { "p_branch": string,"p_email": string,"p_name": string,"p_operation": string,"p_role": Database["public"]['Enums']["staff_role"],"p_team"?: string }; Returns: string
                           },
"create_staff_team":
{ Args: { "p_branch": string,"p_name": string,"p_operation": string }; Returns: string
                           },
"dispatch_bo_department":
{ Args: { "p_booking": string,"p_operation": string,"p_revision": number,"p_target_dept": string }; Returns: string
                           },
"finalize_booking_document":
{ Args: { "p_attestation": string,"p_document": string,"p_revision": number }; Returns: string
                           },
"forward_accessories_to_accounts":
{ Args: { "p_booking": string,"p_operation": string,"p_revision": number }; Returns: string
                           },
"handover_to_bo_sm":
{ Args: { "p_booking": string,"p_operation": string,"p_revision": number }; Returns: string
                           },
"issue_gate_pass":
{ Args: { "p_booking": string,"p_document_id"?: string,"p_gate_pass_no": string,"p_odometer": number,"p_officer_name": string,"p_operation": string,"p_revision": number }; Returns: string
                           },
"receive_sales_file":
{ Args: { "p_booking": string,"p_revision": number }; Returns: string
                           },
"record_accessories_bill":
{ Args: { "p_bill_date": string,"p_bill_number": string,"p_booking": string,"p_cost_amount"?: number,"p_document_id"?: string,"p_labour_amount": number,"p_operation": string,"p_parts_amount": number,"p_revision": number,"p_total_amount": number }; Returns: string
                           },
"record_accessories_work":
{ Args: { "p_booking": string,"p_items": Json,"p_operation": string,"p_revision": number,"p_stock_status": string }; Returns: string
                           },
"record_bo_pdi":
{ Args: { "p_booking": string,"p_inspector": string,"p_notes": string,"p_operation": string,"p_revision": number,"p_status": string }; Returns: string
                           },
"record_bo_vahan_and_statutory":
{ Args: { "p_booking": string,"p_disclaimer_signed": boolean,"p_form20_signed": boolean,"p_operation": string,"p_revision": number,"p_vahan_app_no": string }; Returns: string
                           },
"record_booking_payment":
{ Args: { "p_amount": number,"p_booking": string,"p_method": string,"p_operation": string,"p_payment_type"?: string,"p_proof_document"?: string,"p_reference": string }; Returns: string
                           },
"record_customer_intimation":
{ Args: { "p_booking": string,"p_notes": string,"p_operation": string,"p_revision": number }; Returns: string
                           },
"record_document_download":
{ Args: { "p_document": string }; Returns: string
                           },
"record_fastag_issuance":
{ Args: { "p_booking": string,"p_fastag_bank": string,"p_fastag_tag_id": string,"p_operation": string,"p_revision": number,"p_security_deposit"?: number,"p_wallet_balance"?: number }; Returns: string
                           },
"record_final_archive":
{ Args: { "p_booking": string,"p_location": string,"p_operation": string,"p_physical_audit"?: Json,"p_revision": number }; Returns: string
                           },
"record_financial_closure":
{ Args: { "p_booking": string,"p_notes"?: string,"p_operation": string,"p_revision": number }; Returns: string
                           },
"record_insurance_policy":
{ Args: { "p_add_ons"?: Json,"p_booking": string,"p_company_name": string,"p_document_id"?: string,"p_end_date"?: string,"p_hypothecation_bank"?: string,"p_idv": number,"p_nominee_age"?: number,"p_nominee_name"?: string,"p_nominee_relation"?: string,"p_operation": string,"p_policy_number": string,"p_policy_type"?: string,"p_premium": number,"p_revision": number,"p_start_date"?: string }; Returns: string
                           },
"record_road_tax_payment":
{ Args: { "p_amount": number,"p_booking": string,"p_document_id"?: string,"p_operation": string,"p_paid_date": string,"p_payment_mode": string,"p_receipt_no": string,"p_revision": number }; Returns: string
                           },
"record_rto_registration":
{ Args: { "p_booking": string,"p_hsrp_status"?: string,"p_location": string,"p_operation": string,"p_rc_status"?: string,"p_registration_date": string,"p_registration_no": string,"p_revision": number }; Returns: string
                           },
"record_vehicle_delivery":
{ Args: { "p_booking": string,"p_document_id"?: string,"p_keys_handed_over"?: boolean,"p_notes"?: string,"p_operation": string,"p_recipient_name": string,"p_relationship"?: string,"p_revision": number }; Returns: string
                           },
"record_vehicle_invoice":
{ Args: { "p_booking": string,"p_document_id"?: string,"p_ex_showroom": number,"p_invoice_date": string,"p_invoice_number": string,"p_operation": string,"p_revision": number,"p_tcs"?: number,"p_total_amount": number }; Returns: string
                           },
"reserve_booking_document":
{ Args: { "p_booking": string,"p_filename": string,"p_kind": string,"p_mime": string,"p_operation": string,"p_revision": number,"p_sha256": string,"p_size": number }; Returns: string
                           },
"return_booking_tl":
{ Args: { "p_booking": string,"p_operation": string,"p_reason": string,"p_revision": number }; Returns: string
                           },
"return_file_to_accounts":
{ Args: { "p_booking": string,"p_operation": string,"p_revision": number }; Returns: string
                           },
"save_booking_draft":
{ Args: { "p_booking"?: string,"p_confirmed": boolean,"p_data": Json,"p_membership": string,"p_operation": string,"p_revision"?: number }; Returns: string
                           },
"send_booking_to_tl":
{ Args: { "p_booking": string,"p_operation": string,"p_revision": number }; Returns: string
                           },
"set_membership_active":
{ Args: { "p_active": boolean,"p_membership": string,"p_operation": string,"p_reason": string,"p_revision": number }; Returns: string
                           },
"sign_accessories_margin":
{ Args: { "p_booking": string,"p_operation": string,"p_revision": number }; Returns: string
                           },
"submit_accessories_to_bo":
{ Args: { "p_booking": string,"p_operation": string,"p_revision": number }; Returns: string
                           },
"verify_booking_payment":
{ Args: { "p_operation": string,"p_payment_id": string,"p_proof_document"?: string,"p_receipt_no": string }; Returns: string
                           },
"verify_public_gate_pass":
{ Args: { "p_booking_id": string }; Returns: Json
                           }
          }
          Enums: {
            "staff_role": "SO"|"TL"|"SM"|"BO"|"Insurance"|"Accounts"|"Cashier"|"Accessories"|"Security"|"Admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "staff_role": ["SO", "TL", "SM", "BO", "Insurance", "Accounts", "Cashier", "Accessories", "Security", "Admin"]
          }
        }
} as const
