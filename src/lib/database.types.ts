
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_events": {
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
                    "booking_id": string,"file_revision": number,"received_at": string | null,"received_by": string | null,"receiver_name": string | null,"requirements_version": number,"sender_name": string,"sent_at": string,"sent_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"file_revision": number,"received_at"?: string | null,"received_by"?: string | null,"receiver_name"?: string | null,"requirements_version"?: number,"sender_name": string,"sent_at"?: string,"sent_by": string
                  }
                  Update: {
                    "booking_id"?: string,"file_revision"?: number,"received_at"?: string | null,"received_by"?: string | null,"receiver_name"?: string | null,"requirements_version"?: number,"sender_name"?: string,"sent_at"?: string,"sent_by"?: string
                  }
                  Relationships: [
                    {
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
"complete_staff_account":
{ Args: { "p_invitation": string }; Returns: string
                           },
"create_staff_invitation":
{ Args: { "p_branch": string,"p_email": string,"p_name": string,"p_operation": string,"p_role": Database["public"]['Enums']["staff_role"],"p_team"?: string }; Returns: string
                           },
"create_staff_team":
{ Args: { "p_branch": string,"p_name": string,"p_operation": string }; Returns: string
                           },
"finalize_booking_document":
{ Args: { "p_attestation": string,"p_document": string,"p_revision": number }; Returns: string
                           },
"receive_sales_file":
{ Args: { "p_booking": string,"p_revision": number }; Returns: string
                           },
"record_document_download":
{ Args: { "p_document": string }; Returns: string
                           },
"reserve_booking_document":
{ Args: { "p_booking": string,"p_filename": string,"p_kind": string,"p_mime": string,"p_operation": string,"p_revision": number,"p_sha256": string,"p_size": number }; Returns: string
                           },
"save_booking_draft":
{ Args: { "p_booking"?: string,"p_confirmed": boolean,"p_data": Json,"p_membership": string,"p_operation": string,"p_revision"?: number }; Returns: string
                           },
"send_booking_to_tl":
{ Args: { "p_booking": string,"p_operation": string,"p_revision": number }; Returns: string
                           },
"set_membership_active":
{ Args: { "p_active": boolean,"p_membership": string,"p_operation": string,"p_reason": string,"p_revision": number }; Returns: string
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
