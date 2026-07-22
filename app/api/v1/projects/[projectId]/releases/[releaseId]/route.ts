import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const releaseUpdateSchema = z.object({
  title: z.string().optional(),
  release_notes: z.string().optional(),
  deployment_checklist: z.array(z.any()).optional(),
  rollback_plan: z.string().optional(),
  release_date: z.string().optional().nullable(),
  status: z.enum(['Planned', 'Staging', 'Released', 'Rolled Back']).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string, releaseId: string }> }) {
  try {
    const { projectId, releaseId } = await params;
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: release, error } = await supabase
      .from('releases')
      .select(`
        *,
        features:features (
          id,
          title,
          status,
          priority
        )
      `)
      .eq('id', releaseId)
      .eq('project_id', projectId)
      .single();

    if (error) throw error;
    return NextResponse.json(release);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string, releaseId: string }> }) {
  try {
    const { projectId, releaseId } = await params;
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const result = releaseUpdateSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || 'Validation error' }, { status: 400 });
    }

    const { data: release, error } = await supabase
      .from('releases')
      .update(result.data)
      .eq('id', releaseId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) throw error;
    
    return NextResponse.json(release);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
