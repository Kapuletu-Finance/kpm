-- Migration: Add invited_at and last_sign_in_at tracking
-- Add invited_at to members table
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;

-- Drop existing function if it exists to avoid conflicts
DROP FUNCTION IF EXISTS public.get_org_members_with_auth;

-- Create secure RPC function to join members with auth.users
-- This function runs with security definer to bypass RLS on auth.users for this specific query
CREATE OR REPLACE FUNCTION public.get_org_members_with_auth(org_id UUID)
RETURNS TABLE (
    id UUID,
    organization_id UUID,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone_number TEXT,
    avatar_url TEXT,
    organization_role TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    invited_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.organization_id,
        m.first_name,
        m.last_name,
        m.email,
        m.phone_number,
        m.avatar_url,
        m.organization_role,
        m.status,
        m.created_at,
        m.updated_at,
        m.invited_at,
        au.last_sign_in_at
    FROM public.members m
    LEFT JOIN auth.users au ON m.id = au.id
    WHERE m.organization_id = org_id
    ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant access to authenticated users and service_role
GRANT EXECUTE ON FUNCTION public.get_org_members_with_auth(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_members_with_auth(UUID) TO service_role;
