"use client";
import { useEffect, useState } from "react";
import { createClient } from "./client";
import type { Profile, UserRole } from "./types";

function buildFallbackProfile(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  created_at?: string;
}): Profile {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  return {
    id: user.id,
    email: user.email ?? "",
    first_name: (meta.first_name as string | null) ?? null,
    last_name: (meta.last_name as string | null) ?? null,
    role: ((meta.role as UserRole | undefined) ?? "employe_magasin") as UserRole,
    magasin_id: (meta.magasin_id as string | null) ?? null,
    phone: null,
    avatar_url: null,
    active: true,
    created_at: user.created_at ?? now,
    updated_at: now,
  };
}

export function useCurrentProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const load = async () => {
      // getSession() reads directly from cookies — no network call, works
      // even on fresh page load before the JWT refresh cycle kicks in.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;
      if (!session?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const user = session.user;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.warn("[useCurrentProfile] profile fetch error", error);
      }

      setProfile(
        (data as Profile | null) ??
          buildFallbackProfile({
            id: user.id,
            email: user.email,
            user_metadata: user.user_metadata,
            created_at: user.created_at,
          }),
      );
      setLoading(false);
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }
      load();
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { profile, loading };
}

export function displayName(
  p: Pick<Profile, "first_name" | "last_name" | "email"> | null,
) {
  if (!p) return "";
  const full = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return full || p.email;
}

export function initials(
  p: Pick<Profile, "first_name" | "last_name" | "email"> | null,
) {
  if (!p) return "?";
  const letters =
    [p.first_name?.[0], p.last_name?.[0]].filter(Boolean).join("") ||
    p.email?.[0] ||
    "?";
  return letters.toUpperCase();
}
