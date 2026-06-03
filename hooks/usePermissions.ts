'use client';

import { useGetWorkspaceQuery } from '@/features/workspaces/workspaceApi';
import { useGetBoardQuery } from '@/features/boards/boardApi';

/**
 * Unified permissions for a workspace. Owner > admin > member > viewer.
 */
export function useWorkspacePermissions(workspaceId: string | null | undefined) {
  const { data: ws } = useGetWorkspaceQuery(
    { workspaceId: workspaceId! },
    { skip: !workspaceId },
  );

  const role = ws?.role;
  const isOwner = role === 'owner';
  const isAdmin = role === 'admin' || isOwner;
  const isMember = role === 'member' || isAdmin;
  const isViewer = role === 'viewer';

  return {
    role,
    isOwner,
    isAdmin,
    isMember,
    isViewer,
    canDeleteWorkspace: isOwner,
    canEditWorkspace: isAdmin,
    canInvite: isAdmin,
    canChangeRoles: isAdmin,
    canCreateBoard: isMember,
  };
}

/**
 * Board-level permissions. Takes workspace role into account when the
 * board is public.
 */
export function useBoardPermissions(boardId: string | null | undefined) {
  const { data: board } = useGetBoardQuery(
    { boardId: boardId! },
    { skip: !boardId },
  );
  const { data: ws } = useGetWorkspaceQuery(
    { workspaceId: board?.workspace_id ?? '' },
    // FIX: skip if board hasn't loaded yet, prevents a query with empty string
    { skip: !board?.workspace_id },
  );

  const wsRole = ws?.role;
  const boardRole = board?.my_role;

  const isWsOwnerOrAdmin = wsRole === 'owner' || wsRole === 'admin';
  const isBoardAdmin = boardRole === 'admin' || isWsOwnerOrAdmin;

  // FIX: isViewer should be true only when the user has no write path at all.
  // A workspace viewer with an explicit board_member role on a private board
  // should still be able to write.
  const isViewer = wsRole === 'viewer' && !boardRole;

  // For public boards: all non-viewer workspace members can write.
  // For private: only board_members can write. Both rules collapse to
  // "has a board_role OR (public board AND not a viewer)".
  const canWrite =
    !!boardRole || (board?.visibility === 'public' && !isViewer) || isWsOwnerOrAdmin;

  return {
    wsRole,
    boardRole,
    isViewer,
    isBoardAdmin,
    canView: !!board,
    canWrite,
    canCreateTask: canWrite,
    canEditBoard: isBoardAdmin,
    canDeleteBoard: isBoardAdmin,
    canManageMembers: isBoardAdmin,
    canDeleteAnyTask: isBoardAdmin,
  };
}
