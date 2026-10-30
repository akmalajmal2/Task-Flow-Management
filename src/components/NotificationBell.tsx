"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp, useAppApi } from "@/store/app-store";
import { Icon } from "./ui";

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};

/** Dropdown is the platform Popover API — open/close/light-dismiss need no JS. */
export function NotificationBell() {
  const notices = useApp((s) => s.notices);
  const app = useAppApi();
  const unread = useMemo(() => notices.filter((n) => !n.read_at).length, [notices]);

  // Ring the bell when a *new* notification arrives (not on first load).
  const latest = notices[0]?.id;
  const seen = useRef(latest);
  const [ring, setRing] = useState(0);
  useEffect(() => {
    if (latest && latest !== seen.current) setRing((r) => r + 1);
    seen.current = latest;
  }, [latest]);

  const read = async (ids: string[] | "all") => {
    app.getState().markRead(ids);
    const q = createClient().from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    await (ids === "all" ? q : q.in("id", ids));
  };

  return (
    <>
      <button className="icon-btn bell" popoverTarget="notices" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
        <span key={ring} className={ring ? "bell-ico ring" : "bell-ico"}><Icon n="bell" size={18} /></span>
        {unread > 0 && <span className="badge" key={unread}>{unread > 9 ? "9+" : unread}</span>}
      </button>
      <div id="notices" popover="auto" className="pop pop-notices">
        <header>
          <strong>Notifications</strong>
          <button className="btn subtle sm" disabled={!unread} onClick={() => read("all")}>
            Mark all read
          </button>
        </header>
        {notices.length === 0 ? (
          <p className="empty">Nothing yet. You'll hear about proposals, assignments, reviews and test results here.</p>
        ) : (
          <ul>
            {notices.map((n) => (
              <li key={n.id} data-unread={!n.read_at}>
                <Link
                  href={n.link ?? "/projects"}
                  onClick={(e) => {
                    read([n.id]);
                    e.currentTarget.closest<HTMLElement>("[popover]")?.hidePopover();
                  }}
                >
                  <b>{n.title}</b>
                  {n.body && <span>{n.body}</span>}
                  <time>{ago(n.created_at)}</time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
