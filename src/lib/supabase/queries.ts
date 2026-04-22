import { createClient } from './server';
import type { Profile, LeadFull, LeadStatus, Magasin } from './types';

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  return data ?? null;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'admin') {
    throw new Error('forbidden');
  }
  return profile;
}

export async function listProfiles(): Promise<
  (Profile & { magasin_name: string | null })[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('*, magasin:magasins(name)')
    .order('created_at', { ascending: false });

  return (
    data?.map((p) => ({
      ...p,
      magasin_name:
        (p as { magasin: { name: string } | null }).magasin?.name ?? null,
    })) ?? []
  );
}

export async function listMagasins(): Promise<Magasin[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('magasins')
    .select('*')
    .eq('active', true)
    .order('name');
  return data ?? [];
}

export async function getLeads(params?: {
  type?: 'devis' | 'sav';
  status?: string;
  limit?: number;
}): Promise<LeadFull[]> {
  const supabase = await createClient();
  let query = supabase
    .from('leads_full')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(params?.limit ?? 50);

  if (params?.type) query = query.eq('type', params.type);
  if (params?.status) query = query.eq('status', params.status);

  const { data } = await query;
  return (data as LeadFull[] | null) ?? [];
}

export async function getLeadById(id: string): Promise<LeadFull | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('leads_full')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return (data as LeadFull | null) ?? null;
}

export interface LeadStatsRow {
  status: LeadStatus;
  total: number;
  last_7d: number;
  last_30d: number;
}

export async function getLeadStatsByStatus(): Promise<LeadStatsRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('leads_stats_by_status')
    .select('status, total, last_7d, last_30d');
  if (!data) return [];

  const grouped: Record<string, LeadStatsRow> = {};
  for (const row of data as Array<{
    status: LeadStatus;
    total: number | null;
    last_7d: number | null;
    last_30d: number | null;
  }>) {
    const current = grouped[row.status] ?? {
      status: row.status,
      total: 0,
      last_7d: 0,
      last_30d: 0,
    };
    current.total += Number(row.total ?? 0);
    current.last_7d += Number(row.last_7d ?? 0);
    current.last_30d += Number(row.last_30d ?? 0);
    grouped[row.status] = current;
  }
  return Object.values(grouped);
}

export interface LeadDailyPoint {
  date: string;
  count: number;
}

export async function getLeadsTimeseries(days = 30): Promise<LeadDailyPoint[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from('leads')
    .select('created_at')
    .gte('created_at', since);

  const counts: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 24 * 3600 * 1000);
    const key = d.toISOString().slice(0, 10);
    counts[key] = 0;
  }
  (data ?? []).forEach((row: { created_at: string }) => {
    const key = row.created_at.slice(0, 10);
    if (key in counts) counts[key] += 1;
  });

  return Object.entries(counts).map(([date, count]) => ({ date, count }));
}

export interface LeadProductBreakdown {
  code: string;
  label: string;
  count: number;
}

export async function getLeadsByProduct(): Promise<LeadProductBreakdown[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('lead_produits')
    .select('produit:produits(code, label, sort_order)');

  const map: Record<string, LeadProductBreakdown & { sort: number }> = {};
  (data ?? []).forEach((row) => {
    const raw = (row as unknown as {
      produit: { code: string; label: string; sort_order: number } | { code: string; label: string; sort_order: number }[] | null;
    }).produit;
    const p = Array.isArray(raw) ? raw[0] : raw;
    if (!p) return;
    const key = p.code;
    if (!map[key]) {
      map[key] = { code: p.code, label: p.label, count: 0, sort: p.sort_order };
    }
    map[key].count += 1;
  });

  return Object.values(map)
    .sort((a, b) => b.count - a.count || a.sort - b.sort)
    .map(({ code, label, count }) => ({ code, label, count }));
}

export async function getUrgentLeads(limit = 5): Promise<LeadFull[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('leads_full')
    .select('*')
    .in('status', ['new', 'assigned'])
    .in('priority', ['urgent', 'high'])
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as LeadFull[] | null) ?? [];
}
