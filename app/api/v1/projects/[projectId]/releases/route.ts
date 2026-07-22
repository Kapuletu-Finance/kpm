import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity.server';
import { z } from 'zod';

const releaseSchema = z.object({
  version: z.string().min(1, 'Version is required'),
  title: z.string().optional(),
  release_notes: z.string().optional(),
  deployment_checklist: z.array(z.any()).optional().default([]),
  rollback_plan: z.string().optional(),
  release_date: z.string().optional().nullable(),
  status: z.enum(['Planned', 'Staging', 'Released', 'Rolled Back']).default('Planned'),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: releases, error } = await supabase
      .from('releases')
      .select(`
        *,
        features:features (
          id,
          title,
          status
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(releases);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const result = releaseSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || 'Validation error' }, { status: 400 });
    }

    const { data: release, error } = await supabase
      .from('releases')
      .insert({
        project_id: projectId,
        version: result.data.version,
        title: result.data.title || null,
        release_notes: result.data.release_notes || null,
        deployment_checklist: result.data.deployment_checklist,
        rollback_plan: result.data.rollback_plan || null,
        release_date: result.data.release_date || null,
        status: result.data.status,
      })
      .select()
      .single();

    if (error) throw error;
    
    // Log the activity
    await logActivity({
      supabase,
      projectId,
      memberId: user.id,
      action: 'Created',
      entityType: 'Release',
      entityId: release.id,
      description: `Drafted a new release: ${release.version} ${release.title ? `- ${release.title}` : ''}`
    });

    return NextResponse.json(release, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
