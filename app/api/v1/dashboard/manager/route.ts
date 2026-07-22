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

    if (!memberProfile || !['Organization Admin', 'Project Manager'].includes(memberProfile.organization_role)) {
      return NextResponse.json({ error: 'Forbidden. Requires Manager role.' }, { status: 403 });
    }

    // 1. Projects managed by user
    const { data: managedProjects, count: managedCount } = await supabase
      .from('projects')
      .select('id, name, status, priority, end_date', { count: 'exact' })
      .eq('project_manager_id', user.id);

    const projectIds = managedProjects?.map(p => p.id) || [];
    
    let actionNeededFeatures: any[] = [];
    let pendingReviews: any[] = [];
    
    if (projectIds.length > 0) {
      // Run dependent queries concurrently
      const [featuresRes, deliverablesRes] = await Promise.all([
        supabase
          .from('features')
          .select('id, title, status, priority, modules!inner(roadmaps!inner(project_id, projects(name)))')
          .in('modules.roadmaps.project_id', projectIds)
          .in('status', ['In Review', 'Blocked'])
          .limit(10),
          
        supabase
          .from('deliverables')
          .select('id, title, status, entity_type, entity_id, member_id, members(first_name, last_name)')
          .eq('status', 'In Review')
          .limit(10)
      ]);
      
      const featuresData = featuresRes.data;
      const deliverablesData = deliverablesRes.data;
      
      actionNeededFeatures = (featuresData || []).map(f => ({
        id: f.id,
        title: f.title,
        status: f.status,
        priority: f.priority,
        project_id: (f.modules as any)?.roadmaps?.project_id,
        project_name: (f.modules as any)?.roadmaps?.projects?.name
      }));
      
      pendingReviews = deliverablesData || [];
    }

    return NextResponse.json({
      stats: {
        managedProjects: managedCount || 0,
        actionNeededFeatures: actionNeededFeatures.length,
        pendingReviews: pendingReviews.length,
      },
      managedProjects: managedProjects || [],
      actionNeededFeatures,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
