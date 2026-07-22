import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const now = new Date().toISOString();

    // 1. Projects where user is a member
    const { data: projectMembers, error: pmError } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('member_id', user.id);
    
    if (pmError) throw pmError;
    const projectIds = projectMembers?.map(pm => pm.project_id) || [];

    // Count Active Projects
    let activeProjectsCount = 0;
    if (projectIds.length > 0) {
      const { count } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .in('id', projectIds)
        .eq('status', 'Active');
      activeProjectsCount = count || 0;
    }

    // 2. Assigned Features
    const { data: assignedFeaturesData } = await supabase
      .from('feature_members')
      .select('feature_id')
      .eq('member_id', user.id);
    
    const featureIds = assignedFeaturesData?.map(fm => fm.feature_id) || [];
    
    let assignedFeatures: any[] = [];
    if (featureIds.length > 0) {
      const { data } = await supabase
        .from('features')
        .select('id, title, status, priority, due_date, modules!inner(roadmaps!inner(project_id, projects(id, name)))')
        .in('id', featureIds)
        .not('status', 'eq', 'Released')
        .order('due_date', { ascending: true })
        .limit(5);
      
      assignedFeatures = (data || []).map(f => ({
        id: f.id,
        title: f.title,
        status: f.status,
        priority: f.priority,
        due_date: f.due_date,
        project_id: (f.modules as any)?.roadmaps?.project_id,
        project_name: (f.modules as any)?.roadmaps?.projects?.name
      }));
    }

    const totalAssignedFeatures = featureIds.length; // Approximate total

    // 3. Pending Deliverables
    const { data: deliverablesData, count: pendingDeliverablesCount } = await supabase
      .from('deliverables')
      .select('id, title, status, due_date, entity_type, entity_id', { count: 'exact' })
      .eq('member_id', user.id)
      .neq('status', 'Approved')
      .order('due_date', { ascending: true })
      .limit(5);

    const pendingDeliverables = deliverablesData || [];

    // 4. Upcoming Meetings
    let upcomingMeetings: any[] = [];
    let upcomingMeetingsCount = 0;
    
    if (projectIds.length > 0) {
      const { data: meetingsData, count: meetingsCount } = await supabase
        .from('meetings')
        .select('id, title, date, start_time, type, project_id, projects(name)', { count: 'exact' })
        .in('project_id', projectIds)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(5);

      upcomingMeetings = (meetingsData || []).map(m => ({
        id: m.id,
        title: m.title,
        date: m.date,
        start_time: m.start_time,
        type: m.type,
        project_id: m.project_id,
        project_name: (m.projects as any)?.name
      }));
      upcomingMeetingsCount = meetingsCount || 0;
    }

    return NextResponse.json({
      stats: {
        activeProjects: activeProjectsCount,
        assignedFeatures: totalAssignedFeatures,
        pendingDeliverables: pendingDeliverablesCount || 0,
        upcomingMeetings: upcomingMeetingsCount
      },
      assignedFeatures,
      pendingDeliverables,
      upcomingMeetings
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
