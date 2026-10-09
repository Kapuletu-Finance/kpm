// Application tables. Generated once from the Supabase schema (drizzle-kit pull with
// casing: preserve, so row keys match the snake_case JSON the frontend already uses),
// then maintained by hand. Change tables here, then `npm run db:generate`.
import { pgTable, foreignKey, index, check, uuid, text, timestamp, jsonb, unique, date, integer, boolean, varchar, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { users } from './auth';

export const reviews = pgTable("reviews", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	deliverable_id: uuid(),
	reviewer_id: uuid(),
	decision: text().default('Pending'),
	comments: text(),
	reviewed_at: timestamp({ withTimezone: true, mode: 'date' }),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().$onUpdate(() => new Date()),
}, (table) => [
	foreignKey({
			columns: [table.deliverable_id],
			foreignColumns: [deliverables.id],
			name: "reviews_deliverable_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.reviewer_id],
			foreignColumns: [members.id],
			name: "reviews_reviewer_id_fkey"
		}).onDelete("set null"),
	check("reviews_decision_check", sql`decision = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Changes Requested'::text, 'Rejected'::text])`),
	index("reviews_deliverable_id_idx").on(table.deliverable_id),
]);

export const meetings = pgTable("meetings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	project_id: uuid(),
	sprint_id: uuid(),
	title: text().notNull(),
	objective: text(),
	agenda: text(),
	meeting_link: text(),
	start_time: timestamp({ withTimezone: true, mode: 'date' }),
	end_time: timestamp({ withTimezone: true, mode: 'date' }),
	minutes: text(),
	decisions: text(),
	created_by: uuid(),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().$onUpdate(() => new Date()),
	type: text().default('Online'),
	location: text(),
}, (table) => [
	foreignKey({
			columns: [table.project_id],
			foreignColumns: [projects.id],
			name: "meetings_project_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sprint_id],
			foreignColumns: [sprints.id],
			name: "meetings_sprint_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.created_by],
			foreignColumns: [members.id],
			name: "meetings_created_by_fkey"
		}).onDelete("set null"),
	check("meetings_type_check", sql`type = ANY (ARRAY['Online'::text, 'Physical'::text])`),
	index("meetings_project_id_start_time_idx").on(table.project_id, table.start_time),
]);

export const organization_standards = pgTable("organization_standards", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organization_id: uuid(),
	engineering_standards: jsonb().default({}),
	coding_standards: jsonb().default({}),
	review_standards: jsonb().default({}),
	qa_standards: jsonb().default({}),
	meeting_templates: jsonb().default({}),
	project_templates: jsonb().default({}),
	role_templates: jsonb().default({}),
	branch_naming_rules: text(),
	definition_of_done: jsonb().default({}),
	working_principles: jsonb().default({}),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().$onUpdate(() => new Date()),
}, (table) => [
	foreignKey({
			columns: [table.organization_id],
			foreignColumns: [organizations.id],
			name: "organization_standards_organization_id_fkey"
		}).onDelete("cascade"),
	index("organization_standards_organization_id_idx").on(table.organization_id),
]);

export const members = pgTable("members", {
	id: uuid().primaryKey().notNull(),
	organization_id: uuid(),
	first_name: text().notNull(),
	last_name: text().notNull(),
	email: text().notNull(),
	job_title: text(),
	organization_role: text().default('Member'),
	avatar_url: text(),
	status: text().default('Invited'),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().$onUpdate(() => new Date()),
	invited_at: timestamp({ withTimezone: true, mode: 'date' }),
}, (table) => [
	foreignKey({
			columns: [table.id],
			foreignColumns: [users.id],
			name: "members_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organization_id],
			foreignColumns: [organizations.id],
			name: "members_organization_id_fkey"
		}).onDelete("cascade"),
	unique("members_email_key").on(table.email),
	check("members_organization_role_check", sql`organization_role = ANY (ARRAY['Organization Admin'::text, 'Project Manager'::text, 'Member'::text])`),
	check("members_status_check", sql`status = ANY (ARRAY['Active'::text, 'Inactive'::text, 'Invited'::text])`),
	index("members_organization_id_idx").on(table.organization_id),
]);

export const organizations = pgTable("organizations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	logo_url: text(),
	description: text(),
	industry: text(),
	website: text(),
	country: text(),
	timezone: text(),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().$onUpdate(() => new Date()),
}, (table) => [
	unique("organizations_slug_key").on(table.slug),
]);

