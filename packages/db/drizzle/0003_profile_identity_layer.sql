-- Track 3a: Profile Identity Layer
-- Creates proxies and profile_events tables, extends browser_profiles
-- and browser_profile_leases with identity/ownership fields, and adds
-- external backend policy columns to domain_policies.

--> statement-breakpoint
CREATE TABLE "proxies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"provider" text,
	"proxy_url" text NOT NULL,
	"auth_secret_ref" text,
	"geo_country" text,
	"geo_region" text,
	"timezone_hint" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_healthcheck_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "backend_type" text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "session_partition" text;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "default_tab_hint" text;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "account_label" text;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "tenant_id" text;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "proxy_id" uuid;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "locale" text;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "user_agent_family" text;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "browser_channel" text;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "capabilities_json" jsonb;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "last_healthcheck_at" timestamp;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "last_used_at" timestamp;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD CONSTRAINT "browser_profiles_proxy_id_proxies_id_fk" FOREIGN KEY ("proxy_id") REFERENCES "public"."proxies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_profile_leases" ADD COLUMN "owner_type" text DEFAULT 'worker' NOT NULL;--> statement-breakpoint
ALTER TABLE "browser_profile_leases" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "browser_profile_leases" ADD COLUMN "lease_token" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "browser_profile_leases" ADD COLUMN "released_at" timestamp;--> statement-breakpoint
ALTER TABLE "browser_profile_leases" ADD COLUMN "release_reason" text;--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_lease_per_profile" ON "browser_profile_leases" ("profile_id") WHERE "browser_profile_leases"."status" = 'active';--> statement-breakpoint
CREATE TABLE "profile_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"job_id" uuid,
	"event_type" text NOT NULL,
	"meta_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_events" ADD CONSTRAINT "profile_events_profile_id_browser_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."browser_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_events" ADD CONSTRAINT "profile_events_job_id_crawl_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."crawl_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_policies" ADD COLUMN "allows_external_browser_backend" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "domain_policies" ADD COLUMN "requires_human_session" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "domain_policies" ADD COLUMN "requires_operator_handoff" boolean DEFAULT false NOT NULL;
