
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "accounts": {
                  Row: {
                    "created_at": string,"current_period_end": string | null,"id": string,"name": string,"seat_quantity": number | null,"stripe_customer_id": string | null,"stripe_subscription_id": string | null,"subscription_status": string | null,"trial_ends_at": string
                  }
                  Insert: {
                    "created_at"?: string,"current_period_end"?: string | null,"id"?: string,"name": string,"seat_quantity"?: number | null,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"subscription_status"?: string | null,"trial_ends_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"current_period_end"?: string | null,"id"?: string,"name"?: string,"seat_quantity"?: number | null,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"subscription_status"?: string | null,"trial_ends_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"appointment_reminders": {
                  Row: {
                    "appointment_id": string,"attempted_at": string,"channel": string,"error": string | null,"id": string,"provider_id": string | null,"scheduled_at": string,"status": string
                  }
                  Insert: {
                    "appointment_id": string,"attempted_at"?: string,"channel": string,"error"?: string | null,"id"?: string,"provider_id"?: string | null,"scheduled_at": string,"status": string
                  }
                  Update: {
                    "appointment_id"?: string,"attempted_at"?: string,"channel"?: string,"error"?: string | null,"id"?: string,"provider_id"?: string | null,"scheduled_at"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      columns: ["appointment_id"]
      foreignKeyName: "appointment_reminders_appointment_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "appointments"
    }
                  ]
                },"appointments": {
                  Row: {
                    "clinic_id": string,"created_at": string,"created_by": string | null,"doctor_id": string,"duration_minutes": number,"id": string,"notes": string | null,"patient_id": string,"patient_responded_at": string | null,"patient_response": string | null,"patient_token": string,"scheduled_at": string,"source": string,"status": Database["public"]['Enums']["appointment_status"]
                  }
                  Insert: {
                    "clinic_id": string,"created_at"?: string,"created_by"?: string | null,"doctor_id": string,"duration_minutes"?: number,"id"?: string,"notes"?: string | null,"patient_id": string,"patient_responded_at"?: string | null,"patient_response"?: string | null,"patient_token"?: string,"scheduled_at": string,"source"?: string,"status"?: Database["public"]['Enums']["appointment_status"]
                  }
                  Update: {
                    "clinic_id"?: string,"created_at"?: string,"created_by"?: string | null,"doctor_id"?: string,"duration_minutes"?: number,"id"?: string,"notes"?: string | null,"patient_id"?: string,"patient_responded_at"?: string | null,"patient_response"?: string | null,"patient_token"?: string,"scheduled_at"?: string,"source"?: string,"status"?: Database["public"]['Enums']["appointment_status"]
                  }
                  Relationships: [
                    {
      columns: ["clinic_id"]
      foreignKeyName: "appointments_clinic_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "clinics"
    },{
      columns: ["created_by"]
      foreignKeyName: "appointments_created_by_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "profiles"
    },{
      columns: ["created_by"]
      foreignKeyName: "appointments_created_by_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "staff_profiles"
    },{
      columns: ["doctor_id"]
      foreignKeyName: "appointments_doctor_id_fkey"
isOneToOne: false
      referencedColumns: ["profile_id"]
      referencedRelation: "doctors"
    },{
      columns: ["patient_id"]
      foreignKeyName: "appointments_patient_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "patients"
    }
                  ]
                },"audit_log": {
                  Row: {
                    "account_id": string | null,"actor_id": string | null,"after": Json | null,"before": Json | null,"id": number,"occurred_at": string,"operation": string,"row_id": string | null,"table_name": string
                  }
                  Insert: {
                    "account_id"?: string | null,"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"id"?: number,"occurred_at"?: string,"operation": string,"row_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "account_id"?: string | null,"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"id"?: number,"occurred_at"?: string,"operation"?: string,"row_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"clinic_assignments": {
                  Row: {
                    "created_at": string,"doctor_clinic_id": string,"id": string,"secretary_id": string
                  }
                  Insert: {
                    "created_at"?: string,"doctor_clinic_id": string,"id"?: string,"secretary_id": string
                  }
                  Update: {
                    "created_at"?: string,"doctor_clinic_id"?: string,"id"?: string,"secretary_id"?: string
                  }
                  Relationships: [
                    {
      columns: ["doctor_clinic_id"]
      foreignKeyName: "clinic_assignments_doctor_clinic_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "doctor_clinics"
    },{
      columns: ["secretary_id"]
      foreignKeyName: "clinic_assignments_secretary_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "profiles"
    },{
      columns: ["secretary_id"]
      foreignKeyName: "clinic_assignments_secretary_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "staff_profiles"
    }
                  ]
                },"clinics": {
                  Row: {
                    "account_id": string,"address": string | null,"booking_slug": string | null,"created_at": string,"id": string,"name": string,"online_booking": boolean
                  }
                  Insert: {
                    "account_id": string,"address"?: string | null,"booking_slug"?: string | null,"created_at"?: string,"id"?: string,"name": string,"online_booking"?: boolean
                  }
                  Update: {
                    "account_id"?: string,"address"?: string | null,"booking_slug"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"online_booking"?: boolean
                  }
                  Relationships: [
                    {
      columns: ["account_id"]
      foreignKeyName: "clinics_account_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "accounts"
    }
                  ]
                },"common_conditions": {
                  Row: {
                    "account_id": string,"created_at": string,"icd_code": string | null,"id": string,"name": string
                  }
                  Insert: {
                    "account_id": string,"created_at"?: string,"icd_code"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: string,"icd_code"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      columns: ["account_id"]
      foreignKeyName: "common_conditions_account_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "accounts"
    }
                  ]
                },"common_lab_tests": {
                  Row: {
                    "account_id": string,"created_at": string,"description": string | null,"id": string,"name": string
                  }
                  Insert: {
                    "account_id": string,"created_at"?: string,"description"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      columns: ["account_id"]
      foreignKeyName: "common_lab_tests_account_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "accounts"
    }
                  ]
                },"common_medications": {
                  Row: {
                    "account_id": string,"created_at": string,"default_dosage": string | null,"default_frequency": string | null,"default_instructions": string | null,"id": string,"name": string
                  }
                  Insert: {
                    "account_id": string,"created_at"?: string,"default_dosage"?: string | null,"default_frequency"?: string | null,"default_instructions"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: string,"default_dosage"?: string | null,"default_frequency"?: string | null,"default_instructions"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      columns: ["account_id"]
      foreignKeyName: "common_medications_account_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "accounts"
    }
                  ]
                },"doctor_availability": {
                  Row: {
                    "clinic_id": string,"doctor_id": string,"end_time": string,"id": string,"start_time": string,"weekday": number
                  }
                  Insert: {
                    "clinic_id": string,"doctor_id": string,"end_time": string,"id"?: string,"start_time": string,"weekday": number
                  }
                  Update: {
                    "clinic_id"?: string,"doctor_id"?: string,"end_time"?: string,"id"?: string,"start_time"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      columns: ["clinic_id"]
      foreignKeyName: "doctor_availability_clinic_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "clinics"
    },{
      columns: ["doctor_id"]
      foreignKeyName: "doctor_availability_doctor_id_fkey"
isOneToOne: false
      referencedColumns: ["profile_id"]
      referencedRelation: "doctors"
    }
                  ]
                },"doctor_clinics": {
                  Row: {
                    "clinic_id": string,"created_at": string,"doctor_id": string,"id": string
                  }
                  Insert: {
                    "clinic_id": string,"created_at"?: string,"doctor_id": string,"id"?: string
                  }
                  Update: {
                    "clinic_id"?: string,"created_at"?: string,"doctor_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      columns: ["clinic_id"]
      foreignKeyName: "doctor_clinics_clinic_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "clinics"
    },{
      columns: ["doctor_id"]
      foreignKeyName: "doctor_clinics_doctor_id_fkey"
isOneToOne: false
      referencedColumns: ["profile_id"]
      referencedRelation: "doctors"
    }
                  ]
                },"doctors": {
                  Row: {
                    "prc_license_no": string | null,"profile_id": string,"specialization": string | null
                  }
                  Insert: {
                    "prc_license_no"?: string | null,"profile_id": string,"specialization"?: string | null
                  }
                  Update: {
                    "prc_license_no"?: string | null,"profile_id"?: string,"specialization"?: string | null
                  }
                  Relationships: [
                    {
      columns: ["profile_id"]
      foreignKeyName: "doctors_profile_id_fkey"
isOneToOne: true
      referencedColumns: ["id"]
      referencedRelation: "profiles"
    },{
      columns: ["profile_id"]
      foreignKeyName: "doctors_profile_id_fkey"
isOneToOne: true
      referencedColumns: ["id"]
      referencedRelation: "staff_profiles"
    }
                  ]
                },"lab_orders": {
                  Row: {
                    "created_at": string,"id": string,"lab_test_id": string | null,"medical_record_id": string,"name": string,"patient_id": string,"result": string | null,"result_at": string | null,"status": Database["public"]['Enums']["lab_status"]
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"lab_test_id"?: string | null,"medical_record_id": string,"name": string,"patient_id": string,"result"?: string | null,"result_at"?: string | null,"status"?: Database["public"]['Enums']["lab_status"]
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"lab_test_id"?: string | null,"medical_record_id"?: string,"name"?: string,"patient_id"?: string,"result"?: string | null,"result_at"?: string | null,"status"?: Database["public"]['Enums']["lab_status"]
                  }
                  Relationships: [
                    {
      columns: ["lab_test_id"]
      foreignKeyName: "lab_orders_lab_test_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "common_lab_tests"
    },{
      columns: ["medical_record_id"]
      foreignKeyName: "lab_orders_medical_record_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "medical_records"
    },{
      columns: ["patient_id"]
      foreignKeyName: "lab_orders_patient_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "patients"
    }
                  ]
                },"lab_result_files": {
                  Row: {
                    "content_type": string | null,"file_name": string,"file_path": string,"id": string,"lab_order_id": string,"size_bytes": number | null,"uploaded_at": string,"uploaded_by": string | null
                  }
                  Insert: {
                    "content_type"?: string | null,"file_name": string,"file_path": string,"id"?: string,"lab_order_id": string,"size_bytes"?: number | null,"uploaded_at"?: string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "content_type"?: string | null,"file_name"?: string,"file_path"?: string,"id"?: string,"lab_order_id"?: string,"size_bytes"?: number | null,"uploaded_at"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      columns: ["lab_order_id"]
      foreignKeyName: "lab_result_files_lab_order_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "lab_orders"
    },{
      columns: ["uploaded_by"]
      foreignKeyName: "lab_result_files_uploaded_by_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "profiles"
    },{
      columns: ["uploaded_by"]
      foreignKeyName: "lab_result_files_uploaded_by_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "staff_profiles"
    }
                  ]
                },"medical_records": {
                  Row: {
                    "appointment_id": string | null,"chief_complaint": string | null,"clinic_id": string,"created_at": string,"diagnosis": string | null,"doctor_id": string,"id": string,"notes": string | null,"patient_id": string,"visit_date": string,"vitals": Json | null
                  }
                  Insert: {
                    "appointment_id"?: string | null,"chief_complaint"?: string | null,"clinic_id": string,"created_at"?: string,"diagnosis"?: string | null,"doctor_id": string,"id"?: string,"notes"?: string | null,"patient_id": string,"visit_date"?: string,"vitals"?: Json | null
                  }
                  Update: {
                    "appointment_id"?: string | null,"chief_complaint"?: string | null,"clinic_id"?: string,"created_at"?: string,"diagnosis"?: string | null,"doctor_id"?: string,"id"?: string,"notes"?: string | null,"patient_id"?: string,"visit_date"?: string,"vitals"?: Json | null
                  }
                  Relationships: [
                    {
      columns: ["appointment_id"]
      foreignKeyName: "medical_records_appointment_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "appointments"
    },{
      columns: ["clinic_id"]
      foreignKeyName: "medical_records_clinic_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "clinics"
    },{
      columns: ["doctor_id"]
      foreignKeyName: "medical_records_doctor_id_fkey"
isOneToOne: false
      referencedColumns: ["profile_id"]
      referencedRelation: "doctors"
    },{
      columns: ["patient_id"]
      foreignKeyName: "medical_records_patient_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "patients"
    }
                  ]
                },"online_booking_attempts": {
                  Row: {
                    "clinic_id": string,"created_at": string,"id": string,"ip_hash": string
                  }
                  Insert: {
                    "clinic_id": string,"created_at"?: string,"id"?: string,"ip_hash": string
                  }
                  Update: {
                    "clinic_id"?: string,"created_at"?: string,"id"?: string,"ip_hash"?: string
                  }
                  Relationships: [
                    {
      columns: ["clinic_id"]
      foreignKeyName: "online_booking_attempts_clinic_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "clinics"
    }
                  ]
                },"patient_clinics": {
                  Row: {
                    "clinic_id": string,"created_at": string,"id": string,"patient_id": string
                  }
                  Insert: {
                    "clinic_id": string,"created_at"?: string,"id"?: string,"patient_id": string
                  }
                  Update: {
                    "clinic_id"?: string,"created_at"?: string,"id"?: string,"patient_id"?: string
                  }
                  Relationships: [
                    {
      columns: ["clinic_id"]
      foreignKeyName: "patient_clinics_clinic_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "clinics"
    },{
      columns: ["patient_id"]
      foreignKeyName: "patient_clinics_patient_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "patients"
    }
                  ]
                },"patient_conditions": {
                  Row: {
                    "condition_id": string | null,"created_at": string,"id": string,"name": string,"notes": string | null,"originating_medical_record_id": string | null,"patient_id": string,"resolved_at": string | null,"since": string | null,"status": Database["public"]['Enums']["condition_status"]
                  }
                  Insert: {
                    "condition_id"?: string | null,"created_at"?: string,"id"?: string,"name": string,"notes"?: string | null,"originating_medical_record_id"?: string | null,"patient_id": string,"resolved_at"?: string | null,"since"?: string | null,"status"?: Database["public"]['Enums']["condition_status"]
                  }
                  Update: {
                    "condition_id"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"notes"?: string | null,"originating_medical_record_id"?: string | null,"patient_id"?: string,"resolved_at"?: string | null,"since"?: string | null,"status"?: Database["public"]['Enums']["condition_status"]
                  }
                  Relationships: [
                    {
      columns: ["condition_id"]
      foreignKeyName: "patient_conditions_condition_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "common_conditions"
    },{
      columns: ["originating_medical_record_id"]
      foreignKeyName: "patient_conditions_originating_medical_record_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "medical_records"
    },{
      columns: ["patient_id"]
      foreignKeyName: "patient_conditions_patient_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "patients"
    }
                  ]
                },"patient_not_duplicates": {
                  Row: {
                    "account_id": string,"dismissed_at": string,"dismissed_by": string | null,"patient_a": string,"patient_b": string
                  }
                  Insert: {
                    "account_id": string,"dismissed_at"?: string,"dismissed_by"?: string | null,"patient_a": string,"patient_b": string
                  }
                  Update: {
                    "account_id"?: string,"dismissed_at"?: string,"dismissed_by"?: string | null,"patient_a"?: string,"patient_b"?: string
                  }
                  Relationships: [
                    {
      columns: ["account_id"]
      foreignKeyName: "patient_not_duplicates_account_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "accounts"
    },{
      columns: ["dismissed_by"]
      foreignKeyName: "patient_not_duplicates_dismissed_by_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "profiles"
    },{
      columns: ["dismissed_by"]
      foreignKeyName: "patient_not_duplicates_dismissed_by_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "staff_profiles"
    },{
      columns: ["patient_a"]
      foreignKeyName: "patient_not_duplicates_patient_a_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "patients"
    },{
      columns: ["patient_b"]
      foreignKeyName: "patient_not_duplicates_patient_b_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "patients"
    }
                  ]
                },"patients": {
                  Row: {
                    "account_id": string,"address": string | null,"created_at": string,"date_of_birth": string | null,"email": string | null,"full_name": string,"id": string,"phone": string | null,"sex": Database["public"]['Enums']["sex_type"] | null
                  }
                  Insert: {
                    "account_id": string,"address"?: string | null,"created_at"?: string,"date_of_birth"?: string | null,"email"?: string | null,"full_name": string,"id"?: string,"phone"?: string | null,"sex"?: Database["public"]['Enums']["sex_type"] | null
                  }
                  Update: {
                    "account_id"?: string,"address"?: string | null,"created_at"?: string,"date_of_birth"?: string | null,"email"?: string | null,"full_name"?: string,"id"?: string,"phone"?: string | null,"sex"?: Database["public"]['Enums']["sex_type"] | null
                  }
                  Relationships: [
                    {
      columns: ["account_id"]
      foreignKeyName: "patients_account_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "accounts"
    }
                  ]
                },"prescriptions": {
                  Row: {
                    "created_at": string,"dosage": string | null,"duration": string | null,"frequency": string | null,"id": string,"instructions": string | null,"medical_record_id": string,"medication_id": string | null,"name": string,"patient_id": string
                  }
                  Insert: {
                    "created_at"?: string,"dosage"?: string | null,"duration"?: string | null,"frequency"?: string | null,"id"?: string,"instructions"?: string | null,"medical_record_id": string,"medication_id"?: string | null,"name": string,"patient_id": string
                  }
                  Update: {
                    "created_at"?: string,"dosage"?: string | null,"duration"?: string | null,"frequency"?: string | null,"id"?: string,"instructions"?: string | null,"medical_record_id"?: string,"medication_id"?: string | null,"name"?: string,"patient_id"?: string
                  }
                  Relationships: [
                    {
      columns: ["medical_record_id"]
      foreignKeyName: "prescriptions_medical_record_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "medical_records"
    },{
      columns: ["medication_id"]
      foreignKeyName: "prescriptions_medication_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "common_medications"
    },{
      columns: ["patient_id"]
      foreignKeyName: "prescriptions_patient_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "patients"
    }
                  ]
                },"profiles": {
                  Row: {
                    "account_id": string | null,"avatar_path": string | null,"created_at": string,"deactivated_at": string | null,"deactivated_by": string | null,"full_name": string | null,"id": string,"phone": string | null,"role": Database["public"]['Enums']["user_role"]
                  }
                  Insert: {
                    "account_id"?: string | null,"avatar_path"?: string | null,"created_at"?: string,"deactivated_at"?: string | null,"deactivated_by"?: string | null,"full_name"?: string | null,"id": string,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Update: {
                    "account_id"?: string | null,"avatar_path"?: string | null,"created_at"?: string,"deactivated_at"?: string | null,"deactivated_by"?: string | null,"full_name"?: string | null,"id"?: string,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Relationships: [
                    {
      columns: ["account_id"]
      foreignKeyName: "profiles_account_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "accounts"
    },{
      columns: ["deactivated_by"]
      foreignKeyName: "profiles_deactivated_by_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "profiles"
    },{
      columns: ["deactivated_by"]
      foreignKeyName: "profiles_deactivated_by_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "staff_profiles"
    }
                  ]
                },"staff_invites": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"account_id": string,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string | null,"revoked_at": string | null,"role": Database["public"]['Enums']["user_role"]
                  }
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"account_id": string,"created_at"?: string,"email": string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"revoked_at"?: string | null,"role": Database["public"]['Enums']["user_role"]
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"account_id"?: string,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Relationships: [
                    {
      columns: ["accepted_by"]
      foreignKeyName: "staff_invites_accepted_by_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "profiles"
    },{
      columns: ["accepted_by"]
      foreignKeyName: "staff_invites_accepted_by_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "staff_profiles"
    },{
      columns: ["account_id"]
      foreignKeyName: "staff_invites_account_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "accounts"
    },{
      columns: ["invited_by"]
      foreignKeyName: "staff_invites_invited_by_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "profiles"
    },{
      columns: ["invited_by"]
      foreignKeyName: "staff_invites_invited_by_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "staff_profiles"
    }
                  ]
                },"stripe_events": {
                  Row: {
                    "id": string,"received_at": string,"type": string
                  }
                  Insert: {
                    "id": string,"received_at"?: string,"type": string
                  }
                  Update: {
                    "id"?: string,"received_at"?: string,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "staff_profiles": {
                  Row: {
                    "account_id": string | null,"active": boolean | null,"avatar_path": string | null,"full_name": string | null,"id": string | null,"role": Database["public"]['Enums']["user_role"] | null
                  }
                  Insert: {
                           "account_id"?: string | null,"active"?: never,"avatar_path"?: string | null,"full_name"?: string | null,"id"?: string | null,"role"?: Database["public"]['Enums']["user_role"] | null
                         }
                        Update: {
                           "account_id"?: string | null,"active"?: never,"avatar_path"?: string | null,"full_name"?: string | null,"id"?: string | null,"role"?: Database["public"]['Enums']["user_role"] | null
                         }
                        Relationships: [
                    {
      columns: ["account_id"]
      foreignKeyName: "profiles_account_id_fkey"
isOneToOne: false
      referencedColumns: ["id"]
      referencedRelation: "accounts"
    }
                  ]
                }
          }
          Functions: {
            "_resolve_account_id":
{ Args: { "p_row": Json,"p_table": string }; Returns: string
                           },
"accept_pending_invite":
{ Args: Record<PropertyKey, never>; Returns: {
              "account_id": string,"role": Database["public"]['Enums']["user_role"]
            }[]
                           },
"account_is_active":
{ Args: { "p_account_id": string }; Returns: boolean
                           },
"admin_assign_user":
{ Args: { "p_account_id"?: string,"p_role": Database["public"]['Enums']["user_role"],"p_user_id": string }; Returns: {
              "account_id": string | null,
"avatar_path": string | null,
"created_at": string,
"deactivated_at": string | null,
"deactivated_by": string | null,
"full_name": string | null,
"id": string,
"phone": string | null,
"role": Database["public"]['Enums']["user_role"]
            }
                          SetofOptions: {
        from: "*"
        isOneToOne: true
        isSetofReturn: false
        to: "profiles"
      } },
"admin_find_duplicate_patients":
{ Args: { "p_limit"?: number }; Returns: {
              "patient_a": string,"patient_b": string,"reason": string
            }[]
                           },
"admin_merge_patients":
{ Args: { "p_keep": string,"p_remove": string }; Returns: Json
                           },
"admin_set_staff_active":
{ Args: { "p_active": boolean,"p_user_id": string }; Returns: undefined
                           },
"appointments_for_reminder":
{ Args: { "p_channel"?: string,"p_days_ahead"?: number }; Returns: {
              "appointment_id": string,"clinic_address": string,"clinic_name": string,"doctor_name": string,"duration_minutes": number,"patient_email": string,"patient_name": string,"patient_phone": string,"patient_token": string,"scheduled_at": string
            }[]
                           },
"available_slots":
{ Args: { "p_clinic_id": string,"p_date_local": string,"p_doctor_id": string,"p_duration_minutes"?: number,"p_step_minutes"?: number }; Returns: {
              "slot_start": string
            }[]
                           },
"book_appointment":
{ Args: { "p_clinic_id": string,"p_doctor_id": string,"p_duration_minutes"?: number,"p_notes"?: string,"p_patient_id": string,"p_scheduled_at": string }; Returns: {
              "clinic_id": string,
"created_at": string,
"created_by": string | null,
"doctor_id": string,
"duration_minutes": number,
"id": string,
"notes": string | null,
"patient_id": string,
"patient_responded_at": string | null,
"patient_response": string | null,
"patient_token": string,
"scheduled_at": string,
"source": string,
"status": Database["public"]['Enums']["appointment_status"]
            }
                          SetofOptions: {
        from: "*"
        isOneToOne: true
        isSetofReturn: false
        to: "appointments"
      } },
"bootstrap_first_admin":
{ Args: { "p_account_name": string,"p_email": string }; Returns: {
              "account_id": string | null,
"avatar_path": string | null,
"created_at": string,
"deactivated_at": string | null,
"deactivated_by": string | null,
"full_name": string | null,
"id": string,
"phone": string | null,
"role": Database["public"]['Enums']["user_role"]
            }
                          SetofOptions: {
        from: "*"
        isOneToOne: true
        isSetofReturn: false
        to: "profiles"
      } },
"caller_is_active":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"can_read_medical_record":
{ Args: { "p_record_id": string }; Returns: boolean
                           },
"can_see_patient":
{ Args: { "p_patient_id": string }; Returns: boolean
                           },
"can_touch_patient":
{ Args: { "p_patient_id": string }; Returns: boolean
                           },
"clinics_for_caller":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"complete_appointment":
{ Args: { "p_appointment_id": string,"p_chief_complaint"?: string,"p_diagnosis"?: string,"p_notes"?: string,"p_vitals"?: Json }; Returns: {
              "appointment_id": string | null,
"chief_complaint": string | null,
"clinic_id": string,
"created_at": string,
"diagnosis": string | null,
"doctor_id": string,
"id": string,
"notes": string | null,
"patient_id": string,
"visit_date": string,
"vitals": Json | null
            }
                          SetofOptions: {
        from: "*"
        isOneToOne: true
        isSetofReturn: false
        to: "medical_records"
      } },
"complete_visit_full":
{ Args: { "p_appointment_id": string,"p_chief_complaint": string,"p_conditions"?: Json,"p_diagnosis": string,"p_labs"?: Json,"p_notes": string,"p_prescriptions"?: Json,"p_vitals": Json }; Returns: {
              "appointment_id": string | null,
"chief_complaint": string | null,
"clinic_id": string,
"created_at": string,
"diagnosis": string | null,
"doctor_id": string,
"id": string,
"notes": string | null,
"patient_id": string,
"visit_date": string,
"vitals": Json | null
            }
                          SetofOptions: {
        from: "*"
        isOneToOne: true
        isSetofReturn: false
        to: "medical_records"
      } },
"create_patient":
{ Args: { "p_address"?: string,"p_clinic_id": string,"p_date_of_birth"?: string,"p_email"?: string,"p_full_name": string,"p_phone"?: string,"p_sex"?: Database["public"]['Enums']["sex_type"] }; Returns: {
              "account_id": string,
"address": string | null,
"created_at": string,
"date_of_birth": string | null,
"email": string | null,
"full_name": string,
"id": string,
"phone": string | null,
"sex": Database["public"]['Enums']["sex_type"] | null
            }
                          SetofOptions: {
        from: "*"
        isOneToOne: true
        isSetofReturn: false
        to: "patients"
      } },
"current_account_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"current_role_v":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_assigned_secretary_clinic":
{ Args: { "p_clinic_id": string }; Returns: boolean
                           },
"is_assigned_secretary_for":
{ Args: { "p_clinic_id": string,"p_doctor_id": string }; Returns: boolean
                           },
"is_doctor_at":
{ Args: { "p_clinic_id": string }; Returns: boolean
                           },
"list_pending_users":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"email": string,"full_name": string,"id": string,"phone": string
            }[]
                           },
