import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface SettingsBody {
  enabled?: boolean;
  customer_id?: string | null;
  login_customer_id?: string | null;
  conversion_action_id?: string | null;
  conversion_label?: string | null;
  default_value?: number;
  currency?: string;
  send_enhanced_conversions?: boolean;
}

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
  return { ok: true as const, supabase, userId: user.id };
}

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: auth.status });
  }

  const { data, error } = await auth.supabase
    .from('google_ads_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'fetch_failed', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ settings: data });
}

export async function PUT(request: Request) {
  const auth = await assertAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as SettingsBody | null;
  if (!body) {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Normalisation : retire les espaces et tirets sur customer_id (les users
  // copient souvent depuis Google Ads avec le format "123-456-7890")
  const customerId = body.customer_id ? body.customer_id.replace(/[^0-9]/g, '') : null;
  const loginCustomerId = body.login_customer_id
    ? body.login_customer_id.replace(/[^0-9]/g, '')
    : null;
  const conversionActionId = body.conversion_action_id
    ? body.conversion_action_id.replace(/[^0-9]/g, '')
    : null;

  const update = {
    enabled: body.enabled ?? false,
    customer_id: customerId || null,
    login_customer_id: loginCustomerId || null,
    conversion_action_id: conversionActionId || null,
    conversion_label: body.conversion_label?.trim() || null,
    default_value: typeof body.default_value === 'number' ? body.default_value : 0,
    currency: body.currency?.trim().toUpperCase() || 'EUR',
    send_enhanced_conversions: body.send_enhanced_conversions ?? true,
    updated_by: auth.userId,
  };

  const { data, error } = await auth.supabase
    .from('google_ads_settings')
    .update(update)
    .eq('id', 1)
    .select('*')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ settings: data });
}
