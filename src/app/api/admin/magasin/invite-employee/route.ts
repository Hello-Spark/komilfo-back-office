import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicOrigin } from "@/lib/public-url";

/**
 * POST /api/admin/magasin/invite-employee
 * Body: { magasin_id, email, first_name?, last_name?, role? }
 *
 * Flow :
 *  1. Vérifie que le caller est gérant (is_primary) du magasin.
 *  2. Pré-crée une ligne magasin_emails avec l'email invité (rôle
 *     supplementaire_1 par défaut, notify=true). Le trigger
 *     magasin_emails_auto_link_profiles fera le rattachement profile_magasins
 *     automatiquement dès que l'invité aura son profile créé.
 *  3. Appelle supabase.auth.admin.inviteUserByEmail pour envoyer l'email
 *     Supabase d'invitation. L'invité définit son password via le lien.
 *
 * Idempotent : si l'email est déjà rattaché au magasin, on re-envoie juste
 * l'invitation.
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
    email?: string;
    first_name?: string;
    last_name?: string;
    role?: "principal" | "adherent" | "supplementaire_1" | "supplementaire_2";
  } | null;

  if (!body?.magasin_id || !body?.email) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  const magasinId = body.magasin_id;

  // 1. Vérifie is_primary via RPC helper (respecte RLS).
  const { data: isPrimary, error: permErr } = await supabase.rpc(
    "is_magasin_primary",
    { p_magasin_id: magasinId },
  );
  if (permErr) {
    console.error("[invite-employee] perm check failed", permErr);
    return NextResponse.json({ error: "perm_check_failed" }, { status: 500 });
  }
  if (!isPrimary) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 2. Pré-crée magasin_emails (upsert idempotent). Rôle par défaut supp_1
  // pour ne pas écraser le `principal` existant d'un ajout initial.
  const { error: emailErr } = await supabase.from("magasin_emails").upsert(
    {
      magasin_id: magasinId,
      email,
      role: body.role ?? "supplementaire_1",
      notify: true,
    },
    { onConflict: "magasin_id,email" },
  );
  if (emailErr) {
    console.error("[invite-employee] magasin_emails upsert failed", emailErr);
    return NextResponse.json(
      { error: "email_link_failed", detail: emailErr.message },
      { status: 500 },
    );
  }

  // 3. Invitation Supabase.
  const admin = createAdminClient();
  const redirectTo = `${getPublicOrigin(request)}/auth/callback?redirect=/magasin`;

  const { data, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo,
      data: {
        first_name: body.first_name ?? null,
        last_name: body.last_name ?? null,
        invited_by_magasin_id: magasinId,
        role: "employe_magasin",
      },
    },
  );

  if (inviteErr) {
    // Cas attendu : l'email existe déjà en auth.users → renvoyer 200 avec un
    // hint pour que l'UI affiche "le lien existe, il suffit qu'il se connecte".
    const msg = inviteErr.message?.toLowerCase() ?? "";
    if (msg.includes("already") || msg.includes("registered")) {
      return NextResponse.json(
        {
          ok: true,
          invited: false,
          note: "user_already_exists",
          message: "Cet email a déjà un compte. Rattachement créé, aucune invitation renvoyée.",
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { error: "invite_failed", detail: inviteErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, invited: true, user_id: data.user?.id },
    { status: 201 },
  );
}
