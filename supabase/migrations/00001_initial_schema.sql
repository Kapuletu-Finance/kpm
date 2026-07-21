-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------
-- TRIGGER FUNCTION: updated_at_trigger
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION updated_at_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------
-- 1. IDENTITY & ORGANIZATION
-- --------------------------------------------------------

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    description TEXT,
    industry TEXT,
    website TEXT,
    country TEXT,
    timezone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION updated_at_trigger();

-- Assuming auth.users is already provided by Supabase
CREATE TABLE members (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    job_title TEXT,
    organization_role TEXT CHECK (organization_role IN ('Organization Admin', 'Project Manager', 'Member')) DEFAULT 'Member',
    avatar_url TEXT,
    status TEXT CHECK (status IN ('Active', 'Inactive', 'Invited')) DEFAULT 'Invited',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_members_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION updated_at_trigger();

CREATE TABLE organization_standards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    engineering_standards JSONB DEFAULT '{}',
    coding_standards JSONB DEFAULT '{}',
    review_standards JSONB DEFAULT '{}',
    qa_standards JSONB DEFAULT '{}',
    meeting_templates JSONB DEFAULT '{}',
    project_templates JSONB DEFAULT '{}',
    role_templates JSONB DEFAULT '{}',
    branch_naming_rules TEXT,
    definition_of_done JSONB DEFAULT '{}',
    working_principles JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_organization_standards_updated_at BEFORE UPDATE ON organization_standards FOR EACH ROW EXECUTE FUNCTION updated_at_trigger();

-- --------------------------------------------------------
-- 2. PROJECT MANAGEMENT
-- --------------------------------------------------------

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    project_manager_id UUID REFERENCES members(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    business_goals TEXT,
    target_users TEXT,
    success_metrics TEXT,
    status TEXT CHECK (status IN ('Draft', 'Planning', 'Active', 'On Hold', 'Completed', 'Archived')) DEFAULT 'Draft',
    start_date DATE,
    end_date DATE,
    github_repository TEXT,
    swagger_url TEXT,
    figma_url TEXT,
    cloudinary_folder TEXT,
    priority TEXT CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')) DEFAULT 'Medium',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION updated_at_trigger();

CREATE TABLE project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    project_role TEXT NOT NULL,
    responsibilities TEXT,
    review_authority BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (project_id, member_id)
);

CREATE TABLE project_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT CHECK (category IN ('Requirements', 'Architecture', 'Research', 'Meeting Minutes', 'Contracts', 'Other')) DEFAULT 'Other',
    cloudinary_url TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    uploaded_by UUID REFERENCES members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_project_documents_updated_at BEFORE UPDATE ON project_documents FOR EACH ROW EXECUTE FUNCTION updated_at_trigger();

-- --------------------------------------------------------
-- 3. PRODUCT PLANNING (ROADMAP & MODULES)
-- --------------------------------------------------------

CREATE TABLE roadmaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_roadmaps_updated_at BEFORE UPDATE ON roadmaps FOR EACH ROW EXECUTE FUNCTION updated_at_trigger();

CREATE TABLE modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    roadmap_id UUID REFERENCES roadmaps(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    objectives TEXT,
    status TEXT CHECK (status IN ('Not Started', 'In Progress', 'Completed')) DEFAULT 'Not Started',
    priority TEXT CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')) DEFAULT 'Medium',
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_modules_updated_at BEFORE UPDATE ON modules FOR EACH ROW EXECUTE FUNCTION updated_at_trigger();

-- --------------------------------------------------------
-- 4. SPRINTS
-- --------------------------------------------------------

CREATE TABLE sprints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    goal TEXT,
    definition_of_success TEXT,
    risks TEXT,
    start_date DATE,
    end_date DATE,
    status TEXT CHECK (status IN ('Planning', 'Active', 'Review', 'Completed')) DEFAULT 'Planning',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_sprints_updated_at BEFORE UPDATE ON sprints FOR EACH ROW EXECUTE FUNCTION updated_at_trigger();

CREATE TABLE sprint_retrospectives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sprint_id UUID UNIQUE REFERENCES sprints(id) ON DELETE CASCADE,
    what_went_well TEXT,
    what_didnt_go_well TEXT,
    lessons_learned TEXT,
    process_improvements TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_sprint_retrospectives_updated_at BEFORE UPDATE ON sprint_retrospectives FOR EACH ROW EXECUTE FUNCTION updated_at_trigger();

-- --------------------------------------------------------
-- 5. ENGINEERING EXECUTION (FEATURES)
-- --------------------------------------------------------

CREATE TABLE features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
    sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    business_value TEXT,
    requirements TEXT,
    acceptance_criteria TEXT,
    user_stories TEXT,
    technical_notes TEXT,
    api_links TEXT,
    design_links TEXT,
    priority TEXT CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')) DEFAULT 'Medium',
    status TEXT CHECK (status IN ('Idea', 'Requirements', 'Design', 'Development', 'Integration', 'Testing', 'Approval', 'Released')) DEFAULT 'Idea',
    start_date DATE,
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_features_updated_at BEFORE UPDATE ON features FOR EACH ROW EXECUTE FUNCTION updated_at_trigger();

CREATE TABLE feature_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feature_id UUID REFERENCES features(id) ON DELETE CASCADE,
    depends_on_feature_id UUID REFERENCES features(id) ON DELETE CASCADE,
    dependency_type TEXT CHECK (dependency_type IN ('Blocks', 'Blocked By', 'Relates To')) DEFAULT 'Blocks',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE feature_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feature_id UUID REFERENCES features(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    responsibility TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE feature_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feature_id UUID REFERENCES features(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_by UUID REFERENCES members(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_feature_checklists_updated_at BEFORE UPDATE ON feature_checklists FOR EACH ROW EXECUTE FUNCTION updated_at_trigger();

-- --------------------------------------------------------
-- 6. DAILY COORDINATION
-- --------------------------------------------------------

CREATE TABLE daily_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    sprint_id UUID REFERENCES sprints(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    yesterday TEXT,
    today TEXT,
    blockers TEXT,
    risks TEXT,
    help_needed TEXT,
    manager_comments TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_daily_updates_updated_at BEFORE UPDATE ON daily_updates FOR EACH ROW EXECUTE FUNCTION updated_at_trigger();

-- --------------------------------------------------------
-- 7. MEETINGS
-- --------------------------------------------------------

CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    objective TEXT,
    agenda TEXT,
    meeting_link TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    minutes TEXT,
    decisions TEXT,
    created_by UUID REFERENCES members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_meetings_updated_at BEFORE UPDATE ON meetings FOR EACH ROW EXECUTE FUNCTION updated_at_trigger();

CREATE TABLE meeting_action_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    assigned_to UUID REFERENCES members(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('Pending', 'In Progress', 'Completed')) DEFAULT 'Pending',
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_meeting_action_items_updated_at BEFORE UPDATE ON meeting_action_items FOR EACH ROW EXECUTE FUNCTION updated_at_trigger();

-- --------------------------------------------------------
-- 8. DELIVERABLES, REVIEWS & COMMENTS
-- --------------------------------------------------------

CREATE TABLE deliverables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type TEXT CHECK (entity_type IN ('Feature', 'Meeting', 'Project')) NOT NULL,
    entity_id UUID NOT NULL,
    member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    type TEXT CHECK (type IN ('GitHub PR', 'Figma Link', 'API Doc', 'Document', 'Video', 'Screenshot', 'Demo', 'Commit', 'Deployment URL')),
    link TEXT,
    description TEXT,
    status TEXT CHECK (status IN ('Pending', 'Submitted', 'Reviewed', 'Approved', 'Rejected')) DEFAULT 'Pending',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_deliverables_updated_at BEFORE UPDATE ON deliverables FOR EACH ROW EXECUTE FUNCTION updated_at_trigger();

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deliverable_id UUID REFERENCES deliverables(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES members(id) ON DELETE SET NULL,
    decision TEXT CHECK (decision IN ('Pending', 'Approved', 'Changes Requested', 'Rejected')) DEFAULT 'Pending',
    comments TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION updated_at_trigger();

CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type TEXT CHECK (entity_type IN ('Feature', 'Deliverable', 'Meeting', 'Project', 'Module')) NOT NULL,
    entity_id UUID NOT NULL,
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION updated_at_trigger();

-- --------------------------------------------------------
-- 9. RELEASE MANAGEMENT & LOGGING
-- --------------------------------------------------------

CREATE TABLE releases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    title TEXT,
    release_notes TEXT,
    deployment_checklist JSONB DEFAULT '[]',
    rollback_plan TEXT,
    release_date DATE,
    status TEXT CHECK (status IN ('Planned', 'Staging', 'Released', 'Rolled Back')) DEFAULT 'Planned',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_releases_updated_at BEFORE UPDATE ON releases FOR EACH ROW EXECUTE FUNCTION updated_at_trigger();

CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT,
    entity_type TEXT,
    entity_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS)
-- --------------------------------------------------------

-- Enable RLS on all tables to prevent anonymous access by default
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprint_retrospectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE features ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Baseline Policies: Allow full access ONLY to authenticated users.
-- (Prevents public/anonymous API requests from reading or modifying your data)
CREATE POLICY "Authenticated access for organizations" ON organizations FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for members" ON members FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for organization_standards" ON organization_standards FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for projects" ON projects FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for project_members" ON project_members FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for project_documents" ON project_documents FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for roadmaps" ON roadmaps FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for modules" ON modules FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for sprints" ON sprints FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for sprint_retrospectives" ON sprint_retrospectives FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for features" ON features FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for feature_dependencies" ON feature_dependencies FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for feature_members" ON feature_members FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for feature_checklists" ON feature_checklists FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for daily_updates" ON daily_updates FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for meetings" ON meetings FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for meeting_action_items" ON meeting_action_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for deliverables" ON deliverables FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for reviews" ON reviews FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for comments" ON comments FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for releases" ON releases FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for activity_logs" ON activity_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access for notifications" ON notifications FOR ALL TO authenticated USING (true);