export const projects = pgTable("projects", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organization_id: uuid(),
	project_manager_id: uuid(),
	name: text().notNull(),
	description: text(),
	business_goals: text(),
	target_users: text(),
	success_metrics: text(),
	status: text().default('Draft'),
	start_date: date(),
	end_date: date(),
	github_repository: text(),
	swagger_url: text(),
	figma_url: text(),
	cloudinary_folder: text(),
	priority: text().default('Medium'),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().$onUpdate(() => new Date()),
}, (table) => [
	foreignKey({
			columns: [table.organization_id],
			foreignColumns: [organizations.id],
			name: "projects_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.project_manager_id],
			foreignColumns: [members.id],
			name: "projects_project_manager_id_fkey"
		}).onDelete("set null"),
	check("projects_status_check", sql`status = ANY (ARRAY['Draft'::text, 'Planning'::text, 'Active'::text, 'On Hold'::text, 'Completed'::text, 'Archived'::text])`),
	check("projects_priority_check", sql`priority = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text, 'Critical'::text])`),
	index("projects_organization_id_idx").on(table.organization_id),
	index("projects_project_manager_id_idx").on(table.project_manager_id),
]);

export const project_documents = pgTable("project_documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	project_id: uuid(),
	title: text().notNull(),
	category: text().default('Other'),
	cloudinary_url: text().notNull(),
	version: integer().default(1),
	uploaded_by: uuid(),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().$onUpdate(() => new Date()),
}, (table) => [
	foreignKey({
			columns: [table.project_id],
			foreignColumns: [projects.id],
			name: "project_documents_project_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.uploaded_by],
			foreignColumns: [members.id],
			name: "project_documents_uploaded_by_fkey"
		}).onDelete("set null"),
	check("project_documents_category_check", sql`category = ANY (ARRAY['Requirements'::text, 'Architecture'::text, 'Research'::text, 'Meeting Minutes'::text, 'Contracts'::text, 'Other'::text])`),
	index("project_documents_project_id_idx").on(table.project_id),
]);

export const sprint_retrospectives = pgTable("sprint_retrospectives", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sprint_id: uuid(),
	what_went_well: text(),
	what_didnt_go_well: text(),
	lessons_learned: text(),
	process_improvements: text(),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().$onUpdate(() => new Date()),
}, (table) => [
	foreignKey({
			columns: [table.sprint_id],
			foreignColumns: [sprints.id],
			name: "sprint_retrospectives_sprint_id_fkey"
		}).onDelete("cascade"),
	unique("sprint_retrospectives_sprint_id_key").on(table.sprint_id),
]);

export const roadmaps = pgTable("roadmaps", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	project_id: uuid(),
	name: text().notNull(),
	description: text(),
	start_date: date(),
	end_date: date(),
	order_index: integer().default(0),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().$onUpdate(() => new Date()),
}, (table) => [
	foreignKey({
			columns: [table.project_id],
			foreignColumns: [projects.id],
			name: "roadmaps_project_id_fkey"
		}).onDelete("cascade"),
	index("roadmaps_project_id_idx").on(table.project_id),
]);

export const modules = pgTable("modules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	roadmap_id: uuid(),
	name: text().notNull(),
	description: text(),
	objectives: text(),
	status: text().default('Not Started'),
	priority: text().default('Medium'),
	order_index: integer().default(0),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().$onUpdate(() => new Date()),
}, (table) => [
	foreignKey({
			columns: [table.roadmap_id],
			foreignColumns: [roadmaps.id],
			name: "modules_roadmap_id_fkey"
		}).onDelete("cascade"),
	check("modules_status_check", sql`status = ANY (ARRAY['Not Started'::text, 'In Progress'::text, 'Completed'::text])`),
	check("modules_priority_check", sql`priority = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text, 'Critical'::text])`),
	index("modules_roadmap_id_idx").on(table.roadmap_id),
]);

export const sprints = pgTable("sprints", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	project_id: uuid(),
	name: text().notNull(),
	goal: text(),
	definition_of_success: text(),
	risks: text(),
	start_date: date(),
	end_date: date(),
	status: text().default('Planning'),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().$onUpdate(() => new Date()),
}, (table) => [
	foreignKey({
			columns: [table.project_id],
			foreignColumns: [projects.id],
			name: "sprints_project_id_fkey"
		}).onDelete("cascade"),
	check("sprints_status_check", sql`status = ANY (ARRAY['Planning'::text, 'Active'::text, 'Review'::text, 'Completed'::text])`),
	index("sprints_project_id_idx").on(table.project_id),
]);

