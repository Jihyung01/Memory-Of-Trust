/**
 * Database 타입 정의
 * 
 * Supabase에서 생성한 타입을 여기에 정의합니다.
 * 실제 사용 시에는 Supabase CLI로 자동 생성된 타입을 사용하는 것이 좋습니다:
 * npx supabase gen types typescript --project-id <your-project-id> > types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type RiskLevel = 'low' | 'medium' | 'high'
export type MessageRole = 'user' | 'assistant' | 'system' | 'care_manager'
export type EmotionType = 'neutral' | 'sad' | 'angry' | 'anxious' | 'happy'
export type SessionChannel = 'web' | 'text' | 'phone' | 'phone_mock' | 'real_ars' | 'kiosk'
export type SessionType = 'care' | 'biography' | 'checkin'

export interface Database {
  public: {
    Tables: {
      elders: {
        Row: {
          id: string
          name: string
          birth_year: number | null
          gender: string | null
          contact_phone: string | null
          guardian_contact: string | null
          risk_level: RiskLevel
          last_session_at: string | null
          last_session_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          birth_year?: number | null
          gender?: string | null
          contact_phone?: string | null
          guardian_contact?: string | null
          risk_level?: RiskLevel
          last_session_at?: string | null
          last_session_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          birth_year?: number | null
          gender?: string | null
          contact_phone?: string | null
          guardian_contact?: string | null
          risk_level?: RiskLevel
          last_session_at?: string | null
          last_session_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      interview_sessions: {
        Row: {
          id: string
          elder_id: string
          started_at: string
          ended_at: string | null
          summary: string | null
          risk_level_before: RiskLevel
          risk_level_after: RiskLevel | null
          channel: string
          session_type: SessionType
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          elder_id: string
          started_at?: string
          ended_at?: string | null
          summary?: string | null
          risk_level_before?: RiskLevel
          risk_level_after?: RiskLevel | null
          channel?: string
          session_type?: SessionType
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          elder_id?: string
          started_at?: string
          ended_at?: string | null
          summary?: string | null
          risk_level_before?: RiskLevel
          risk_level_after?: RiskLevel | null
          channel?: string
          session_type?: SessionType
          created_by?: string
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          session_id: string
          role: MessageRole
          content: string
          emotion: EmotionType | null
          risk_score: number | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          role: MessageRole
          content: string
          emotion?: EmotionType | null
          risk_score?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          role?: MessageRole
          content?: string
          emotion?: EmotionType | null
          risk_score?: number | null
          created_at?: string
        }
      }
      biographies: {
        Row: {
          id: string
          elder_id: string
          session_id: string | null
          title: string
          outline: string | null
          content: string
          version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          elder_id: string
          session_id?: string | null
          title: string
          outline?: string | null
          content: string
          version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          elder_id?: string
          session_id?: string | null
          title?: string
          outline?: string | null
          content?: string
          version?: number
          created_at?: string
          updated_at?: string
        }
      }
      alerts: {
        Row: {
          id: string
          elder_id: string
          session_id: string | null
          level: 'medium' | 'high'
          reason: string
          created_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          elder_id: string
          session_id?: string | null
          level: 'medium' | 'high'
          reason: string
          created_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          elder_id?: string
          session_id?: string | null
          level?: 'medium' | 'high'
          reason?: string
          created_at?: string
          resolved_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
      Enums: {
      risk_level: RiskLevel
      message_role: MessageRole
      emotion_type: EmotionType
      session_channel: SessionChannel
    }
  }
}
