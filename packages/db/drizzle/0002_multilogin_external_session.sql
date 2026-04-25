ALTER TABLE "browser_profiles" ADD COLUMN "backend" text DEFAULT 'local_vault' NOT NULL;--> statement-breakpoint
ALTER TABLE "browser_profiles" ALTER COLUMN "encrypted_profile" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "external_profile_id" text;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "external_profile_label" text;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "bridge_target" text;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "automation_type" text;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "profile_kind" text;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "browser_profiles" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "domain_policies" ADD COLUMN "action" text DEFAULT 'allow' NOT NULL;--> statement-breakpoint
ALTER TABLE "domain_policies" ADD COLUMN "browser_mode" text DEFAULT 'static' NOT NULL;--> statement-breakpoint
ALTER TABLE "domain_policies" ADD COLUMN "session_backend" text DEFAULT 'crawlx_local' NOT NULL;--> statement-breakpoint
ALTER TABLE "domain_policies" ADD COLUMN "requires_named_profile" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "domain_policies" ADD COLUMN "requires_manual_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "domain_policies" ADD COLUMN "allow_cloud_escalation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "domain_policies" ADD COLUMN "max_depth" integer;--> statement-breakpoint
ALTER TABLE "domain_policies" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
CREATE TABLE "browser_profile_leases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"owner_job_id" uuid,
	"worker_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_heartbeat_at" timestamp DEFAULT now() NOT NULL,
	"cooldown_until" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "browser_profile_leases" ADD CONSTRAINT "browser_profile_leases_profile_id_browser_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."browser_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_profile_leases" ADD CONSTRAINT "browser_profile_leases_owner_job_id_crawl_jobs_id_fk" FOREIGN KEY ("owner_job_id") REFERENCES "public"."crawl_jobs"("id") ON DELETE no action ON UPDATE no action;
