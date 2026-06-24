export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      candidates: {
        Row: {
          id: string;
          full_name: string;
          university: string;
          degree: string;
          branch: string;
          graduation_year: number;
          linkedin_url: string | null;
          email: string | null;
          email_confidence:
            | "github_profile"
            | "github_commit"
            | "inferred"
            | null;
          github_url: string | null;
          source: "competition_scrape" | "google_search" | "twitter" | "linkedin" | "manual";
          culture_score: number | null;
          created_at: string;
          last_updated: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["candidates"]["Row"],
          "id" | "created_at" | "last_updated"
        > & {
          id?: string;
          created_at?: string;
          last_updated?: string;
        };
        Update: Partial<Database["public"]["Tables"]["candidates"]["Insert"]>;
      };
      competition_results: {
        Row: {
          id: string;
          candidate_id: string;
          competition_name: string;
          competition_category:
            | "hardware"
            | "software"
            | "founders_office"
            | "product_gtm";
          result_tier:
            | "winner"
            | "runner_up"
            | "top_3"
            | "top_10"
            | "finalist"
            | "participant";
          year: number;
          team_name: string | null;
          source_url: string;
          ingestion_method: "api" | "html_scrape" | "pdf_parse" | "manual";
        };
        Insert: Omit<Database["public"]["Tables"]["competition_results"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["competition_results"]["Insert"]>;
      };
      positions_of_responsibility: {
        Row: {
          id: string;
          candidate_id: string;
          organisation_name: string;
          role_title: string;
          por_category:
            | "ecell"
            | "technical_committee"
            | "cultural_fest"
            | "student_body"
            | "sports";
          institution: string;
          year_start: number;
          year_end: number | null;
          source_url: string;
          ingestion_method: "api" | "html_scrape" | "manual";
        };
        Insert: Omit<
          Database["public"]["Tables"]["positions_of_responsibility"]["Row"],
          "id"
        > & { id?: string };
        Update: Partial<
          Database["public"]["Tables"]["positions_of_responsibility"]["Insert"]
        >;
      };
      pipelines: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          candidate_ids: string[];
          created_at: string;
          notes: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["pipelines"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["pipelines"]["Insert"]>;
      };
      scraper_health_log: {
        Row: {
          id: string;
          scraper_name: string;
          run_at: string;
          status: "ok" | "degraded" | "failed" | "skipped";
          records_extracted: number;
          records_expected_min: number;
          error_message: string | null;
          source_url: string;
          alert_sent: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["scraper_health_log"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["scraper_health_log"]["Insert"]>;
      };
      rate_limit_log: {
        Row: {
          id: string;
          service: "duckduckgo" | "github";
          date: string;
          requests_made: number;
          daily_ceiling: number;
          ceiling_hit: boolean;
          last_updated: string;
        };
        Insert: Omit<Database["public"]["Tables"]["rate_limit_log"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rate_limit_log"]["Insert"]>;
      };
      competitions: {
        Row: {
          id: string;
          name: string;
          short_name: string | null;
          type: string | null;
          role_clusters: string[] | null;
          twitter_keywords: string[] | null;
          frequency: string | null;
          level: "international" | "national" | "regional" | "institute" | null;
          status: "active" | "inactive";
          source: "manual" | "auto_detected";
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["competitions"]["Row"],
          "created_at" | "updated_at"
        > & { created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["competitions"]["Insert"]>;
      };
      flagged_competitions: {
        Row: {
          id: string;
          name: string;
          raw_keyword: string;
          source_tweet_url: string | null;
          source_tweet_text: string | null;
          source_platform: string;
          detected_at: string;
          review_status: "pending" | "approved" | "dismissed";
          reviewed_at: string | null;
          competition_id: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["flagged_competitions"]["Row"],
          "id" | "detected_at"
        > & { id?: string; detected_at?: string };
        Update: Partial<Database["public"]["Tables"]["flagged_competitions"]["Insert"]>;
      };
      campaigns: {
        Row: {
          id: string;
          name: string;
          jd_raw: string;
          jd_parsed: Json;
          filters: Json;
          status: "pending" | "searching" | "done" | "error";
          candidate_count: number;
          company_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["campaigns"]["Row"],
          "id" | "created_at" | "updated_at"
        > & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["campaigns"]["Insert"]>;
      };
      experienced_candidates: {
        Row: {
          id: string;
          campaign_id: string;
          apollo_id: string;
          full_name: string;
          title: string | null;
          headline: string | null;
          linkedin_url: string | null;
          email: string | null;
          company_name: string | null;
          company_id: string | null;
          location: string | null;
          years_experience: number | null;
          skills: string[];
          fit_score: number;
          fit_tier: "strong" | "good" | "partial" | "skip";
          required_match: boolean;
          apollo_raw: Json;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["experienced_candidates"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["experienced_candidates"]["Insert"]>;
      };
      campaign_companies: {
        Row: {
          id: string;
          campaign_id: string;
          apollo_org_id: string;
          name: string;
          industry: string | null;
          employee_count: number | null;
          linkedin_url: string | null;
          website: string | null;
          candidate_count: number;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["campaign_companies"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["campaign_companies"]["Insert"]>;
      };
    };
      outreach_templates: {
        Row: {
          id: string;
          name: string;
          pipeline: "student" | "experienced" | "both";
          message_type: "initial" | "followup_1" | "followup_2";
          channel: "email" | "linkedin";
          subject_template: string | null;
          body_template: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["outreach_templates"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string; created_at?: string; updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["outreach_templates"]["Insert"]>;
      };
      outreach_messages: {
        Row: {
          id: string;
          candidate_id: string;
          candidate_type: "student" | "experienced";
          pipeline_id: string | null;
          campaign_id: string | null;
          channel: "email" | "linkedin";
          status: "draft" | "approved" | "sending" | "sent" | "failed" | "replied";
          subject: string | null;
          body: string;
          to_email: string | null;
          to_linkedin_url: string | null;
          candidate_name: string | null;
          candidate_title: string | null;
          candidate_company: string | null;
          template_id: string | null;
          is_followup: boolean;
          parent_message_id: string | null;
          follow_up_number: number;
          gmail_message_id: string | null;
          gmail_thread_id: string | null;
          sent_at: string | null;
          replied_at: string | null;
          next_follow_up_at: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["outreach_messages"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string; created_at?: string; updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["outreach_messages"]["Insert"]>;
      };
    };
    Functions: {
      increment_rate_limit: {
        Args: { p_service: string; p_date: string; p_ceiling: number };
        Returns: undefined;
      };
      set_updated_at: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
  };
}
