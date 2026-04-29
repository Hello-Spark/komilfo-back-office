import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendConversionForLead } from '@/lib/googleAds/sendConversion';

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 as const };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin') {
    return { ok: false as const, status: 403 as const };
  }
  return { ok: true as const, userId: user.id };
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: leadId } = await context.params;

  const auth = await assertAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: auth.status });
  }

  const admin = createAdminClient();
  const outcome = await sendConversionForLead({
    admin,
    leadId,
    triggeredBy: auth.userId,
  });

  switch (outcome.kind) {
    case 'success':
      return NextResponse.json({
        ok: true,
        identifier_used: outcome.identifierUsed,
      });
    case 'skipped':
      return NextResponse.json({ ok: false, skipped: outcome.reason });
    case 'error':
      return NextResponse.json(
        { ok: false, error: 'upload_failed', detail: outcome.message },
        { status: outcome.message === 'lead_not_found' ? 404 : 502 },
      );
  }
}
