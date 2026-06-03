/**
 * invitationApi.ts
 *
 * ROOT BUG FIX (members not visible after accepting):
 * ─────────────────────────────────────────────────────
 * The original `acceptInvitation` mutation invalidated the generic
 * `"WorkspaceMember"` tag string.  RTK Query treats generic string tags and
 * `{ type, id }` tags as SEPARATE entries — a generic "WorkspaceMember"
 * invalidation does NOT flush caches that were registered with the more-specific
 * `{ type: "WorkspaceMember", id: workspaceId }` tag.
 *
 * The fix is to:
 *   1. Add a `{ type: "WorkspaceMember", id: "LIST" }` sentinel to
 *      `listWorkspaceMembers.providesTags` so every member-list query is
 *      reachable via a single well-known tag.
 *   2. Invalidate BOTH the sentinel `{ type, id: "LIST" }` AND the generic
 *      string tag in `acceptInvitation.invalidatesTags` so we hit every
 *      permutation of cached member queries.
 */
import { baseApi } from "@/store/baseApi";
import { createClient } from "@/lib/supabase/client";
import { mapSupabaseError } from "@/lib/errors/map";
import type { Invitation } from "@/types/domain";
import type { InvitationSendInput } from "@/lib/validations/invitation";

const sb = () => createClient();

export const invitationApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listPendingForWorkspace: b.query<Invitation[], { workspaceId: string }>({
      async queryFn({ workspaceId }) {
        const { data, error } = await sb()
          .from("invitations")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        if (error) return { error: mapSupabaseError(error) };
        return { data: (data ?? []) as Invitation[] };
      },
      providesTags: (_r, _e, { workspaceId }) => [
        { type: "Invitation", id: workspaceId },
        { type: "Invitation", id: "LIST" },
      ],
    }),

    listMyPending: b.query<Invitation[], void>({
      async queryFn() {
        const supabase = sb();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { data: [] };
        const { data: me } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", user.id)
          .maybeSingle();
        if (!me) return { data: [] };

        const { data, error } = await supabase
          .from("invitations")
          .select("*")
          .ilike("email", me.email)
          .eq("status", "pending")
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false });
        if (error) return { error: mapSupabaseError(error) };
        return { data: (data ?? []) as Invitation[] };
      },
      providesTags: [{ type: "Invitation", id: "LIST" }],
    }),

    sendInvitation: b.mutation<
      { invitation: Invitation; emailWarning: string | null },
      InvitationSendInput
    >({
      async queryFn(input) {
        const res = await fetch("/api/invitations/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: "Failed" }));
          return { error: { message: error ?? "Failed to send invitation" } };
        }
        const json = await res.json();
        return {
          data: {
            invitation: json.invitation as Invitation,
            emailWarning: json.emailWarning ?? null,
          },
        };
      },
      invalidatesTags: [{ type: "Invitation", id: "LIST" }],
    }),

    acceptInvitation: b.mutation<
      { workspace_id: string | null; board_id: string | null },
      { token: string }
    >({
      async queryFn({ token }) {
        const { data, error } = await sb().rpc("accept_invitation", {
          p_token: token,
        });
        if (error) return { error: mapSupabaseError(error) };
        return {
          data: data as { workspace_id: string | null; board_id: string | null },
        };
      },
      /**
       * CORE FIX: We must invalidate BOTH forms of the WorkspaceMember tag:
       *
       *   - "WorkspaceMember" (generic string) → catches any query that used
       *     providesTags: ["WorkspaceMember"]
       *   - { type: "WorkspaceMember", id: "LIST" } → catches the specific-id
       *     form `{ type: "WorkspaceMember", id: workspaceId }` because LIST
       *     is a sentinel that listWorkspaceMembers now also provides.
       *
       * Without the LIST sentinel, the owner's member list query (which is
       * cached under `{ type: "WorkspaceMember", id: wsId }`) was NEVER
       * invalidated and therefore NEVER refetched after an invite was accepted.
       */
      invalidatesTags: [
        { type: "Invitation", id: "LIST" },
        { type: "WorkspaceMember", id: "LIST" },
        "WorkspaceMember",
        // Invitee's workspace list needs to update (they can now see the workspace)
        "Workspace",
        // Board member lists update for board-level invitations
        { type: "BoardMember", id: "LIST" },
        "BoardMember",
      ],
    }),

    declineInvitation: b.mutation<void, { token: string }>({
      async queryFn({ token }) {
        const { error } = await sb()
          .from("invitations")
          .update({ status: "declined" })
          .eq("token", token)
          .eq("status", "pending");
        if (error) return { error: mapSupabaseError(error) };
        return { data: undefined };
      },
      invalidatesTags: [{ type: "Invitation", id: "LIST" }],
    }),

    revokeInvitation: b.mutation<
      void,
      { invitationId: string; workspaceId?: string }
    >({
      async queryFn({ invitationId }) {
        const { error } = await sb()
          .from("invitations")
          .update({ status: "revoked" })
          .eq("id", invitationId);
        if (error) return { error: mapSupabaseError(error) };
        return { data: undefined };
      },
      invalidatesTags: (_r, _e, { workspaceId }) => [
        { type: "Invitation", id: "LIST" },
        ...(workspaceId
          ? [{ type: "Invitation" as const, id: workspaceId }]
          : []),
      ],
    }),
  }),
});

export const {
  useListPendingForWorkspaceQuery,
  useListMyPendingQuery,
  useSendInvitationMutation,
  useAcceptInvitationMutation,
  useDeclineInvitationMutation,
  useRevokeInvitationMutation,
} = invitationApi;

