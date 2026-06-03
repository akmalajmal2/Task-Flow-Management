"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppDispatch } from "@/hooks/useAppStore";
import { baseApi } from "@/store/baseApi";

/**
 * Subscribe to a board's realtime channels. Any row change on tasks /
 * board_columns / subtasks / task_assignees invalidates the relevant
 * RTK Query cache so all connected clients see the change instantly.
 */
export function useBoardRealtime(boardId: string | null | undefined) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!boardId) return;
    const supabase = createClient();

    const invalidateBoard = () =>
      dispatch(
        baseApi.util.invalidateTags([
          { type: "Task", id: `BOARD-${boardId}` },
        ]),
      );

    const channel = supabase
      .channel(`board:${boardId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `board_id=eq.${boardId}`,
        },
        invalidateBoard,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "board_columns",
          filter: `board_id=eq.${boardId}`,
        },
        () =>
          dispatch(
            baseApi.util.invalidateTags([
              { type: "BoardColumn", id: boardId },
            ]),
          ),
      )
      // FIX: subtasks don't have board_id directly; filter via task_id is not
      // supported by Supabase postgres_changes. Instead we subscribe at the
      // task level (tasks.board_id filter above) and accept that subtask
      // changes inside a board refetch the board's task list. For cross-board
      // isolation, users who aren't on this board won't have a channel open.
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subtasks",
        },
        // Debounce to avoid N invalidations for a batch subtask operation.
        // Using a closure-captured timer that resets per channel lifetime.
        (() => {
          let timer: ReturnType<typeof setTimeout> | null = null;
          return () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(invalidateBoard, 150);
          };
        })(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_assignees",
        },
        invalidateBoard,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, dispatch]);
}

/**
 * Subscribe to workspace_members changes for a given workspace.
 *
 * Fires on any INSERT / UPDATE / DELETE to workspace_members for this workspace,
 * immediately invalidating the RTK Query WorkspaceMember cache so:
 *   - The owner sees new members as soon as they accept an invitation.
 *   - The assignee dropdown refreshes without a page reload.
 */
export function useWorkspaceMembersRealtime(
  workspaceId: string | null | undefined,
) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!workspaceId) return;
    const supabase = createClient();

    const invalidate = () => {
      dispatch(
        baseApi.util.invalidateTags([
          { type: "WorkspaceMember", id: workspaceId },
          { type: "WorkspaceMember", id: "LIST" },
          "WorkspaceMember",
          "BoardMember",
          // Also invalidate Workspace so the INVITEE's sidebar workspace list
          // appears immediately after their workspace_members row is inserted
          "Workspace",
        ]),
      );
    };

    const channel = supabase
      .channel(`workspace-members:${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_members",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        invalidate,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") invalidate();
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, dispatch]);
}

/**
 * Subscribe to the current user's notifications channel.
 */
export function useNotificationsRealtime(userId: string | null | undefined) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          dispatch(baseApi.util.invalidateTags(["Notification"]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, dispatch]);
}

/**
 * Subscribe to a comment thread (task / subtask / bug).
 */
export function useCommentsRealtime(
  parentType: "task" | "subtask" | "bug" | null,
  parentId: string | null,
) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!parentType || !parentId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`comments:${parentType}:${parentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `parent_id=eq.${parentId}`,
        },
        () => {
          dispatch(
            baseApi.util.invalidateTags([
              { type: "Comment", id: `${parentType}-${parentId}` },
            ]),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [parentType, parentId, dispatch]);
}
