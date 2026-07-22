import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is an admin of the organization
    const { data: member } = await supabase
      .from('members')
      .select('organization_role')
      .eq('id', user.id)
      .single();
    
    if (!member || member.organization_role !== 'Organization Admin') {
      return NextResponse.json({ error: 'Not authorized for organization logs' }, { status: 403 });
    }

    // Parse query params for pagination
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Fetch all activity logs across the workspace
    const { data: logs, error, count } = await supabase
      .from('activity_logs')
      .select(`
        *,
        member:members(id, first_name, last_name, avatar_url, role:organization_role),
        project:projects(id, name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    
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
