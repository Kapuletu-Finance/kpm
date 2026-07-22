import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const query = url.searchParams.get('q');
    
    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    const searchQuery = `%${query}%`;

    // Fetch projects where user is member
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, description, project_members!inner(member_id)')
      .eq('project_members.member_id', user.id)
      .or(`name.ilike.${searchQuery},description.ilike.${searchQuery}`)
      .limit(5);

    // Fetch features where user's projects are
    // We will join features -> modules -> roadmaps -> projects -> project_members
    const { data: features } = await supabase
      .from('features')
      .select('id, title, description, module_id, modules!inner(roadmaps!inner(project_id, projects!inner(project_members!inner(member_id))))')
      .eq('modules.roadmaps.projects.project_members.member_id', user.id)
      .or(`title.ilike.${searchQuery},description.ilike.${searchQuery}`)
      .limit(5);

    // Fetch meetings
    const { data: meetings } = await supabase
      .from('meetings')
      .select('id, title, project_id, projects!inner(project_members!inner(member_id))')
      .eq('projects.project_members.member_id', user.id)
      .ilike('title', searchQuery)
      .limit(5);

    // Fetch members from the user's organization
    const { data: callerMember } = await supabase
      .from('members')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    let members: any[] = [];
    if (callerMember?.organization_id) {
      const { data } = await supabase
        .from('members')
        .select('id, first_name, last_name, email, avatar_url')
        .eq('organization_id', callerMember.organization_id)
        .or(`first_name.ilike.${searchQuery},last_name.ilike.${searchQuery},email.ilike.${searchQuery}`)
        .limit(5);
      members = data || [];
    }

    const results = [
      ...(projects || []).map(p => ({
        type: 'Project',
        id: p.id,
        title: p.name,
        subtitle: p.description,
        url: `/workspace/projects/${p.id}`
      })),
      ...(features || []).map(f => {
        // extract projectId from nested relations
        const projectId = (f.modules as any)?.roadmaps?.project_id;
        return {
          type: 'Feature',
          id: f.id,
          title: f.title,
          subtitle: f.description,
          url: projectId ? `/workspace/projects/${projectId}/features/${f.id}` : '#'
        };
      }),
      ...(meetings || []).map(m => ({
        type: 'Meeting',
        id: m.id,
        title: m.title,
        subtitle: `Project Meeting`,
        url: `/workspace/projects/${m.project_id}/meetings`
      })),
      ...members.map(m => ({
        type: 'Member',
        id: m.id,
        title: `${m.first_name} ${m.last_name}`,
        subtitle: m.email,
        avatar_url: m.avatar_url,
        url: `/workspace/organization`
      }))
    ];

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
