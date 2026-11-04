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
      access_grants: {
        Row: {
          department_id: string | null
          granted_by: string
          id: string
          organization_id: string
          project_id: string | null
          request_id: string | null
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          department_id?: string | null
          granted_by: string
          id?: string
          organization_id?: string
          project_id?: string | null
          request_id?: string | null
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          department_id?: string | null
          granted_by?: string
          id?: string
          organization_id?: string
          project_id?: string | null
          request_id?: string | null
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_grants_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_grants_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_grants_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "access_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      access_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string
          department_id: string | null
          id: string
          organization_id: string
          project_id: string | null
          reason: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string
          department_id?: string | null
          id?: string
          organization_id?: string
          project_id?: string | null
          reason: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string
          department_id?: string | null
          id?: string
          organization_id?: string
          project_id?: string | null
          reason?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_policies: {
        Row: {
          data: Json
          organization_id: string
        }
        Insert: {
          data: Json
          organization_id: string
        }
        Update: {
          data?: Json
          organization_id?: string
        }
        Relationships: []
      }
      approvals: {
        Row: {
          data: Json
          expense_id: string
          id: string
        }
        Insert: {
          data: Json
          expense_id: string
          id: string
        }
        Update: {
          data?: Json
          expense_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          detail: Json
          id: string
          organization_id: string
          target_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          detail?: Json
          id?: string
          organization_id?: string
          target_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          detail?: Json
          id?: string
          organization_id?: string
          target_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          data: Json
          department_id: string
          id: string
          organization_id: string
          project_id: string | null
        }
        Insert: {
          data: Json
          department_id: string
          id: string
          organization_id?: string
          project_id?: string | null
        }
        Update: {
          data?: Json
          department_id?: string
          id?: string
          organization_id?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cancelled_submissions: {
        Row: {
          actor_id: string
          submission_key: string
        }
        Insert: {
          actor_id: string
          submission_key: string
        }
        Update: {
          actor_id?: string
          submission_key?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          id: string
          manager_id: string | null
          name: string
          organization_id: string
        }
        Insert: {
          id: string
          manager_id?: string | null
          name: string
          organization_id?: string
        }
        Update: {
          id?: string
          manager_id?: string | null
          name?: string
          organization_id?: string
        }
        Relationships: []
      }
      developer_roles: {
        Row: {
          active: boolean
          email: string
          id: string
          role: string
        }
        Insert: {
          active?: boolean
          email: string
          id?: string
          role?: string
        }
        Update: {
          active?: boolean
          email?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          access_role: string
          active: boolean
          department_id: string
          email: string
          id: string
          manager_id: string | null
          name: string
          organization_id: string
          title: string
        }
        Insert: {
          access_role: string
          active?: boolean
          department_id: string
          email: string
          id: string
          manager_id?: string | null
          name: string
          organization_id?: string
          title: string
        }
        Update: {
          access_role?: string
          active?: boolean
          department_id?: string
          email?: string
          id?: string
          manager_id?: string | null
          name?: string
          organization_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_cents: number | null
          approval_status: string
          data: Json
          department_id: string
          document_version: number
          employee_id: string
          id: string
          organization_id: string
          project_id: string | null
          submission_actor: string | null
          submission_key: string | null
          submission_payload: Json | null
        }
        Insert: {
          amount_cents?: number | null
          approval_status?: string
          data: Json
          department_id: string
          document_version?: number
          employee_id: string
          id: string
          organization_id?: string
          project_id?: string | null
          submission_actor?: string | null
          submission_key?: string | null
          submission_payload?: Json | null
        }
        Update: {
          amount_cents?: number | null
          approval_status?: string
          data?: Json
          department_id?: string
          document_version?: number
          employee_id?: string
          id?: string
          organization_id?: string
          project_id?: string | null
          submission_actor?: string | null
          submission_key?: string | null
          submission_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          data: Json
          id: string
          user_id: string
        }
        Insert: {
          data: Json
          id: string
          user_id: string
        }
        Update: {
          data?: Json
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          display_name: string
          employee_id: string
          id: string
          organization_id: string
          preferences: Json
        }
        Insert: {
          display_name: string
          employee_id: string
          id: string
          organization_id?: string
          preferences?: Json
        }
        Update: {
          display_name?: string
          employee_id?: string
          id?: string
          organization_id?: string
          preferences?: Json
        }
        Relationships: [
          {
            foreignKeyName: "profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      project_departments: {
        Row: {
          department_id: string
          project_id: string
        }
        Insert: {
          department_id: string
          project_id: string
        }
        Update: {
          department_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_departments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          data: Json
          id: string
          organization_id: string
        }
        Insert: {
          data: Json
          id: string
          organization_id?: string
        }
        Update: {
          data?: Json
          id?: string
          organization_id?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          data: Json
          expense_id: string
          id: string
          organization_id: string
          storage_path: string
        }
        Insert: {
          data: Json
          expense_id: string
          id: string
          organization_id?: string
          storage_path: string
        }
        Update: {
          data?: Json
          expense_id?: string
          id?: string
          organization_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      reimbursements: {
        Row: {
          data: Json
          employee_id: string
          expense_id: string
          id: string
          organization_id: string
          status: string
        }
        Insert: {
          data: Json
          employee_id: string
          expense_id: string
          id: string
          organization_id?: string
          status?: string
        }
        Update: {
          data?: Json
          employee_id?: string
          expense_id?: string
          id?: string
          organization_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reimbursements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursements_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: true
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          role: string
          user_id: string
        }
        Update: {
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_department: { Args: { _department: string }; Returns: boolean }
      can_expense: { Args: { _expense: string }; Returns: boolean }
      can_project: { Args: { _project: string }; Returns: boolean }
      cancel_expense_submission: {
        Args: { submission_key: string }
        Returns: boolean
      }
      current_employee: { Args: never; Returns: string }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      internal_action: {
        Args: { action: string; payload: Json }
        Returns: undefined
      }
      internal_action_legacy: {
        Args: { action: string; payload: Json }
        Returns: undefined
      }
      shared_project_totals: {
        Args: never
        Returns: {
          approved_total: number
          pending_total: number
          project_id: string
        }[]
      }
      submission_status: { Args: { submission_key: string }; Returns: Json }
      validate_expense_document: { Args: { p: Json }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