export const features = pgTable("features", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	module_id: uuid(),
	sprint_id: uuid(),
	title: text().notNull(),
	description: text(),
	business_value: text(),
	requirements: text(),
	acceptance_criteria: text(),
	user_stories: text(),
	technical_notes: text(),
	api_links: text(),
	design_links: text(),
	priority: text().default('Medium'),
	status: text().default('Idea'),
	start_date: date(),
	due_date: date(),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().$onUpdate(() => new Date()),
	release_id: uuid(),
	// When the feature last reached Released (null while unfinished). Drives burndown and velocity.
	completed_at: timestamp({ withTimezone: true, mode: 'date' }),
}, (table) => [
	foreignKey({
			columns: [table.release_id],
			foreignColumns: [releases.id],
			name: "features_release_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.module_id],
			foreignColumns: [modules.id],
			name: "features_module_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sprint_id],
			foreignColumns: [sprints.id],
			name: "features_sprint_id_fkey"
		}).onDelete("set null"),
	check("features_priority_check", sql`priority = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text, 'Critical'::text])`),
	check("features_status_check", sql`status = ANY (ARRAY['Idea'::text, 'Requirements'::text, 'Design'::text, 'Development'::text, 'Integration'::text, 'Testing'::text, 'Approval'::text, 'Released'::text])`),
	index("features_module_id_idx").on(table.module_id),
	index("features_sprint_id_idx").on(table.sprint_id),
	index("features_release_id_idx").on(table.release_id),
]);

export const project_members = pgTable("project_members", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	project_id: uuid(),
	member_id: uuid(),
	project_role: text().notNull(),
	responsibilities: text(),
	review_authority: boolean().default(false),
	joined_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	functional_role: varchar({ length: 255 }),
	role_responsibilities: jsonb().default([]),
}, (table) => [
	foreignKey({
			columns: [table.project_id],
			foreignColumns: [projects.id],
			name: "project_members_project_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.member_id],
			foreignColumns: [members.id],
			name: "project_members_member_id_fkey"
		}).onDelete("cascade"),
	unique("project_members_project_id_member_id_key").on(table.project_id, table.member_id),
	index("project_members_member_id_idx").on(table.member_id),
]);

export const meeting_action_items = pgTable("meeting_action_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	meeting_id: uuid(),
	description: text().notNull(),
	assigned_to: uuid(),
	status: text().default('Pending'),
	due_date: date(),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().$onUpdate(() => new Date()),
}, (table) => [
	foreignKey({
			columns: [table.meeting_id],
			foreignColumns: [meetings.id],
			name: "meeting_action_items_meeting_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.assigned_to],
			foreignColumns: [members.id],
			name: "meeting_action_items_assigned_to_fkey"
		}).onDelete("set null"),
	check("meeting_action_items_status_check", sql`status = ANY (ARRAY['Pending'::text, 'In Progress'::text, 'Completed'::text])`),
	index("meeting_action_items_meeting_id_idx").on(table.meeting_id),
	index("meeting_action_items_assigned_to_idx").on(table.assigned_to),
]);

export const feature_checklists = pgTable("feature_checklists", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	feature_id: uuid(),
	title: text().notNull(),
	is_completed: boolean().default(false),
	completed_by: uuid(),
	completed_at: timestamp({ withTimezone: true, mode: 'date' }),
	order_index: integer().default(0),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().$onUpdate(() => new Date()),
}, (table) => [
	foreignKey({
			columns: [table.feature_id],
			foreignColumns: [features.id],
			name: "feature_checklists_feature_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.completed_by],
			foreignColumns: [members.id],
			name: "feature_checklists_completed_by_fkey"
		}).onDelete("set null"),
	index("feature_checklists_feature_id_idx").on(table.feature_id),
]);

export const daily_updates = pgTable("daily_updates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	project_id: uuid(),
	sprint_id: uuid(),
	member_id: uuid(),
	yesterday: text(),
	today: text(),
	blockers: text(),
	risks: text(),
	help_needed: text(),
	manager_comments: text(),
	submitted_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().$onUpdate(() => new Date()),
}, (table) => [
	foreignKey({
			columns: [table.project_id],
			foreignColumns: [projects.id],
			name: "daily_updates_project_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sprint_id],
			foreignColumns: [sprints.id],
			name: "daily_updates_sprint_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.member_id],
			foreignColumns: [members.id],
			name: "daily_updates_member_id_fkey"
		}).onDelete("cascade"),
	index("daily_updates_project_id_submitted_at_idx").on(table.project_id, table.submitted_at),
	index("daily_updates_member_id_idx").on(table.member_id),
]);

