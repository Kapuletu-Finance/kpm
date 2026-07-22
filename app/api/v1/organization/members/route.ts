import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });
    }

    // We use the admin client because the RPC function `get_org_members_with_auth` uses SECURITY DEFINER
    // and returns `last_sign_in_at` from the auth schema.
    const adminSupabase = createAdminClient();
    const { data: members, error: membersError } = await adminSupabase
      .rpc('get_org_members_with_auth', { org_id: member.organization_id });

    if (membersError) {
      // Fallback to standard members query if the migration hasn't been applied yet
      const { data: fallbackMembers, error: fallbackError } = await supabase
        .from('members')
        .select('*')
        .eq('organization_id', member.organization_id)
        .order('created_at', { ascending: false });
        
      if (fallbackError) {
        return NextResponse.json({ error: fallbackError.message }, { status: 400 });
      }
      return NextResponse.json(fallbackMembers);
    }

    return NextResponse.json(members);
  } catch (err: any) {
    console.error('Members GET exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('id');

    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify caller is Org Admin
    const { data: caller, error: callerError } = await supabase
      .from('members')
      .select('organization_role, organization_id')
      .eq('id', user.id)
      .single();

    if (callerError || !caller || caller.organization_role !== 'Organization Admin') {
      return NextResponse.json({ error: 'Forbidden. Only Organization Admins can remove members.' }, { status: 403 });
    }

    const adminSupabase = createAdminClient();

    // Verify the target member is in the same org
    const { data: targetMember } = await adminSupabase
      .from('members')
      .select('organization_id')
      .eq('id', memberId)
      .single();

    if (!targetMember || targetMember.organization_id !== caller.organization_id) {
       return NextResponse.json({ error: 'Member not found in your organization' }, { status: 404 });
    }

    // Prevent removing oneself
    if (memberId === user.id) {
       return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
    }

    const { error: deleteError } = await adminSupabase
      .from('members')
      .delete()
      .eq('id', memberId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    // Optional: Delete user from Supabase Auth as well to fully revoke access
    await adminSupabase.auth.admin.deleteUser(memberId);

    return NextResponse.json({ message: 'Member removed successfully' });
  } catch (err: any) {
    console.error('Members DELETE exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
