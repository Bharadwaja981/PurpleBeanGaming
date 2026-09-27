export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      abuse_signals: {
        Row: {
          created_at: string
          evidence_count: number
          id: string
          metadata: Json
          score: number
          signal_type: string
          subject_user_id: string | null
        }
        Insert: {
          created_at?: string
          evidence_count?: number
          id?: string
          metadata?: Json
          score?: number
          signal_type: string
          subject_user_id?: string | null
        }
        Update: {
          created_at?: string
          evidence_count?: number
          id?: string
          metadata?: Json
          score?: number
          signal_type?: string
          subject_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abuse_signals_subject_user_id_fkey"
            columns: ["subject_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      account_operational_status: {
        Row: {
          deactivated_at: string | null
          deactivated_by: string | null
          reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          deactivated_at?: string | null
          deactivated_by?: string | null
          reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          deactivated_at?: string | null
          deactivated_by?: string | null
          reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_operational_status_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_operational_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      achievements: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string
          icon: string | null
          name: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description: string
          icon?: string | null
          name: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string
          icon?: string | null
          name?: string
        }
        Relationships: []
      }
      appeals: {
        Row: {
          appeal_type: string
          created_at: string
          evidence_url: string | null
          id: string
          player_id: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["appeal_status"]
          tournament_id: string
        }
        Insert: {
          appeal_type: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          player_id: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["appeal_status"]
          tournament_id: string
        }
        Update: {
          appeal_type?: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          player_id?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["appeal_status"]
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appeals_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "organizer_dota_verification"
            referencedColumns: ["tournament_player_id"]
          },
          {
            foreignKeyName: "appeals_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_player_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appeals_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "tournament_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appeals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appeals_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appeals_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      auctions: {
        Row: {
          anti_snipe_extension_count: number
          closed_at: string | null
          closes_at: string | null
          created_at: string
          current_bid: number | null
          id: string
          leading_team_id: string | null
          nominating_team_id: string
          opening_bid: number
          paused_remaining_seconds: number | null
          player_id: string
          revision: number
          sequence_number: number
          started_at: string | null
          status: Database["public"]["Enums"]["auction_status"]
          tournament_id: string
          updated_at: string
          winning_bid: number | null
          winning_team_id: string | null
        }
        Insert: {
          anti_snipe_extension_count?: number
          closed_at?: string | null
          closes_at?: string | null
          created_at?: string
          current_bid?: number | null
          id?: string
          leading_team_id?: string | null
          nominating_team_id: string
          opening_bid: number
          paused_remaining_seconds?: number | null
          player_id: string
          revision?: number
          sequence_number: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["auction_status"]
          tournament_id: string
          updated_at?: string
          winning_bid?: number | null
          winning_team_id?: string | null
        }
        Update: {
          anti_snipe_extension_count?: number
          closed_at?: string | null
          closes_at?: string | null
          created_at?: string
          current_bid?: number | null
          id?: string
          leading_team_id?: string | null
          nominating_team_id?: string
          opening_bid?: number
          paused_remaining_seconds?: number | null
          player_id?: string
          revision?: number
          sequence_number?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["auction_status"]
          tournament_id?: string
          updated_at?: string
          winning_bid?: number | null
          winning_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auctions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_leading_team_id_fkey"
            columns: ["tournament_id", "leading_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_leading_team_id_fkey"
            columns: ["tournament_id", "leading_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_leading_team_id_fkey"
            columns: ["tournament_id", "leading_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_leading_team_id_fkey"
            columns: ["tournament_id", "leading_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_nominating_team_id_fkey"
            columns: ["tournament_id", "nominating_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_nominating_team_id_fkey"
            columns: ["tournament_id", "nominating_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_nominating_team_id_fkey"
            columns: ["tournament_id", "nominating_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_nominating_team_id_fkey"
            columns: ["tournament_id", "nominating_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_player_id_fkey"
            columns: ["tournament_id", "player_id"]
            isOneToOne: false
            referencedRelation: "organizer_dota_verification"
            referencedColumns: ["tournament_id", "tournament_player_id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_player_id_fkey"
            columns: ["tournament_id", "player_id"]
            isOneToOne: false
            referencedRelation: "public_player_pool"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_player_id_fkey"
            columns: ["tournament_id", "player_id"]
            isOneToOne: false
            referencedRelation: "tournament_players"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_winning_team_id_fkey"
            columns: ["tournament_id", "winning_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_winning_team_id_fkey"
            columns: ["tournament_id", "winning_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_winning_team_id_fkey"
            columns: ["tournament_id", "winning_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_winning_team_id_fkey"
            columns: ["tournament_id", "winning_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      audit_events: {
        Row: {
          actor_role: Database["public"]["Enums"]["tournament_role"] | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          payload: Json
          tournament_id: string | null
        }
        Insert: {
          actor_role?: Database["public"]["Enums"]["tournament_role"] | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          payload?: Json
          tournament_id?: string | null
        }
        Update: {
          actor_role?: Database["public"]["Enums"]["tournament_role"] | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          payload?: Json
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      bids: {
        Row: {
          accepted: boolean
          amount: number
          auction_id: string
          auction_revision_after: number | null
          auction_revision_before: number
          captain_user_id: string
          id: string
          received_at: string
          rejection_reason: string | null
          request_id: string
          team_id: string
          tournament_id: string
        }
        Insert: {
          accepted?: boolean
          amount: number
          auction_id: string
          auction_revision_after?: number | null
          auction_revision_before: number
          captain_user_id: string
          id?: string
          received_at?: string
          rejection_reason?: string | null
          request_id: string
          team_id: string
          tournament_id: string
        }
        Update: {
          accepted?: boolean
          amount?: number
          auction_id?: string
          auction_revision_after?: number | null
          auction_revision_before?: number
          captain_user_id?: string
          id?: string
          received_at?: string
          rejection_reason?: string | null
          request_id?: string
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "public_auction_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_captain_user_id_fkey"
            columns: ["captain_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "bids_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "bids_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_action_requests: {
        Row: {
          action: string
          created_at: string
          match_id: string | null
          request_id: string
          response: Json
        }
        Insert: {
          action: string
          created_at?: string
          match_id?: string | null
          request_id: string
          response: Json
        }
        Update: {
          action?: string
          created_at?: string
          match_id?: string | null
          request_id?: string
          response?: Json
        }
        Relationships: [
          {
            foreignKeyName: "competition_action_requests_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_action_requests_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_group_teams: {
        Row: {
          group_id: string
          seed: number
          team_id: string
        }
        Insert: {
          group_id: string
          seed: number
          team_id: string
        }
        Update: {
          group_id?: string
          seed?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_group_teams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "competition_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "competition_group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "competition_group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          sequence_number: number
          stage_id: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sequence_number: number
          stage_id: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sequence_number?: number
          stage_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_groups_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "competition_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_groups_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_groups_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_notifications: {
        Row: {
          created_at: string
          event_type: string
          id: string
          match_id: string | null
          payload: Json
          read_at: string | null
          recipient_user_id: string | null
          tournament_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          match_id?: string | null
          payload?: Json
          read_at?: string | null
          recipient_user_id?: string | null
          tournament_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          match_id?: string | null
          payload?: Json
          read_at?: string | null
          recipient_user_id?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_notifications_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_notifications_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_notifications_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_notifications_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_result_snapshots: {
        Row: {
          champion_team_id: string | null
          created_at: string
          id: string
          matches: Json
          runner_up_team_id: string | null
          settings: Json
          standings: Json
          tournament_id: string
        }
        Insert: {
          champion_team_id?: string | null
          created_at?: string
          id?: string
          matches: Json
          runner_up_team_id?: string | null
          settings: Json
          standings: Json
          tournament_id: string
        }
        Update: {
          champion_team_id?: string | null
          created_at?: string
          id?: string
          matches?: Json
          runner_up_team_id?: string | null
          settings?: Json
          standings?: Json
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_result_snapshots_champion_team_id_fkey"
            columns: ["champion_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "competition_result_snapshots_champion_team_id_fkey"
            columns: ["champion_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "competition_result_snapshots_champion_team_id_fkey"
            columns: ["champion_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_result_snapshots_champion_team_id_fkey"
            columns: ["champion_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_result_snapshots_runner_up_team_id_fkey"
            columns: ["runner_up_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "competition_result_snapshots_runner_up_team_id_fkey"
            columns: ["runner_up_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "competition_result_snapshots_runner_up_team_id_fkey"
            columns: ["runner_up_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_result_snapshots_runner_up_team_id_fkey"
            columns: ["runner_up_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_result_snapshots_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_result_snapshots_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_settings: {
        Row: {
          advance_per_group: number
          allow_draws: boolean
          configured_at: string
          configured_by: string
          default_best_of: number
          format: Database["public"]["Enums"]["competition_format"]
          lineup_size: number
          points_draw: number
          points_loss: number
          points_win: number
          rules_version: number
          tiebreak_rules: Json
          tournament_id: string
        }
        Insert: {
          advance_per_group?: number
          allow_draws?: boolean
          configured_at?: string
          configured_by: string
          default_best_of?: number
          format: Database["public"]["Enums"]["competition_format"]
          lineup_size?: number
          points_draw?: number
          points_loss?: number
          points_win?: number
          rules_version?: number
          tiebreak_rules?: Json
          tournament_id: string
        }
        Update: {
          advance_per_group?: number
          allow_draws?: boolean
          configured_at?: string
          configured_by?: string
          default_best_of?: number
          format?: Database["public"]["Enums"]["competition_format"]
          lineup_size?: number
          points_draw?: number
          points_loss?: number
          points_win?: number
          rules_version?: number
          tiebreak_rules?: Json
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_settings_configured_by_fkey"
            columns: ["configured_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_settings_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_settings_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_stages: {
        Row: {
          created_at: string
          id: string
          is_complete: boolean
          name: string
          sequence_number: number
          stage_type: Database["public"]["Enums"]["competition_stage_type"]
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_complete?: boolean
          name: string
          sequence_number: number
          stage_type: Database["public"]["Enums"]["competition_stage_type"]
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_complete?: boolean
          name?: string
          sequence_number?: number
          stage_type?: Database["public"]["Enums"]["competition_stage_type"]
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_stages_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_stages_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      competitive_rating_events: {
        Row: {
          delta: number
          id: string
          match_id: string
          player_id: string
          processed_at: string
          rating_after: number
          rating_before: number
          rating_version: string
          result: number
          season_id: string | null
          tournament_id: string
          uncertainty_after: number
          uncertainty_before: number
        }
        Insert: {
          delta: number
          id?: string
          match_id: string
          player_id: string
          processed_at?: string
          rating_after: number
          rating_before: number
          rating_version: string
          result: number
          season_id?: string | null
          tournament_id: string
          uncertainty_after: number
          uncertainty_before: number
        }
        Update: {
          delta?: number
          id?: string
          match_id?: string
          player_id?: string
          processed_at?: string
          rating_after?: number
          rating_before?: number
          rating_version?: string
          result?: number
          season_id?: string | null
          tournament_id?: string
          uncertainty_after?: number
          uncertainty_before?: number
        }
        Relationships: [
          {
            foreignKeyName: "competitive_rating_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitive_rating_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitive_rating_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitive_rating_events_rating_version_fkey"
            columns: ["rating_version"]
            isOneToOne: false
            referencedRelation: "competitive_rating_versions"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "competitive_rating_events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "public_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitive_rating_events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitive_rating_events_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitive_rating_events_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      competitive_rating_versions: {
        Row: {
          active: boolean
          algorithm: string
          created_at: string
          effective_at: string
          parameters: Json
          version: string
        }
        Insert: {
          active?: boolean
          algorithm: string
          created_at?: string
          effective_at: string
          parameters: Json
          version: string
        }
        Update: {
          active?: boolean
          algorithm?: string
          created_at?: string
          effective_at?: string
          parameters?: Json
          version?: string
        }
        Relationships: []
      }
      dota_heroes: {
        Row: {
          hero_id: number
          image_path: string | null
          internal_name: string
          localized_name: string
          primary_attribute: string | null
          provider: Database["public"]["Enums"]["external_provider"]
          updated_at: string
        }
        Insert: {
          hero_id: number
          image_path?: string | null
          internal_name: string
          localized_name: string
          primary_attribute?: string | null
          provider?: Database["public"]["Enums"]["external_provider"]
          updated_at?: string
        }
        Update: {
          hero_id?: number
          image_path?: string | null
          internal_name?: string
          localized_name?: string
          primary_attribute?: string | null
          provider?: Database["public"]["Enums"]["external_provider"]
          updated_at?: string
        }
        Relationships: []
      }
      dota_match_players: {
        Row: {
          account_id: number | null
          assists: number | null
          deaths: number | null
          gpm: number | null
          hero_id: number | null
          is_radiant: boolean
          kills: number | null
          match_id: number
          player_game_account_id: string | null
          slot: number
          xpm: number | null
        }
        Insert: {
          account_id?: number | null
          assists?: number | null
          deaths?: number | null
          gpm?: number | null
          hero_id?: number | null
          is_radiant: boolean
          kills?: number | null
          match_id: number
          player_game_account_id?: string | null
          slot: number
          xpm?: number | null
        }
        Update: {
          account_id?: number | null
          assists?: number | null
          deaths?: number | null
          gpm?: number | null
          hero_id?: number | null
          is_radiant?: boolean
          kills?: number | null
          match_id?: number
          player_game_account_id?: string | null
          slot?: number
          xpm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dota_match_players_hero_id_fkey"
            columns: ["hero_id"]
            isOneToOne: false
            referencedRelation: "dota_heroes"
            referencedColumns: ["hero_id"]
          },
          {
            foreignKeyName: "dota_match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "dota_matches"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "dota_match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_dota_match_stats"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "dota_match_players_player_game_account_id_fkey"
            columns: ["player_game_account_id"]
            isOneToOne: false
            referencedRelation: "player_game_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      dota_matches: {
        Row: {
          duration_seconds: number | null
          fetched_at: string
          game_mode: number | null
          lobby_type: number | null
          match_id: number
          parse_state: Database["public"]["Enums"]["dota_parse_state"]
          patch: number | null
          provider: Database["public"]["Enums"]["external_provider"]
          radiant_win: boolean | null
          replay_url: string | null
          source_hash: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          duration_seconds?: number | null
          fetched_at?: string
          game_mode?: number | null
          lobby_type?: number | null
          match_id: number
          parse_state?: Database["public"]["Enums"]["dota_parse_state"]
          patch?: number | null
          provider?: Database["public"]["Enums"]["external_provider"]
          radiant_win?: boolean | null
          replay_url?: string | null
          source_hash: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          duration_seconds?: number | null
          fetched_at?: string
          game_mode?: number | null
          lobby_type?: number | null
          match_id?: number
          parse_state?: Database["public"]["Enums"]["dota_parse_state"]
          patch?: number | null
          provider?: Database["public"]["Enums"]["external_provider"]
          radiant_win?: boolean | null
          replay_url?: string | null
          source_hash?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dota_profile_snapshots: {
        Row: {
          avatar_url: string | null
          captured_at: string
          id: string
          leaderboard_rank: number | null
          persona_name: string | null
          player_game_account_id: string
          profile_visibility: string | null
          provider: Database["public"]["Enums"]["external_provider"]
          rank_tier: number | null
          source_hash: string
        }
        Insert: {
          avatar_url?: string | null
          captured_at?: string
          id?: string
          leaderboard_rank?: number | null
          persona_name?: string | null
          player_game_account_id: string
          profile_visibility?: string | null
          provider: Database["public"]["Enums"]["external_provider"]
          rank_tier?: number | null
          source_hash: string
        }
        Update: {
          avatar_url?: string | null
          captured_at?: string
          id?: string
          leaderboard_rank?: number | null
          persona_name?: string | null
          player_game_account_id?: string
          profile_visibility?: string | null
          provider?: Database["public"]["Enums"]["external_provider"]
          rank_tier?: number | null
          source_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "dota_profile_snapshots_player_game_account_id_fkey"
            columns: ["player_game_account_id"]
            isOneToOne: false
            referencedRelation: "player_game_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_player_snapshots: {
        Row: {
          acquisition_type: Database["public"]["Enums"]["acquisition_type"]
          active_bidding_duration_seconds: number | null
          anti_snipe_extension_count: number
          auction_id: string | null
          auction_sequence: number | null
          bid_count: number
          draft_phase: string
          id: string
          ign: string
          nomination_round: number | null
          player_id: string
          player_slug: string
          primary_role: string | null
          purchase_price: number | null
          region: string | null
          secondary_role: string | null
          snapshot_id: string
          team_id: string
          tournament_id: string
          tournament_mmr_at_draft: number
          unique_bidding_teams: number
          wall_clock_duration_seconds: number | null
        }
        Insert: {
          acquisition_type: Database["public"]["Enums"]["acquisition_type"]
          active_bidding_duration_seconds?: number | null
          anti_snipe_extension_count?: number
          auction_id?: string | null
          auction_sequence?: number | null
          bid_count?: number
          draft_phase?: string
          id?: string
          ign: string
          nomination_round?: number | null
          player_id: string
          player_slug: string
          primary_role?: string | null
          purchase_price?: number | null
          region?: string | null
          secondary_role?: string | null
          snapshot_id: string
          team_id: string
          tournament_id: string
          tournament_mmr_at_draft: number
          unique_bidding_teams?: number
          wall_clock_duration_seconds?: number | null
        }
        Update: {
          acquisition_type?: Database["public"]["Enums"]["acquisition_type"]
          active_bidding_duration_seconds?: number | null
          anti_snipe_extension_count?: number
          auction_id?: string | null
          auction_sequence?: number | null
          bid_count?: number
          draft_phase?: string
          id?: string
          ign?: string
          nomination_round?: number | null
          player_id?: string
          player_slug?: string
          primary_role?: string | null
          purchase_price?: number | null
          region?: string | null
          secondary_role?: string | null
          snapshot_id?: string
          team_id?: string
          tournament_id?: string
          tournament_mmr_at_draft?: number
          unique_bidding_teams?: number
          wall_clock_duration_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_player_snapshots_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "draft_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_snapshots: {
        Row: {
          completed_at: string
          id: string
          mmr_max: number | null
          mmr_min: number | null
          mmr_target: number | null
          rules_version: number
          season: string | null
          snapshot_at: string
          started_at: string | null
          starting_credits: number
          team_size: number
          total_auctions: number
          total_bids: number
          total_sold: number
          total_unsold: number
          tournament_id: string
          tournament_name: string
          tournament_slug: string
        }
        Insert: {
          completed_at: string
          id?: string
          mmr_max?: number | null
          mmr_min?: number | null
          mmr_target?: number | null
          rules_version: number
          season?: string | null
          snapshot_at?: string
          started_at?: string | null
          starting_credits: number
          team_size: number
          total_auctions: number
          total_bids: number
          total_sold: number
          total_unsold: number
          tournament_id: string
          tournament_name: string
          tournament_slug: string
        }
        Update: {
          completed_at?: string
          id?: string
          mmr_max?: number | null
          mmr_min?: number | null
          mmr_target?: number | null
          rules_version?: number
          season?: string | null
          snapshot_at?: string
          started_at?: string | null
          starting_credits?: number
          team_size?: number
          total_auctions?: number
          total_bids?: number
          total_sold?: number
          total_unsold?: number
          tournament_id?: string
          tournament_name?: string
          tournament_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_snapshots_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_snapshots_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_team_snapshots: {
        Row: {
          accent_color: string | null
          captain_mmr: number
          captain_name: string
          captain_slug: string
          credits_remaining: number
          final_team_mmr: number
          id: string
          logo_url: string | null
          recruit_count: number
          snapshot_id: string
          starting_credits: number
          team_id: string
          team_name: string
          team_slug: string
          team_tag: string
          tournament_id: string
        }
        Insert: {
          accent_color?: string | null
          captain_mmr: number
          captain_name: string
          captain_slug: string
          credits_remaining: number
          final_team_mmr: number
          id?: string
          logo_url?: string | null
          recruit_count: number
          snapshot_id: string
          starting_credits: number
          team_id: string
          team_name: string
          team_slug: string
          team_tag: string
          tournament_id: string
        }
        Update: {
          accent_color?: string | null
          captain_mmr?: number
          captain_name?: string
          captain_slug?: string
          credits_remaining?: number
          final_team_mmr?: number
          id?: string
          logo_url?: string | null
          recruit_count?: number
          snapshot_id?: string
          starting_credits?: number
          team_id?: string
          team_name?: string
          team_slug?: string
          team_tag?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_team_snapshots_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "draft_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      external_provider_cache: {
        Row: {
          cache_key: string
          etag: string | null
          expires_at: string
          fetched_at: string
          payload: Json
          provider: Database["public"]["Enums"]["external_provider"]
        }
        Insert: {
          cache_key: string
          etag?: string | null
          expires_at: string
          fetched_at?: string
          payload: Json
          provider: Database["public"]["Enums"]["external_provider"]
        }
        Update: {
          cache_key?: string
          etag?: string | null
          expires_at?: string
          fetched_at?: string
          payload?: Json
          provider?: Database["public"]["Enums"]["external_provider"]
        }
        Relationships: []
      }
      external_provider_health: {
        Row: {
          circuit_open_until: string | null
          circuit_state: string
          consecutive_failures: number
          last_error_code: string | null
          last_failure_at: string | null
          last_success_at: string | null
          next_retry_at: string | null
          provider: Database["public"]["Enums"]["external_provider"]
          rate_limit_count: number
          recent_error_count: number
          status: string
          updated_at: string
        }
        Insert: {
          circuit_open_until?: string | null
          circuit_state?: string
          consecutive_failures?: number
          last_error_code?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          next_retry_at?: string | null
          provider: Database["public"]["Enums"]["external_provider"]
          rate_limit_count?: number
          recent_error_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          circuit_open_until?: string | null
          circuit_state?: string
          consecutive_failures?: number
          last_error_code?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          next_retry_at?: string | null
          provider?: Database["public"]["Enums"]["external_provider"]
          rate_limit_count?: number
          recent_error_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      external_provider_requests: {
        Row: {
          created_at: string
          duration_ms: number | null
          id: number
          operation: string
          outcome: string
          provider: Database["public"]["Enums"]["external_provider"]
          retry_after_seconds: number | null
          status_code: number | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          id?: never
          operation: string
          outcome: string
          provider: Database["public"]["Enums"]["external_provider"]
          retry_after_seconds?: number | null
          status_code?: number | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          id?: never
          operation?: string
          outcome?: string
          provider?: Database["public"]["Enums"]["external_provider"]
          retry_after_seconds?: number | null
          status_code?: number | null
        }
        Relationships: []
      }
      external_sync_jobs: {
        Row: {
          attempts: number
          created_at: string
          created_by: string | null
          dedupe_key: string
          external_match_id: number | null
          id: string
          job_type: string
          last_error_code: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          player_game_account_id: string | null
          provider: Database["public"]["Enums"]["external_provider"]
          run_after: string
          status: Database["public"]["Enums"]["external_job_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          created_by?: string | null
          dedupe_key: string
          external_match_id?: number | null
          id?: string
          job_type: string
          last_error_code?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          player_game_account_id?: string | null
          provider: Database["public"]["Enums"]["external_provider"]
          run_after?: string
          status?: Database["public"]["Enums"]["external_job_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          created_by?: string | null
          dedupe_key?: string
          external_match_id?: number | null
          id?: string
          job_type?: string
          last_error_code?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          player_game_account_id?: string | null
          provider?: Database["public"]["Enums"]["external_provider"]
          run_after?: string
          status?: Database["public"]["Enums"]["external_job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_sync_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_sync_jobs_player_game_account_id_fkey"
            columns: ["player_game_account_id"]
            isOneToOne: false
            referencedRelation: "player_game_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      feasibility_event_snapshots: {
        Row: {
          auction_id: string | null
          created_at: string
          current_team_mmr: number
          id: string
          mmr_max: number | null
          mmr_min: number | null
          player_id: string | null
          reason_code: string
          remaining_slots: number
          rules_version: number
          safe_range_max: number | null
          safe_range_min: number | null
          team_id: string | null
          tournament_id: string
        }
        Insert: {
          auction_id?: string | null
          created_at?: string
          current_team_mmr: number
          id?: string
          mmr_max?: number | null
          mmr_min?: number | null
          player_id?: string | null
          reason_code: string
          remaining_slots: number
          rules_version: number
          safe_range_max?: number | null
          safe_range_min?: number | null
          team_id?: string | null
          tournament_id: string
        }
        Update: {
          auction_id?: string | null
          created_at?: string
          current_team_mmr?: number
          id?: string
          mmr_max?: number | null
          mmr_min?: number | null
          player_id?: string | null
          reason_code?: string
          remaining_slots?: number
          rules_version?: number
          safe_range_max?: number | null
          safe_range_min?: number | null
          team_id?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feasibility_event_snapshots_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feasibility_event_snapshots_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "public_auction_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feasibility_event_snapshots_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "organizer_dota_verification"
            referencedColumns: ["tournament_player_id"]
          },
          {
            foreignKeyName: "feasibility_event_snapshots_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_player_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feasibility_event_snapshots_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "tournament_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feasibility_event_snapshots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "feasibility_event_snapshots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "feasibility_event_snapshots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feasibility_event_snapshots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feasibility_event_snapshots_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feasibility_event_snapshots_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      group_advancement_results: {
        Row: {
          created_at: string
          group_id: string
          group_position: number
          id: string
          knockout_seed: number
          team_id: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          group_position: number
          id?: string
          knockout_seed: number
          team_id: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          group_position?: number
          id?: string
          knockout_seed?: number
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_advancement_results_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "competition_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_advancement_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "group_advancement_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "group_advancement_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_advancement_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_advancement_results_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_advancement_results_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      group_knockout_seed_mappings: {
        Row: {
          created_at: string
          destination_match_id: string
          destination_slot: number
          id: string
          source_group_id: string
          source_position: number
          team_id: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          destination_match_id: string
          destination_slot: number
          id?: string
          source_group_id: string
          source_position: number
          team_id: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          destination_match_id?: string
          destination_slot?: number
          id?: string
          source_group_id?: string
          source_position?: number
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_knockout_seed_mappings_destination_match_id_fkey"
            columns: ["destination_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_knockout_seed_mappings_destination_match_id_fkey"
            columns: ["destination_match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_knockout_seed_mappings_source_group_id_fkey"
            columns: ["source_group_id"]
            isOneToOne: false
            referencedRelation: "competition_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_knockout_seed_mappings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "group_knockout_seed_mappings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "group_knockout_seed_mappings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_knockout_seed_mappings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_knockout_seed_mappings_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_knockout_seed_mappings_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      job_health: {
        Row: {
          job_name: string
          last_duration_ms: number | null
          last_failure_at: string | null
          last_success_at: string | null
          message: string | null
          status: string
          updated_at: string
        }
        Insert: {
          job_name: string
          last_duration_ms?: number | null
          last_failure_at?: string | null
          last_success_at?: string | null
          message?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          job_name?: string
          last_duration_ms?: number | null
          last_failure_at?: string | null
          last_success_at?: string | null
          message?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          privacy_version: string
          terms_version: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          privacy_version: string
          terms_version: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          privacy_version?: string
          terms_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_acceptances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_check_ins: {
        Row: {
          checked_in_at: string
          checked_in_by: string
          id: string
          is_override: boolean
          match_id: string
          team_id: string
        }
        Insert: {
          checked_in_at?: string
          checked_in_by: string
          id?: string
          is_override?: boolean
          match_id: string
          team_id: string
        }
        Update: {
          checked_in_at?: string
          checked_in_by?: string
          id?: string
          is_override?: boolean
          match_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_check_ins_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_check_ins_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_check_ins_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_check_ins_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_check_ins_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_check_ins_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_check_ins_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_disputes: {
        Row: {
          created_at: string
          evidence_path: string | null
          id: string
          match_id: string
          opened_by: string
          opening_team_id: string
          reason: string
          request_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          submission_id: string
        }
        Insert: {
          created_at?: string
          evidence_path?: string | null
          id?: string
          match_id: string
          opened_by: string
          opening_team_id: string
          reason: string
          request_id: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          submission_id: string
        }
        Update: {
          created_at?: string
          evidence_path?: string | null
          id?: string
          match_id?: string
          opened_by?: string
          opening_team_id?: string
          reason?: string
          request_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_disputes_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_disputes_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_disputes_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_disputes_opening_team_id_fkey"
            columns: ["opening_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_disputes_opening_team_id_fkey"
            columns: ["opening_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_disputes_opening_team_id_fkey"
            columns: ["opening_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_disputes_opening_team_id_fkey"
            columns: ["opening_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_disputes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "match_result_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      match_external_link_history: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          match_external_link_id: string
          match_game_id: string
          new_dota_match_id: number
          old_dota_match_id: number
          reason: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          match_external_link_id: string
          match_game_id: string
          new_dota_match_id: number
          old_dota_match_id: number
          reason: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          match_external_link_id?: string
          match_game_id?: string
          new_dota_match_id?: number
          old_dota_match_id?: number
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_external_link_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_external_link_history_match_external_link_id_fkey"
            columns: ["match_external_link_id"]
            isOneToOne: false
            referencedRelation: "match_external_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_external_link_history_match_game_id_fkey"
            columns: ["match_game_id"]
            isOneToOne: false
            referencedRelation: "match_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_external_link_history_match_game_id_fkey"
            columns: ["match_game_id"]
            isOneToOne: false
            referencedRelation: "public_match_games"
            referencedColumns: ["id"]
          },
        ]
      }
      match_external_links: {
        Row: {
          corrected_from_id: string | null
          correction_reason: string | null
          dire_team_id: string | null
          dota_match_id: number
          external_winner_team_id: string | null
          id: string
          linked_at: string
          linked_by: string
          match_game_id: string
          participant_summary: Json
          radiant_team_id: string | null
          reconciliation_state: Database["public"]["Enums"]["dota_reconciliation_state"]
          result_agrees: boolean | null
        }
        Insert: {
          corrected_from_id?: string | null
          correction_reason?: string | null
          dire_team_id?: string | null
          dota_match_id: number
          external_winner_team_id?: string | null
          id?: string
          linked_at?: string
          linked_by: string
          match_game_id: string
          participant_summary?: Json
          radiant_team_id?: string | null
          reconciliation_state?: Database["public"]["Enums"]["dota_reconciliation_state"]
          result_agrees?: boolean | null
        }
        Update: {
          corrected_from_id?: string | null
          correction_reason?: string | null
          dire_team_id?: string | null
          dota_match_id?: number
          external_winner_team_id?: string | null
          id?: string
          linked_at?: string
          linked_by?: string
          match_game_id?: string
          participant_summary?: Json
          radiant_team_id?: string | null
          reconciliation_state?: Database["public"]["Enums"]["dota_reconciliation_state"]
          result_agrees?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "match_external_links_corrected_from_id_fkey"
            columns: ["corrected_from_id"]
            isOneToOne: false
            referencedRelation: "match_external_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_external_links_dire_team_id_fkey"
            columns: ["dire_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_external_links_dire_team_id_fkey"
            columns: ["dire_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_external_links_dire_team_id_fkey"
            columns: ["dire_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_external_links_dire_team_id_fkey"
            columns: ["dire_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_external_links_dota_match_id_fkey"
            columns: ["dota_match_id"]
            isOneToOne: true
            referencedRelation: "dota_matches"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "match_external_links_dota_match_id_fkey"
            columns: ["dota_match_id"]
            isOneToOne: true
            referencedRelation: "public_dota_match_stats"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "match_external_links_external_winner_team_id_fkey"
            columns: ["external_winner_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_external_links_external_winner_team_id_fkey"
            columns: ["external_winner_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_external_links_external_winner_team_id_fkey"
            columns: ["external_winner_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_external_links_external_winner_team_id_fkey"
            columns: ["external_winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_external_links_linked_by_fkey"
            columns: ["linked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_external_links_match_game_id_fkey"
            columns: ["match_game_id"]
            isOneToOne: true
            referencedRelation: "match_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_external_links_match_game_id_fkey"
            columns: ["match_game_id"]
            isOneToOne: true
            referencedRelation: "public_match_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_external_links_radiant_team_id_fkey"
            columns: ["radiant_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_external_links_radiant_team_id_fkey"
            columns: ["radiant_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_external_links_radiant_team_id_fkey"
            columns: ["radiant_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_external_links_radiant_team_id_fkey"
            columns: ["radiant_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_games: {
        Row: {
          completed_at: string | null
          external_match_id: string | null
          game_number: number
          id: string
          match_id: string
          metadata: Json
          replay_url: string | null
          started_at: string | null
          team_a_score: number
          team_b_score: number
          winner_team_id: string | null
        }
        Insert: {
          completed_at?: string | null
          external_match_id?: string | null
          game_number: number
          id?: string
          match_id: string
          metadata?: Json
          replay_url?: string | null
          started_at?: string | null
          team_a_score?: number
          team_b_score?: number
          winner_team_id?: string | null
        }
        Update: {
          completed_at?: string | null
          external_match_id?: string | null
          game_number?: number
          id?: string
          match_id?: string
          metadata?: Json
          replay_url?: string | null
          started_at?: string | null
          team_a_score?: number
          team_b_score?: number
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_games_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_games_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_games_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_games_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_games_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_games_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_lineup_players: {
        Row: {
          is_substitute: boolean
          lineup_id: string
          player_id: string
          player_ign: string
        }
        Insert: {
          is_substitute?: boolean
          lineup_id: string
          player_id: string
          player_ign: string
        }
        Update: {
          is_substitute?: boolean
          lineup_id?: string
          player_id?: string
          player_ign?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lineup_players_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "match_lineups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineup_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "organizer_dota_verification"
            referencedColumns: ["tournament_player_id"]
          },
          {
            foreignKeyName: "match_lineup_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_player_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineup_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "tournament_players"
            referencedColumns: ["id"]
          },
        ]
      }
      match_lineups: {
        Row: {
          confirmed_at: string
          confirmed_by: string
          id: string
          locked_at: string | null
          match_id: string
          team_id: string
        }
        Insert: {
          confirmed_at?: string
          confirmed_by: string
          id?: string
          locked_at?: string | null
          match_id: string
          team_id: string
        }
        Update: {
          confirmed_at?: string
          confirmed_by?: string
          id?: string
          locked_at?: string | null
          match_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lineups_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_result_submissions: {
        Row: {
          created_at: string
          evidence_path: string | null
          id: string
          match_id: string
          notes: string | null
          request_id: string
          status: Database["public"]["Enums"]["result_submission_status"]
          submitted_by: string
          submitting_team_id: string
          team_a_score: number
          team_b_score: number
          winner_team_id: string
        }
        Insert: {
          created_at?: string
          evidence_path?: string | null
          id?: string
          match_id: string
          notes?: string | null
          request_id: string
          status?: Database["public"]["Enums"]["result_submission_status"]
          submitted_by: string
          submitting_team_id: string
          team_a_score: number
          team_b_score: number
          winner_team_id: string
        }
        Update: {
          created_at?: string
          evidence_path?: string | null
          id?: string
          match_id?: string
          notes?: string | null
          request_id?: string
          status?: Database["public"]["Enums"]["result_submission_status"]
          submitted_by?: string
          submitting_team_id?: string
          team_a_score?: number
          team_b_score?: number
          winner_team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_result_submissions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_result_submissions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_result_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_result_submissions_submitting_team_id_fkey"
            columns: ["submitting_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_result_submissions_submitting_team_id_fkey"
            columns: ["submitting_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_result_submissions_submitting_team_id_fkey"
            columns: ["submitting_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_result_submissions_submitting_team_id_fkey"
            columns: ["submitting_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_result_submissions_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_result_submissions_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_result_submissions_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_result_submissions_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_schedule_changes: {
        Row: {
          changed_by: string
          created_at: string
          id: string
          match_id: string
          new_scheduled_at: string
          old_scheduled_at: string | null
          reason: string
        }
        Insert: {
          changed_by: string
          created_at?: string
          id?: string
          match_id: string
          new_scheduled_at: string
          old_scheduled_at?: string | null
          reason: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          id?: string
          match_id?: string
          new_scheduled_at?: string
          old_scheduled_at?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_schedule_changes_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_schedule_changes_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_schedule_changes_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_snapshots: {
        Row: {
          best_of: number
          completed_at: string
          created_at: string
          group_name: string | null
          id: string
          match_id: string
          match_number: number
          round_number: number
          stage_name: string
          stage_type: Database["public"]["Enums"]["competition_stage_type"]
          status: Database["public"]["Enums"]["match_status"]
          team_a_id: string | null
          team_a_lineup: Json
          team_a_name: string | null
          team_a_score: number | null
          team_a_tag: string | null
          team_b_id: string | null
          team_b_lineup: Json
          team_b_name: string | null
          team_b_score: number | null
          team_b_tag: string | null
          tournament_id: string
          winner_name: string | null
          winner_team_id: string | null
        }
        Insert: {
          best_of: number
          completed_at: string
          created_at?: string
          group_name?: string | null
          id?: string
          match_id: string
          match_number: number
          round_number: number
          stage_name: string
          stage_type: Database["public"]["Enums"]["competition_stage_type"]
          status: Database["public"]["Enums"]["match_status"]
          team_a_id?: string | null
          team_a_lineup?: Json
          team_a_name?: string | null
          team_a_score?: number | null
          team_a_tag?: string | null
          team_b_id?: string | null
          team_b_lineup?: Json
          team_b_name?: string | null
          team_b_score?: number | null
          team_b_tag?: string | null
          tournament_id: string
          winner_name?: string | null
          winner_team_id?: string | null
        }
        Update: {
          best_of?: number
          completed_at?: string
          created_at?: string
          group_name?: string | null
          id?: string
          match_id?: string
          match_number?: number
          round_number?: number
          stage_name?: string
          stage_type?: Database["public"]["Enums"]["competition_stage_type"]
          status?: Database["public"]["Enums"]["match_status"]
          team_a_id?: string | null
          team_a_lineup?: Json
          team_a_name?: string | null
          team_a_score?: number | null
          team_a_tag?: string | null
          team_b_id?: string | null
          team_b_lineup?: Json
          team_b_name?: string | null
          team_b_score?: number | null
          team_b_tag?: string | null
          tournament_id?: string
          winner_name?: string | null
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_snapshots_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_snapshots_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_snapshots_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_snapshots_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          best_of: number
          check_in_deadline: string | null
          check_in_opens_at: string | null
          completed_at: string | null
          created_at: string
          external_match_reference: string | null
          forfeit_reason: string | null
          forfeit_team_id: string | null
          group_id: string | null
          id: string
          lobby_name: string | null
          lobby_password: string | null
          lobby_region: string | null
          lobby_server_id: string | null
          loser_team_id: string | null
          match_number: number
          next_match_id: string | null
          next_match_slot: number | null
          rematch_of_match_id: string | null
          revision: number
          round_number: number
          scheduled_at: string | null
          stage_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["match_status"]
          superseded_by_match_id: string | null
          team_a_id: string | null
          team_a_score: number | null
          team_b_id: string | null
          team_b_score: number | null
          tournament_id: string
          updated_at: string
          winner_team_id: string | null
        }
        Insert: {
          best_of: number
          check_in_deadline?: string | null
          check_in_opens_at?: string | null
          completed_at?: string | null
          created_at?: string
          external_match_reference?: string | null
          forfeit_reason?: string | null
          forfeit_team_id?: string | null
          group_id?: string | null
          id?: string
          lobby_name?: string | null
          lobby_password?: string | null
          lobby_region?: string | null
          lobby_server_id?: string | null
          loser_team_id?: string | null
          match_number: number
          next_match_id?: string | null
          next_match_slot?: number | null
          rematch_of_match_id?: string | null
          revision?: number
          round_number: number
          scheduled_at?: string | null
          stage_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          superseded_by_match_id?: string | null
          team_a_id?: string | null
          team_a_score?: number | null
          team_b_id?: string | null
          team_b_score?: number | null
          tournament_id: string
          updated_at?: string
          winner_team_id?: string | null
        }
        Update: {
          best_of?: number
          check_in_deadline?: string | null
          check_in_opens_at?: string | null
          completed_at?: string | null
          created_at?: string
          external_match_reference?: string | null
          forfeit_reason?: string | null
          forfeit_team_id?: string | null
          group_id?: string | null
          id?: string
          lobby_name?: string | null
          lobby_password?: string | null
          lobby_region?: string | null
          lobby_server_id?: string | null
          loser_team_id?: string | null
          match_number?: number
          next_match_id?: string | null
          next_match_slot?: number | null
          rematch_of_match_id?: string | null
          revision?: number
          round_number?: number
          scheduled_at?: string | null
          stage_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          superseded_by_match_id?: string | null
          team_a_id?: string | null
          team_a_score?: number | null
          team_b_id?: string | null
          team_b_score?: number | null
          tournament_id?: string
          updated_at?: string
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_forfeit_team_id_fkey"
            columns: ["forfeit_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_forfeit_team_id_fkey"
            columns: ["forfeit_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_forfeit_team_id_fkey"
            columns: ["forfeit_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_forfeit_team_id_fkey"
            columns: ["forfeit_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "competition_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_loser_team_id_fkey"
            columns: ["loser_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_loser_team_id_fkey"
            columns: ["loser_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_loser_team_id_fkey"
            columns: ["loser_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_loser_team_id_fkey"
            columns: ["loser_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_next_match_id_fkey"
            columns: ["next_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_next_match_id_fkey"
            columns: ["next_match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_rematch_of_match_id_fkey"
            columns: ["rematch_of_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_rematch_of_match_id_fkey"
            columns: ["rematch_of_match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "competition_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_superseded_by_match_id_fkey"
            columns: ["superseded_by_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_superseded_by_match_id_fkey"
            columns: ["superseded_by_match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_team_a_id_fkey"
            columns: ["tournament_id", "team_a_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "matches_tournament_id_team_a_id_fkey"
            columns: ["tournament_id", "team_a_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "matches_tournament_id_team_a_id_fkey"
            columns: ["tournament_id", "team_a_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "matches_tournament_id_team_a_id_fkey"
            columns: ["tournament_id", "team_a_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "matches_tournament_id_team_b_id_fkey"
            columns: ["tournament_id", "team_b_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "matches_tournament_id_team_b_id_fkey"
            columns: ["tournament_id", "team_b_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "matches_tournament_id_team_b_id_fkey"
            columns: ["tournament_id", "team_b_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "matches_tournament_id_team_b_id_fkey"
            columns: ["tournament_id", "team_b_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_appeals: {
        Row: {
          created_at: string
          evidence_path: string | null
          id: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          reviewed_by: string | null
          sanction_id: string
          status: Database["public"]["Enums"]["moderation_appeal_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          evidence_path?: string | null
          id?: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          reviewed_by?: string | null
          sanction_id: string
          status?: Database["public"]["Enums"]["moderation_appeal_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          evidence_path?: string | null
          id?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          reviewed_by?: string | null
          sanction_id?: string
          status?: Database["public"]["Enums"]["moderation_appeal_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_appeals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_appeals_sanction_id_fkey"
            columns: ["sanction_id"]
            isOneToOne: false
            referencedRelation: "sanctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_appeals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_case_notes: {
        Row: {
          author_user_id: string
          case_id: string
          created_at: string
          id: string
          note: string
        }
        Insert: {
          author_user_id: string
          case_id: string
          created_at?: string
          id?: string
          note: string
        }
        Update: {
          author_user_id?: string
          case_id?: string
          created_at?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_case_notes_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "moderation_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_cases: {
        Row: {
          assigned_to: string | null
          case_type: string
          created_at: string
          id: string
          report_id: string | null
          resolution: string | null
          resolved_at: string | null
          revision: number
          severity: Database["public"]["Enums"]["case_severity"]
          status: Database["public"]["Enums"]["case_status"]
          subject_user_id: string
          summary: string
          tournament_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          case_type: string
          created_at?: string
          id?: string
          report_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          revision?: number
          severity?: Database["public"]["Enums"]["case_severity"]
          status?: Database["public"]["Enums"]["case_status"]
          subject_user_id: string
          summary: string
          tournament_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          case_type?: string
          created_at?: string
          id?: string
          report_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          revision?: number
          severity?: Database["public"]["Enums"]["case_severity"]
          status?: Database["public"]["Enums"]["case_status"]
          subject_user_id?: string
          summary?: string
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_cases_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_cases_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_cases_subject_user_id_fkey"
            columns: ["subject_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_cases_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_cases_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      nomination_order: {
        Row: {
          completed_at: string | null
          id: string
          position: number
          round_number: number
          status: Database["public"]["Enums"]["nomination_status"]
          team_id: string
          tournament_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          position: number
          round_number: number
          status?: Database["public"]["Enums"]["nomination_status"]
          team_id: string
          tournament_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          position?: number
          round_number?: number
          status?: Database["public"]["Enums"]["nomination_status"]
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nomination_order_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nomination_order_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nomination_order_tournament_id_team_id_fkey"
            columns: ["tournament_id", "team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "nomination_order_tournament_id_team_id_fkey"
            columns: ["tournament_id", "team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "nomination_order_tournament_id_team_id_fkey"
            columns: ["tournament_id", "team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "nomination_order_tournament_id_team_id_fkey"
            columns: ["tournament_id", "team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      organizations: {
        Row: {
          accent_color: string | null
          country_code: string | null
          created_at: string
          created_by: string
          id: string
          logo_url: string | null
          name: string
          short_tag: string
          slug: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          accent_color?: string | null
          country_code?: string | null
          created_at?: string
          created_by: string
          id?: string
          logo_url?: string | null
          name: string
          short_tag: string
          slug: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          accent_color?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string
          id?: string
          logo_url?: string | null
          name?: string
          short_tag?: string
          slug?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_verifications: {
        Row: {
          notes: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["organizer_operational_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          notes?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["organizer_operational_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          notes?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["organizer_operational_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizer_verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          granted_at: string
          granted_by: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["platform_admin_role"]
          status: Database["public"]["Enums"]["platform_admin_status"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["platform_admin_role"]
          status?: Database["public"]["Enums"]["platform_admin_status"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["platform_admin_role"]
          status?: Database["public"]["Enums"]["platform_admin_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_admins_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string
          ends_at: string | null
          id: string
          published: boolean
          severity: Database["public"]["Enums"]["announcement_severity"]
          starts_at: string
          target: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          ends_at?: string | null
          id?: string
          published?: boolean
          severity?: Database["public"]["Enums"]["announcement_severity"]
          starts_at?: string
          target?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          ends_at?: string | null
          id?: string
          published?: boolean
          severity?: Database["public"]["Enums"]["announcement_severity"]
          starts_at?: string
          target?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_config: {
        Row: {
          description: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_achievements: {
        Row: {
          achievement_code: string
          awarded_at: string
          id: string
          match_id: string | null
          metadata: Json
          player_id: string
          tournament_id: string | null
        }
        Insert: {
          achievement_code: string
          awarded_at?: string
          id?: string
          match_id?: string | null
          metadata?: Json
          player_id: string
          tournament_id?: string | null
        }
        Update: {
          achievement_code?: string
          awarded_at?: string
          id?: string
          match_id?: string | null
          metadata?: Json
          player_id?: string
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_achievements_achievement_code_fkey"
            columns: ["achievement_code"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "player_achievements_achievement_code_fkey"
            columns: ["achievement_code"]
            isOneToOne: false
            referencedRelation: "public_player_achievements"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "player_achievements_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_achievements_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_achievements_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_achievements_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_achievements_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      player_competitive_ratings: {
        Row: {
          losses: number
          matches_count: number
          player_id: string
          rating: number
          rating_version: string
          status: Database["public"]["Enums"]["rating_confidence_status"]
          uncertainty: number
          updated_at: string
          wins: number
        }
        Insert: {
          losses?: number
          matches_count?: number
          player_id: string
          rating: number
          rating_version: string
          status?: Database["public"]["Enums"]["rating_confidence_status"]
          uncertainty: number
          updated_at?: string
          wins?: number
        }
        Update: {
          losses?: number
          matches_count?: number
          player_id?: string
          rating?: number
          rating_version?: string
          status?: Database["public"]["Enums"]["rating_confidence_status"]
          uncertainty?: number
          updated_at?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_competitive_ratings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_competitive_ratings_rating_version_fkey"
            columns: ["rating_version"]
            isOneToOne: false
            referencedRelation: "competitive_rating_versions"
            referencedColumns: ["version"]
          },
        ]
      }
      player_evidence: {
        Row: {
          created_at: string
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          id: string
          player_id: string
          storage_path: string
          tournament_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          id?: string
          player_id: string
          storage_path: string
          tournament_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          evidence_type?: Database["public"]["Enums"]["evidence_type"]
          id?: string
          player_id?: string
          storage_path?: string
          tournament_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_evidence_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "organizer_dota_verification"
            referencedColumns: ["tournament_player_id"]
          },
          {
            foreignKeyName: "player_evidence_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_player_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_evidence_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "tournament_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_evidence_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_evidence_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_evidence_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_game_accounts: {
        Row: {
          dota_account_id: number
          game: string
          id: string
          is_primary: boolean
          linked_at: string
          player_id: string
          profile_url: string | null
          steam_id64: number
          updated_at: string
          verification_status: Database["public"]["Enums"]["game_account_verification_status"]
          verified_at: string | null
        }
        Insert: {
          dota_account_id: number
          game?: string
          id?: string
          is_primary?: boolean
          linked_at?: string
          player_id: string
          profile_url?: string | null
          steam_id64: number
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["game_account_verification_status"]
          verified_at?: string | null
        }
        Update: {
          dota_account_id?: number
          game?: string
          id?: string
          is_primary?: boolean
          linked_at?: string
          player_id?: string
          profile_url?: string | null
          steam_id64?: number
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["game_account_verification_status"]
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_game_accounts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_season_ratings: {
        Row: {
          losses: number
          matches_count: number
          player_id: string
          rating: number
          rating_version: string
          season_id: string
          status: Database["public"]["Enums"]["rating_confidence_status"]
          uncertainty: number
          updated_at: string
          wins: number
        }
        Insert: {
          losses?: number
          matches_count?: number
          player_id: string
          rating: number
          rating_version: string
          season_id: string
          status?: Database["public"]["Enums"]["rating_confidence_status"]
          uncertainty: number
          updated_at?: string
          wins?: number
        }
        Update: {
          losses?: number
          matches_count?: number
          player_id?: string
          rating?: number
          rating_version?: string
          season_id?: string
          status?: Database["public"]["Enums"]["rating_confidence_status"]
          uncertainty?: number
          updated_at?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_season_ratings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_season_ratings_rating_version_fkey"
            columns: ["rating_version"]
            isOneToOne: false
            referencedRelation: "competitive_rating_versions"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "player_season_ratings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "public_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_season_ratings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_requests: {
        Row: {
          created_at: string
          id: string
          request_type: string
          resolved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_type: string
          resolved_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          request_type?: string
          resolved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country_code: string | null
          created_at: string
          discord_username: string | null
          display_name: string | null
          id: string
          public_slug: string
          show_discord_publicly: boolean
          show_mmr_history_publicly: boolean
          show_region_publicly: boolean
          show_steam_publicly: boolean
          steam_id: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          country_code?: string | null
          created_at?: string
          discord_username?: string | null
          display_name?: string | null
          id: string
          public_slug: string
          show_discord_publicly?: boolean
          show_mmr_history_publicly?: boolean
          show_region_publicly?: boolean
          show_steam_publicly?: boolean
          steam_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          country_code?: string | null
          created_at?: string
          discord_username?: string | null
          display_name?: string | null
          id?: string
          public_slug?: string
          show_discord_publicly?: boolean
          show_mmr_history_publicly?: boolean
          show_region_publicly?: boolean
          show_steam_publicly?: boolean
          steam_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      rating_reviews: {
        Row: {
          assessment: Database["public"]["Enums"]["rating_assessment"]
          created_at: string
          id: string
          player_id: string
          reviewer_user_id: string
          tournament_id: string
        }
        Insert: {
          assessment: Database["public"]["Enums"]["rating_assessment"]
          created_at?: string
          id?: string
          player_id: string
          reviewer_user_id: string
          tournament_id: string
        }
        Update: {
          assessment?: Database["public"]["Enums"]["rating_assessment"]
          created_at?: string
          id?: string
          player_id?: string
          reviewer_user_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rating_reviews_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "organizer_dota_verification"
            referencedColumns: ["tournament_player_id"]
          },
          {
            foreignKeyName: "rating_reviews_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_player_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_reviews_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "tournament_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_reviews_reviewer_user_id_fkey"
            columns: ["reviewer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_reviews_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_reviews_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string
          evidence_path: string | null
          id: string
          match_id: string | null
          priority: Database["public"]["Enums"]["case_severity"]
          reason: string
          report_type: string
          reported_user_id: string | null
          reporter_user_id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["report_status"]
          tournament_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description: string
          evidence_path?: string | null
          id?: string
          match_id?: string | null
          priority?: Database["public"]["Enums"]["case_severity"]
          reason: string
          report_type: string
          reported_user_id?: string | null
          reporter_user_id: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          tournament_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string
          evidence_path?: string | null
          id?: string
          match_id?: string | null
          priority?: Database["public"]["Enums"]["case_severity"]
          reason?: string
          report_type?: string
          reported_user_id?: string | null
          reporter_user_id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          tournament_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_policies: {
        Row: {
          automatic_deletion: boolean
          category: string
          legal_basis: string
          retention_days: number | null
          updated_at: string
        }
        Insert: {
          automatic_deletion?: boolean
          category: string
          legal_basis: string
          retention_days?: number | null
          updated_at?: string
        }
        Update: {
          automatic_deletion?: boolean
          category?: string
          legal_basis?: string
          retention_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      rule_acceptances: {
        Row: {
          accepted_at: string
          rule_version_id: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          rule_version_id: string
          tournament_id: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          rule_version_id?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_acceptances_rule_version_id_fkey"
            columns: ["rule_version_id"]
            isOneToOne: false
            referencedRelation: "tournament_rule_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_acceptances_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_acceptances_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_acceptances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sanctions: {
        Row: {
          active: boolean
          case_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          issued_by: string
          reason: string
          revoked_at: string | null
          revoked_by: string | null
          sanction_type: Database["public"]["Enums"]["sanction_type"]
          scope: Database["public"]["Enums"]["sanction_scope"]
          starts_at: string
          tournament_id: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          case_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_by: string
          reason: string
          revoked_at?: string | null
          revoked_by?: string | null
          sanction_type: Database["public"]["Enums"]["sanction_type"]
          scope: Database["public"]["Enums"]["sanction_scope"]
          starts_at?: string
          tournament_id?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          case_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_by?: string
          reason?: string
          revoked_at?: string | null
          revoked_by?: string | null
          sanction_type?: Database["public"]["Enums"]["sanction_type"]
          scope?: Database["public"]["Enums"]["sanction_scope"]
          starts_at?: string
          tournament_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sanctions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "moderation_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sanctions_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sanctions_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sanctions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sanctions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sanctions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scouting_entries: {
        Row: {
          captain_user_id: string
          category: Database["public"]["Enums"]["scouting_category"]
          created_at: string
          id: string
          notes: string | null
          player_id: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          captain_user_id: string
          category: Database["public"]["Enums"]["scouting_category"]
          created_at?: string
          id?: string
          notes?: string | null
          player_id: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          captain_user_id?: string
          category?: Database["public"]["Enums"]["scouting_category"]
          created_at?: string
          id?: string
          notes?: string | null
          player_id?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scouting_entries_captain_user_id_fkey"
            columns: ["captain_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scouting_entries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "organizer_dota_verification"
            referencedColumns: ["tournament_player_id"]
          },
          {
            foreignKeyName: "scouting_entries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_player_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scouting_entries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "tournament_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scouting_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scouting_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      season_rules: {
        Row: {
          minimum_matches_for_leaderboard: number
          minimum_tournaments_for_ranking: number
          placement_points: Json
          placement_points_enabled: boolean
          season_id: string
          season_rating_enabled: boolean
          updated_at: string
        }
        Insert: {
          minimum_matches_for_leaderboard?: number
          minimum_tournaments_for_ranking?: number
          placement_points?: Json
          placement_points_enabled?: boolean
          season_id: string
          season_rating_enabled?: boolean
          updated_at?: string
        }
        Update: {
          minimum_matches_for_leaderboard?: number
          minimum_tournaments_for_ranking?: number
          placement_points?: Json
          placement_points_enabled?: boolean
          season_id?: string
          season_rating_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_rules_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: true
            referencedRelation: "public_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_rules_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: true
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          created_by: string
          ends_at: string
          id: string
          name: string
          sequence: number
          slug: string
          starts_at: string
          status: Database["public"]["Enums"]["season_status"]
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by: string
          ends_at: string
          id?: string
          name: string
          sequence: number
          slug: string
          starts_at: string
          status?: Database["public"]["Enums"]["season_status"]
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string
          ends_at?: string
          id?: string
          name?: string
          sequence?: number
          slug?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["season_status"]
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "seasons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          details: Json
          event_type: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          severity: Database["public"]["Enums"]["case_severity"]
          summary: string
          tournament_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: Database["public"]["Enums"]["case_severity"]
          summary: string
          tournament_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: Database["public"]["Enums"]["case_severity"]
          summary?: string
          tournament_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sensitive_action_approvals: {
        Row: {
          action_type: string
          created_at: string
          id: string
          payload: Json
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          payload: Json
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          payload?: Json
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sensitive_action_approvals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensitive_action_approvals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      substitutions: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          incoming_player_id: string
          new_team_mmr: number
          old_team_mmr: number
          outgoing_player_id: string | null
          reason: string
          requested_by: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["substitution_status"]
          team_id: string
          tournament_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id?: string
          incoming_player_id: string
          new_team_mmr: number
          old_team_mmr: number
          outgoing_player_id?: string | null
          reason: string
          requested_by: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["substitution_status"]
          team_id: string
          tournament_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          incoming_player_id?: string
          new_team_mmr?: number
          old_team_mmr?: number
          outgoing_player_id?: string | null
          reason?: string
          requested_by?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["substitution_status"]
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "substitutions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_incoming_player_id_fkey"
            columns: ["incoming_player_id"]
            isOneToOne: false
            referencedRelation: "organizer_dota_verification"
            referencedColumns: ["tournament_player_id"]
          },
          {
            foreignKeyName: "substitutions_incoming_player_id_fkey"
            columns: ["incoming_player_id"]
            isOneToOne: false
            referencedRelation: "public_player_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_incoming_player_id_fkey"
            columns: ["incoming_player_id"]
            isOneToOne: false
            referencedRelation: "tournament_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_outgoing_player_id_fkey"
            columns: ["outgoing_player_id"]
            isOneToOne: false
            referencedRelation: "organizer_dota_verification"
            referencedColumns: ["tournament_player_id"]
          },
          {
            foreignKeyName: "substitutions_outgoing_player_id_fkey"
            columns: ["outgoing_player_id"]
            isOneToOne: false
            referencedRelation: "public_player_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_outgoing_player_id_fkey"
            columns: ["outgoing_player_id"]
            isOneToOne: false
            referencedRelation: "tournament_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "substitutions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "substitutions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          author_user_id: string
          created_at: string
          id: string
          is_internal: boolean
          message: string
          ticket_id: string
        }
        Insert: {
          author_user_id: string
          created_at?: string
          id?: string
          is_internal?: boolean
          message: string
          ticket_id: string
        }
        Update: {
          author_user_id?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          message?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["support_category"]
          closed_at: string | null
          created_at: string
          id: string
          priority: Database["public"]["Enums"]["case_severity"]
          status: Database["public"]["Enums"]["support_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category: Database["public"]["Enums"]["support_category"]
          closed_at?: string | null
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["case_severity"]
          status?: Database["public"]["Enums"]["support_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["support_category"]
          closed_at?: string | null
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["case_severity"]
          status?: Database["public"]["Enums"]["support_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_roster: {
        Row: {
          acquisition_type: Database["public"]["Enums"]["acquisition_type"]
          auction_id: string | null
          created_at: string
          id: string
          is_active: boolean
          is_captain: boolean
          is_substitute: boolean
          player_id: string
          purchase_price: number | null
          team_id: string
          tournament_id: string
          tournament_mmr_at_draft: number
        }
        Insert: {
          acquisition_type: Database["public"]["Enums"]["acquisition_type"]
          auction_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_captain?: boolean
          is_substitute?: boolean
          player_id: string
          purchase_price?: number | null
          team_id: string
          tournament_id: string
          tournament_mmr_at_draft: number
        }
        Update: {
          acquisition_type?: Database["public"]["Enums"]["acquisition_type"]
          auction_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_captain?: boolean
          is_substitute?: boolean
          player_id?: string
          purchase_price?: number | null
          team_id?: string
          tournament_id?: string
          tournament_mmr_at_draft?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_roster_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_roster_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "public_auction_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_roster_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_roster_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_roster_tournament_id_player_id_fkey"
            columns: ["tournament_id", "player_id"]
            isOneToOne: false
            referencedRelation: "organizer_dota_verification"
            referencedColumns: ["tournament_id", "tournament_player_id"]
          },
          {
            foreignKeyName: "team_roster_tournament_id_player_id_fkey"
            columns: ["tournament_id", "player_id"]
            isOneToOne: false
            referencedRelation: "public_player_pool"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "team_roster_tournament_id_player_id_fkey"
            columns: ["tournament_id", "player_id"]
            isOneToOne: false
            referencedRelation: "tournament_players"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "team_roster_tournament_id_team_id_fkey"
            columns: ["tournament_id", "team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "team_roster_tournament_id_team_id_fkey"
            columns: ["tournament_id", "team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "team_roster_tournament_id_team_id_fkey"
            columns: ["tournament_id", "team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "team_roster_tournament_id_team_id_fkey"
            columns: ["tournament_id", "team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      teams: {
        Row: {
          accent_color: string | null
          captain_mmr: number
          captain_user_id: string
          confirmation_status: Database["public"]["Enums"]["captain_confirmation_status"]
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          credits_remaining: number
          current_team_mmr: number
          id: string
          logo_url: string | null
          max_roster_size: number
          name: string
          organization_id: string | null
          public_slug: string
          roster_size: number
          short_tag: string
          starting_credits: number
          tournament_id: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          captain_mmr?: number
          captain_user_id: string
          confirmation_status?: Database["public"]["Enums"]["captain_confirmation_status"]
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          credits_remaining: number
          current_team_mmr?: number
          id?: string
          logo_url?: string | null
          max_roster_size: number
          name: string
          organization_id?: string | null
          public_slug: string
          roster_size?: number
          short_tag: string
          starting_credits: number
          tournament_id: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          captain_mmr?: number
          captain_user_id?: string
          confirmation_status?: Database["public"]["Enums"]["captain_confirmation_status"]
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          credits_remaining?: number
          current_team_mmr?: number
          id?: string
          logo_url?: string | null
          max_roster_size?: number
          name?: string
          organization_id?: string | null
          public_slug?: string
          roster_size?: number
          short_tag?: string
          starting_credits?: number
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_captain_user_id_fkey"
            columns: ["captain_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "public_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string
          ends_at: string | null
          id: string
          published: boolean
          severity: Database["public"]["Enums"]["announcement_severity"]
          starts_at: string
          target: string
          title: string
          tournament_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          ends_at?: string | null
          id?: string
          published?: boolean
          severity?: Database["public"]["Enums"]["announcement_severity"]
          starts_at?: string
          target?: string
          title: string
          tournament_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          ends_at?: string | null
          id?: string
          published?: boolean
          severity?: Database["public"]["Enums"]["announcement_severity"]
          starts_at?: string
          target?: string
          title?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_announcements_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_announcements_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_member_roles: {
        Row: {
          created_at: string
          member_id: string
          role: Database["public"]["Enums"]["tournament_role"]
        }
        Insert: {
          created_at?: string
          member_id: string
          role: Database["public"]["Enums"]["tournament_role"]
        }
        Update: {
          created_at?: string
          member_id?: string
          role?: Database["public"]["Enums"]["tournament_role"]
        }
        Relationships: [
          {
            foreignKeyName: "tournament_member_roles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "tournament_members"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_members: {
        Row: {
          created_at: string
          id: string
          status: Database["public"]["Enums"]["member_status"]
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["member_status"]
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["member_status"]
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_members_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_members_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_players: {
        Row: {
          additional_notes: string | null
          availability_status: string
          created_at: string
          declared_mmr: number | null
          draft_state: Database["public"]["Enums"]["player_draft_state"]
          full_name: string | null
          id: string
          ign: string
          is_active: boolean
          is_drafted: boolean
          is_eligible: boolean
          is_reserve: boolean
          player_type: Database["public"]["Enums"]["player_type"]
          primary_role: string | null
          profile_url: string | null
          rating_confidence:
            | Database["public"]["Enums"]["rating_confidence_level"]
            | null
          rating_status: Database["public"]["Enums"]["rating_status"]
          recent_peak_mmr: number | null
          region: string | null
          registration_status: Database["public"]["Enums"]["registration_status"]
          secondary_role: string | null
          tournament_id: string
          tournament_mmr: number | null
          updated_at: string
          user_id: string
          verified_mmr: number | null
        }
        Insert: {
          additional_notes?: string | null
          availability_status?: string
          created_at?: string
          declared_mmr?: number | null
          draft_state?: Database["public"]["Enums"]["player_draft_state"]
          full_name?: string | null
          id?: string
          ign: string
          is_active?: boolean
          is_drafted?: boolean
          is_eligible?: boolean
          is_reserve?: boolean
          player_type?: Database["public"]["Enums"]["player_type"]
          primary_role?: string | null
          profile_url?: string | null
          rating_confidence?:
            | Database["public"]["Enums"]["rating_confidence_level"]
            | null
          rating_status?: Database["public"]["Enums"]["rating_status"]
          recent_peak_mmr?: number | null
          region?: string | null
          registration_status?: Database["public"]["Enums"]["registration_status"]
          secondary_role?: string | null
          tournament_id: string
          tournament_mmr?: number | null
          updated_at?: string
          user_id: string
          verified_mmr?: number | null
        }
        Update: {
          additional_notes?: string | null
          availability_status?: string
          created_at?: string
          declared_mmr?: number | null
          draft_state?: Database["public"]["Enums"]["player_draft_state"]
          full_name?: string | null
          id?: string
          ign?: string
          is_active?: boolean
          is_drafted?: boolean
          is_eligible?: boolean
          is_reserve?: boolean
          player_type?: Database["public"]["Enums"]["player_type"]
          primary_role?: string | null
          profile_url?: string | null
          rating_confidence?:
            | Database["public"]["Enums"]["rating_confidence_level"]
            | null
          rating_status?: Database["public"]["Enums"]["rating_status"]
          recent_peak_mmr?: number | null
          region?: string | null
          registration_status?: Database["public"]["Enums"]["registration_status"]
          secondary_role?: string | null
          tournament_id?: string
          tournament_mmr?: number | null
          updated_at?: string
          user_id?: string
          verified_mmr?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_rule_versions: {
        Row: {
          content: string
          created_at: string
          created_by: string
          effective_at: string
          id: string
          requires_reacceptance: boolean
          tournament_id: string
          version: number
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          effective_at?: string
          id?: string
          requires_reacceptance?: boolean
          tournament_id: string
          version: number
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          effective_at?: string
          id?: string
          requires_reacceptance?: boolean
          tournament_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tournament_rule_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_rule_versions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_rule_versions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_rules: {
        Row: {
          allow_custom_bid_jumps: boolean
          allow_trades: boolean
          allow_unsold_round: boolean
          anti_snipe_extension_seconds: number
          anti_snipe_threshold_seconds: number
          bid_increment: number
          evidence_required: boolean
          expose_verified_mmr_to_captains: boolean
          initial_bid_seconds: number
          locked_at: string | null
          minimum_bid: number
          mmr_max: number | null
          mmr_min: number | null
          mmr_target: number | null
          nomination_seconds: number
          replacement_mmr_tolerance: number
          required_roles: string[]
          roles_enforced: boolean
          rules_version: number
          spectator_delay_seconds: number
          starting_credits: number
          team_size: number
          tournament_id: string
          unsold_minimum_bid: number | null
          updated_at: string
        }
        Insert: {
          allow_custom_bid_jumps?: boolean
          allow_trades?: boolean
          allow_unsold_round?: boolean
          anti_snipe_extension_seconds?: number
          anti_snipe_threshold_seconds?: number
          bid_increment: number
          evidence_required?: boolean
          expose_verified_mmr_to_captains?: boolean
          initial_bid_seconds: number
          locked_at?: string | null
          minimum_bid: number
          mmr_max?: number | null
          mmr_min?: number | null
          mmr_target?: number | null
          nomination_seconds: number
          replacement_mmr_tolerance?: number
          required_roles?: string[]
          roles_enforced?: boolean
          rules_version?: number
          spectator_delay_seconds?: number
          starting_credits: number
          team_size: number
          tournament_id: string
          unsold_minimum_bid?: number | null
          updated_at?: string
        }
        Update: {
          allow_custom_bid_jumps?: boolean
          allow_trades?: boolean
          allow_unsold_round?: boolean
          anti_snipe_extension_seconds?: number
          anti_snipe_threshold_seconds?: number
          bid_increment?: number
          evidence_required?: boolean
          expose_verified_mmr_to_captains?: boolean
          initial_bid_seconds?: number
          locked_at?: string | null
          minimum_bid?: number
          mmr_max?: number | null
          mmr_min?: number | null
          mmr_target?: number | null
          nomination_seconds?: number
          replacement_mmr_tolerance?: number
          required_roles?: string[]
          roles_enforced?: boolean
          rules_version?: number
          spectator_delay_seconds?: number
          starting_credits?: number
          team_size?: number
          tournament_id?: string
          unsold_minimum_bid?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_rules_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_rules_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          active_rule_version_id: string | null
          appeals_close_at: string | null
          auction_starts_at: string | null
          created_at: string
          created_by: string
          ends_at: string | null
          id: string
          name: string
          ratings_lock_at: string | null
          registration_closes_at: string | null
          registration_opens_at: string | null
          season: string | null
          season_id: string | null
          slug: string
          starts_at: string | null
          status: Database["public"]["Enums"]["tournament_status"]
          updated_at: string
        }
        Insert: {
          active_rule_version_id?: string | null
          appeals_close_at?: string | null
          auction_starts_at?: string | null
          created_at?: string
          created_by: string
          ends_at?: string | null
          id?: string
          name: string
          ratings_lock_at?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          season?: string | null
          season_id?: string | null
          slug: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
        }
        Update: {
          active_rule_version_id?: string | null
          appeals_close_at?: string | null
          auction_starts_at?: string | null
          created_at?: string
          created_by?: string
          ends_at?: string | null
          id?: string
          name?: string
          ratings_lock_at?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          season?: string | null
          season_id?: string | null
          slug?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_active_rule_version_id_fkey"
            columns: ["active_rule_version_id"]
            isOneToOne: false
            referencedRelation: "tournament_rule_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "public_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      unsold_rounds: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          round_number: number
          started_at: string | null
          status: string
          tournament_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          round_number: number
          started_at?: string | null
          status?: string
          tournament_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          round_number?: number
          started_at?: string | null
          status?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unsold_rounds_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unsold_rounds_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      organizer_dota_verification: {
        Row: {
          dota_account_id: number | null
          last_synced_at: string | null
          leaderboard_rank: number | null
          profile_visibility: string | null
          provider: Database["public"]["Enums"]["external_provider"] | null
          rank_tier: number | null
          tournament_id: string | null
          tournament_player_id: string | null
          verification_status:
            | Database["public"]["Enums"]["game_account_verification_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_rating_review_summary: {
        Row: {
          assessment: Database["public"]["Enums"]["rating_assessment"] | null
          player_id: string | null
          review_count: number | null
          tournament_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rating_reviews_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "organizer_dota_verification"
            referencedColumns: ["tournament_player_id"]
          },
          {
            foreignKeyName: "rating_reviews_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_player_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_reviews_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "tournament_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_reviews_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_reviews_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_health: {
        Row: {
          active_sanctions: number | null
          active_tournaments: number | null
          open_cases: number | null
          open_reports: number | null
          open_support: number | null
          rating_backlog: number | null
          unresolved_disputes: number | null
        }
        Relationships: []
      }
      provider_operational_metrics: {
        Row: {
          cache_hits_day: number | null
          circuit_state: string | null
          consecutive_failures: number | null
          last_error_code: string | null
          last_failure_at: string | null
          last_success_at: string | null
          next_retry_at: string | null
          provider: Database["public"]["Enums"]["external_provider"] | null
          queue_depth: number | null
          rate_limit_count: number | null
          recent_error_count: number | null
          requests_day: number | null
          requests_hour: number | null
          requests_minute: number | null
          status: string | null
        }
        Insert: {
          cache_hits_day?: never
          circuit_state?: string | null
          consecutive_failures?: number | null
          last_error_code?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          next_retry_at?: string | null
          provider?: Database["public"]["Enums"]["external_provider"] | null
          queue_depth?: never
          rate_limit_count?: number | null
          recent_error_count?: number | null
          requests_day?: never
          requests_hour?: never
          requests_minute?: never
          status?: string | null
        }
        Update: {
          cache_hits_day?: never
          circuit_state?: string | null
          consecutive_failures?: number | null
          last_error_code?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          next_retry_at?: string | null
          provider?: Database["public"]["Enums"]["external_provider"] | null
          queue_depth?: never
          rate_limit_count?: number | null
          recent_error_count?: number | null
          requests_day?: never
          requests_hour?: never
          requests_minute?: never
          status?: string | null
        }
        Relationships: []
      }
      public_active_announcements: {
        Row: {
          body: string | null
          ends_at: string | null
          id: string | null
          severity: Database["public"]["Enums"]["announcement_severity"] | null
          starts_at: string | null
          target: string | null
          title: string | null
        }
        Insert: {
          body?: string | null
          ends_at?: string | null
          id?: string | null
          severity?: Database["public"]["Enums"]["announcement_severity"] | null
          starts_at?: string | null
          target?: string | null
          title?: string | null
        }
        Update: {
          body?: string | null
          ends_at?: string | null
          id?: string | null
          severity?: Database["public"]["Enums"]["announcement_severity"] | null
          starts_at?: string | null
          target?: string | null
          title?: string | null
        }
        Relationships: []
      }
      public_auction_state: {
        Row: {
          closed_at: string | null
          closes_at: string | null
          current_bid: number | null
          id: string | null
          leading_team_id: string | null
          nominating_team_id: string | null
          opening_bid: number | null
          player_id: string | null
          revision: number | null
          sequence_number: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["auction_status"] | null
          tournament_id: string | null
          winning_bid: number | null
          winning_team_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auctions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_leading_team_id_fkey"
            columns: ["tournament_id", "leading_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_leading_team_id_fkey"
            columns: ["tournament_id", "leading_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_leading_team_id_fkey"
            columns: ["tournament_id", "leading_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_leading_team_id_fkey"
            columns: ["tournament_id", "leading_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_nominating_team_id_fkey"
            columns: ["tournament_id", "nominating_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_nominating_team_id_fkey"
            columns: ["tournament_id", "nominating_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_nominating_team_id_fkey"
            columns: ["tournament_id", "nominating_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_nominating_team_id_fkey"
            columns: ["tournament_id", "nominating_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_player_id_fkey"
            columns: ["tournament_id", "player_id"]
            isOneToOne: false
            referencedRelation: "organizer_dota_verification"
            referencedColumns: ["tournament_id", "tournament_player_id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_player_id_fkey"
            columns: ["tournament_id", "player_id"]
            isOneToOne: false
            referencedRelation: "public_player_pool"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_player_id_fkey"
            columns: ["tournament_id", "player_id"]
            isOneToOne: false
            referencedRelation: "tournament_players"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_winning_team_id_fkey"
            columns: ["tournament_id", "winning_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_winning_team_id_fkey"
            columns: ["tournament_id", "winning_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_winning_team_id_fkey"
            columns: ["tournament_id", "winning_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "auctions_tournament_id_winning_team_id_fkey"
            columns: ["tournament_id", "winning_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
        ]
      }
      public_captain_career_stats: {
        Row: {
          average_credits_remaining: number | null
          average_team_mmr_vs_target: number | null
          captain_name: string | null
          captain_slug: string | null
          championships: number | null
          contested_wins: number | null
          match_losses: number | null
          match_wins: number | null
          matches_played: number | null
          players_acquired: number | null
          runner_up_finishes: number | null
          total_credits_spent: number | null
          tournaments_captained: number | null
          uncontested_wins: number | null
          unsold_round_acquisitions: number | null
        }
        Relationships: []
      }
      public_captain_draft_history: {
        Row: {
          average_purchase_efficiency: number | null
          captain_name: string | null
          captain_slug: string | null
          completed_at: string | null
          contested_wins: number | null
          credits_remaining: number | null
          credits_spent: number | null
          distance_from_target: number | null
          final_team_mmr: number | null
          players_acquired: number | null
          team_name: string | null
          team_slug: string | null
          tournament_name: string | null
          tournament_slug: string | null
          uncontested_wins: number | null
          unsold_round_acquisitions: number | null
        }
        Relationships: []
      }
      public_career_timeline: {
        Row: {
          detail: string | null
          event_at: string | null
          event_type: string | null
          public_slug: string | null
          tournament: string | null
        }
        Relationships: []
      }
      public_competition_rankings: {
        Row: {
          game_difference: number | null
          games_lost: number | null
          games_won: number | null
          group_id: string | null
          head_to_head_points: number | null
          losses: number | null
          played: number | null
          points: number | null
          position: number | null
          short_tag: string | null
          sort_key: number[] | null
          team_id: string | null
          team_name: string | null
          tiebreak_required: boolean | null
          tournament_id: string | null
          wins: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "competition_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      public_dota_match_stats: {
        Row: {
          account_id: number | null
          assists: number | null
          deaths: number | null
          duration_seconds: number | null
          gpm: number | null
          hero_id: number | null
          hero_name: string | null
          is_radiant: boolean | null
          kills: number | null
          match_game_id: string | null
          match_id: number | null
          parse_state: Database["public"]["Enums"]["dota_parse_state"] | null
          patch: number | null
          radiant_win: boolean | null
          slot: number | null
          start_time: string | null
          xpm: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dota_match_players_hero_id_fkey"
            columns: ["hero_id"]
            isOneToOne: false
            referencedRelation: "dota_heroes"
            referencedColumns: ["hero_id"]
          },
          {
            foreignKeyName: "match_external_links_match_game_id_fkey"
            columns: ["match_game_id"]
            isOneToOne: true
            referencedRelation: "match_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_external_links_match_game_id_fkey"
            columns: ["match_game_id"]
            isOneToOne: true
            referencedRelation: "public_match_games"
            referencedColumns: ["id"]
          },
        ]
      }
      public_draft_events: {
        Row: {
          amount: number | null
          event_at: string | null
          event_id: string | null
          event_type: string | null
          player_id: string | null
          sequence_number: number | null
          team_id: string | null
          tournament_id: string | null
        }
        Relationships: []
      }
      public_draft_player_analytics: {
        Row: {
          active_bidding_duration_seconds: number | null
          anti_snipe_extension_count: number | null
          auction_sequence: number | null
          bid_count: number | null
          credits_per_1000_mmr: number | null
          draft_phase: string | null
          expected_price: number | null
          ign: string | null
          mmr_rank: number | null
          nomination_round: number | null
          player_slug: string | null
          price_delta: number | null
          price_indicator: string | null
          price_rank: number | null
          price_ratio: number | null
          primary_role: string | null
          purchase_price: number | null
          snapshot_id: string | null
          team_id: string | null
          tournament_id: string | null
          tournament_mmr_at_draft: number | null
          unique_bidding_teams: number | null
          wall_clock_duration_seconds: number | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_player_snapshots_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "draft_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      public_draft_team_analytics: {
        Row: {
          average_purchase: number | null
          captain_mmr: number | null
          captain_name: string | null
          captain_slug: string | null
          contested_wins: number | null
          credits_per_1000_mmr: number | null
          credits_remaining: number | null
          credits_spent: number | null
          drafted_mmr: number | null
          final_team_mmr: number | null
          highest_purchase: number | null
          logo_url: string | null
          lowest_purchase: number | null
          normal_round_spend: number | null
          recruit_count: number | null
          snapshot_id: string | null
          starting_credits: number | null
          team_name: string | null
          team_slug: string | null
          team_tag: string | null
          tournament_id: string | null
          uncontested_wins: number | null
          unsold_round_acquisitions: number | null
          unsold_round_spend: number | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_team_snapshots_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "draft_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      public_group_advancements: {
        Row: {
          created_at: string | null
          group_id: string | null
          group_name: string | null
          group_position: number | null
          knockout_seed: number | null
          short_tag: string | null
          team_id: string | null
          team_name: string | null
          tournament_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_advancement_results_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "competition_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_advancement_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "group_advancement_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "group_advancement_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_advancement_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_advancement_results_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_advancement_results_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      public_group_knockout_seeding: {
        Row: {
          destination_match_id: string | null
          destination_slot: number | null
          short_tag: string | null
          source_group: string | null
          source_group_id: string | null
          source_position: number | null
          team_id: string | null
          team_name: string | null
          tournament_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_knockout_seed_mappings_destination_match_id_fkey"
            columns: ["destination_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_knockout_seed_mappings_destination_match_id_fkey"
            columns: ["destination_match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_knockout_seed_mappings_source_group_id_fkey"
            columns: ["source_group_id"]
            isOneToOne: false
            referencedRelation: "competition_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_knockout_seed_mappings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "group_knockout_seed_mappings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "group_knockout_seed_mappings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_knockout_seed_mappings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_knockout_seed_mappings_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_knockout_seed_mappings_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      public_match_games: {
        Row: {
          completed_at: string | null
          external_match_id: string | null
          game_number: number | null
          id: string | null
          match_id: string | null
          replay_url: string | null
          started_at: string | null
          team_a_score: number | null
          team_b_score: number | null
          winner_team_id: string | null
        }
        Insert: {
          completed_at?: string | null
          external_match_id?: string | null
          game_number?: number | null
          id?: string | null
          match_id?: string | null
          replay_url?: string | null
          started_at?: string | null
          team_a_score?: number | null
          team_b_score?: number | null
          winner_team_id?: string | null
        }
        Update: {
          completed_at?: string | null
          external_match_id?: string | null
          game_number?: number | null
          id?: string | null
          match_id?: string | null
          replay_url?: string | null
          started_at?: string | null
          team_a_score?: number | null
          team_b_score?: number | null
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_games_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_games_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_games_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_games_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_games_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_games_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      public_matches: {
        Row: {
          best_of: number | null
          completed_at: string | null
          forfeit_team_id: string | null
          group_id: string | null
          group_name: string | null
          id: string | null
          match_number: number | null
          rematch_of_match_id: string | null
          round_number: number | null
          scheduled_at: string | null
          stage_id: string | null
          stage_name: string | null
          stage_type:
            | Database["public"]["Enums"]["competition_stage_type"]
            | null
          started_at: string | null
          status: Database["public"]["Enums"]["match_status"] | null
          superseded_by_match_id: string | null
          team_a_id: string | null
          team_a_name: string | null
          team_a_score: number | null
          team_a_tag: string | null
          team_b_id: string | null
          team_b_name: string | null
          team_b_score: number | null
          team_b_tag: string | null
          tournament_id: string | null
          winner_name: string | null
          winner_team_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_forfeit_team_id_fkey"
            columns: ["forfeit_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_forfeit_team_id_fkey"
            columns: ["forfeit_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_forfeit_team_id_fkey"
            columns: ["forfeit_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_forfeit_team_id_fkey"
            columns: ["forfeit_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "competition_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_rematch_of_match_id_fkey"
            columns: ["rematch_of_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_rematch_of_match_id_fkey"
            columns: ["rematch_of_match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "competition_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_superseded_by_match_id_fkey"
            columns: ["superseded_by_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_superseded_by_match_id_fkey"
            columns: ["superseded_by_match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_team_a_id_fkey"
            columns: ["tournament_id", "team_a_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "matches_tournament_id_team_a_id_fkey"
            columns: ["tournament_id", "team_a_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "matches_tournament_id_team_a_id_fkey"
            columns: ["tournament_id", "team_a_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "matches_tournament_id_team_a_id_fkey"
            columns: ["tournament_id", "team_a_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "matches_tournament_id_team_b_id_fkey"
            columns: ["tournament_id", "team_b_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "matches_tournament_id_team_b_id_fkey"
            columns: ["tournament_id", "team_b_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["tournament_id", "team_id"]
          },
          {
            foreignKeyName: "matches_tournament_id_team_b_id_fkey"
            columns: ["tournament_id", "team_b_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "matches_tournament_id_team_b_id_fkey"
            columns: ["tournament_id", "team_b_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["tournament_id", "id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "public_competition_rankings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "public_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "public_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      public_organization_history: {
        Row: {
          accent_color: string | null
          captain: string | null
          captain_slug: string | null
          champion: boolean | null
          country_code: string | null
          credits_remaining: number | null
          credits_spent: number | null
          logo_url: string | null
          match_losses: number | null
          match_wins: number | null
          matches_played: number | null
          name: string | null
          organization_slug: string | null
          roster: Json | null
          runner_up: boolean | null
          season: string | null
          short_tag: string | null
          team: string | null
          tournament: string | null
          tournament_slug: string | null
          verified: boolean | null
        }
        Relationships: []
      }
      public_organization_standings: {
        Row: {
          championships: number | null
          final_appearances: number | null
          match_wins: number | null
          name: string | null
          organization_slug: string | null
          season_id: string | null
          short_tag: string | null
          tournaments: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "public_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      public_organizations: {
        Row: {
          accent_color: string | null
          country_code: string | null
          created_at: string | null
          id: string | null
          logo_url: string | null
          name: string | null
          short_tag: string | null
          slug: string | null
          verified: boolean | null
        }
        Insert: {
          accent_color?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          short_tag?: string | null
          slug?: string | null
          verified?: boolean | null
        }
        Update: {
          accent_color?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          short_tag?: string | null
          slug?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      public_player_achievements: {
        Row: {
          awarded_at: string | null
          code: string | null
          description: string | null
          icon: string | null
          name: string | null
          public_slug: string | null
          tournament: string | null
          tournament_slug: string | null
        }
        Relationships: []
      }
      public_player_career_stats: {
        Row: {
          avatar_url: string | null
          average_auction_price: number | null
          championships: number | null
          competitive_rating: number | null
          confidence:
            | Database["public"]["Enums"]["rating_confidence_status"]
            | null
          highest_auction_price: number | null
          matches_played: number | null
          player_name: string | null
          public_slug: string | null
          runner_up_finishes: number | null
          series_losses: number | null
          series_wins: number | null
          teams_represented: number | null
          times_drafted: number | null
          tournaments_completed: number | null
          tournaments_entered: number | null
          uncertainty: number | null
          win_rate: number | null
        }
        Relationships: []
      }
      public_player_dota_stats: {
        Row: {
          assists: number | null
          avg_gpm: number | null
          avg_xpm: number | null
          deaths: number | null
          games_played: number | null
          hero_diversity: number | null
          kda: number | null
          kills: number | null
          losses: number | null
          public_slug: string | null
          wins: number | null
        }
        Relationships: []
      }
      public_player_draft_history: {
        Row: {
          acquisition_type:
            | Database["public"]["Enums"]["acquisition_type"]
            | null
          completed_at: string | null
          ign: string | null
          player_slug: string | null
          primary_role: string | null
          purchase_price: number | null
          team_name: string | null
          team_slug: string | null
          tournament_mmr_at_draft: number | null
          tournament_name: string | null
          tournament_slug: string | null
        }
        Relationships: []
      }
      public_player_leaderboard: {
        Row: {
          competitive_rating: number | null
          confidence:
            | Database["public"]["Enums"]["rating_confidence_status"]
            | null
          losses: number | null
          matches_count: number | null
          player_name: string | null
          primary_role: string | null
          public_slug: string | null
          rank: number | null
          region: string | null
          win_rate: number | null
          wins: number | null
        }
        Relationships: []
      }
      public_player_match_history: {
        Row: {
          completed_at: string | null
          forfeit: boolean | null
          opponent: string | null
          public_slug: string | null
          result: string | null
          stage: string | null
          team: string | null
          team_a_score: number | null
          team_b_score: number | null
          tournament: string | null
          tournament_slug: string | null
        }
        Relationships: []
      }
      public_player_pool: {
        Row: {
          id: string | null
          ign: string | null
          is_drafted: boolean | null
          is_reserve: boolean | null
          primary_role: string | null
          region: string | null
          secondary_role: string | null
          tournament_id: string | null
          tournament_mmr: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      public_rating_history: {
        Row: {
          delta: number | null
          match_id: string | null
          processed_at: string | null
          public_slug: string | null
          rating: number | null
          rating_after: number | null
          rating_before: number | null
          result: number | null
          season_id: string | null
          tournament: string | null
          tournament_slug: string | null
          uncertainty: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competitive_rating_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitive_rating_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitive_rating_events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "public_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitive_rating_events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      public_season_player_leaderboard: {
        Row: {
          competitive_rating: number | null
          confidence:
            | Database["public"]["Enums"]["rating_confidence_status"]
            | null
          losses: number | null
          matches_count: number | null
          player_name: string | null
          primary_role: string | null
          public_slug: string | null
          rank: number | null
          season_id: string | null
          season_slug: string | null
          win_rate: number | null
          wins: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_season_ratings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "public_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_season_ratings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      public_season_rating_history: {
        Row: {
          delta: number | null
          match_id: string | null
          processed_at: string | null
          public_slug: string | null
          rating_after: number | null
          rating_before: number | null
          result: number | null
          season_slug: string | null
          tournament: string | null
          tournament_slug: string | null
          uncertainty: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competitive_rating_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitive_rating_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      public_season_tournaments: {
        Row: {
          champion: string | null
          completed_at: string | null
          runner_up: string | null
          season_slug: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["tournament_status"] | null
          tournament: string | null
          tournament_slug: string | null
        }
        Relationships: []
      }
      public_seasons: {
        Row: {
          ends_at: string | null
          id: string | null
          name: string | null
          sequence: number | null
          slug: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["season_status"] | null
          year: number | null
        }
        Insert: {
          ends_at?: string | null
          id?: string | null
          name?: string | null
          sequence?: number | null
          slug?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["season_status"] | null
          year?: number | null
        }
        Update: {
          ends_at?: string | null
          id?: string | null
          name?: string | null
          sequence?: number | null
          slug?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["season_status"] | null
          year?: number | null
        }
        Relationships: []
      }
      public_standings: {
        Row: {
          game_difference: number | null
          games_lost: number | null
          games_won: number | null
          group_id: string | null
          losses: number | null
          played: number | null
          points: number | null
          position: number | null
          short_tag: string | null
          team_id: string | null
          team_name: string | null
          tournament_id: string | null
          wins: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "competition_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      public_team_spend_progression: {
        Row: {
          auction_sequence: number | null
          credits_after: number | null
          credits_before: number | null
          cumulative_spent: number | null
          draft_phase: string | null
          nomination_round: number | null
          player: string | null
          purchase_price: number | null
          remaining_roster_slots: number | null
          snapshot_id: string | null
          team_mmr_after: number | null
          team_name: string | null
          team_slug: string | null
          tournament_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_player_snapshots_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "draft_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      public_teams: {
        Row: {
          accent_color: string | null
          current_team_mmr: number | null
          id: string | null
          logo_url: string | null
          max_roster_size: number | null
          name: string | null
          roster_size: number | null
          short_tag: string | null
          tournament_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournament_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      public_tournament_dota_stats: {
        Row: {
          avg_duration_seconds: number | null
          imported_games: number | null
          linked_game_slots: number | null
          parsed_games: number | null
          tournament_slug: string | null
        }
        Relationships: []
      }
      public_tournament_placements: {
        Row: {
          placement: number | null
          placement_label: string | null
          public_slug: string | null
          season_slug: string | null
          team: string | null
          tournament: string | null
          tournament_slug: string | null
        }
        Relationships: []
      }
      public_tournament_summary: {
        Row: {
          auction_starts_at: string | null
          ends_at: string | null
          id: string | null
          name: string | null
          registration_closes_at: string | null
          registration_opens_at: string | null
          season: string | null
          slug: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["tournament_status"] | null
        }
        Insert: {
          auction_starts_at?: string | null
          ends_at?: string | null
          id?: string | null
          name?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          season?: string | null
          slug?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"] | null
        }
        Update: {
          auction_starts_at?: string | null
          ends_at?: string | null
          id?: string | null
          name?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          season?: string | null
          slug?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_tournament_rules: {
        Args: { p_tournament: string; p_version: string }
        Returns: undefined
      }
      add_moderation_case_note: {
        Args: { p_case: string; p_note: string }
        Returns: string
      }
      advance_groups_to_knockout: {
        Args: {
          p_interval_minutes?: number
          p_scheduled_start?: string
          p_tournament_id: string
        }
        Returns: number
      }
      assign_captain: {
        Args: { p_tournament_id: string; p_user_id: string }
        Returns: undefined
      }
      award_match_forfeit: {
        Args: {
          p_forfeit_team_id: string
          p_match_id: string
          p_reason: string
          p_request_id: string
        }
        Returns: Json
      }
      check_award_feasibility: {
        Args: {
          p_player_id: string
          p_proposed_bid: number
          p_team_id: string
          p_tournament_id: string
        }
        Returns: Json
      }
      check_in_team: {
        Args: {
          p_match_id: string
          p_override?: boolean
          p_request_id?: string
          p_team_id: string
        }
        Returns: Json
      }
      claim_external_sync_job: {
        Args: { p_worker: string }
        Returns: {
          attempts: number
          created_at: string
          created_by: string | null
          dedupe_key: string
          external_match_id: number | null
          id: string
          job_type: string
          last_error_code: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          player_game_account_id: string | null
          provider: Database["public"]["Enums"]["external_provider"]
          run_after: string
          status: Database["public"]["Enums"]["external_job_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "external_sync_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      close_support_ticket: { Args: { p_id: string }; Returns: undefined }
      complete_competition: {
        Args: { p_tournament_id: string }
        Returns: string
      }
      configure_competition: {
        Args: {
          p_default_best_of?: number
          p_format: Database["public"]["Enums"]["competition_format"]
          p_lineup_size?: number
          p_points_draw?: number
          p_points_loss?: number
          p_points_win?: number
          p_tiebreak_rules?: Json
          p_tournament_id: string
        }
        Returns: string
      }
      confirm_account_deactivation: {
        Args: { p_confirmation: string; p_reason: string }
        Returns: undefined
      }
      confirm_captain: {
        Args: { p_confirm: boolean; p_team_id: string }
        Returns: undefined
      }
      confirm_match_lineup: {
        Args: {
          p_match_id: string
          p_player_ids: string[]
          p_request_id?: string
          p_team_id: string
        }
        Returns: string
      }
      create_competition_group: {
        Args: { p_name: string; p_team_ids: string[]; p_tournament_id: string }
        Returns: string
      }
      create_moderation_case: {
        Args: {
          p_report: string
          p_severity: Database["public"]["Enums"]["case_severity"]
          p_subject: string
          p_summary: string
          p_tournament: string
          p_type: string
        }
        Returns: string
      }
      create_platform_announcement: {
        Args: {
          p_body: string
          p_confirmation?: string
          p_ends_at: string
          p_published: boolean
          p_severity: Database["public"]["Enums"]["announcement_severity"]
          p_starts_at: string
          p_target: string
          p_title: string
        }
        Returns: string
      }
      create_report: {
        Args: {
          p_description: string
          p_evidence_path?: string
          p_match: string
          p_reason: string
          p_reported: string
          p_tournament: string
          p_type: string
        }
        Returns: string
      }
      create_support_ticket: {
        Args: {
          p_category: Database["public"]["Enums"]["support_category"]
          p_message: string
          p_subject: string
        }
        Returns: string
      }
      create_team: {
        Args: {
          p_accent: string
          p_captain: string
          p_logo: string
          p_name: string
          p_tag: string
          p_tournament_id: string
        }
        Returns: string
      }
      create_tournament_announcement: {
        Args: {
          p_body: string
          p_ends_at: string
          p_published: boolean
          p_severity: Database["public"]["Enums"]["announcement_severity"]
          p_starts_at: string
          p_target: string
          p_title: string
          p_tournament: string
        }
        Returns: string
      }
      deactivate_own_account: { Args: { p_reason: string }; Returns: undefined }
      emergency_correct_player_rating: {
        Args: {
          p_player_id: string
          p_reason: string
          p_tournament_mmr: number
        }
        Returns: undefined
      }
      export_draft_csv: { Args: { p_tournament_id: string }; Returns: string }
      export_match_results_csv: {
        Args: { p_tournament_id: string }
        Returns: string
      }
      export_standings_csv: {
        Args: { p_tournament_id: string }
        Returns: string
      }
      finalize_auction: { Args: { p_auction_id: string }; Returns: Json }
      finalize_auction_phase03: {
        Args: { p_auction_id: string }
        Returns: Json
      }
      finish_external_sync_job: {
        Args: {
          p_error_code?: string
          p_id: string
          p_retry_seconds?: number
          p_success: boolean
        }
        Returns: undefined
      }
      generate_competition_schedule: {
        Args: {
          p_interval_minutes?: number
          p_scheduled_start?: string
          p_tournament_id: string
        }
        Returns: number
      }
      generate_competition_schedule_phase06: {
        Args: {
          p_interval_minutes?: number
          p_scheduled_start?: string
          p_tournament_id: string
        }
        Returns: number
      }
      get_current_auction_state: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      get_current_auction_state_phase03: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      get_draft_completion_state: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      get_match_operations: { Args: { p_match_id: string }; Returns: Json }
      get_max_legal_bid: { Args: { p_auction_id: string }; Returns: number }
      get_organizer_feasibility_analytics: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      get_own_active_sanctions: {
        Args: never
        Returns: {
          appeal_eligible: boolean
          expires_at: string
          id: string
          reason: string
          sanction_type: Database["public"]["Enums"]["sanction_type"]
          scope: Database["public"]["Enums"]["sanction_scope"]
          starts_at: string
          tournament_id: string
        }[]
      }
      get_public_auction_history: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_player?: string
          p_price_max?: number
          p_price_min?: number
          p_round?: number
          p_slug: string
          p_status?: string
          p_team?: string
          p_unsold_only?: boolean
        }
        Returns: Json
      }
      get_public_draft_package: { Args: { p_slug: string }; Returns: Json }
      get_public_draft_package_phase05: {
        Args: { p_slug: string }
        Returns: Json
      }
      get_safe_recruit_range: {
        Args: { p_team_id: string; p_tournament_id: string }
        Returns: Json
      }
      get_team_recruit_eligibility: {
        Args: {
          p_player_id: string
          p_team_id: string
          p_tournament_id: string
        }
        Returns: Json
      }
      is_draft_state_feasible: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_platform_moderator: { Args: never; Returns: boolean }
      is_support_agent: { Args: never; Returns: boolean }
      is_tournament_role: {
        Args: {
          tid: string
          wanted: Database["public"]["Enums"]["tournament_role"]
        }
        Returns: boolean
      }
      issue_sanction: {
        Args: {
          p_case: string
          p_expires?: string
          p_reason: string
          p_scope: Database["public"]["Enums"]["sanction_scope"]
          p_tournament: string
          p_type: Database["public"]["Enums"]["sanction_type"]
          p_user: string
        }
        Returns: string
      }
      link_dota_account: { Args: { p_input: string }; Returns: string }
      link_external_dota_match: {
        Args: { p_dota_match_id: number; p_match_game_id: string }
        Returns: string
      }
      lock_player_pool: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      manage_platform_admin: {
        Args: {
          p_grant: boolean
          p_role: Database["public"]["Enums"]["platform_admin_role"]
          p_user: string
        }
        Returns: undefined
      }
      mark_competition_notification_read: {
        Args: { p_notification_id: string }
        Returns: string
      }
      nominate_player: {
        Args: {
          p_expected_nomination_id: string
          p_player_id: string
          p_tournament_id: string
        }
        Returns: Json
      }
      nominate_player_phase03: {
        Args: {
          p_expected_nomination_id: string
          p_player_id: string
          p_tournament_id: string
        }
        Returns: Json
      }
      pause_auction: { Args: { p_auction_id: string }; Returns: Json }
      place_bid: {
        Args: {
          p_auction_id: string
          p_expected_revision: number
          p_increment_type: Database["public"]["Enums"]["bid_increment_type"]
          p_request_id: string
        }
        Returns: Json
      }
      place_bid_phase03: {
        Args: {
          p_auction_id: string
          p_expected_revision: number
          p_increment_type: Database["public"]["Enums"]["bid_increment_type"]
          p_request_id: string
        }
        Returns: Json
      }
      process_achievement: {
        Args: {
          p_code: string
          p_match?: string
          p_player: string
          p_tournament?: string
        }
        Returns: boolean
      }
      process_match_rating: { Args: { p_match_id: string }; Returns: boolean }
      publish_rule_version: {
        Args: {
          p_content: string
          p_requires_reacceptance?: boolean
          p_tournament: string
        }
        Returns: string
      }
      queue_external_sync: {
        Args: { p_account_id: string; p_job_type?: string }
        Returns: string
      }
      rebuild_achievements: { Args: never; Returns: number }
      rebuild_competitive_ratings: { Args: never; Returns: number }
      reconcile_external_dota_match: {
        Args: { p_link_id: string }
        Returns: Database["public"]["Enums"]["dota_reconciliation_state"]
      }
      record_provider_state: {
        Args: {
          p_event: string
          p_failures: number
          p_open_until: string
          p_provider: Database["public"]["Enums"]["external_provider"]
          p_state: string
        }
        Returns: undefined
      }
      relink_external_dota_match: {
        Args: { p_link_id: string; p_new_match_id: number; p_reason: string }
        Returns: string
      }
      reopen_support_ticket: { Args: { p_id: string }; Returns: undefined }
      reply_support_ticket: {
        Args: { p_id: string; p_internal?: boolean; p_message: string }
        Returns: string
      }
      request_organizer_verification: { Args: never; Returns: undefined }
      reschedule_match: {
        Args: { p_match_id: string; p_reason: string; p_scheduled_at: string }
        Returns: undefined
      }
      resolve_appeal: {
        Args: { p_appeal_id: string; p_approve: boolean; p_resolution: string }
        Returns: undefined
      }
      resolve_match_dispute: {
        Args: {
          p_action: string
          p_dispute_id: string
          p_reason: string
          p_request_id: string
          p_team_a_score: number
          p_team_b_score: number
        }
        Returns: Json
      }
      resolve_moderation_appeal: {
        Args: { p_approve: boolean; p_id: string; p_resolution: string }
        Returns: boolean
      }
      resolve_moderation_case: {
        Args: { p_id: string; p_resolution: string; p_revision: number }
        Returns: boolean
      }
      respond_to_match_result: {
        Args: {
          p_confirm: boolean
          p_reason: string
          p_request_id: string
          p_submission_id: string
        }
        Returns: Json
      }
      resume_auction: { Args: { p_auction_id: string }; Returns: Json }
      review_organizer: {
        Args: {
          p_confirmation?: string
          p_notes: string
          p_status: Database["public"]["Enums"]["organizer_operational_status"]
          p_user: string
        }
        Returns: undefined
      }
      review_player: {
        Args: {
          p_confidence: Database["public"]["Enums"]["rating_confidence_level"]
          p_decision: string
          p_player_id: string
          p_recent_peak_mmr: number
          p_tournament_mmr: number
          p_verified_mmr: number
        }
        Returns: undefined
      }
      revoke_sanction: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      search_public_ecosystem: {
        Args: { p_limit?: number; p_query: string }
        Returns: Json
      }
      set_match_lobby: {
        Args: {
          p_external_reference: string
          p_match_id: string
          p_name: string
          p_password: string
          p_region: string
          p_server_id: string
        }
        Returns: undefined
      }
      set_platform_announcement_published: {
        Args: { p_id: string; p_published: boolean }
        Returns: undefined
      }
      set_platform_config: {
        Args: { p_confirmation: string; p_key: string; p_value: Json }
        Returns: undefined
      }
      snapshot_completed_draft: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      start_auction: { Args: { p_tournament_id: string }; Returns: Json }
      start_auction_phase03: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      start_match: {
        Args: { p_force?: boolean; p_match_id: string }
        Returns: Json
      }
      start_unsold_round: { Args: { p_tournament_id: string }; Returns: Json }
      submit_appeal: {
        Args: {
          p_evidence_url?: string
          p_player_id: string
          p_reason: string
          p_type: string
        }
        Returns: string
      }
      submit_match_result: {
        Args: {
          p_evidence_path: string
          p_match_id: string
          p_notes: string
          p_request_id: string
          p_team_a_score: number
          p_team_b_score: number
        }
        Returns: Json
      }
      submit_moderation_appeal: {
        Args: { p_evidence_path?: string; p_reason: string; p_sanction: string }
        Returns: string
      }
      submit_rating_review: {
        Args: {
          p_assessment: Database["public"]["Enums"]["rating_assessment"]
          p_player_id: string
        }
        Returns: string
      }
      submit_registration: {
        Args: {
          p_availability: string
          p_declared_mmr: number
          p_full_name: string
          p_ign: string
          p_notes: string
          p_player_type: Database["public"]["Enums"]["player_type"]
          p_primary_role: string
          p_profile_url: string
          p_recent_peak_mmr: number
          p_region: string
          p_secondary_role: string
          p_tournament_id: string
        }
        Returns: string
      }
      suggest_mmr_tolerance: {
        Args: { p_max_percent?: number; p_tournament_id: string }
        Returns: Json
      }
      update_support_ticket: {
        Args: {
          p_assigned_to?: string
          p_id: string
          p_priority?: Database["public"]["Enums"]["case_severity"]
          p_status: Database["public"]["Enums"]["support_status"]
        }
        Returns: undefined
      }
      validate_draft_configuration: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
    }
    Enums: {
      acquisition_type:
        | "captain"
        | "auction"
        | "replacement"
        | "admin_assignment"
      announcement_severity: "info" | "notice" | "warning" | "critical"
      appeal_status:
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "withdrawn"
      auction_status:
        | "pending"
        | "open"
        | "paused"
        | "sold"
        | "unsold"
        | "cancelled"
        | "reversed"
      bid_increment_type: "next" | "plus_5" | "plus_10" | "max_legal"
      captain_confirmation_status: "pending" | "confirmed" | "declined"
      case_severity: "low" | "medium" | "high" | "critical"
      case_status:
        | "open"
        | "under_review"
        | "pending_approval"
        | "resolved"
        | "dismissed"
      competition_format: "round_robin" | "groups" | "single_elimination"
      competition_stage_type: "group" | "league" | "knockout" | "grand_final"
      dispute_status: "open" | "resolved"
      dota_parse_state:
        | "unknown"
        | "unparsed"
        | "requested"
        | "parsing"
        | "parsed"
        | "unavailable"
      dota_reconciliation_state:
        | "pending"
        | "matched"
        | "partial"
        | "participant_mismatch"
        | "result_conflict"
      evidence_type: "rank_mmr" | "profile" | "additional"
      external_job_status:
        | "queued"
        | "running"
        | "retry_scheduled"
        | "succeeded"
        | "failed"
        | "cancelled"
      external_provider: "opendota" | "steam"
      game_account_verification_status:
        | "unverified"
        | "user_linked"
        | "organizer_verified"
        | "provider_verified"
      match_status:
        | "scheduled"
        | "check_in"
        | "ready"
        | "live"
        | "awaiting_confirmation"
        | "disputed"
        | "rematch_ordered"
        | "superseded"
        | "completed"
        | "forfeit"
        | "cancelled"
        | "rescheduled"
      member_status: "invited" | "active" | "suspended" | "removed"
      moderation_appeal_status:
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "withdrawn"
      nomination_status: "upcoming" | "active" | "completed" | "skipped"
      organizer_operational_status:
        | "pending"
        | "verified"
        | "restricted"
        | "suspended"
        | "revoked"
        | "rejected"
      platform_admin_role:
        | "super_admin"
        | "platform_moderator"
        | "support_agent"
      platform_admin_status: "active" | "suspended" | "revoked"
      player_draft_state:
        | "available"
        | "in_auction"
        | "unsold"
        | "reentered"
        | "sold"
        | "withdrawn"
      player_type:
        | "active"
        | "reserve"
        | "captain_candidate"
        | "willing_substitute"
      rating_assessment:
        | "much_weaker"
        | "slightly_weaker"
        | "accurate"
        | "slightly_stronger"
        | "much_stronger"
        | "unknown"
      rating_confidence_level: "low" | "medium" | "high"
      rating_confidence_status: "provisional" | "established"
      rating_status:
        | "pending"
        | "verified"
        | "review_required"
        | "appealed"
        | "locked"
      registration_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
        | "withdrawn"
      report_status:
        | "submitted"
        | "triaged"
        | "under_review"
        | "awaiting_information"
        | "resolved"
        | "dismissed"
        | "escalated"
      result_submission_status:
        | "pending"
        | "confirmed"
        | "disputed"
        | "superseded"
      sanction_scope:
        | "platform"
        | "tournament"
        | "registration"
        | "captain_access"
        | "organizer_access"
      sanction_type:
        | "warning"
        | "temporary_suspension"
        | "indefinite_suspension"
        | "ban"
        | "registration_restriction"
        | "captain_restriction"
        | "organizer_restriction"
        | "player_removal"
        | "team_removal"
        | "match_forfeit"
      scouting_category: "priority" | "backup" | "avoid" | "watch"
      season_status: "upcoming" | "active" | "completed" | "archived"
      substitution_status:
        | "requested"
        | "under_review"
        | "approved"
        | "rejected"
        | "cancelled"
      support_category:
        | "account"
        | "tournament"
        | "payment_future"
        | "technical"
        | "bug"
        | "moderation"
        | "other"
      support_status:
        | "open"
        | "awaiting_support"
        | "awaiting_user"
        | "resolved"
        | "closed"
      tournament_role:
        | "player"
        | "captain"
        | "organizer"
        | "moderator"
        | "referee"
      tournament_status:
        | "draft"
        | "registration"
        | "verification"
        | "rating_review"
        | "player_pool_locked"
        | "auction_ready"
        | "auction_live"
        | "auction_paused"
        | "rosters_locked"
        | "competition"
        | "completed"
        | "cancelled"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      acquisition_type: [
        "captain",
        "auction",
        "replacement",
        "admin_assignment",
      ],
      announcement_severity: ["info", "notice", "warning", "critical"],
      appeal_status: [
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "withdrawn",
      ],
      auction_status: [
        "pending",
        "open",
        "paused",
        "sold",
        "unsold",
        "cancelled",
        "reversed",
      ],
      bid_increment_type: ["next", "plus_5", "plus_10", "max_legal"],
      captain_confirmation_status: ["pending", "confirmed", "declined"],
      case_severity: ["low", "medium", "high", "critical"],
      case_status: [
        "open",
        "under_review",
        "pending_approval",
        "resolved",
        "dismissed",
      ],
      competition_format: ["round_robin", "groups", "single_elimination"],
      competition_stage_type: ["group", "league", "knockout", "grand_final"],
      dispute_status: ["open", "resolved"],
      dota_parse_state: [
        "unknown",
        "unparsed",
        "requested",
        "parsing",
        "parsed",
        "unavailable",
      ],
      dota_reconciliation_state: [
        "pending",
        "matched",
        "partial",
        "participant_mismatch",
        "result_conflict",
      ],
      evidence_type: ["rank_mmr", "profile", "additional"],
      external_job_status: [
        "queued",
        "running",
        "retry_scheduled",
        "succeeded",
        "failed",
        "cancelled",
      ],
      external_provider: ["opendota", "steam"],
      game_account_verification_status: [
        "unverified",
        "user_linked",
        "organizer_verified",
        "provider_verified",
      ],
      match_status: [
        "scheduled",
        "check_in",
        "ready",
        "live",
        "awaiting_confirmation",
        "disputed",
        "rematch_ordered",
        "superseded",
        "completed",
        "forfeit",
        "cancelled",
        "rescheduled",
      ],
      member_status: ["invited", "active", "suspended", "removed"],
      moderation_appeal_status: [
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "withdrawn",
      ],
      nomination_status: ["upcoming", "active", "completed", "skipped"],
      organizer_operational_status: [
        "pending",
        "verified",
        "restricted",
        "suspended",
        "revoked",
        "rejected",
      ],
      platform_admin_role: [
        "super_admin",
        "platform_moderator",
        "support_agent",
      ],
      platform_admin_status: ["active", "suspended", "revoked"],
      player_draft_state: [
        "available",
        "in_auction",
        "unsold",
        "reentered",
        "sold",
        "withdrawn",
      ],
      player_type: [
        "active",
        "reserve",
        "captain_candidate",
        "willing_substitute",
      ],
      rating_assessment: [
        "much_weaker",
        "slightly_weaker",
        "accurate",
        "slightly_stronger",
        "much_stronger",
        "unknown",
      ],
      rating_confidence_level: ["low", "medium", "high"],
      rating_confidence_status: ["provisional", "established"],
      rating_status: [
        "pending",
        "verified",
        "review_required",
        "appealed",
        "locked",
      ],
      registration_status: [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "withdrawn",
      ],
      report_status: [
        "submitted",
        "triaged",
        "under_review",
        "awaiting_information",
        "resolved",
        "dismissed",
        "escalated",
      ],
      result_submission_status: [
        "pending",
        "confirmed",
        "disputed",
        "superseded",
      ],
      sanction_scope: [
        "platform",
        "tournament",
        "registration",
        "captain_access",
        "organizer_access",
      ],
      sanction_type: [
        "warning",
        "temporary_suspension",
        "indefinite_suspension",
        "ban",
        "registration_restriction",
        "captain_restriction",
        "organizer_restriction",
        "player_removal",
        "team_removal",
        "match_forfeit",
      ],
      scouting_category: ["priority", "backup", "avoid", "watch"],
      season_status: ["upcoming", "active", "completed", "archived"],
      substitution_status: [
        "requested",
        "under_review",
        "approved",
        "rejected",
        "cancelled",
      ],
      support_category: [
        "account",
        "tournament",
        "payment_future",
        "technical",
        "bug",
        "moderation",
        "other",
      ],
      support_status: [
        "open",
        "awaiting_support",
        "awaiting_user",
        "resolved",
        "closed",
      ],
      tournament_role: [
        "player",
        "captain",
        "organizer",
        "moderator",
        "referee",
      ],
      tournament_status: [
        "draft",
        "registration",
        "verification",
        "rating_review",
        "player_pool_locked",
        "auction_ready",
        "auction_live",
        "auction_paused",
        "rosters_locked",
        "competition",
        "completed",
        "cancelled",
      ],
    },
  },
} as const

