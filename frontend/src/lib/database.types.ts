
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_types": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"is_custom": boolean,"name": string,"requires_photo": boolean,"sort_order": number,"team_id": string
                  }
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"is_custom"?: boolean,"name": string,"requires_photo"?: boolean,"sort_order"?: number,"team_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"is_custom"?: boolean,"name"?: string,"requires_photo"?: boolean,"sort_order"?: number,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_types_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"calendar_events": {
                  Row: {
                    "activity_type_id": string | null,"created_at": string,"created_by": string | null,"description": string | null,"event_date": string,"id": string,"intensity_id": string | null,"kind": Database["public"]['Enums']["calendar_event_kind"],"start_time": string | null,"team_id": string,"title": string
                  }
                  Insert: {
                    "activity_type_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"event_date": string,"id"?: string,"intensity_id"?: string | null,"kind": Database["public"]['Enums']["calendar_event_kind"],"start_time"?: string | null,"team_id": string,"title": string
                  }
                  Update: {
                    "activity_type_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"event_date"?: string,"id"?: string,"intensity_id"?: string | null,"kind"?: Database["public"]['Enums']["calendar_event_kind"],"start_time"?: string | null,"team_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "calendar_events_activity_type_id_team_id_fkey"
      columns: ["activity_type_id","team_id"]
isOneToOne: false
      referencedRelation: "activity_types"
      referencedColumns: ["id","team_id"]
    },{
      foreignKeyName: "calendar_events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "calendar_events_intensity_id_team_id_fkey"
      columns: ["intensity_id","team_id"]
isOneToOne: false
      referencedRelation: "intensities"
      referencedColumns: ["id","team_id"]
    },{
      foreignKeyName: "calendar_events_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"edited_at": string | null,"id": string,"session_id": string,"team_id": string
                  }
                  Insert: {
                    "author_id"?: string,"body": string,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"session_id": string,"team_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"session_id"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_session_id_team_id_fkey"
      columns: ["session_id","team_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id","team_id"]
    }
                  ]
                },"credit_rules": {
                  Row: {
                    "activity_type_id": string,"credits": number,"id": string,"intensity_id": string | null,"kind": Database["public"]['Enums']["credit_rule_kind"],"per_meters": number | null,"per_minutes": number | null,"team_id": string,"updated_at": string
                  }
                  Insert: {
                    "activity_type_id": string,"credits": number,"id"?: string,"intensity_id"?: string | null,"kind": Database["public"]['Enums']["credit_rule_kind"],"per_meters"?: number | null,"per_minutes"?: number | null,"team_id": string,"updated_at"?: string
                  }
                  Update: {
                    "activity_type_id"?: string,"credits"?: number,"id"?: string,"intensity_id"?: string | null,"kind"?: Database["public"]['Enums']["credit_rule_kind"],"per_meters"?: number | null,"per_minutes"?: number | null,"team_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "credit_rules_activity_type_id_team_id_fkey"
      columns: ["activity_type_id","team_id"]
isOneToOne: false
      referencedRelation: "activity_types"
      referencedColumns: ["id","team_id"]
    },{
      foreignKeyName: "credit_rules_intensity_id_team_id_fkey"
      columns: ["intensity_id","team_id"]
isOneToOne: false
      referencedRelation: "intensities"
      referencedColumns: ["id","team_id"]
    },{
      foreignKeyName: "credit_rules_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"intensities": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"name": string,"sort_order": number,"team_id": string
                  }
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name": string,"sort_order"?: number,"team_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"sort_order"?: number,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "intensities_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"invites": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"id": string,"revoked_at": string | null,"role": Database["public"]['Enums']["member_role"],"team_id": string,"token": string
                  }
                  Insert: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"revoked_at"?: string | null,"role": Database["public"]['Enums']["member_role"],"team_id": string,"token"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"team_id"?: string,"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "grace_until": string | null,"is_admin": boolean,"joined_at": string,"role": Database["public"]['Enums']["member_role"],"team_id": string,"user_id": string,"is_locked_out": boolean | null
                  }
                  Insert: {
                    "grace_until"?: string | null,"is_admin"?: boolean,"joined_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"team_id": string,"user_id": string
                  }
                  Update: {
                    "grace_until"?: string | null,"is_admin"?: boolean,"joined_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"team_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_settings": {
                  Row: {
                    "enabled": boolean,"kind": Database["public"]['Enums']["notification_kind"],"user_id": string
                  }
                  Insert: {
                    "enabled": boolean,"kind": Database["public"]['Enums']["notification_kind"],"user_id"?: string
                  }
                  Update: {
                    "enabled"?: boolean,"kind"?: Database["public"]['Enums']["notification_kind"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_settings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"id": string,"name": string
                  }
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"id": string,"name"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_tokens": {
                  Row: {
                    "created_at": string,"last_seen_at": string,"platform": Database["public"]['Enums']["push_platform"],"token": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"last_seen_at"?: string,"platform": Database["public"]['Enums']["push_platform"],"token": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"last_seen_at"?: string,"platform"?: Database["public"]['Enums']["push_platform"],"token"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reactions": {
                  Row: {
                    "created_at": string,"emoji": string,"session_id": string,"team_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"emoji": string,"session_id": string,"team_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"emoji"?: string,"session_id"?: string,"team_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reactions_session_id_team_id_fkey"
      columns: ["session_id","team_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id","team_id"]
    },{
      foreignKeyName: "reactions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"seasons": {
                  Row: {
                    "created_at": string,"end_date": string,"id": string,"name": string,"start_date": string,"team_id": string
                  }
                  Insert: {
                    "created_at"?: string,"end_date": string,"id"?: string,"name": string,"start_date": string,"team_id": string
                  }
                  Update: {
                    "created_at"?: string,"end_date"?: string,"id"?: string,"name"?: string,"start_date"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "seasons_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"session_photos": {
                  Row: {
                    "created_at": string,"id": string,"image_hash": string | null,"session_id": string,"source": Database["public"]['Enums']["photo_source"],"storage_path": string,"taken_at": string | null,"team_id": string,"uploaded_by": string | null
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"image_hash"?: string | null,"session_id": string,"source": Database["public"]['Enums']["photo_source"],"storage_path": string,"taken_at"?: string | null,"team_id": string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"image_hash"?: string | null,"session_id"?: string,"source"?: Database["public"]['Enums']["photo_source"],"storage_path"?: string,"taken_at"?: string | null,"team_id"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_photos_session_id_team_id_fkey"
      columns: ["session_id","team_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id","team_id"]
    },{
      foreignKeyName: "session_photos_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"sessions": {
                  Row: {
                    "activity_type_id": string,"athlete_id": string,"athlete_responded_at": string | null,"athlete_response": Database["public"]['Enums']["athlete_response"] | null,"athlete_response_note": string | null,"calendar_event_id": string | null,"created_at": string,"credits": number,"custom_label": string | null,"distance_meters": number | null,"duration_seconds": number,"group_log_id": string | null,"id": string,"intensity_id": string | null,"logged_by": string | null,"notes": string | null,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"rule_used": Json | null,"session_date": string,"team_id": string,"updated_at": string,"verification_note": string | null,"verification_status": Database["public"]['Enums']["verification_status"]
                  }
                  Insert: {
                    "activity_type_id": string,"athlete_id": string,"athlete_responded_at"?: string | null,"athlete_response"?: Database["public"]['Enums']["athlete_response"] | null,"athlete_response_note"?: string | null,"calendar_event_id"?: string | null,"created_at"?: string,"credits"?: number,"custom_label"?: string | null,"distance_meters"?: number | null,"duration_seconds": number,"group_log_id"?: string | null,"id"?: string,"intensity_id"?: string | null,"logged_by"?: string | null,"notes"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"rule_used"?: Json | null,"session_date": string,"team_id": string,"updated_at"?: string,"verification_note"?: string | null,"verification_status"?: Database["public"]['Enums']["verification_status"]
                  }
                  Update: {
                    "activity_type_id"?: string,"athlete_id"?: string,"athlete_responded_at"?: string | null,"athlete_response"?: Database["public"]['Enums']["athlete_response"] | null,"athlete_response_note"?: string | null,"calendar_event_id"?: string | null,"created_at"?: string,"credits"?: number,"custom_label"?: string | null,"distance_meters"?: number | null,"duration_seconds"?: number,"group_log_id"?: string | null,"id"?: string,"intensity_id"?: string | null,"logged_by"?: string | null,"notes"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"rule_used"?: Json | null,"session_date"?: string,"team_id"?: string,"updated_at"?: string,"verification_note"?: string | null,"verification_status"?: Database["public"]['Enums']["verification_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "sessions_activity_type_id_team_id_fkey"
      columns: ["activity_type_id","team_id"]
isOneToOne: false
      referencedRelation: "activity_types"
      referencedColumns: ["id","team_id"]
    },{
      foreignKeyName: "sessions_athlete_id_fkey"
      columns: ["athlete_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_calendar_event_id_team_id_fkey"
      columns: ["calendar_event_id","team_id"]
isOneToOne: false
      referencedRelation: "calendar_events"
      referencedColumns: ["id","team_id"]
    },{
      foreignKeyName: "sessions_intensity_id_team_id_fkey"
      columns: ["intensity_id","team_id"]
isOneToOne: false
      referencedRelation: "intensities"
      referencedColumns: ["id","team_id"]
    },{
      foreignKeyName: "sessions_logged_by_fkey"
      columns: ["logged_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"target_overrides": {
                  Row: {
                    "activity_type_id": string | null,"id": string,"label": string | null,"max_credits": number | null,"min_credits": number,"period_start": string,"season_id": string,"team_id": string
                  }
                  Insert: {
                    "activity_type_id"?: string | null,"id"?: string,"label"?: string | null,"max_credits"?: number | null,"min_credits"?: number,"period_start": string,"season_id": string,"team_id": string
                  }
                  Update: {
                    "activity_type_id"?: string | null,"id"?: string,"label"?: string | null,"max_credits"?: number | null,"min_credits"?: number,"period_start"?: string,"season_id"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "target_overrides_activity_type_id_team_id_fkey"
      columns: ["activity_type_id","team_id"]
isOneToOne: false
      referencedRelation: "activity_types"
      referencedColumns: ["id","team_id"]
    },{
      foreignKeyName: "target_overrides_season_id_team_id_fkey"
      columns: ["season_id","team_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id","team_id"]
    }
                  ]
                },"targets": {
                  Row: {
                    "activity_type_id": string | null,"id": string,"max_credits": number | null,"min_credits": number,"season_id": string,"team_id": string
                  }
                  Insert: {
                    "activity_type_id"?: string | null,"id"?: string,"max_credits"?: number | null,"min_credits"?: number,"season_id": string,"team_id": string
                  }
                  Update: {
                    "activity_type_id"?: string | null,"id"?: string,"max_credits"?: number | null,"min_credits"?: number,"season_id"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "targets_activity_type_id_team_id_fkey"
      columns: ["activity_type_id","team_id"]
isOneToOne: false
      referencedRelation: "activity_types"
      referencedColumns: ["id","team_id"]
    },{
      foreignKeyName: "targets_season_id_team_id_fkey"
      columns: ["season_id","team_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id","team_id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "accent_primary": string,"accent_secondary": string | null,"allowed_domains": (string)[],"created_at": string,"id": string,"logo_path": string | null,"name": string,"require_email_domain": boolean,"target_period": Database["public"]['Enums']["target_period"],"time_zone": string
                  }
                  Insert: {
                    "accent_primary"?: string,"accent_secondary"?: string | null,"allowed_domains"?: (string)[],"created_at"?: string,"id"?: string,"logo_path"?: string | null,"name": string,"require_email_domain"?: boolean,"target_period"?: Database["public"]['Enums']["target_period"],"time_zone"?: string
                  }
                  Update: {
                    "accent_primary"?: string,"accent_secondary"?: string | null,"allowed_domains"?: (string)[],"created_at"?: string,"id"?: string,"logo_path"?: string | null,"name"?: string,"require_email_domain"?: boolean,"target_period"?: Database["public"]['Enums']["target_period"],"time_zone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_emails": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"kind": Database["public"]['Enums']["email_kind"],"user_id": string,"verified_at": string | null
                  }
                  Insert: {
                    "created_at"?: string,"email": string,"id"?: string,"kind": Database["public"]['Enums']["email_kind"],"user_id": string,"verified_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["email_kind"],"user_id"?: string,"verified_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_emails_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"verification_checks": {
                  Row: {
                    "attempts": number,"created_at": string,"engine": string | null,"finished_at": string | null,"id": string,"note": string | null,"result": Json | null,"session_id": string,"started_at": string | null,"status": Database["public"]['Enums']["check_status"],"team_id": string,"verdict": Database["public"]['Enums']["check_verdict"] | null
                  }
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"engine"?: string | null,"finished_at"?: string | null,"id"?: string,"note"?: string | null,"result"?: Json | null,"session_id": string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["check_status"],"team_id": string,"verdict"?: Database["public"]['Enums']["check_verdict"] | null
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"engine"?: string | null,"finished_at"?: string | null,"id"?: string,"note"?: string | null,"result"?: Json | null,"session_id"?: string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["check_status"],"team_id"?: string,"verdict"?: Database["public"]['Enums']["check_verdict"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "verification_checks_session_id_team_id_fkey"
      columns: ["session_id","team_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id","team_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "apply_verification":
{ Args: { "check_engine"?: string,"check_id": string,"check_note"?: string,"check_result"?: Json,"check_verdict": Database["public"]['Enums']["check_verdict"] }; Returns: undefined
                           },
"calculate_credits":
{ Args: { "distance_meters": number,"duration_seconds": number,"rule": Database["public"]['Tables']["credit_rules"]['Row'] }; Returns: number
                           },
"can_edit_photo_path":
{ Args: { "path": string }; Returns: boolean
                           },
"can_edit_session":
{ Args: { "session": string }; Returns: boolean
                           },
"can_see_member_email":
{ Args: { "addr": string,"owner": string }; Returns: boolean
                           },
"confirm_flagged_session":
{ Args: { "note"?: string,"session": string }; Returns: undefined
                           },
"correct_flagged_session":
{ Args: { "new_activity_type_id": string,"new_distance_meters": number,"new_duration_seconds": number,"new_intensity_id": string,"note"?: string,"session": string }; Returns: undefined
                           },
"create_team":
{ Args: { "creator_role"?: Database["public"]['Enums']["member_role"],"team_name": string,"team_time_zone"?: string }; Returns: string
                           },
"delete_team":
{ Args: { "team": string }; Returns: undefined
                           },
"email_matches_domains":
{ Args: { "addr": string,"domains": (string)[] }; Returns: boolean
                           },
"find_credit_rule":
{ Args: { "activity_type": string,"intensity": string }; Returns: {
              "activity_type_id": string,
"credits": number,
"id": string,
"intensity_id": string | null,
"kind": Database["public"]['Enums']["credit_rule_kind"],
"per_meters": number | null,
"per_minutes": number | null,
"team_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "credit_rules"
        isOneToOne: true
        isSetofReturn: false
      } },
"flagged_sessions":
{ Args: { "team": string }; Returns: {
              "activity_name": string,"athlete_id": string,"athlete_name": string,"athlete_responded_at": string,"athlete_response": Database["public"]['Enums']["athlete_response"],"athlete_response_note": string,"credits": number,"custom_label": string,"distance_meters": number,"duration_seconds": number,"flag_note": string,"id": string,"intensity_name": string,"photo_paths": (string)[],"session_date": string
            }[]
                           },
"has_coach_rights":
{ Args: { "team": string }; Returns: boolean
                           },
"has_password":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"hook_before_user_created":
{ Args: { "event": Json }; Returns: Json
                           },
"invite_preview":
{ Args: { "token_or_code": string }; Returns: {
              "allowed_domains": (string)[],"requires_email_domain": boolean,"role": Database["public"]['Enums']["member_role"],"team_name": string
            }[]
                           },
"is_active_member":
{ Args: { "member": string,"team": string }; Returns: boolean
                           },
"is_locked_out":
{ Args: { "m": Database["public"]['Tables']["memberships"]['Row'] }; Returns: boolean
                           },
"is_team_admin":
{ Args: { "team": string }; Returns: boolean
                           },
"is_team_member":
{ Args: { "team": string }; Returns: boolean
                           },
"join_team":
{ Args: { "token_or_code": string }; Returns: string
                           },
"leaderboard":
{ Args: { "day"?: string,"kind": Database["public"]['Enums']["period_kind"],"team": string }; Returns: {
              "avatar_path": string,"credits": number,"distance_meters": number,"minutes": number,"name": string,"role": Database["public"]['Enums']["member_role"],"sessions": number,"user_id": string
            }[]
                           },
"leave_team":
{ Args: { "team": string }; Returns: undefined
                           },
"meets_email_requirement":
{ Args: { "member": string,"team": string }; Returns: boolean
                           },
"member_totals":
{ Args: { "p_end": string,"p_start": string,"team": string }; Returns: {
              "credits": number,"distance_meters": number,"minutes": number,"role": Database["public"]['Enums']["member_role"],"sessions": number,"user_id": string
            }[]
                           },
"missed_target":
{ Args: { "day"?: string,"team": string }; Returns: {
              "avatar_path": string,"credits": number,"missing_types": (string)[],"name": string,"sessions": number,"short_by": number,"target": number,"user_id": string
            }[]
                           },
"my_flagged_sessions":
{ Args: { "team": string }; Returns: {
              "activity_name": string,"activity_type_id": string,"athlete_response": Database["public"]['Enums']["athlete_response"],"credits": number,"custom_label": string,"distance_meters": number,"duration_seconds": number,"flag_note": string,"id": string,"intensity_id": string,"intensity_name": string,"photo_paths": (string)[],"session_date": string
            }[]
                           },
"my_type_progress":
{ Args: { "day"?: string,"team": string }; Returns: {
              "activity_type_id": string,"credits": number,"max_credits": number,"min_credits": number,"name": string
            }[]
                           },
"own_flagged_session":
{ Args: { "session": string }; Returns: {
              "activity_type_id": string,
"athlete_id": string,
"athlete_responded_at": string | null,
"athlete_response": Database["public"]['Enums']["athlete_response"] | null,
"athlete_response_note": string | null,
"calendar_event_id": string | null,
"created_at": string,
"credits": number,
"custom_label": string | null,
"distance_meters": number | null,
"duration_seconds": number,
"group_log_id": string | null,
"id": string,
"intensity_id": string | null,
"logged_by": string | null,
"notes": string | null,
"review_note": string | null,
"reviewed_at": string | null,
"reviewed_by": string | null,
"rule_used": Json | null,
"session_date": string,
"team_id": string,
"updated_at": string,
"verification_note": string | null,
"verification_status": Database["public"]['Enums']["verification_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "sessions"
        isOneToOne: true
        isSetofReturn: false
      } },
"period_bounds":
{ Args: { "day": string,"kind": Database["public"]['Enums']["period_kind"],"team": string }; Returns: Record<string, unknown>
                           },
"period_results":
{ Args: { "p_end": string,"p_start": string,"team": string }; Returns: {
              "credits": number,"met": boolean,"missing_types": (string)[],"sessions": number,"short_by": number,"target": number,"user_id": string
            }[]
                           },
"period_target":
{ Args: { "activity_type"?: string,"p_start": string,"team": string }; Returns: Record<string, unknown>
                           },
"refresh_grace":
{ Args: { "member": string,"team": string }; Returns: undefined
                           },
"register_push_token":
{ Args: { "device_platform": Database["public"]['Enums']["push_platform"],"device_token": string }; Returns: undefined
                           },
"remove_member":
{ Args: { "member": string,"team": string }; Returns: undefined
                           },
"reset_invite":
{ Args: { "invite_role": Database["public"]['Enums']["member_role"],"team": string }; Returns: {
              "code": string,
"created_at": string,
"created_by": string | null,
"id": string,
"revoked_at": string | null,
"role": Database["public"]['Enums']["member_role"],
"team_id": string,
"token": string
            }
                          SetofOptions: {
        from: "*"
        to: "invites"
        isOneToOne: true
        isSetofReturn: false
      } },
"review_session":
{ Args: { "approve": boolean,"note"?: string,"session": string }; Returns: undefined
                           },
"season_at":
{ Args: { "d": string,"team": string }; Returns: {
              "created_at": string,
"end_date": string,
"id": string,
"name": string,
"start_date": string,
"team_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "seasons"
        isOneToOne: true
        isSetofReturn: false
      } },
"season_target_periods":
{ Args: { "team": string }; Returns: {
              "period_end": string,"period_start": string
            }[]
                           },
"session_photo_paths":
{ Args: { "session": string }; Returns: (string)[]
                           },
"set_member_admin":
{ Args: { "make_admin": boolean,"member": string,"team": string }; Returns: undefined
                           },
"set_member_role":
{ Args: { "member": string,"new_role": Database["public"]['Enums']["member_role"],"team": string }; Returns: undefined
                           },
"shares_team_with":
{ Args: { "other": string }; Returns: boolean
                           },
"streaks":
{ Args: { "team": string }; Returns: {
              "avatar_path": string,"name": string,"streak": number,"user_id": string
            }[]
                           },
"target_hit_rate":
{ Args: { "team": string }; Returns: {
              "athletes": number,"on_target": number,"period_end": string,"period_start": string
            }[]
                           },
"target_summary":
{ Args: { "day"?: string,"team": string }; Returns: {
              "athletes": number,"on_target": number,"period_end": string,"period_start": string
            }[]
                           },
"team_period":
{ Args: { "day"?: string,"kind": Database["public"]['Enums']["period_kind"],"team": string }; Returns: {
              "is_current": boolean,"max_credits": number,"period_end": string,"period_start": string,"target": number
            }[]
                           },
"team_today":
{ Args: { "team": string }; Returns: string
                           },
"week_monday":
{ Args: { "d": string }; Returns: string
                           }
          }
          Enums: {
            "athlete_response": "confirmed"|"corrected","calendar_event_kind": "test"|"race"|"workout"|"other","check_status": "queued"|"running"|"done"|"failed","check_verdict": "passed"|"flagged","credit_rule_kind": "per_session"|"per_time"|"per_distance","email_kind": "primary"|"secondary","member_role": "coach"|"athlete","notification_kind": "comment"|"reaction","period_kind": "week"|"two_weeks"|"month"|"season","photo_source": "camera"|"gallery","push_platform": "ios"|"android"|"web","target_period": "week"|"two_weeks"|"month","verification_status": "not_needed"|"pending"|"passed"|"flagged"|"rejected"
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
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "athlete_response": ["confirmed", "corrected"],"calendar_event_kind": ["test", "race", "workout", "other"],"check_status": ["queued", "running", "done", "failed"],"check_verdict": ["passed", "flagged"],"credit_rule_kind": ["per_session", "per_time", "per_distance"],"email_kind": ["primary", "secondary"],"member_role": ["coach", "athlete"],"notification_kind": ["comment", "reaction"],"period_kind": ["week", "two_weeks", "month", "season"],"photo_source": ["camera", "gallery"],"push_platform": ["ios", "android", "web"],"target_period": ["week", "two_weeks", "month"],"verification_status": ["not_needed", "pending", "passed", "flagged", "rejected"]
          }
        }
} as const
