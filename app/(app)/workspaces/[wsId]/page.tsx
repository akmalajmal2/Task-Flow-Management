"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  KanbanSquare,
  Plus,
  Star,
  Lock,
  Globe,
  Settings,
  Trash2,
  Pencil,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { RenameDialog } from "@/components/shared/RenameDialog";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import {
  useGetWorkspaceQuery,
  useUpdateWorkspaceMutation,
  useDeleteWorkspaceMutation,
} from "@/features/workspaces/workspaceApi";
import { WorkspaceSkeleton } from "@/components/skeletons/WorkspaceSkeleton";
import {
  useListBoardsQuery,
  useToggleStarBoardMutation,
  useDeleteBoardMutation,
  useUpdateBoardMutation,
} from "@/features/boards/boardApi";
import { useWorkspacePermissions } from "@/hooks/usePermissions";
import type { BoardWithMeta, WorkspaceRole } from "@/types/domain";
import { cn } from "@/lib/utils/cn";
import { useState } from "react";

export default function WorkspacePage() {
  const { wsId } = useParams<{ wsId: string }>();
  const router = useRouter();
  const confirm = useConfirm();
  const perms = useWorkspacePermissions(wsId);

  const { data: ws } = useGetWorkspaceQuery({ workspaceId: wsId });
  const { data: boards = [], isLoading } = useListBoardsQuery({
    workspaceId: wsId,
  });
  const [toggleStar] = useToggleStarBoardMutation();
  const [deleteBoard] = useDeleteBoardMutation();
  const [updateWorkspace] = useUpdateWorkspaceMutation();
  const [deleteWorkspace] = useDeleteWorkspaceMutation();

  const [wsRenameOpen, setWsRenameOpen] = useState(false);

  if (isLoading) return <WorkspaceSkeleton />;

  const onDeleteWorkspace = async () => {
    const ok = await confirm({
      title: `Delete workspace "${ws?.name}"?`,
      description:
        "All boards, tasks, bugs, and comments will be permanently deleted. This cannot be undone.",
      confirmText: "Delete workspace",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteWorkspace({ workspaceId: wsId }).unwrap();
      toast.success("Workspace deleted");
      router.push("/dashboard");
    } catch {
      /* toasted by listenerMiddleware */
    }
  };

  const onDeleteBoard = async (boardId: string, boardName: string) => {
    const ok = await confirm({
      title: `Delete board "${boardName}"?`,
      description:
        "All tasks, columns, and comments on this board will be permanently deleted.",
      confirmText: "Delete board",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteBoard({ boardId }).unwrap();
      toast.success("Board deleted");
    } catch {
      /* toasted by listenerMiddleware */
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-6 py-8">
      {/* Workspace header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Workspace
          </p>
          <h1 className="mt-1 text-2xl font-bold">{ws?.name ?? "Workspace"}</h1>
          {ws?.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {ws.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {perms.canCreateBoard && (
            <Button asChild className="gap-2">
              <Link href={`/workspaces/${wsId}/boards/new`}>
                <Plus className="h-4 w-4" /> New board
              </Link>
            </Button>
          )}
          {perms.isAdmin && (
            <ActionMenu
              size="default"
              items={[
                {
                  label: "Edit workspace",
                  icon: Pencil,
                  onSelect: () => setWsRenameOpen(true),
                },
                {
                  label: "Manage members",
                  icon: Users,
                  onSelect: () => router.push(`/workspaces/${wsId}/members`),
                },
                {
                  label: "Settings",
                  icon: Settings,
                  onSelect: () => router.push(`/workspaces/${wsId}/settings`),
                },
                ...(perms.isOwner
                  ? [
                      {
                        label: "Delete workspace",
                        icon: Trash2,
                        destructive: true,
                        separatorBefore: true,
                        onSelect: onDeleteWorkspace,
                      },
                    ]
                  : []),
              ]}
            />
          )}
        </div>
      </div>

      {/* Boards grid */}
      {boards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent">
              <KanbanSquare className="h-7 w-7 text-primary" />
            </div>
            <p className="mb-4 text-sm">No boards yet.</p>
            {perms.canCreateBoard && (
              <Button asChild>
                <Link href={`/workspaces/${wsId}/boards/new`}>
                  Create your first board
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => (
            <BoardCard
              key={b.id}
              board={b}
              wsId={wsId}
              wsRole={perms.role}
              onStar={() => toggleStar({ boardId: b.id })}
              onDelete={() => onDeleteBoard(b.id, b.name)}
            />
          ))}
        </div>
      )}

      {/* Workspace rename dialog */}
      <RenameDialog
        open={wsRenameOpen}
        onOpenChange={setWsRenameOpen}
        title="Edit workspace"
        initialName={ws?.name ?? ""}
        initialDescription={ws?.description}
        onSave={async ({ name, description }) => {
          await updateWorkspace({
            workspaceId: wsId,
            input: { name, description },
          }).unwrap();
          toast.success("Workspace updated");
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Board card with inline edit/delete actions                          */
/* ------------------------------------------------------------------ */
function BoardCard({
  board,
  wsId,
  wsRole,
  onStar,
  onDelete,
}: {
  board: BoardWithMeta;
  wsId: string;
  /**
   * Workspace role of the current user, passed down from WorkspacePage
   * where getWorkspace has already resolved. This avoids a second
   * useGetBoardQuery + useGetWorkspaceQuery inside each card, which was
   * always null on the first render and caused isBoardAdmin to be false
   * for workspace owners/admins on public boards.
   */
  wsRole: WorkspaceRole | undefined;
  onStar: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [updateBoard] = useUpdateBoardMutation();

  /**
   * FIX: Derive board admin status directly from the already-fetched
   * board prop + the wsRole passed from the parent.
   *
   * The previous code called useBoardPermissions(board.id) which internally
   * called useGetBoardQuery() — always undefined on first render — and
   * useGetWorkspaceQuery() again per card. This meant:
   *   1. isWsAdmin was false until the second render cycle.
   *   2. For public boards where my_role is null, isBoardAdmin was always
   *      false even for the workspace owner, hiding the action menu entirely.
   */
  const isWsAdmin = wsRole === "owner" || wsRole === "admin";
  const isBoardAdmin = board.my_role === "admin" || isWsAdmin;

  return (
    <>
      <Card
        className={cn(
          "group relative overflow-hidden transition-all",
          "hover:-translate-y-0.5 hover:shadow-card-hover",
        )}
      >
        <Link href={`/workspaces/${wsId}/boards/${board.id}`}>
          <div
            className="h-1 w-full"
            style={{ backgroundColor: board.color }}
          />
          <CardHeader className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <span
                className="flex h-7 w-7 items-center justify-center rounded text-white"
                style={{ backgroundColor: board.color }}
              >
                <KanbanSquare className="h-4 w-4" />
              </span>
              <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {board.visibility === "private" ? (
                  <>
                    <Lock className="h-2.5 w-2.5" /> Private
                  </>
                ) : (
                  <>
                    <Globe className="h-2.5 w-2.5" /> Public
                  </>
                )}
              </span>
              {board.my_role && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  {board.my_role}
                </span>
              )}
            </div>
            <CardTitle className="text-base">{board.name}</CardTitle>
            {board.description && (
              <CardDescription className="mt-1 line-clamp-2 text-xs">
                {board.description}
              </CardDescription>
            )}
          </CardHeader>
        </Link>

        {/* Star button */}
        <button
          onClick={onStar}
          className={cn(
            "absolute right-10 top-3 rounded p-1 text-muted-foreground transition-opacity hover:text-yellow-500",
            board.is_starred
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100",
          )}
          aria-label={board.is_starred ? "Unstar" : "Star"}
        >
          <Star
            className={cn(
              "h-4 w-4",
              board.is_starred && "fill-yellow-400 text-yellow-400",
            )}
          />
        </button>

        {/* Action menu — visible to workspace admins and board admins */}
        {isBoardAdmin && (
          <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
            <ActionMenu
              items={[
                {
                  label: "Open board",
                  icon: KanbanSquare,
                  onSelect: () =>
                    router.push(`/workspaces/${wsId}/boards/${board.id}`),
                },
                {
                  label: "Edit board",
                  icon: Pencil,
                  onSelect: () => setRenameOpen(true),
                },
                {
                  label: "Board settings",
                  icon: Settings,
                  onSelect: () =>
                    router.push(
                      `/workspaces/${wsId}/boards/${board.id}/settings`,
                    ),
                },
                {
                  label: "Delete board",
                  icon: Trash2,
                  destructive: true,
                  separatorBefore: true,
                  onSelect: onDelete,
                },
              ]}
            />
          </div>
        )}
      </Card>

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Edit board"
        initialName={board.name}
        initialDescription={board.description}
        onSave={async ({ name, description }) => {
          await updateBoard({
            boardId: board.id,
            input: { name, description },
          }).unwrap();
          toast.success("Board updated");
        }}
      />
    </>
  );
}
