CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"roadmap_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"due_date" date,
	"status" text DEFAULT 'Planned' NOT NULL,
	"achieved_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "milestones_status_check" CHECK (status = ANY (ARRAY['Planned'::text, 'In Progress'::text, 'Achieved'::text, 'Missed'::text]))
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "features" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sessions_valid_after" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "milestones_project_id_due_date_idx" ON "milestones" USING btree ("project_id","due_date");--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_organization_id_created_at_idx" ON "activity_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
-- Backfill: existing activity belongs to its project's organization.
UPDATE "activity_logs" AS a SET "organization_id" = p."organization_id" FROM "projects" AS p WHERE p."id" = a."project_id" AND a."organization_id" IS NULL;--> statement-breakpoint
-- Backfill: features already released count as completed when they were last updated.
UPDATE "features" SET "completed_at" = COALESCE("updated_at", now()) WHERE "status" = 'Released' AND "completed_at" IS NULL;