export const deliverables = pgTable("deliverables", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	entity_type: text().notNull(),
	entity_id: uuid().notNull(),
	member_id: uuid(),
	title: text().notNull(),
	type: text(),
	link: text(),
	description: text(),
	status: text().default('Pending'),
	submitted_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().$onUpdate(() => new Date()),
}, (table) => [
	foreignKey({
			columns: [table.member_id],
			foreignColumns: [members.id],
			name: "deliverables_member_id_fkey"
		}).onDelete("set null"),
	check("deliverables_entity_type_check", sql`entity_type = ANY (ARRAY['Feature'::text, 'Meeting'::text, 'Project'::text])`),
	check("deliverables_type_check", sql`type = ANY (ARRAY['GitHub PR'::text, 'Figma Link'::text, 'API Doc'::text, 'Document'::text, 'Video'::text, 'Screenshot'::text, 'Demo'::text, 'Commit'::text, 'Deployment URL'::text])`),
	check("deliverables_status_check", sql`status = ANY (ARRAY['Pending'::text, 'Submitted'::text, 'Reviewed'::text, 'Approved'::text, 'Rejected'::text, 'Changes Requested'::text])`),
	index("deliverables_entity_type_entity_id_idx").on(table.entity_type, table.entity_id),
	index("deliverables_member_id_idx").on(table.member_id),
]);

export const feature_dependencies = pgTable("feature_dependencies", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	feature_id: uuid(),
	depends_on_feature_id: uuid(),
	dependency_type: text().default('Blocks'),
	notes: text(),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.feature_id],
			foreignColumns: [features.id],
			name: "feature_dependencies_feature_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.depends_on_feature_id],
			foreignColumns: [features.id],
			name: "feature_dependencies_depends_on_feature_id_fkey"
		}).onDelete("cascade"),
	check("feature_dependencies_dependency_type_check", sql`dependency_type = ANY (ARRAY['Blocks'::text, 'Blocked By'::text, 'Relates To'::text])`),
	index("feature_dependencies_feature_id_idx").on(table.feature_id),
]);

export const feature_members = pgTable("feature_members", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	feature_id: uuid(),
	member_id: uuid(),
	responsibility: text(),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.feature_id],
			foreignColumns: [features.id],
			name: "feature_members_feature_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.member_id],
			foreignColumns: [members.id],
			name: "feature_members_member_id_fkey"
		}).onDelete("cascade"),
	index("feature_members_feature_id_idx").on(table.feature_id),
	index("feature_members_member_id_idx").on(table.member_id),
]);

export const releases = pgTable("releases", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	project_id: uuid(),
	version: text().notNull(),
	title: text(),
	release_notes: text(),
	deployment_checklist: jsonb().default([]),
	rollback_plan: text(),
	release_date: date(),
	status: text().default('Planned'),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().$onUpdate(() => new Date()),
}, (table) => [
	foreignKey({
			columns: [table.project_id],
			foreignColumns: [projects.id],
			name: "releases_project_id_fkey"
		}).onDelete("cascade"),
	check("releases_status_check", sql`status = ANY (ARRAY['Planned'::text, 'Staging'::text, 'Released'::text, 'Rolled Back'::text])`),
	index("releases_project_id_idx").on(table.project_id),
]);

export const activity_logs = pgTable("activity_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	// Every event belongs to an organization; project-less events (role changes,
	// invites, settings) have project_id null.
	organization_id: uuid(),
	project_id: uuid(),
	member_id: uuid(),
	action: text().notNull(),
	entity_type: text().notNull(),
	entity_id: uuid().notNull(),
	description: text(),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.organization_id],
			foreignColumns: [organizations.id],
			name: "activity_logs_organization_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.project_id],
			foreignColumns: [projects.id],
			name: "activity_logs_project_id_fkey"
		}).onDelete("cascade"),
	index("activity_logs_organization_id_created_at_idx").on(table.organization_id, table.created_at),
	foreignKey({
			columns: [table.member_id],
			foreignColumns: [members.id],
			name: "activity_logs_member_id_fkey"
		}).onDelete("set null"),
	index("activity_logs_project_id_created_at_idx").on(table.project_id, table.created_at),
	index("activity_logs_member_id_idx").on(table.member_id),
]);

