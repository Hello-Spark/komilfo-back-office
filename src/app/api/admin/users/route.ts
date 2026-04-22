import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 as const };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin') {
    return { ok: false, status: 403 as const };
  }
  return { ok: true as const };
}

export async function POST(request: Request) {
  const auth = await assertAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { email, password, first_name, last_name, role, magasin_id } = body as {
    email?: string;
    password?: string;
    first_name?: string;
    last_name?: string;
    role?: 'admin' | 'employe_magasin';
    magasin_id?: string | null;
  };

  if (!email || !password || !role) {
    return NextResponse.json(
      { error: 'missing_fields', detail: 'email, password, role requis' },
      { status: 400 },
    );
  }

  if (role === 'employe_magasin' && !magasin_id) {
    return NextResponse.json(
      { error: 'missing_magasin', detail: 'Un employé magasin doit être rattaché à un magasin' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: first_name ?? null,
      last_name: last_name ?? null,
      role,
      magasin_id: role === 'employe_magasin' ? magasin_id : null,
    },
  });

  if (error) {
    return NextResponse.json({ error: 'auth_create_failed', detail: error.message }, { status: 400 });
  }

  return NextResponse.json({ user_id: data.user?.id }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await assertAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ error: 'missing_user_id' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: 'delete_failed', detail: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
