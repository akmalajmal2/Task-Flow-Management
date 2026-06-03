"use client";

/**
 * Workspace layout — wraps every page nested under /workspaces/[wsId].
 *
 * Responsibilities:
 *  1. Starts the workspace_members Realtime subscription so that the member
 *     list refreshes automatically when anyone accepts/is removed.
 *  2. Subscribes to workspace invitations so the invitations list stays live.
 *  3. Keeps both subscriptions alive for the full workspace session.
 */
import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useWorkspaceMembersRealtime } from "@/hooks/useRealtime";
import { useAppDispatch } from "@/hooks/useAppStore";
import { baseApi } from "@/store/baseApi";
import { createClient } from "@/lib/supabase/client";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { wsId } = useParams<{ wsId: string }>();
  const dispatch = useAppDispatch();

  // Live workspace_members subscription (handles member add/remove/role changes)
  useWorkspaceMembersRealtime(wsId);

  // Subscribe to invitation status changes for this workspace.
  // When an invitee accepts, their `invitations` row changes status to 'accepted'.
  // This fires on the owner's channel and serves as a SECOND trigger to invalidate
  // the WorkspaceMember cache — a belt-and-suspenders against the case where the
  // workspace_members INSERT (which runs inside a SECURITY DEFINER function)
  // doesn't reliably deliver a realtime event.
  useEffect(() => {
    if (!wsId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`workspace-invitations:${wsId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "invitations",
          filter: `workspace_id=eq.${wsId}`,
        },
        (payload) => {
          // An invitation row was updated — if it moved to 'accepted', the new
          // member is already in workspace_members (added by accept_invitation RPC).
          // Invalidate the member list to pick them up.
          if (
            (payload.new as { status?: string })?.status === "accepted" ||
            (payload.new as { status?: string })?.status === "declined"
          ) {
            dispatch(
              baseApi.util.invalidateTags([
                { type: "WorkspaceMember", id: wsId },
                { type: "WorkspaceMember", id: "LIST" },
                "WorkspaceMember",
                { type: "Invitation", id: wsId },
                { type: "Invitation", id: "LIST" },
              ]),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [wsId, dispatch]);

  return <>{children}</>;
}
