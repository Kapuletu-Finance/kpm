import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateStandardsSchema = z.object({
  engineering_standards: z.array(z.string()).optional(),
  coding_standards: z.array(z.string()).optional(),
  review_standards: z.array(z.string()).optional(),
  qa_standards: z.array(z.string()).optional(),
  meeting_templates: z.array(z.string()).optional(),
  project_templates: z.array(z.string()).optional(),
  role_templates: z.array(z.string()).optional(),
  branch_naming_rules: z.string().optional(),
  definition_of_done: z.array(z.string()).optional(),
  working_principles: z.array(z.string()).optional(),
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

    // Try to get standards, if they don't exist, create an empty record
    let { data: standards, error: standardsError } = await supabase
      .from('organization_standards')
      .select('*')
      .eq('organization_id', member.organization_id)
      .single();

    if (standardsError && standardsError.code === 'PGRST116') {
      // Create empty standards record
      const { data: newStandards, error: createError } = await supabase
        .from('organization_standards')
        .insert([{ organization_id: member.organization_id }])
        .select()
        .single();
        
      if (createError) {
        return NextResponse.json({ error: 'Failed to initialize standards' }, { status: 500 });
      }
      standards = newStandards;
    } else if (standardsError) {
      return NextResponse.json({ error: 'Failed to fetch standards' }, { status: 500 });
    }

    // Parse JSON fields
    const parsedStandards = { ...standards };
    const jsonFields = [
      'engineering_standards', 'coding_standards', 'review_standards', 'qa_standards', 
      'meeting_templates', 'project_templates', 'role_templates', 'definition_of_done', 'working_principles'
    ];
    
    for (const field of jsonFields) {
      if (typeof parsedStandards[field] === 'string') {
        try {
          parsedStandards[field] = JSON.parse(parsedStandards[field]);
        } catch {
          parsedStandards[field] = [];
        }
      }
    }

    return NextResponse.json(parsedStandards);
  } catch (err: any) {
    console.error('Organization Standards GET exception:', err);
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
    const validatedData = updateStandardsSchema.parse(body);

    // Transform array to stringified JSON if needed
    const payload: any = {};
    for (const [key, value] of Object.entries(validatedData)) {
      if (Array.isArray(value)) {
        payload[key] = JSON.stringify(value);
      } else if (value !== undefined) {
        payload[key] = value;
      }
    }

    const { data: updatedStandards, error: updateError } = await supabase
      .from('organization_standards')
      .update(payload)
      .eq('organization_id', member.organization_id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json(updatedStandards);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error('Organization Standards PATCH exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
