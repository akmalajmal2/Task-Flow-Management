"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Trash2, UserPlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import {
  useListWorkspaceMembersQuery,
  useRemoveMemberMutation,
  useUpdateMemberRoleMutation,
} from "@/features/workspaces/workspaceApi";
import { useSendInvitationMutation } from "@/features/invitations/invitationApi";
import { useWorkspacePermissions } from "@/hooks/usePermissions";
import { useCurrentUser } from "@/hooks/useCurrentUser";
// Mount the realtime subscription directly on this page so it's active
// even when the workspace layout's subscription misses an event.
import { useWorkspaceMembersRealtime } from "@/hooks/useRealtime";
import { WORKSPACE_ROLES, ROLE_LABELS } from "@/lib/constants";
import type { WorkspaceRole } from "@/types/domain";

export default function MembersPage() {
  const { wsId } = useParams<{ wsId: string }>();
  const { user } = useCurrentUser();
  const perms = useWorkspacePermissions(wsId);
  const confirm = useConfirm();

  // Subscribe directly on this page — redundant with workspace layout but
  // ensures the member list updates even if the layout subscription missed
  // the event (e.g. deep-linked directly to /members without a workspace nav).
  useWorkspaceMembersRealtime(wsId);

  const {
    data: members = [],
    isLoading,
    isFetching,
    refetch,
  } = useListWorkspaceMembersQuery(
    { workspaceId: wsId },
    {
      // Refetch when the tab regains focus — covers the case where the invitee
      // accepted in a different browser/tab while the owner had this page open.
      refetchOnFocus: true,
      // Poll every 30 seconds as a last-resort fallback if realtime missed the event.
      // (Supabase SECURITY DEFINER inserts can occasionally miss realtime delivery.)
      pollingInterval: 30_000,
    },
  );

  const [updateRole] = useUpdateMemberRoleMutation();
  const [removeMember] = useRemoveMemberMutation();
  const [sendInvite, { isLoading: sending }] = useSendInvitationMutation();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("member");

  const onChangeRole = async (userId: string, newRole: WorkspaceRole) => {
    const member = members.find((m) => m.user_id === userId);
    if (!member || member.role === newRole) return;
    const ok = await confirm({
      title: `Change ${member.profile.full_name ?? member.profile.email}'s role to ${ROLE_LABELS[newRole]}?`,
      description:
        newRole === "admin"
          ? "Admins can invite, manage members, and manage all boards."
          : newRole === "viewer"
            ? "Viewers are read-only and can comment on public boards."
            : "Members can create and collaborate on boards.",
      confirmText: "Confirm",
    });
    if (!ok) return;
    await updateRole({ workspaceId: wsId, userId, role: newRole }).unwrap();
    toast.success("Role updated");
  };

  const onRemove = async (userId: string, name: string) => {
    const ok = await confirm({
      title: `Remove ${name} from this workspace?`,
      description: "They will lose access to all boards in this workspace.",
      confirmText: "Remove",
      destructive: true,
    });
    if (!ok) return;
    await removeMember({ workspaceId: wsId, userId }).unwrap();
    toast.success("Member removed");
  };

  const onSendInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      const res = await sendInvite({
        workspaceId: wsId,
        email: inviteEmail.trim(),
        role: inviteRole,
      }).unwrap();
      if (res.emailWarning) {
        toast.warning("Invitation created but email not sent", {
          description: res.emailWarning,
          duration: 10_000,
        });
      } else {
        toast.success(`Invitation sent to ${inviteEmail}`);
      }
      setInviteEmail("");
      setInviteOpen(false);
    } catch {
      // toasted by listenerMiddleware
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "…"
              : `${members.length} member${members.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Manual refresh as a safety net */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh member list"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
          </Button>

          {perms.canInvite && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <UserPlus className="h-4 w-4" /> Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite to workspace</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="teammate@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && onSendInvite()}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(v) => setInviteRole(v as WorkspaceRole)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WORKSPACE_ROLES.filter((r) => r !== "owner").map(
                          (r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setInviteOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={onSendInvite}
                    disabled={sending || !inviteEmail.trim()}
                  >
                    {sending ? "Sending…" : "Send invite"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Members list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Workspace members
            {isFetching && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                Syncing…
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-0 divide-y">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-6 py-4">
                  <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-48 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No members yet. Invite someone to get started.
            </p>
          ) : (
            <ul className="divide-y">
              {members.map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center justify-between px-6 py-3"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={m.profile.full_name}
                      src={m.profile.avatar_url}
                    />
                    <div>
                      <p className="font-medium leading-tight">
                        {m.profile.full_name ?? m.profile.email}
                        {m.user_id === user?.id && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.profile.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {perms.canChangeRoles &&
                    m.user_id !== user?.id &&
                    m.role !== "owner" ? (
                      <Select
                        value={m.role}
                        onValueChange={(v) =>
                          onChangeRole(m.user_id, v as WorkspaceRole)
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WORKSPACE_ROLES.filter((r) => r !== "owner").map(
                            (r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary">{ROLE_LABELS[m.role]}</Badge>
                    )}

                    {perms.canChangeRoles &&
                      m.user_id !== user?.id &&
                      m.role !== "owner" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title={`Remove ${m.profile.full_name ?? m.profile.email}`}
                          onClick={() =>
                            onRemove(
                              m.user_id,
                              m.profile.full_name ?? m.profile.email,
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
