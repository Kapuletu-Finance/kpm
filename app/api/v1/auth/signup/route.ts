import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  organizationName: z.string().min(2, 'Organization name is required'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = signupSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password, fullName, organizationName } = result.data;
    const supabase = await createClient(); // Current user context
    const adminSupabase = createAdminClient(); // Bypasses RLS for initial org setup

    // 1. Create the user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const user = authData.user;
    if (!user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // 2. Create Organization using Admin Client
    const slug =
      organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') +
      '-' +
      Math.random().toString(36).substring(2, 6);

    const { data: orgData, error: orgError } = await adminSupabase
      .from('organizations')
      .insert({
        name: organizationName,
        slug: slug,
      })
      .select('id')
      .single();

    if (orgError || !orgData) {
      console.error('Org creation error:', orgError);
      return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
    }

    // 3. Create Member linking User to Organization
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || ' ';

    const { error: memberError } = await adminSupabase
      .from('members')
      .insert({
        id: user.id,
        organization_id: orgData.id,
        first_name: firstName,
        last_name: lastName,
        email: email,
        organization_role: 'Organization Admin',
        status: 'Active',
      });

    if (memberError) {
      console.error('Member creation error:', memberError);
      return NextResponse.json({ error: 'Failed to assign organization role' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Signup successful',
      user: user,
      organizationId: orgData.id,
      session: authData.session,
    });
  } catch (err: any) {
    console.error('Signup exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
