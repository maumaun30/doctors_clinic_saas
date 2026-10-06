export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      appointment_reminders: {
        Row: {
          appointment_id: string
          attempted_at: string
          channel: string
          error: string | null
          id: string
          provider_id: string | null
          scheduled_at: string
          status: string
        }
        Insert: {
          appointment_id: string
          attempted_at?: string
          channel: string
          error?: string | null
          id?: string
          provider_id?: string | null
          scheduled_at: string
          status: string
        }
        Update: {
          appointment_id?: string
          attempted_at?: string
          channel?: string
          error?: string | null
          id?: string
          provider_id?: string | null
          scheduled_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          doctor_id: string
          duration_minutes: number
          id: string
          notes: string | null
          patient_id: string
          scheduled_at: string
          source: string
          status: Database["public"]["Enums"]["appointment_status"]
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          doctor_id: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          patient_id: string
          scheduled_at: string
          source?: string
          status?: Database["public"]["Enums"]["appointment_status"]
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          doctor_id?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          patient_id?: string
          scheduled_at?: string
          source?: string
          status?: Database["public"]["Enums"]["appointment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          account_id: string | null
          actor_id: string | null
          after: Json | null
          before: Json | null
          id: number
          occurred_at: string
          operation: string
          row_id: string | null
          table_name: string
        }
        Insert: {
          account_id?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          id?: number
          occurred_at?: string
          operation: string
          row_id?: string | null
          table_name: string
        }
        Update: {
          account_id?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          id?: number
          occurred_at?: string
          operation?: string
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      clinic_assignments: {
        Row: {
          created_at: string
          doctor_clinic_id: string
          id: string
          secretary_id: string
        }
        Insert: {
          created_at?: string
          doctor_clinic_id: string
          id?: string
          secretary_id: string
        }
        Update: {
          created_at?: string
          doctor_clinic_id?: string
          id?: string
          secretary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_assignments_doctor_clinic_id_fkey"
            columns: ["doctor_clinic_id"]
            isOneToOne: false
            referencedRelation: "doctor_clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_assignments_secretary_id_fkey"
            columns: ["secretary_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          account_id: string
          address: string | null
          booking_slug: string | null
          created_at: string
          id: string
          name: string
          online_booking: boolean
        }
        Insert: {
          account_id: string
          address?: string | null
          booking_slug?: string | null
          created_at?: string
          id?: string
          name: string
          online_booking?: boolean
        }
        Update: {
          account_id?: string
          address?: string | null
          booking_slug?: string | null
          created_at?: string
          id?: string
          name?: string
          online_booking?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clinics_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      common_conditions: {
        Row: {
          account_id: string
          created_at: string
          icd_code: string | null
          id: string
          name: string
        }
        Insert: {
          account_id: string
          created_at?: string
          icd_code?: string | null
          id?: string
          name: string
        }
        Update: {
          account_id?: string
          created_at?: string
          icd_code?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "common_conditions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      common_lab_tests: {
        Row: {
          account_id: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          account_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          account_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "common_lab_tests_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      common_medications: {
        Row: {
          account_id: string
          created_at: string
          default_dosage: string | null
          default_frequency: string | null
          default_instructions: string | null
          id: string
          name: string
        }
        Insert: {
          account_id: string
          created_at?: string
          default_dosage?: string | null
          default_frequency?: string | null
          default_instructions?: string | null
          id?: string
          name: string
        }
        Update: {
          account_id?: string
          created_at?: string
          default_dosage?: string | null
          default_frequency?: string | null
          default_instructions?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "common_medications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_availability: {
        Row: {
          clinic_id: string
          doctor_id: string
          end_time: string
          id: string
          start_time: string
          weekday: number
        }
        Insert: {
          clinic_id: string
          doctor_id: string
          end_time: string
          id?: string
          start_time: string
          weekday: number
        }
        Update: {
          clinic_id?: string
          doctor_id?: string
          end_time?: string
          id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "doctor_availability_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_availability_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      doctor_clinics: {
        Row: {
          clinic_id: string
          created_at: string
          doctor_id: string
          id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          doctor_id: string
          id?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          doctor_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_clinics_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_clinics_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      doctors: {
        Row: {
          prc_license_no: string | null
          profile_id: string
          specialization: string | null
        }
        Insert: {
          prc_license_no?: string | null
          profile_id: string
          specialization?: string | null
        }
        Update: {
          prc_license_no?: string | null
          profile_id?: string
          specialization?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_orders: {
        Row: {
          created_at: string
          id: string
          lab_test_id: string | null
          medical_record_id: string
          name: string
          patient_id: string
          result: string | null
          result_at: string | null
          status: Database["public"]["Enums"]["lab_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          lab_test_id?: string | null
          medical_record_id: string
          name: string
          patient_id: string
          result?: string | null
          result_at?: string | null
          status?: Database["public"]["Enums"]["lab_status"]
        }
        Update: {
          created_at?: string
          id?: string
          lab_test_id?: string | null
          medical_record_id?: string
          name?: string
          patient_id?: string
          result?: string | null
          result_at?: string | null
          status?: Database["public"]["Enums"]["lab_status"]
        }
        Relationships: [
          {
            foreignKeyName: "lab_orders_lab_test_id_fkey"
            columns: ["lab_test_id"]
            isOneToOne: false
            referencedRelation: "common_lab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_result_files: {
        Row: {
          content_type: string | null
          file_name: string
          file_path: string
          id: string
          lab_order_id: string
          size_bytes: number | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string | null
          file_name: string
          file_path: string
          id?: string
          lab_order_id: string
          size_bytes?: number | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string | null
          file_name?: string
          file_path?: string
          id?: string
          lab_order_id?: string
          size_bytes?: number | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_result_files_lab_order_id_fkey"
            columns: ["lab_order_id"]
            isOneToOne: false
            referencedRelation: "lab_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_result_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_records: {
        Row: {
          appointment_id: string | null
          chief_complaint: string | null
          clinic_id: string
          created_at: string
          diagnosis: string | null
          doctor_id: string
          id: string
          notes: string | null
          patient_id: string
          visit_date: string
          vitals: Json | null
        }
        Insert: {
          appointment_id?: string | null
          chief_complaint?: string | null
          clinic_id: string
          created_at?: string
          diagnosis?: string | null
          doctor_id: string
          id?: string
          notes?: string | null
          patient_id: string
          visit_date?: string
          vitals?: Json | null
        }
        Update: {
          appointment_id?: string | null
          chief_complaint?: string | null
          clinic_id?: string
          created_at?: string
          diagnosis?: string | null
          doctor_id?: string
          id?: string
          notes?: string | null
          patient_id?: string
          visit_date?: string
          vitals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "medical_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      online_booking_attempts: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          ip_hash: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          ip_hash: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          ip_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "online_booking_attempts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_clinics: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          patient_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          patient_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_clinics_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_clinics_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_conditions: {
        Row: {
          condition_id: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          originating_medical_record_id: string | null
          patient_id: string
          resolved_at: string | null
          since: string | null
          status: Database["public"]["Enums"]["condition_status"]
        }
        Insert: {
          condition_id?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          originating_medical_record_id?: string | null
          patient_id: string
          resolved_at?: string | null
          since?: string | null
          status?: Database["public"]["Enums"]["condition_status"]
        }
        Update: {
          condition_id?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          originating_medical_record_id?: string | null
          patient_id?: string
          resolved_at?: string | null
          since?: string | null
          status?: Database["public"]["Enums"]["condition_status"]
        }
        Relationships: [
          {
            foreignKeyName: "patient_conditions_condition_id_fkey"
            columns: ["condition_id"]
            isOneToOne: false
            referencedRelation: "common_conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_conditions_originating_medical_record_id_fkey"
            columns: ["originating_medical_record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_conditions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          account_id: string
          address: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          sex: Database["public"]["Enums"]["sex_type"] | null
        }
        Insert: {
          account_id: string
          address?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          sex?: Database["public"]["Enums"]["sex_type"] | null
        }
        Update: {
          account_id?: string
          address?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          sex?: Database["public"]["Enums"]["sex_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          created_at: string
          dosage: string | null
          duration: string | null
          frequency: string | null
          id: string
          instructions: string | null
          medical_record_id: string
          medication_id: string | null
          name: string
          patient_id: string
        }
        Insert: {
          created_at?: string
          dosage?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medical_record_id: string
          medication_id?: string | null
          name: string
          patient_id: string
        }
        Update: {
          created_at?: string
          dosage?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medical_record_id?: string
          medication_id?: string | null
          name?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "common_medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_id: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          account_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _resolve_account_id: {
        Args: {
          p_table: string
          p_row: Json
        }
        Returns: string
      }
      admin_assign_user: {
        Args: {
          p_role: Database["public"]["Enums"]["user_role"]
          p_user_id: string
          p_account_id?: string
        }
        Returns: {
          account_id: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
      }
      appointments_for_reminder: {
        Args: {
          p_days_ahead?: number
        }
        Returns: {
          clinic_name: string
          clinic_address: string
          appointment_id: string
          scheduled_at: string
          duration_minutes: number
          patient_name: string
          patient_phone: string
          patient_email: string
          doctor_name: string
        }[]
      }
      available_slots: {
        Args: {
          p_clinic_id: string
          p_doctor_id: string
          p_date_local: string
          p_duration_minutes?: number
          p_step_minutes?: number
        }
        Returns: {
          slot_start: string
        }[]
      }
      book_appointment: {
        Args: {
          p_clinic_id: string
          p_scheduled_at: string
          p_duration_minutes?: number
          p_notes?: string
          p_patient_id: string
          p_doctor_id: string
        }
        Returns: {
          clinic_id: string
          created_at: string
          created_by: string | null
          doctor_id: string
          duration_minutes: number
          id: string
          notes: string | null
          patient_id: string
          scheduled_at: string
          source: string
          status: Database["public"]["Enums"]["appointment_status"]
        }
      }
      bootstrap_first_admin: {
        Args: {
          p_account_name: string
          p_email: string
        }
        Returns: {
          account_id: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
      }
      can_read_medical_record: {
        Args: {
          p_record_id: string
        }
        Returns: boolean
      }
      can_see_patient: {
        Args: {
          p_patient_id: string
        }
        Returns: boolean
      }
      can_touch_patient: {
        Args: {
          p_patient_id: string
        }
        Returns: boolean
      }
      clinics_for_caller: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      complete_appointment: {
        Args: {
          p_chief_complaint?: string
          p_diagnosis?: string
          p_vitals?: Json
          p_notes?: string
          p_appointment_id: string
        }
        Returns: {
          appointment_id: string | null
          chief_complaint: string | null
          clinic_id: string
          created_at: string
          diagnosis: string | null
          doctor_id: string
          id: string
          notes: string | null
          patient_id: string
          visit_date: string
          vitals: Json | null
        }
      }
      complete_visit_full: {
        Args: {
          p_conditions?: Json
          p_appointment_id: string
          p_chief_complaint: string
          p_diagnosis: string
          p_vitals: Json
          p_notes: string
          p_prescriptions?: Json
          p_labs?: Json
        }
        Returns: {
          appointment_id: string | null
          chief_complaint: string | null
          clinic_id: string
          created_at: string
          diagnosis: string | null
          doctor_id: string
          id: string
          notes: string | null
          patient_id: string
          visit_date: string
          vitals: Json | null
        }
      }
      create_patient: {
        Args: {
          p_sex?: Database["public"]["Enums"]["sex_type"]
          p_clinic_id: string
          p_full_name: string
          p_date_of_birth?: string
          p_phone?: string
          p_address?: string
          p_email?: string
        }
        Returns: {
          account_id: string
          address: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          sex: Database["public"]["Enums"]["sex_type"] | null
        }
      }
      current_account_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      current_role_v: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_assigned_secretary_clinic: {
        Args: {
          p_clinic_id: string
        }
        Returns: boolean
      }
      is_assigned_secretary_for: {
        Args: {
          p_clinic_id: string
          p_doctor_id: string
        }
        Returns: boolean
      }
      is_doctor_at: {
        Args: {
          p_clinic_id: string
        }
        Returns: boolean
      }
      list_pending_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          phone: string
          full_name: string
          created_at: string
          email: string
          id: string
        }[]
      }
      public_available_slots: {
        Args: {
          p_doctor_id: string
          p_date_local: string
          p_slug: string
        }
        Returns: {
          slot_start: string
        }[]
      }
      public_book_appointment: {
        Args: {
          p_full_name: string
          p_doctor_id: string
          p_phone: string
          p_email?: string
          p_date_of_birth?: string
          p_slug: string
          p_ip_hash?: string
          p_scheduled_at: string
        }
        Returns: {
          scheduled_at: string
          appointment_id: string
        }[]
      }
      public_booking_info: {
        Args: {
          p_slug: string
        }
        Returns: {
          clinic_id: string
          doctors: Json
          clinic_address: string
          clinic_name: string
        }[]
      }
      reschedule_appointment: {
        Args: {
          p_scheduled_at: string
          p_duration_minutes?: number
          p_appointment_id: string
        }
        Returns: {
          clinic_id: string
          created_at: string
          created_by: string | null
          doctor_id: string
          duration_minutes: number
          id: string
          notes: string | null
          patient_id: string
          scheduled_at: string
          source: string
          status: Database["public"]["Enums"]["appointment_status"]
        }
      }
      set_appointment_status: {
        Args: {
          p_status: Database["public"]["Enums"]["appointment_status"]
          p_appointment_id: string
        }
        Returns: {
          clinic_id: string
          created_at: string
          created_by: string | null
          doctor_id: string
          duration_minutes: number
          id: string
          notes: string | null
          patient_id: string
          scheduled_at: string
          source: string
          status: Database["public"]["Enums"]["appointment_status"]
        }
      }
    }
    Enums: {
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      condition_status: "active" | "resolved"
      lab_status: "ordered" | "in_progress" | "completed" | "cancelled"
      sex_type: "male" | "female" | "other"
      user_role: "pending" | "admin" | "doctor" | "secretary"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

