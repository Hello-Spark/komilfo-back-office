"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/supabase/types";

const PAGE_SIZE = 20;

interface UseNotifications {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export function useNotifications(): UseNotifications {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setUserId(null);
        setNotifications([]);
        setLoading(false);
        return;
      }

      const { data, error: err } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (cancelled) return;
      if (err) {
        setError(err.message);
      } else {
        setNotifications((data ?? []) as Notification[]);
      }
      setUserId(user.id);
      setLoading(false);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Notification;
          setNotifications((prev) => {
            if (prev.some((n) => n.id === row.id)) return prev;
            return [row, ...prev].slice(0, PAGE_SIZE);
          });
          toast(row.title, {
            description: row.body ?? undefined,
            action: row.lead_id
              ? {
                  label: "Voir",
                  onClick: () =>
                    router.push(`/list?lead=${row.lead_id}`),
                }
              : undefined,
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === row.id ? row : n)),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, router]);

  const markAsRead = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id && !n.read_at ? { ...n, read_at: now } : n,
        ),
      );
      const { error: err } = await supabase
        .from("notifications")
        .update({ read_at: now })
        .eq("id", id)
        .is("read_at", null);
      if (err) setError(err.message);
    },
    [supabase],
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: now })),
    );
    const { error: err } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", userId)
      .is("read_at", null);
    if (err) setError(err.message);
  }, [supabase, userId]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
  };
}