"my_billing_status":
{ Args: Record<PropertyKey, never>; Returns: {
              "account_id": string,"current_period_end": string,"doctor_count": number,"has_customer": boolean,"is_active": boolean,"seat_quantity": number,"subscription_status": string,"trial_ends_at": string
            }[]
                           },
"public_appointment":
{ Args: { "p_token": string }; Returns: {
              "can_cancel": boolean,"can_confirm": boolean,"clinic_address": string,"clinic_name": string,"doctor_name": string,"duration_minutes": number,"patient_first_name": string,"patient_response": string,"scheduled_at": string,"status": Database["public"]['Enums']["appointment_status"]
            }[]
                           },
"public_available_slots":
{ Args: { "p_date_local": string,"p_doctor_id": string,"p_slug": string }; Returns: {
              "slot_start": string
            }[]
                           },
"public_book_appointment":
{ Args: { "p_date_of_birth"?: string,"p_doctor_id": string,"p_email"?: string,"p_full_name": string,"p_ip_hash"?: string,"p_phone": string,"p_scheduled_at": string,"p_slug": string }; Returns: {
              "appointment_id": string,"scheduled_at": string
            }[]
                           },
"public_booking_info":
{ Args: { "p_slug": string }; Returns: {
              "clinic_address": string,"clinic_id": string,"clinic_name": string,"doctors": Json
            }[]
                           },
