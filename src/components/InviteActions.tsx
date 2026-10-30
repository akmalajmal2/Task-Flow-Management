"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite, declineInvite } from "@/app/actions";
import { useAppApi } from "@/store/app-store";
import type { MyInvite } from "@/lib/types";
import { Spinner } from "./ui";

export function InviteButtons({ token, compact = false }: { token: string; compact?: boolean }) {
  const router = useRouter();
  const app = useAppApi();
  const [pending, start] = useTransition();
  const cls = compact ? "btn sm" : "btn";

  return (
    <div className="dlg-actions">
      <button
        className={`${cls} subtle`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await declineInvite(token);
            if (!r.ok) return app.getState().toast({ text: r.error, tone: "danger" });
            router.replace("/projects");
            router.refresh();
          })
        }
      >
        Decline
      </button>
      <button
        className={`${cls} primary`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await acceptInvite(token);
            if (!r.ok) return app.getState().toast({ text: r.error, tone: "danger" });
            router.push(`/projects/${r.data.project_id}`);
          })
        }
      >
        {pending && <Spinner />} Accept invitation
      </button>
    </div>
  );
}

export function InviteRow({ invite }: { invite: MyInvite }) {
  return (
    <div className="invite-row">
      <div className="grow">
        <strong>
          {invite.inviter_name ?? "A manager"} invited you to {invite.project_name}
        </strong>
        <div style={{ color: "var(--ink-2)" }}>Join as {invite.role}. You become a member once you accept.</div>
      </div>
      <InviteButtons token={invite.token} compact />
    </div>
  );
}