export const notifications = pgTable("notifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	member_id: uuid(),
	title: text().notNull(),
	message: text(),
	type: text(),
	entity_type: text(),
	entity_id: uuid(),
	is_read: boolean().default(false),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.member_id],
			foreignColumns: [members.id],
			name: "notifications_member_id_fkey"
		}).onDelete("cascade"),
	index("notifications_member_id_created_at_idx").on(table.member_id, table.created_at),
]);

export const comments = pgTable("comments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	entity_type: text().notNull(),
	entity_id: uuid().notNull(),
	member_id: uuid(),
	comment: text().notNull(),
	parent_comment_id: uuid(),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().$onUpdate(() => new Date()),
}, (table) => [
	foreignKey({
			columns: [table.member_id],
			foreignColumns: [members.id],
			name: "comments_member_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.parent_comment_id],
			foreignColumns: [table.id],
			name: "comments_parent_comment_id_fkey"
		}).onDelete("cascade"),
	check("comments_entity_type_check", sql`entity_type = ANY (ARRAY['Feature'::text, 'Deliverable'::text, 'Meeting'::text, 'Project'::text, 'Module'::text])`),
	index("comments_entity_type_entity_id_idx").on(table.entity_type, table.entity_id),
]);

export const meeting_participants = pgTable("meeting_participants", {
	meeting_id: uuid().notNull(),
	member_id: uuid().notNull(),
	joined_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.meeting_id],
			foreignColumns: [meetings.id],
			name: "meeting_participants_meeting_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.member_id],
			foreignColumns: [members.id],
			name: "meeting_participants_member_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.meeting_id, table.member_id], name: "meeting_participants_pkey"}),
	index("meeting_participants_member_id_idx").on(table.member_id),
]);

// Project checkpoints. "Achieved" milestones are the project's recorded achievements.
export const milestones = pgTable("milestones", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	project_id: uuid().notNull(),
	// Optional link to the roadmap phase the milestone closes
	roadmap_id: uuid(),
	title: text().notNull(),
	description: text(),
	due_date: date(),
	status: text().default('Planned').notNull(),
	achieved_at: timestamp({ withTimezone: true, mode: 'date' }),
	created_by: uuid(),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().$onUpdate(() => new Date()),
}, (table) => [
	foreignKey({
			columns: [table.project_id],
			foreignColumns: [projects.id],
			name: "milestones_project_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.roadmap_id],
			foreignColumns: [roadmaps.id],
			name: "milestones_roadmap_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.created_by],
			foreignColumns: [members.id],
			name: "milestones_created_by_fkey"
		}).onDelete("set null"),
	check("milestones_status_check", sql`status = ANY (ARRAY['Planned'::text, 'In Progress'::text, 'Achieved'::text, 'Missed'::text])`),
	index("milestones_project_id_due_date_idx").on(table.project_id, table.due_date),
]);

// How an organization's official documents (PDF reports, minutes, ...) are branded.
// With `enabled` false, documents carry the default KPM - Kapuletu Systems letterhead.
export const organization_branding = pgTable("organization_branding", {
	organization_id: uuid().primaryKey().notNull(),
	enabled: boolean().default(false).notNull(),
	// Name printed on the letterhead; falls back to the organization name
	display_name: text(),
	tagline: text(),
	// PNG or JPEG uploaded through KPM (documents only embed images from our storage)
	logo_url: text(),
	contact_email: text(),
	contact_phone: text(),
	address: text(),
	website: text(),
	// e.g. company registration number or tax PIN
	registration_number: text(),
	primary_color: text().default('#097255').notNull(),
	template: text().default('classic').notNull(),
	footer_text: text(),
	confidentiality_notice: text(),
	show_kpm_attribution: boolean().default(true).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().$onUpdate(() => new Date()),
}, (table) => [
	foreignKey({
			columns: [table.organization_id],
			foreignColumns: [organizations.id],
			name: "organization_branding_organization_id_fkey"
		}).onDelete("cascade"),
	check("organization_branding_template_check", sql`template = ANY (ARRAY['classic'::text, 'modern'::text, 'minimal'::text])`),
	check("organization_branding_color_check", sql`primary_color ~ '^#[0-9a-fA-F]{6}$'`),
]);
