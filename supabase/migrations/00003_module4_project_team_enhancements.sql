-- Migration: Module 4 Project Team Enhancements
-- Description: Adds functional_role and role_responsibilities to project_members

ALTER TABLE public.project_members
ADD COLUMN IF NOT EXISTS functional_role VARCHAR(255),
ADD COLUMN IF NOT EXISTS role_responsibilities JSONB DEFAULT '[]'::jsonb;

-- Comment for PostgREST
COMMENT ON COLUMN public.project_members.functional_role IS 'The specific job title or role the member plays in this project (e.g., UI/UX Designer)';
COMMENT ON COLUMN public.project_members.role_responsibilities IS 'A structured JSON array of strings defining the member''s key responsibilities';
