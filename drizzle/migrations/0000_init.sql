CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"member_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"member_id" uuid,
	"comment" text NOT NULL,
	"parent_comment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "comments_entity_type_check" CHECK (entity_type = ANY (ARRAY['Feature'::text, 'Deliverable'::text, 'Meeting'::text, 'Project'::text, 'Module'::text]))
);
--> statement-breakpoint
CREATE TABLE "daily_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"sprint_id" uuid,
	"member_id" uuid,
	"yesterday" text,
	"today" text,
	"blockers" text,
	"risks" text,
	"help_needed" text,
	"manager_comments" text,
	"submitted_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"member_id" uuid,
	"title" text NOT NULL,
	"type" text,
	"link" text,
	"description" text,
	"status" text DEFAULT 'Pending',
	"submitted_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "deliverables_entity_type_check" CHECK (entity_type = ANY (ARRAY['Feature'::text, 'Meeting'::text, 'Project'::text])),
	CONSTRAINT "deliverables_type_check" CHECK (type = ANY (ARRAY['GitHub PR'::text, 'Figma Link'::text, 'API Doc'::text, 'Document'::text, 'Video'::text, 'Screenshot'::text, 'Demo'::text, 'Commit'::text, 'Deployment URL'::text])),
	CONSTRAINT "deliverables_status_check" CHECK (status = ANY (ARRAY['Pending'::text, 'Submitted'::text, 'Reviewed'::text, 'Approved'::text, 'Rejected'::text, 'Changes Requested'::text]))
);
--> statement-breakpoint
CREATE TABLE "feature_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_id" uuid,
	"title" text NOT NULL,
	"is_completed" boolean DEFAULT false,
	"completed_by" uuid,
	"completed_at" timestamp with time zone,
	"order_index" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feature_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_id" uuid,
	"depends_on_feature_id" uuid,
	"dependency_type" text DEFAULT 'Blocks',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "feature_dependencies_dependency_type_check" CHECK (dependency_type = ANY (ARRAY['Blocks'::text, 'Blocked By'::text, 'Relates To'::text]))
);
--> statement-breakpoint
CREATE TABLE "feature_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_id" uuid,
	"member_id" uuid,
	"responsibility" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid,
	"sprint_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"business_value" text,
	"requirements" text,
	"acceptance_criteria" text,
	"user_stories" text,
	"technical_notes" text,
	"api_links" text,
	"design_links" text,
	"priority" text DEFAULT 'Medium',
	"status" text DEFAULT 'Idea',
	"start_date" date,
	"due_date" date,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"release_id" uuid,
	CONSTRAINT "features_priority_check" CHECK (priority = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text, 'Critical'::text])),
	CONSTRAINT "features_status_check" CHECK (status = ANY (ARRAY['Idea'::text, 'Requirements'::text, 'Design'::text, 'Development'::text, 'Integration'::text, 'Testing'::text, 'Approval'::text, 'Released'::text]))
);
--> statement-breakpoint
CREATE TABLE "meeting_action_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid,
	"description" text NOT NULL,
	"assigned_to" uuid,
	"status" text DEFAULT 'Pending',
	"due_date" date,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "meeting_action_items_status_check" CHECK (status = ANY (ARRAY['Pending'::text, 'In Progress'::text, 'Completed'::text]))
);
--> statement-breakpoint
CREATE TABLE "meeting_participants" (
	"meeting_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "meeting_participants_pkey" PRIMARY KEY("meeting_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"sprint_id" uuid,
	"title" text NOT NULL,
	"objective" text,
	"agenda" text,
	"meeting_link" text,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"minutes" text,
	"decisions" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"type" text DEFAULT 'Online',
	"location" text,
	CONSTRAINT "meetings_type_check" CHECK (type = ANY (ARRAY['Online'::text, 'Physical'::text]))
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"job_title" text,
	"organization_role" text DEFAULT 'Member',
	"avatar_url" text,
	"status" text DEFAULT 'Invited',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"invited_at" timestamp with time zone,
	CONSTRAINT "members_email_key" UNIQUE("email"),
	CONSTRAINT "members_organization_role_check" CHECK (organization_role = ANY (ARRAY['Organization Admin'::text, 'Project Manager'::text, 'Member'::text])),
	CONSTRAINT "members_status_check" CHECK (status = ANY (ARRAY['Active'::text, 'Inactive'::text, 'Invited'::text]))
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roadmap_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"objectives" text,
	"status" text DEFAULT 'Not Started',
	"priority" text DEFAULT 'Medium',
	"order_index" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "modules_status_check" CHECK (status = ANY (ARRAY['Not Started'::text, 'In Progress'::text, 'Completed'::text])),
	CONSTRAINT "modules_priority_check" CHECK (priority = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text, 'Critical'::text]))
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid,
	"title" text NOT NULL,
	"message" text,
	"type" text,
	"entity_type" text,
	"entity_id" uuid,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_standards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"engineering_standards" jsonb DEFAULT '{}'::jsonb,
	"coding_standards" jsonb DEFAULT '{}'::jsonb,
	"review_standards" jsonb DEFAULT '{}'::jsonb,
	"qa_standards" jsonb DEFAULT '{}'::jsonb,
	"meeting_templates" jsonb DEFAULT '{}'::jsonb,
	"project_templates" jsonb DEFAULT '{}'::jsonb,
	"role_templates" jsonb DEFAULT '{}'::jsonb,
	"branch_naming_rules" text,
	"definition_of_done" jsonb DEFAULT '{}'::jsonb,
	"working_principles" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"description" text,
	"industry" text,
	"website" text,
	"country" text,
	"timezone" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "organizations_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "project_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"category" text DEFAULT 'Other',
	"cloudinary_url" text NOT NULL,
	"version" integer DEFAULT 1,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "project_documents_category_check" CHECK (category = ANY (ARRAY['Requirements'::text, 'Architecture'::text, 'Research'::text, 'Meeting Minutes'::text, 'Contracts'::text, 'Other'::text]))
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"member_id" uuid,
	"project_role" text NOT NULL,
	"responsibilities" text,
	"review_authority" boolean DEFAULT false,
	"joined_at" timestamp with time zone DEFAULT now(),
	"functional_role" varchar(255),
	"role_responsibilities" jsonb DEFAULT '[]'::jsonb,
	CONSTRAINT "project_members_project_id_member_id_key" UNIQUE("project_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"project_manager_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"business_goals" text,
	"target_users" text,
	"success_metrics" text,
	"status" text DEFAULT 'Draft',
	"start_date" date,
	"end_date" date,
	"github_repository" text,
	"swagger_url" text,
	"figma_url" text,
	"cloudinary_folder" text,
	"priority" text DEFAULT 'Medium',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "projects_status_check" CHECK (status = ANY (ARRAY['Draft'::text, 'Planning'::text, 'Active'::text, 'On Hold'::text, 'Completed'::text, 'Archived'::text])),
	CONSTRAINT "projects_priority_check" CHECK (priority = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text, 'Critical'::text]))
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"version" text NOT NULL,
	"title" text,
	"release_notes" text,
	"deployment_checklist" jsonb DEFAULT '[]'::jsonb,
	"rollback_plan" text,
	"release_date" date,
	"status" text DEFAULT 'Planned',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "releases_status_check" CHECK (status = ANY (ARRAY['Planned'::text, 'Staging'::text, 'Released'::text, 'Rolled Back'::text]))
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deliverable_id" uuid,
	"reviewer_id" uuid,
	"decision" text DEFAULT 'Pending',
	"comments" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "reviews_decision_check" CHECK (decision = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Changes Requested'::text, 'Rejected'::text]))
);
--> statement-breakpoint
CREATE TABLE "roadmaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"start_date" date,
	"end_date" date,
	"order_index" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sprint_retrospectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sprint_id" uuid,
	"what_went_well" text,
	"what_didnt_go_well" text,
	"lessons_learned" text,
	"process_improvements" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sprint_retrospectives_sprint_id_key" UNIQUE("sprint_id")
);
--> statement-breakpoint
CREATE TABLE "sprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"goal" text,
	"definition_of_success" text,
	"risks" text,
	"start_date" date,
	"end_date" date,
	"status" text DEFAULT 'Planning',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sprints_status_check" CHECK (status = ANY (ARRAY['Planning'::text, 'Active'::text, 'Review'::text, 'Completed'::text]))
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp with time zone,
	"image" text,
	"password_hash" text,
	"last_sign_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_updates" ADD CONSTRAINT "daily_updates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_updates" ADD CONSTRAINT "daily_updates_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_updates" ADD CONSTRAINT "daily_updates_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_checklists" ADD CONSTRAINT "feature_checklists_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_checklists" ADD CONSTRAINT "feature_checklists_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_dependencies" ADD CONSTRAINT "feature_dependencies_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_dependencies" ADD CONSTRAINT "feature_dependencies_depends_on_feature_id_fkey" FOREIGN KEY ("depends_on_feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_members" ADD CONSTRAINT "feature_members_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_members" ADD CONSTRAINT "feature_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_action_items" ADD CONSTRAINT "meeting_action_items_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_action_items" ADD CONSTRAINT "meeting_action_items_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_standards" ADD CONSTRAINT "organization_standards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_manager_id_fkey" FOREIGN KEY ("project_manager_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_retrospectives" ADD CONSTRAINT "sprint_retrospectives_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_project_id_created_at_idx" ON "activity_logs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_member_id_idx" ON "activity_logs" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "comments_entity_type_entity_id_idx" ON "comments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "daily_updates_project_id_submitted_at_idx" ON "daily_updates" USING btree ("project_id","submitted_at");--> statement-breakpoint
CREATE INDEX "daily_updates_member_id_idx" ON "daily_updates" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "deliverables_entity_type_entity_id_idx" ON "deliverables" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "deliverables_member_id_idx" ON "deliverables" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "feature_checklists_feature_id_idx" ON "feature_checklists" USING btree ("feature_id");--> statement-breakpoint
CREATE INDEX "feature_dependencies_feature_id_idx" ON "feature_dependencies" USING btree ("feature_id");--> statement-breakpoint
CREATE INDEX "feature_members_feature_id_idx" ON "feature_members" USING btree ("feature_id");--> statement-breakpoint
CREATE INDEX "feature_members_member_id_idx" ON "feature_members" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "features_module_id_idx" ON "features" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "features_sprint_id_idx" ON "features" USING btree ("sprint_id");--> statement-breakpoint
CREATE INDEX "features_release_id_idx" ON "features" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "meeting_action_items_meeting_id_idx" ON "meeting_action_items" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "meeting_action_items_assigned_to_idx" ON "meeting_action_items" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "meeting_participants_member_id_idx" ON "meeting_participants" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "meetings_project_id_start_time_idx" ON "meetings" USING btree ("project_id","start_time");--> statement-breakpoint
CREATE INDEX "members_organization_id_idx" ON "members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "modules_roadmap_id_idx" ON "modules" USING btree ("roadmap_id");--> statement-breakpoint
CREATE INDEX "notifications_member_id_created_at_idx" ON "notifications" USING btree ("member_id","created_at");--> statement-breakpoint
CREATE INDEX "organization_standards_organization_id_idx" ON "organization_standards" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "project_documents_project_id_idx" ON "project_documents" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_members_member_id_idx" ON "project_members" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "projects_organization_id_idx" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "projects_project_manager_id_idx" ON "projects" USING btree ("project_manager_id");--> statement-breakpoint
CREATE INDEX "releases_project_id_idx" ON "releases" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "reviews_deliverable_id_idx" ON "reviews" USING btree ("deliverable_id");--> statement-breakpoint
CREATE INDEX "roadmaps_project_id_idx" ON "roadmaps" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "sprints_project_id_idx" ON "sprints" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_tokens_token_idx" ON "verification_tokens" USING btree ("token");