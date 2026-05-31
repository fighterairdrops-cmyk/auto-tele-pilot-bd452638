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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      allowed_groups: {
        Row: {
          created_at: string
          id: string
          system_id: string
          telegram_chat_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          system_id: string
          telegram_chat_id: string
        }
        Update: {
          created_at?: string
          id?: string
          system_id?: string
          telegram_chat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "allowed_groups_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      allowed_users: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          system_id: string
          telegram_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          system_id: string
          telegram_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          system_id?: string
          telegram_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "allowed_users_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_delete_rules: {
        Row: {
          chat_id: string
          created_at: string
          delay: string
          enabled: boolean
          id: string
          system_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          delay?: string
          enabled?: boolean
          id?: string
          system_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          delay?: string
          enabled?: boolean
          id?: string
          system_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_delete_rules_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          id: string
          system_id: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          system_id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          system_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_deletions: {
        Row: {
          bot_token: string
          chat_id: string
          created_at: string
          delete_at: string
          id: string
          message_id: number
        }
        Insert: {
          bot_token: string
          chat_id: string
          created_at?: string
          delete_at: string
          id?: string
          message_id: number
        }
        Update: {
          bot_token?: string
          chat_id?: string
          created_at?: string
          delete_at?: string
          id?: string
          message_id?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_posts: {
        Row: {
          active: boolean
          chat_id: string
          created_at: string
          id: string
          interval_seconds: number
          media_file_id: string | null
          media_type: string | null
          message_text: string
          next_run_at: string
          post_kind: string
          rotation_index: number
          rotation_messages: Json | null
          system_id: string
          target_channels: string[] | null
          telegram_user_id: string
          times_sent: number
          total_times: number
          window_end_hour: number | null
          window_start_hour: number | null
        }
        Insert: {
          active?: boolean
          chat_id: string
          created_at?: string
          id?: string
          interval_seconds?: number
          media_file_id?: string | null
          media_type?: string | null
          message_text: string
          next_run_at?: string
          post_kind?: string
          rotation_index?: number
          rotation_messages?: Json | null
          system_id: string
          target_channels?: string[] | null
          telegram_user_id: string
          times_sent?: number
          total_times?: number
          window_end_hour?: number | null
          window_start_hour?: number | null
        }
        Update: {
          active?: boolean
          chat_id?: string
          created_at?: string
          id?: string
          interval_seconds?: number
          media_file_id?: string | null
          media_type?: string | null
          message_text?: string
          next_run_at?: string
          post_kind?: string
          rotation_index?: number
          rotation_messages?: Json | null
          system_id?: string
          target_channels?: string[] | null
          telegram_user_id?: string
          times_sent?: number
          total_times?: number
          window_end_hour?: number | null
          window_start_hour?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_tasks: {
        Row: {
          chat_id: string
          created_at: string
          enabled: boolean
          id: string
          message: string
          repeat_interval: string
          scheduled_time: string
          system_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          message: string
          repeat_interval?: string
          scheduled_time: string
          system_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          message?: string
          repeat_interval?: string
          scheduled_time?: string
          system_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_tasks_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      systems: {
        Row: {
          api_hash: string | null
          api_id: string | null
          bot_token: string | null
          created_at: string
          daily_post_quota: number | null
          id: string
          label: string
          last_checked: string | null
          status: string
          string_session: string | null
          type: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          api_hash?: string | null
          api_id?: string | null
          bot_token?: string | null
          created_at?: string
          daily_post_quota?: number | null
          id?: string
          label: string
          last_checked?: string | null
          status?: string
          string_session?: string | null
          type: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          api_hash?: string | null
          api_id?: string | null
          bot_token?: string | null
          created_at?: string
          daily_post_quota?: number | null
          id?: string
          label?: string
          last_checked?: string | null
          status?: string
          string_session?: string | null
          type?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      user_channel_access: {
        Row: {
          channel_username: string
          created_at: string
          expires_at: string | null
          granted_by: string | null
          id: string
          system_id: string
          telegram_user_id: string
        }
        Insert: {
          channel_username: string
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          system_id: string
          telegram_user_id: string
        }
        Update: {
          channel_username?: string
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          system_id?: string
          telegram_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_channel_access_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
