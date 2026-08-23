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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      app_ratings: {
        Row: {
          created_at: string
          has_rated: boolean
          id: string
          last_prompted_at: string | null
          rating: number | null
          reels_viewed_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          has_rated?: boolean
          id?: string
          last_prompted_at?: string | null
          rating?: number | null
          reels_viewed_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          has_rated?: boolean
          id?: string
          last_prompted_at?: string | null
          rating?: number | null
          reels_viewed_count?: number
          user_id?: string
        }
        Relationships: []
      }
      battle_votes: {
        Row: {
          battle_id: string
          created_at: string
          id: string
          voted_for_user_id: string
          voted_side: string
          voter_id: string
        }
        Insert: {
          battle_id: string
          created_at?: string
          id?: string
          voted_for_user_id: string
          voted_side: string
          voter_id: string
        }
        Update: {
          battle_id?: string
          created_at?: string
          id?: string
          voted_for_user_id?: string
          voted_side?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_votes_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
      }
      battles: {
        Row: {
          bonus_coins: number
          challenger_caption: string | null
          challenger_id: string
          challenger_reel_id: string | null
          challenger_thumbnail_url: string | null
          challenger_video_url: string | null
          challenger_votes: number
          created_at: string
          ends_at: string
          id: string
          opponent_caption: string | null
          opponent_id: string | null
          opponent_reel_id: string | null
          opponent_thumbnail_url: string | null
          opponent_video_url: string | null
          opponent_votes: number
          prompt: string | null
          results_recorded_at: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
          winner_id: string | null
          winner_side: string | null
        }
        Insert: {
          bonus_coins?: number
          challenger_caption?: string | null
          challenger_id: string
          challenger_reel_id?: string | null
          challenger_thumbnail_url?: string | null
          challenger_video_url?: string | null
          challenger_votes?: number
          created_at?: string
          ends_at?: string
          id?: string
          opponent_caption?: string | null
          opponent_id?: string | null
          opponent_reel_id?: string | null
          opponent_thumbnail_url?: string | null
          opponent_video_url?: string | null
          opponent_votes?: number
          prompt?: string | null
          results_recorded_at?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
          winner_id?: string | null
          winner_side?: string | null
        }
        Update: {
          bonus_coins?: number
          challenger_caption?: string | null
          challenger_id?: string
          challenger_reel_id?: string | null
          challenger_thumbnail_url?: string | null
          challenger_video_url?: string | null
          challenger_votes?: number
          created_at?: string
          ends_at?: string
          id?: string
          opponent_caption?: string | null
          opponent_id?: string | null
          opponent_reel_id?: string | null
          opponent_thumbnail_url?: string | null
          opponent_video_url?: string | null
          opponent_votes?: number
          prompt?: string | null
          results_recorded_at?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
          winner_id?: string | null
          winner_side?: string | null
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          likes_count: number
          reel_id: string
          reply_to_id: string | null
          reply_to_username: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          likes_count?: number
          reel_id: string
          reply_to_id?: string | null
          reply_to_username?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          likes_count?: number
          reel_id?: string
          reply_to_id?: string | null
          reply_to_username?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          last_message_at: string | null
          participant_one: string
          participant_two: string
          requested_by: string | null
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_one: string
          participant_two: string
          requested_by?: string | null
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_one?: string
          participant_two?: string
          requested_by?: string | null
          status?: string
        }
        Relationships: []
      }
      country_vat_rates: {
        Row: {
          country_code: string
          country_name: string
          created_at: string
          currency: string
          id: string
          updated_at: string
          vat_rate: number
        }
        Insert: {
          country_code: string
          country_name: string
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          country_code?: string
          country_name?: string
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          vat_rate?: number
        }
        Relationships: []
      }
      creator_earnings: {
        Row: {
          country_code: string
          created_at: string
          currency: string
          earning_type: string
          gross_earnings: number
          id: string
          is_paid: boolean
          net_earnings: number
          paid_at: string | null
          period_end: string
          period_start: string
          reel_id: string | null
          updated_at: string
          user_id: string
          vat_amount: number
          watch_hours: number
        }
        Insert: {
          country_code?: string
          created_at?: string
          currency?: string
          earning_type?: string
          gross_earnings?: number
          id?: string
          is_paid?: boolean
          net_earnings?: number
          paid_at?: string | null
          period_end?: string
          period_start?: string
          reel_id?: string | null
          updated_at?: string
          user_id: string
          vat_amount?: number
          watch_hours?: number
        }
        Update: {
          country_code?: string
          created_at?: string
          currency?: string
          earning_type?: string
          gross_earnings?: number
          id?: string
          is_paid?: boolean
          net_earnings?: number
          paid_at?: string | null
          period_end?: string
          period_start?: string
          reel_id?: string | null
          updated_at?: string
          user_id?: string
          vat_amount?: number
          watch_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "creator_earnings_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_financials: {
        Row: {
          is_monetized: boolean
          lifetime_earnings: number
          monetization_date: string | null
          total_watch_hours: number
          updated_at: string
          user_id: string
        }
        Insert: {
          is_monetized?: boolean
          lifetime_earnings?: number
          monetization_date?: string | null
          total_watch_hours?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          is_monetized?: boolean
          lifetime_earnings?: number
          monetization_date?: string | null
          total_watch_hours?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_onboarding: {
        Row: {
          completed_at: string | null
          completed_steps: string[]
          created_at: string
          current_step: number
          id: string
          is_completed: boolean
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_steps?: string[]
          created_at?: string
          current_step?: number
          id?: string
          is_completed?: boolean
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_steps?: string[]
          created_at?: string
          current_step?: number
          id?: string
          is_completed?: boolean
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_payouts: {
        Row: {
          amount: number
          country_code: string
          created_at: string
          currency: string
          id: string
          payout_method: string | null
          payout_reference: string | null
          processed_at: string | null
          requested_at: string
          status: string
          user_id: string
          vat_deducted: number
        }
        Insert: {
          amount: number
          country_code: string
          created_at?: string
          currency?: string
          id?: string
          payout_method?: string | null
          payout_reference?: string | null
          processed_at?: string | null
          requested_at?: string
          status?: string
          user_id: string
          vat_deducted?: number
        }
        Update: {
          amount?: number
          country_code?: string
          created_at?: string
          currency?: string
          id?: string
          payout_method?: string | null
          payout_reference?: string | null
          processed_at?: string | null
          requested_at?: string
          status?: string
          user_id?: string
          vat_deducted?: number
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      gift_catalog: {
        Row: {
          active: boolean
          animation: string
          cost: number
          created_at: string
          emoji: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          animation?: string
          cost: number
          created_at?: string
          emoji: string
          id: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          animation?: string
          cost?: number
          created_at?: string
          emoji?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          id: string
          reel_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reel_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      live_gifts: {
        Row: {
          coin_cost: number
          created_at: string
          gift_name: string
          gift_type: string
          id: string
          receiver_id: string
          sender_id: string
          session_id: string
        }
        Insert: {
          coin_cost: number
          created_at?: string
          gift_name: string
          gift_type: string
          id?: string
          receiver_id: string
          sender_id: string
          session_id: string
        }
        Update: {
          coin_cost?: number
          created_at?: string
          gift_name?: string
          gift_type?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          session_id?: string
        }
        Relationships: []
      }
      live_comments: {
        Row: {
          created_at: string
          id: string
          live_id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          live_id: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          live_id?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      live_pinned_messages: {
        Row: {
          content: string
          id: string
          pinned_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          id?: string
          pinned_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          id?: string
          pinned_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      live_streams: {
        Row: {
          created_at: string | null
          description: string | null
          ended_at: string | null
          id: string
          is_active: boolean | null
          last_heartbeat_at: string | null
          likes_count: number | null
          session_id: string
          started_at: string | null
          status: string | null
          thumbnail_url: string | null
          title: string
          user_id: string
          viewer_count: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          last_heartbeat_at?: string | null
          likes_count?: number | null
          session_id: string
          started_at?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title: string
          user_id: string
          viewer_count?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          last_heartbeat_at?: string | null
          likes_count?: number | null
          session_id?: string
          started_at?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string
          user_id?: string
          viewer_count?: number | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          media_type: string | null
          media_url: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          media_type?: string | null
          media_url?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          media_type?: string | null
          media_url?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          comments: boolean
          created_at: string
          announcements: boolean
          battles: boolean
          earnings: boolean
          follows: boolean
          gifts: boolean
          id: string
          likes: boolean
          live_alerts: boolean
          live_invitations: boolean
          message_requests: boolean
          mentions: boolean
          messages: boolean
          moderation: boolean
          new_reels: boolean
          push_enabled: boolean
          replies: boolean
          reposts: boolean
          sound_enabled: boolean
          updated_at: string
          uploads: boolean
          user_id: string
          verification: boolean
          vibration_enabled: boolean
        }
        Insert: {
          announcements?: boolean
          battles?: boolean
          comments?: boolean
          created_at?: string
          earnings?: boolean
          follows?: boolean
          gifts?: boolean
          id?: string
          likes?: boolean
          live_alerts?: boolean
          live_invitations?: boolean
          message_requests?: boolean
          mentions?: boolean
          messages?: boolean
          moderation?: boolean
          new_reels?: boolean
          push_enabled?: boolean
          replies?: boolean
          reposts?: boolean
          sound_enabled?: boolean
          updated_at?: string
          uploads?: boolean
          user_id: string
          verification?: boolean
          vibration_enabled?: boolean
        }
        Update: {
          announcements?: boolean
          battles?: boolean
          comments?: boolean
          created_at?: string
          earnings?: boolean
          follows?: boolean
          gifts?: boolean
          id?: string
          likes?: boolean
          live_alerts?: boolean
          live_invitations?: boolean
          message_requests?: boolean
          mentions?: boolean
          messages?: boolean
          moderation?: boolean
          new_reels?: boolean
          push_enabled?: boolean
          replies?: boolean
          reposts?: boolean
          sound_enabled?: boolean
          updated_at?: string
          uploads?: boolean
          user_id?: string
          verification?: boolean
          vibration_enabled?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          actor_avatar_url: string | null
          battle_id: string | null
          body: string | null
          comment_id: string | null
          conversation_id: string | null
          deep_link: string | null
          delivery_attempts: number
          event_key: string | null
          from_user_id: string
          id: string
          is_read: boolean
          live_session_id: string | null
          message: string | null
          provider_response: Json | null
          push_error: string | null
          push_sent_at: string | null
          push_status: string | null
          read_at: string | null
          reel_id: string | null
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_avatar_url?: string | null
          battle_id?: string | null
          body?: string | null
          comment_id?: string | null
          conversation_id?: string | null
          created_at?: string
          deep_link?: string | null
          delivery_attempts?: number
          event_key?: string | null
          from_user_id: string
          id?: string
          is_read?: boolean
          live_session_id?: string | null
          message?: string | null
          provider_response?: Json | null
          push_error?: string | null
          push_sent_at?: string | null
          push_status?: string | null
          read_at?: string | null
          reel_id?: string | null
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_avatar_url?: string | null
          battle_id?: string | null
          body?: string | null
          comment_id?: string | null
          conversation_id?: string | null
          created_at?: string
          deep_link?: string | null
          delivery_attempts?: number
          event_key?: string | null
          from_user_id?: string
          id?: string
          is_read?: boolean
          live_session_id?: string | null
          message?: string | null
          provider_response?: Json | null
          push_error?: string | null
          push_sent_at?: string | null
          push_status?: string | null
          read_at?: string | null
          reel_id?: string | null
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_views: {
        Row: {
          created_at: string
          id: string
          profile_user_id: string
          viewed_at: string
          viewer_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_user_id: string
          viewed_at?: string
          viewer_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_user_id?: string
          viewed_at?: string
          viewer_user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country_code: string | null
          created_at: string | null
          display_name: string
          followers_count: number | null
          following_count: number | null
          id: string
          onesignal_player_id: string | null
          reels_count: number | null
          updated_at: string | null
          user_id: string | null
          username: string
          verified: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string | null
          display_name?: string
          followers_count?: number | null
          following_count?: number | null
          id?: string
          onesignal_player_id?: string | null
          reels_count?: number | null
          updated_at?: string | null
          user_id?: string | null
          username: string
          verified?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string | null
          display_name?: string
          followers_count?: number | null
          following_count?: number | null
          id?: string
          onesignal_player_id?: string | null
          reels_count?: number | null
          updated_at?: string | null
          user_id?: string | null
          username?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      reels: {
        Row: {
          category: string | null
          comments_count: number | null
          created_at: string | null
          description: string | null
          difficulty_level: string | null
          file_size_bytes: number | null
          id: string
          is_portrait: boolean | null
          is_tutorial: boolean | null
          likes_count: number | null
          mime_type: string | null
          processing_completed_at: string | null
          processing_error: string | null
          processing_started_at: string | null
          processing_status: string
          reposts_count: number | null
          shares_count: number | null
          source_storage_path: string | null
          thumbnail_url: string | null
          title: string
          upload_status: string
          user_id: string
          video_url: string
          views_count: number | null
        }
        Insert: {
          category?: string | null
          comments_count?: number | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          file_size_bytes?: number | null
          id?: string
          is_portrait?: boolean | null
          is_tutorial?: boolean | null
          likes_count?: number | null
          mime_type?: string | null
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_started_at?: string | null
          processing_status?: string
          reposts_count?: number | null
          shares_count?: number | null
          source_storage_path?: string | null
          thumbnail_url?: string | null
          title: string
          upload_status?: string
          user_id: string
          video_url: string
          views_count?: number | null
        }
        Update: {
          category?: string | null
          comments_count?: number | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          file_size_bytes?: number | null
          id?: string
          is_portrait?: boolean | null
          is_tutorial?: boolean | null
          likes_count?: number | null
          mime_type?: string | null
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_started_at?: string | null
          processing_status?: string
          reposts_count?: number | null
          shares_count?: number | null
          source_storage_path?: string | null
          thumbnail_url?: string | null
          title?: string
          upload_status?: string
          user_id?: string
          video_url?: string
          views_count?: number | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string | null
          id: string
          reason: string
          reported_reel_id: string | null
          reported_user_id: string | null
          reporter_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reason: string
          reported_reel_id?: string | null
          reported_user_id?: string | null
          reporter_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reason?: string
          reported_reel_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_reel_id_fkey"
            columns: ["reported_reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reposts: {
        Row: {
          created_at: string
          id: string
          reel_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reel_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reposts_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_reels: {
        Row: {
          created_at: string
          id: string
          reel_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reel_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_reels_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          achieved_at: string
          badge_type: string
          created_at: string
          id: string
          milestone: number
          user_id: string
        }
        Insert: {
          achieved_at?: string
          badge_type: string
          created_at?: string
          id?: string
          milestone: number
          user_id: string
        }
        Update: {
          achieved_at?: string
          badge_type?: string
          created_at?: string
          id?: string
          milestone?: number
          user_id?: string
        }
        Relationships: []
      }
      user_coins: {
        Row: {
          balance: number
          created_at: string
          id: string
          total_earned: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_locations: {
        Row: {
          latitude: number
          longitude: number
          updated_at: string
          user_id: string
        }
        Insert: {
          latitude: number
          longitude: number
          updated_at?: string
          user_id: string
        }
        Update: {
          latitude?: number
          longitude?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      watch_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          is_complete: boolean
          reel_id: string
          started_at: string
          total_video_duration_seconds: number | null
          user_id: string | null
          viewer_id: string | null
          watch_duration_seconds: number
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          is_complete?: boolean
          reel_id: string
          started_at?: string
          total_video_duration_seconds?: number | null
          user_id?: string | null
          viewer_id?: string | null
          watch_duration_seconds?: number
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          is_complete?: boolean
          reel_id?: string
          started_at?: string
          total_video_duration_seconds?: number | null
          user_id?: string | null
          viewer_id?: string | null
          watch_duration_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "watch_sessions_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_badge_if_earned: {
        Args: { _badge_type: string; _milestone: number }
        Returns: boolean
      }
      ensure_user_coins: { Args: never; Returns: undefined }
      finalize_battle: {
        Args: { _battle_id: string }
        Returns: {
          bonus_coins: number
          challenger_caption: string | null
          challenger_id: string
          challenger_reel_id: string | null
          challenger_thumbnail_url: string | null
          challenger_video_url: string | null
          challenger_votes: number
          created_at: string
          ends_at: string
          id: string
          opponent_caption: string | null
          opponent_id: string | null
          opponent_reel_id: string | null
          opponent_thumbnail_url: string | null
          opponent_video_url: string | null
          opponent_votes: number
          prompt: string | null
          results_recorded_at: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
          winner_id: string | null
          winner_side: string | null
        }
        SetofOptions: {
          from: "*"
          to: "battles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      find_nearby_users: {
        Args: {
          _lat: number
          _limit?: number
          _lng: number
          _radius_km?: number
        }
        Returns: {
          distance_km: number
          user_id: string
        }[]
      }
      get_creator_watch_hours: { Args: { creator_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_view_count: { Args: { reel_id: string }; Returns: undefined }
      send_live_gift: {
        Args: { _gift_id: string; _session_id: string }
        Returns: {
          gift_animation: string
          gift_cost: number
          gift_emoji: string
          gift_name: string
          new_balance: number
        }[]
      }
      spend_coins: { Args: { _amount: number }; Returns: number }
      submit_battle_response: {
        Args: {
          _battle_id: string
          _caption?: string
          _thumbnail_url?: string
          _video_url: string
        }
        Returns: {
          bonus_coins: number
          challenger_caption: string | null
          challenger_id: string
          challenger_reel_id: string | null
          challenger_thumbnail_url: string | null
          challenger_video_url: string | null
          challenger_votes: number
          created_at: string
          ends_at: string
          id: string
          opponent_caption: string | null
          opponent_id: string | null
          opponent_reel_id: string | null
          opponent_thumbnail_url: string | null
          opponent_video_url: string | null
          opponent_votes: number
          prompt: string | null
          results_recorded_at: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
          winner_id: string | null
          winner_side: string | null
        }
        SetofOptions: {
          from: "*"
          to: "battles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_battle_vote: {
        Args: { _battle_id: string; _voted_side: string }
        Returns: {
          bonus_coins: number
          challenger_caption: string | null
          challenger_id: string
          challenger_reel_id: string | null
          challenger_thumbnail_url: string | null
          challenger_video_url: string | null
          challenger_votes: number
          created_at: string
          ends_at: string
          id: string
          opponent_caption: string | null
          opponent_id: string | null
          opponent_reel_id: string | null
          opponent_thumbnail_url: string | null
          opponent_video_url: string | null
          opponent_votes: number
          prompt: string | null
          results_recorded_at: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
          winner_id: string | null
          winner_side: string | null
        }
        SetofOptions: {
          from: "*"
          to: "battles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
