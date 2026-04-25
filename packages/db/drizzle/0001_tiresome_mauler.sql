CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid,
	"entity_type" text NOT NULL,
	"event" text NOT NULL,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"robots_txt" text,
	"rate_limit" jsonb,
	"path_patterns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "domain_policies_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "llm_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"latency_ms" integer,
	"cost_estimate_cents" integer,
	"correlation_id" uuid,
	"status" text NOT NULL,
	"request" jsonb NOT NULL,
	"response" jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"url" text NOT NULL,
	"content_hash" text NOT NULL,
	"request_url" text NOT NULL,
	"response_url" text NOT NULL,
	"status_code" integer,
	"content_type" text,
	"content_length" integer,
	"headers" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"url" text NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"policy_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "watch_jobs" ADD COLUMN "check_interval" text;--> statement-breakpoint
ALTER TABLE "watch_jobs" ADD COLUMN "active" boolean;--> statement-breakpoint
ALTER TABLE "watch_jobs" ADD COLUMN "last_check_at" timestamp;--> statement-breakpoint
ALTER TABLE "watch_jobs" ADD COLUMN "next_check_at" timestamp;--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD COLUMN "event_types" text[];--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD COLUMN "active" boolean;--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;