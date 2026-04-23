import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/magasin/transfer-primary
 * Body: { magasin_id, new_primary_profile_id }
 *
 * Transfère le rôle de gérant d'un magasin à un autre user rattaché. Doit
 * être atomique : d'abord unset l'ancien primary, puis set le nouveau —
 * sinon la contrainte unique `profile_magasins_one_primary_per_magasin`
 * lève une erreur.
 *
 * Utilise le service_role pour éviter de se battre avec la policy UPDATE
 * qui ne voit que le primary courant (et donc bloquerait le second UPDATE
 * après que le caller a perdu son statut primary).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    magasin_id?: string;
    new_primary_profile_id?: string;
  } | null;

  if (!body?.magasin_id || !body?.new_primary_profile_id) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Vérif permission via RPC (policy-agnostic).
  const { data: isPrimary, error: permErr } = await supabase.rpc(
    "is_magasin_primary",
    { p_magasin_id: body.magasin_id },
  );
  if (permErr) {
    return NextResponse.json({ error: "perm_check_failed" }, { status: 500 });
  }
  if (!isPrimary) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Vérifie que le nouveau primary est bien rattaché au magasin.
  const { data: existing, error: checkErr } = await admin
    .from("profile_magasins")
    .select("profile_id, is_primary")
    .eq("magasin_id", body.magasin_id)
    .eq("profile_id", body.new_primary_profile_id)
    .maybeSingle();
  if (checkErr) {
    return NextResponse.json(
      { error: "check_failed", detail: checkErr.message },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json(
      { error: "not_linked", detail: "Le user cible n'est pas rattaché au magasin" },
      { status: 400 },
    );
  }

  // Étape 1 : unset l'ancien primary de ce magasin.
  const { error: unsetErr } = await admin
    .from("profile_magasins")
    .update({ is_primary: false })
    .eq("magasin_id", body.magasin_id)
    .eq("is_primary", true);
  if (unsetErr) {
    return NextResponse.json(
      { error: "unset_failed", detail: unsetErr.message },
      { status: 500 },
    );
  }

  // Étape 2 : set le nouveau.
  const { error: setErr } = await admin
    .from("profile_magasins")
    .update({ is_primary: true })
    .eq("magasin_id", body.magasin_id)
    .eq("profile_id", body.new_primary_profile_id);
  if (setErr) {
    // Rollback best-effort : re-set l'ancien caller comme primary.
    await admin
      .from("profile_magasins")
      .update({ is_primary: true })
      .eq("magasin_id", body.magasin_id)
      .eq("profile_id", user.id);
    return NextResponse.json(
      { error: "set_failed", detail: setErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
