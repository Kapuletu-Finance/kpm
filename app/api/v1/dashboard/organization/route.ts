import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: memberProfile } = await supabase
      .from('members')
      .select('organization_id, organization_role')
      .eq('id', user.id)
      .single();

    if (!memberProfile || memberProfile.organization_role !== 'Organization Admin') {
      return NextResponse.json({ error: 'Forbidden. Requires Organization Admin role.' }, { status: 403 });
    }

    const orgId = memberProfile.organization_id;

    // Run all independent queries concurrently to eliminate waterfall
    const [
      { data: projectsData, count: projectsCount },
      { count: membersCount },
      { count: invitesCount }
    ] = await Promise.all([
      // 1. Projects summary
      supabase
        .from('projects')
        .select('id, name, status, priority, end_date, members!projects_project_manager_id_fkey(first_name, last_name)', { count: 'exact' })
        .eq('organization_id', orgId),
      
      // 2. Members count
      supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'Active'),
        
      // 3. Pending Invites
      supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'Invited')
    ]);

    const activeProjectsCount = projectsData?.filter(p => p.status === 'Active').length || 0;
    
    const projectList = (projectsData || []).map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      priority: p.priority,
      end_date: p.end_date,
      manager_name: p.members ? `${(p.members as any).first_name} ${(p.members as any).last_name}` : 'Unassigned',
    }));

    return NextResponse.json({
      stats: {
        totalProjects: projectsCount || 0,
        activeProjects: activeProjectsCount,
        activeMembers: membersCount || 0,
        pendingInvites: invitesCount || 0,
      },
      projects: projectList,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
