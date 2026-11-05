// Generated from the hosted Supabase schema. Do not edit by hand. Regenerate with: npm run types:generate
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          hr_contact_name: string | null
          hr_contact_phone: string | null
          id: boolean
          organization_name: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          hr_contact_name?: string | null
          hr_contact_phone?: string | null
          id?: boolean
          organization_name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          hr_contact_name?: string | null
          hr_contact_phone?: string | null
          id?: boolean
          organization_name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      card_assignments: {
        Row: {
          card_id: string
          id: string
          issued_at: string
          issued_by: string
          returned_at: string | null
          returned_by: string | null
          visit_id: string
        }
        Insert: {
          card_id: string
          id?: string
          issued_at?: string
          issued_by: string
          returned_at?: string | null
          returned_by?: string | null
          visit_id: string
        }
        Update: {
          card_id?: string
          id?: string
          issued_at?: string
          issued_by?: string
          returned_at?: string | null
          returned_by?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_assignments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "visitor_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_assignments_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_assignments_returned_by_fkey"
            columns: ["returned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_assignments_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_assignments_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          can_register_visitors: boolean
          created_at: string
          designation: string | null
          employee_code: string
          full_name: string
          id: string
          official_email: string
          phone: string | null
          team: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          can_register_visitors?: boolean
          created_at?: string
          designation?: string | null
          employee_code: string
          full_name: string
          id?: string
          official_email: string
          phone?: string | null
          team?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          can_register_visitors?: boolean
          created_at?: string
          designation?: string | null
          employee_code?: string
          full_name?: string
          id?: string
          official_email?: string
          phone?: string | null
          team?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          recipient_id: string
          type: Database["public"]["Enums"]["notification_type"]
          visit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipient_id: string
          type: Database["public"]["Enums"]["notification_type"]
          visit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recipient_id?: string
          type?: Database["public"]["Enums"]["notification_type"]
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activated_at: string | null
          active: boolean
          created_at: string
          email: string | null
          employee_id: string | null
          full_name: string
          id: string
          invited_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          active?: boolean
          created_at?: string
          email?: string | null
          employee_id?: string | null
          full_name: string
          id: string
          invited_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          active?: boolean
          created_at?: string
          email?: string | null
          employee_id?: string | null
          full_name?: string
          id?: string
          invited_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employee_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_cards: {
        Row: {
          card_number: string
          created_at: string
          created_by: string | null
          id: string
          status: Database["public"]["Enums"]["card_status"]
          updated_at: string
        }
        Insert: {
          card_number: string
          created_at?: string
          created_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["card_status"]
          updated_at?: string
        }
        Update: {
          card_number?: string
          created_at?: string
          created_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["card_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_cards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visitors: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string
          updated_at: string
          visitor_code: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          phone: string
          updated_at?: string
          visitor_code?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string
          updated_at?: string
          visitor_code?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          actual_guest_count: number | null
          category: Database["public"]["Enums"]["visitor_category"]
          checked_in_at: string | null
          checked_out_at: string | null
          company_organization: string | null
          created_at: string
          guest_count: number
          id: string
          invited_by_employee_id: string | null
          invited_by_name: string | null
          purpose: string
          registered_by: string | null
          scheduled_arrival_at: string | null
          scheduled_departure_at: string | null
          source: Database["public"]["Enums"]["registration_source"]
          status: Database["public"]["Enums"]["visit_status"]
          updated_at: string
          visitor_id: string
        }
        Insert: {
          actual_guest_count?: number | null
          category: Database["public"]["Enums"]["visitor_category"]
          checked_in_at?: string | null
          checked_out_at?: string | null
          company_organization?: string | null
          created_at?: string
          guest_count?: number
          id?: string
          invited_by_employee_id?: string | null
          invited_by_name?: string | null
          purpose: string
          registered_by?: string | null
          scheduled_arrival_at?: string | null
          scheduled_departure_at?: string | null
          source: Database["public"]["Enums"]["registration_source"]
          status?: Database["public"]["Enums"]["visit_status"]
          updated_at?: string
          visitor_id: string
        }
        Update: {
          actual_guest_count?: number | null
          category?: Database["public"]["Enums"]["visitor_category"]
          checked_in_at?: string | null
          checked_out_at?: string | null
          company_organization?: string | null
          created_at?: string
          guest_count?: number
          id?: string
          invited_by_employee_id?: string | null
          invited_by_name?: string | null
          purpose?: string
          registered_by?: string | null
          scheduled_arrival_at?: string | null
          scheduled_departure_at?: string | null
          source?: Database["public"]["Enums"]["registration_source"]
          status?: Database["public"]["Enums"]["visit_status"]
          updated_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_invited_by_employee_id_fkey"
            columns: ["invited_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_invited_by_employee_id_fkey"
            columns: ["invited_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_invited_by_employee_id_fkey"
            columns: ["invited_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      employee_directory: {
        Row: {
          full_name: string | null
          id: string | null
          team: string | null
        }
        Insert: {
          full_name?: string | null
          id?: string | null
          team?: string | null
        }
        Update: {
          full_name?: string | null
          id?: string | null
          team?: string | null
        }
        Relationships: []
      }
      employee_names: {
        Row: {
          full_name: string | null
          id: string | null
          team: string | null
        }
        Insert: {
          full_name?: string | null
          id?: string | null
          team?: string | null
        }
        Update: {
          full_name?: string | null
          id?: string | null
          team?: string | null
        }
        Relationships: []
      }
      visit_overview: {
        Row: {
          actual_guest_count: number | null
          card_numbers: string | null
          cards_out: number | null
          category: Database["public"]["Enums"]["visitor_category"] | null
          checked_in_at: string | null
          checked_out_at: string | null
          company_organization: string | null
          created_at: string | null
          first_issued_at: string | null
          guest_count: number | null
          host_name: string | null
          host_team: string | null
          id: string | null
          invited_by_employee_id: string | null
          invited_by_name: string | null
          last_returned_at: string | null
          phone: string | null
          purpose: string | null
          registered_by: string | null
          scheduled_arrival_at: string | null
          scheduled_departure_at: string | null
          source: Database["public"]["Enums"]["registration_source"] | null
          status: Database["public"]["Enums"]["visit_status"] | null
          visit_at: string | null
          visitor_code: string | null
          visitor_id: string | null
          visitor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_invited_by_employee_id_fkey"
            columns: ["invited_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_invited_by_employee_id_fkey"
            columns: ["invited_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employee_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_invited_by_employee_id_fkey"
            columns: ["invited_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_create_profile: {
        Args: {
          p_email: string
          p_employee_id?: string
          p_full_name: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      admin_mark_invited: { Args: { p_user_id: string }; Returns: undefined }
      auth_employee_id: { Args: never; Returns: string }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      check_in_visit: {
        Args: {
          p_actual_guest_count?: number
          p_card_ids: string[]
          p_visit_id: string
        }
        Returns: Json
      }
      check_out_visit: {
        Args: { p_card_returned: boolean; p_visit_id: string }
        Returns: Json
      }
      import_candidates: {
        Args: { p_default_purpose?: string; p_rows: Json }
        Returns: Json
      }
      import_employees: {
        Args: { p_can_register_visitors?: boolean; p_rows: Json }
        Returns: Json
      }
      mark_account_active: { Args: never; Returns: undefined }
      org_today: { Args: never; Returns: string }
      register_visit: {
        Args: {
          p_category: Database["public"]["Enums"]["visitor_category"]
          p_company_organization?: string
          p_full_name: string
          p_guest_count?: number
          p_invited_by_employee_id?: string
          p_invited_by_name?: string
          p_phone: string
          p_purpose: string
          p_scheduled_arrival_at?: string
          p_scheduled_departure_at?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "receptionist" | "employee"
      card_status: "available" | "issued"
      notification_type: "visitor_checked_in"
      registration_source: "admin" | "employee" | "receptionist" | "import"
      visit_status: "expected" | "checked_in" | "checked_out"
      visitor_category:
        | "business_meeting"
        | "job_interview"
        | "vip_visit"
        | "vendor_supplier"
        | "maintenance_technician"
        | "personal_guest"
        | "delivery_courier"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "receptionist", "employee"],
      card_status: ["available", "issued"],
      notification_type: ["visitor_checked_in"],
      registration_source: ["admin", "employee", "receptionist", "import"],
      visit_status: ["expected", "checked_in", "checked_out"],
      visitor_category: [
        "business_meeting",
        "job_interview",
        "vip_visit",
        "vendor_supplier",
        "maintenance_technician",
        "personal_guest",
        "delivery_courier",
        "other",
      ],
    },
  },
} as const
