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
          source: "competition_scrape" | "manual";
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
          status: "ok" | "degraded" | "failed";
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
    };
    Functions: {
      increment_rate_limit: {
        Args: { p_service: string; p_date: string; p_ceiling: number };
        Returns: undefined;
      };
    };
  };
}
