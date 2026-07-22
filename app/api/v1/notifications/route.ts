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

    // Get member ID for the current user
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });
    }

    // Parse query params
    const url = new URL(req.url);
    const filter = url.searchParams.get('filter'); // 'all', 'unread'
    const type = url.searchParams.get('type'); // 'Assignment', 'Review', 'Mention', etc.

    // Fetch notifications
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('member_id', member.id)
      .order('created_at', { ascending: false });

    if (filter === 'unread') {
      query = query.eq('is_read', false);
    }
    
    if (type && type !== 'All') {
      query = query.eq('type', type);
    }

    const { data: notifications, error } = await query.limit(200); // Get up to 200 for inbox

    if (error) throw error;

    return NextResponse.json(notifications);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
