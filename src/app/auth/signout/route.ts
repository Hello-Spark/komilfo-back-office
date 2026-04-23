import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildPublicUrl } from '@/lib/public-url';

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(buildPublicUrl(request, '/signin'), { status: 303 });
}