"public_respond_appointment":
{ Args: { "p_action": string,"p_token": string }; Returns: Database["public"]['Enums']["appointment_status"]
                           },
"reschedule_appointment":
{ Args: { "p_appointment_id": string,"p_duration_minutes"?: number,"p_scheduled_at": string }; Returns: {
              "clinic_id": string,
"created_at": string,
"created_by": string | null,
"doctor_id": string,
"duration_minutes": number,
"id": string,
"notes": string | null,
"patient_id": string,
"patient_responded_at": string | null,
"patient_response": string | null,
"patient_token": string,
"scheduled_at": string,
"source": string,
"status": Database["public"]['Enums']["appointment_status"]
            }
                          SetofOptions: {
        from: "*"
        isOneToOne: true
        isSetofReturn: false
        to: "appointments"
      } },
"set_appointment_status":
{ Args: { "p_appointment_id": string,"p_status": Database["public"]['Enums']["appointment_status"] }; Returns: {
              "clinic_id": string,
"created_at": string,
"created_by": string | null,
"doctor_id": string,
"duration_minutes": number,
"id": string,
"notes": string | null,
"patient_id": string,
"patient_responded_at": string | null,
"patient_response": string | null,
"patient_token": string,
"scheduled_at": string,
"source": string,
"status": Database["public"]['Enums']["appointment_status"]
            }
                          SetofOptions: {
        from: "*"
        isOneToOne: true
        isSetofReturn: false
        to: "appointments"
      } }
          }
          Enums: {
            "appointment_status": "scheduled"|"confirmed"|"completed"|"cancelled"|"no_show","condition_status": "active"|"resolved","lab_status": "ordered"|"in_progress"|"completed"|"cancelled","sex_type": "male"|"female"|"other","user_role": "pending"|"admin"|"doctor"|"secretary"
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
            "appointment_status": ["scheduled", "confirmed", "completed", "cancelled", "no_show"],"condition_status": ["active", "resolved"],"lab_status": ["ordered", "in_progress", "completed", "cancelled"],"sex_type": ["male", "female", "other"],"user_role": ["pending", "admin", "doctor", "secretary"]
          }
        }
} as const
