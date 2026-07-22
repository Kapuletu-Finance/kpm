import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  industry: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  country: z.string().optional(),
  timezone: z.string().optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
});

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

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', member.organization_id)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json(org);
  } catch (err: any) {
    console.error('Organization GET exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: member } = await supabase
      .from('members')
      .select('organization_id, organization_role')
      .eq('id', user.id)
      .single();

    if (!member || member.organization_role !== 'Organization Admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateOrgSchema.parse(body);

    const { data: updatedOrg, error: updateError } = await supabase
      .from('organizations')
      .update(validatedData)
      .eq('id', member.organization_id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json(updatedOrg);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error('Organization PATCH exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: member } = await supabase
      .from('members')
      .select('organization_id, organization_role')
      .eq('id', user.id)
      .single();

    if (!member || member.organization_role !== 'Organization Admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Relying on CASCADE DELETE setup in the database to remove members, projects, features, etc.
    const { error: deleteError } = await supabase
      .from('organizations')
      .delete()
      .eq('id', member.organization_id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    // Log the user out of supabase so their session is completely dead
    await supabase.auth.signOut();

    return NextResponse.json({ message: 'Organization deleted' });
  } catch (err: any) {
    console.error('Organization DELETE exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
