"use client";

import { signOut } from "@/app/actions";
import { useApp } from "@/store/app-store";
import { Avatar, Icon } from "./ui";

export function UserMenu() {
  const me = useApp((s) => s.me);
  return (
    <>
      <button className="icon-btn" popoverTarget="usermenu" aria-label="Account menu">
        <Avatar name={me.full_name || me.email} size={28} />
      </button>
      <div id="usermenu" popover="auto" className="pop pop-user">
        <div className="who">
          <strong>{me.full_name}</strong>
          <span>{me.email}</span>
          {me.is_admin && <em className="chip" data-tone="violet">Workspace admin</em>}
        </div>
        <form action={signOut}>
          <button className="menu-item" type="submit">
            <Icon n="logout" /> Sign out
          </button>
        </form>
      </div>
    </>
  );
}
