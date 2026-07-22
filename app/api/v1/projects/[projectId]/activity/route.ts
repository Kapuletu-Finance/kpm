import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();
    
    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is part of the project
    const { data: projectMember } = await supabase
      .from('project_members')
      .select('member_id')
      .eq('project_id', projectId)
      .limit(1)
      .single();

    if (!projectMember) {
      // also check if they are an admin in the org... for simplicity we assume project member or org admin
      const { data: member } = await supabase
        .from('members')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
        return NextResponse.json({ error: 'Not authorized for this project' }, { status: 403 });
      }
    }

    // Parse query params for pagination
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Fetch activity logs
    const { data: logs, error, count } = await supabase
      .from('activity_logs')
      .select(`
        *,
        member:members(id, first_name, last_name, avatar_url, role:organization_role)
      `, { count: 'exact' })
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Get user profiles from Clerk/Auth for the members if needed, 
    // but typically we can just return the data and let the frontend cross-reference the team hook.
    
    return NextResponse.json({
      data: logs,
      count,
      offset,
      limit
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
