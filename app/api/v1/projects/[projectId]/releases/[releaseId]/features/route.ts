import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const assignFeaturesSchema = z.object({
  featureIds: z.array(z.string().uuid()),
  action: z.enum(['assign', 'remove']),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string, releaseId: string }> }) {
  try {
    const { projectId, releaseId } = await params;
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const result = assignFeaturesSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || 'Validation error' }, { status: 400 });
    }

    const { featureIds, action } = result.data;
    
    if (featureIds.length === 0) {
      return NextResponse.json({ success: true });
    }

    // Verify release belongs to project
    const { data: release, error: releaseError } = await supabase
      .from('releases')
      .select('id')
      .eq('id', releaseId)
      .eq('project_id', projectId)
      .single();
      
    if (releaseError || !release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }

    // Update features
    const { error } = await supabase
      .from('features')
      .update({ release_id: action === 'assign' ? releaseId : null })
      .in('id', featureIds);

    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
