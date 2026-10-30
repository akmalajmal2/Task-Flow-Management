"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createStore, useStore, type StoreApi } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { Notice, Profile } from "@/lib/types";

export interface Toast {
  id: string;
  text: string;
  tone: "info" | "success" | "danger";
  href?: string | null;
}

export interface AskOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
}

interface AppState {
  me: Profile;
  /** The in-app confirmation dialog currently on screen, if any. */
  ask: (o: AskOptions) => Promise<boolean>;
  asking: AskOptions | null;
  answer: (ok: boolean) => void;
  notices: Notice[];
  toasts: Toast[];
  addNotice: (n: Notice) => void;
  mergeNotices: (list: Notice[]) => void;
  patchNotice: (n: Notice) => void;
  markRead: (ids: string[] | "all") => void;
  toast: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const Ctx = createContext<StoreApi<AppState> | null>(null);

const TONE: Record<string, Toast["tone"]> = {
  proposal_approved: "success", approved: "success", test_passed: "success", invite_accepted: "success",
  proposal_declined: "danger", rejected: "danger", test_failed: "danger", overdue: "danger",
};

function makeStore(me: Profile, notices: Notice[]) {
  let resolver: ((ok: boolean) => void) | null = null;
  return createStore<AppState>((set) => ({
    me,
    asking: null,
    ask: (o) =>
      new Promise<boolean>((resolve) => {
        resolver?.(false); // a newer question replaces an unanswered one
        resolver = resolve;
        set({ asking: o });
      }),
    answer: (ok) => {
      const r = resolver;
      resolver = null;
      set({ asking: null });
      r?.(ok);
    },
    notices,
    toasts: [],
    addNotice: (n) => set((s) => (s.notices.some((x) => x.id === n.id) ? s : { notices: [n, ...s.notices].slice(0, 50) })),
    // Used after a reconnect / tab wake-up: keep local read state, add anything we missed.
    mergeNotices: (list) =>
      set((s) => {
        const known = new Map(s.notices.map((n) => [n.id, n]));
        for (const n of list) known.set(n.id, { ...n, read_at: n.read_at ?? known.get(n.id)?.read_at ?? null });
        return { notices: [...known.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50) };
      }),
    patchNotice: (n) => set((s) => ({ notices: s.notices.map((x) => (x.id === n.id ? n : x)) })),
    markRead: (ids) =>
      set((s) => {
        const at = new Date().toISOString();
        return { notices: s.notices.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, read_at: n.read_at ?? at } : n)) };
      }),
    toast: (t) => set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id: Math.random().toString(36).slice(2) }] })),
    dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  }));
}

export function AppProvider({ me, notices, children }: { me: Profile; notices: Notice[]; children: ReactNode }) {
  const [store] = useState(() => makeStore(me, notices));

  // Live notifications: a new row for this user appears instantly, in every open tab.
  useEffect(() => {
    const sb = createClient();
    let connectedBefore = false;
    const resync = async () => {
      const { data } = await sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(30);
      if (data) store.getState().mergeNotices(data as Notice[]);
    };
    const onVisible = () => document.visibilityState === "visible" && resync();
    document.addEventListener("visibilitychange", onVisible);
    const ch = sb
      .channel(`notices:${me.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${me.id}` }, (p) => {
        const n = p.new as Notice;
        const s = store.getState();
        if (s.notices.some((x) => x.id === n.id)) return;
        s.addNotice(n);
        s.toast({ text: n.title, tone: TONE[n.kind] ?? "info", href: n.link });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${me.id}` }, (p) =>
        store.getState().patchNotice(p.new as Notice),
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        // After a dropped connection events may have been missed: pull the latest once.
        if (connectedBefore) void resync();
        connectedBefore = true;
      });
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      sb.removeChannel(ch);
    };
  }, [me.id, store]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useApp<T>(selector: (s: AppState) => T): T {
  const s = useContext(Ctx);
  if (!s) throw new Error("useApp must be used inside AppProvider");
  return useStore(s, selector);
}

export function useAppApi() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useAppApi must be used inside AppProvider");
  return s;
}
