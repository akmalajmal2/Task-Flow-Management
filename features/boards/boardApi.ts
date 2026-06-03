import { baseApi } from "@/store/baseApi";
import { createClient } from "@/lib/supabase/client";
import { mapSupabaseError } from "@/lib/errors/map";
import type {
  Board,
  BoardWithMeta,
  BoardMember,
  BoardColumn,
  BoardRole,
  Profile,
} from "@/types/domain";
import type {
  BoardCreateInput,
  BoardUpdateInput,
} from "@/lib/validations/board";

const sb = () => createClient();

export const boardApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    /**
     * All boards in a workspace the current user can see. RLS filters out
     * private boards the user isn't a member of automatically.
     */
    listBoards: b.query<BoardWithMeta[], { workspaceId: string }>({
      async queryFn({ workspaceId }) {
        const supabase = sb();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { data: [] };

        const [{ data: boards, error }, { data: bmRows }, { data: starred }] =
          await Promise.all([
            supabase
              .from("boards")
              .select("*")
              .eq("workspace_id", workspaceId)
              .is("archived_at", null)
              .order("created_at", { ascending: false }),
            supabase
              .from("board_members")
              .select("board_id, role")
              .eq("user_id", user.id),
            supabase
              .from("starred_boards")
              .select("board_id")
              .eq("user_id", user.id),
          ]);
        if (error) return { error: mapSupabaseError(error) };

        const roleMap = new Map(
          (bmRows ?? []).map((r) => [r.board_id, r.role as BoardRole]),
        );
        const starSet = new Set((starred ?? []).map((s) => s.board_id));

        return {
          data: (boards ?? []).map((b) => ({
            ...b,
            my_role: roleMap.get(b.id) ?? null,
            is_starred: starSet.has(b.id),
          })) as BoardWithMeta[],
        };
      },
      providesTags: (_r, _e, { workspaceId }) => [
        { type: "Board", id: `WS-${workspaceId}` },
        "StarredBoard",
      ],
    }),

    getBoard: b.query<BoardWithMeta | null, { boardId: string }>({
      async queryFn({ boardId }) {
        const supabase = sb();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { data: null };

        const { data: board, error } = await supabase
          .from("boards")
          .select("*")
          .eq("id", boardId)
          .maybeSingle();
        if (error) return { error: mapSupabaseError(error) };
        if (!board) return { data: null };

        const { data: bm } = await supabase
          .from("board_members")
          .select("role")
          .eq("board_id", boardId)
          .eq("user_id", user.id)
          .maybeSingle();

        const { data: star } = await supabase
          .from("starred_boards")
          .select("board_id")
          .eq("user_id", user.id)
          .eq("board_id", boardId)
          .maybeSingle();

        return {
          data: {
            ...board,
            my_role: (bm?.role as BoardRole) ?? null,
            is_starred: !!star,
          } as BoardWithMeta,
        };
      },
      providesTags: (_r, _e, { boardId }) => [{ type: "Board", id: boardId }],
    }),

    listBoardMembers: b.query<BoardMember[], { boardId: string }>({
      async queryFn({ boardId }) {
        const { data, error } = await sb()
          .from("board_members")
          .select("board_id, user_id, role, profile:profiles(*)")
          .eq("board_id", boardId);
        if (error) return { error: mapSupabaseError(error) };
        return {
          data: ((data ?? []) as any[])
            .filter((r) => r.profile)
            .map((r) => ({
              board_id: r.board_id,
              user_id: r.user_id,
              role: r.role,
              profile: r.profile as Profile,
            })),
        };
      },
      providesTags: (_r, _e, { boardId }) => [
        { type: "BoardMember", id: boardId },
      ],
    }),

    listBoardColumns: b.query<BoardColumn[], { boardId: string }>({
      async queryFn({ boardId }) {
        const { data, error } = await sb()
          .from("board_columns")
          .select("*")
          .eq("board_id", boardId)
          .order("position");
        if (error) return { error: mapSupabaseError(error) };
        return { data: (data ?? []) as BoardColumn[] };
      },
      providesTags: (_r, _e, { boardId }) => [
        { type: "BoardColumn", id: boardId },
      ],
    }),

    /**
     * Returns everyone who can be assigned a task on this board.
     *
     * Private board → board_members.
     * Public board → all workspace members (except viewers, who can read-only).
     */
    listAssignableMembers: b.query<
      Array<{
        user_id: string;
        role: BoardRole | "workspace";
        profile: Profile;
      }>,
      { boardId: string }
    >({
      async queryFn({ boardId }) {
        const supabase = sb();
        const { data: board } = await supabase
          .from("boards")
          .select("workspace_id, visibility")
          .eq("id", boardId)
          .maybeSingle();
        if (!board) return { data: [] };

        if (board.visibility === "private") {
          const { data, error } = await supabase
            .from("board_members")
            .select("user_id, role, profile:profiles(*)")
            .eq("board_id", boardId);
          if (error) return { error: mapSupabaseError(error) };
          return {
            data: ((data ?? []) as any[])
              .filter((r) => r.profile)
              .map((r) => ({
                user_id: r.user_id,
                role: r.role,
                profile: r.profile as Profile,
              })),
          };
        }

        // Public board: everyone in the workspace except viewers
        const { data: ws, error } = await supabase
          .from("workspace_members")
          .select("user_id, role, profile:profiles(*)")
          .eq("workspace_id", board.workspace_id)
          .neq("role", "viewer");
        if (error) return { error: mapSupabaseError(error) };
        return {
          data: ((ws ?? []) as any[])
            .filter((r) => r.profile)
            .map((r) => ({
              user_id: r.user_id,
              role: "workspace" as const,
              profile: r.profile as Profile,
            })),
        };
      },
      providesTags: (_r, _e, { boardId }) => [
        { type: "BoardMember", id: `ASSIGNABLE-${boardId}` },
      ],
    }),

    // features/boards/boardApi.ts  —  createBoard mutation

    createBoard: b.mutation<
      Board,
      { workspaceId: string; input: BoardCreateInput }
    >({
      async queryFn({ workspaceId, input }) {
        const supabase = sb();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { message: "Not authenticated" } };

        const { initial_member_ids, initial_admin_ids, ...boardFields } = input;

        const { error: insertError } = await supabase.from("boards").insert({
          ...boardFields,
          workspace_id: workspaceId,
          created_by: user.id,
        });

        if (insertError) return { error: mapSupabaseError(insertError) };

        // ✅ Step 2: Fetch the board in a separate round-trip so the trigger's
        // board_members row is committed and RLS passes cleanly.
        const { data: board, error: fetchError } = await supabase
          .from("boards")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("created_by", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (fetchError) return { error: mapSupabaseError(fetchError) };

        // Step 3: Add extra members for private boards (unchanged)
        if (
          boardFields.visibility === "private" &&
          initial_member_ids.length > 0
        ) {
          const adminSet = new Set(initial_admin_ids);
          const rows = initial_member_ids
            .filter((uid) => uid !== user.id)
            .map((uid) => ({
              board_id: board.id,
              user_id: uid,
              role: (adminSet.has(uid) ? "admin" : "member") as BoardRole,
            }));
          if (rows.length > 0) {
            const { error: bmErr } = await supabase
              .from("board_members")
              .insert(rows);
            if (bmErr) {
              await supabase.from("boards").delete().eq("id", board.id);
              return { error: mapSupabaseError(bmErr) };
            }
          }
        }

        return { data: board as Board };
      },
      invalidatesTags: (_r, _e, { workspaceId }) => [
        { type: "Board", id: `WS-${workspaceId}` },
      ],
    }),

    updateBoard: b.mutation<
      Board,
      { boardId: string; input: BoardUpdateInput }
    >({
      async queryFn({ boardId, input }) {
        const { data, error } = await sb()
          .from("boards")
          .update(input)
          .eq("id", boardId)
          .select()
          .single();
        if (error) return { error: mapSupabaseError(error) };
        return { data: data as Board };
      },
      invalidatesTags: (_r, _e, { boardId }) => [
        { type: "Board", id: boardId },
        "Board",
      ],
    }),

    deleteBoard: b.mutation<void, { boardId: string }>({
      async queryFn({ boardId }) {
        const { error } = await sb().from("boards").delete().eq("id", boardId);
        if (error) return { error: mapSupabaseError(error) };
        return { data: undefined };
      },
      invalidatesTags: ["Board"],
    }),

    addBoardMember: b.mutation<
      void,
      { boardId: string; userId: string; role: BoardRole }
    >({
      async queryFn({ boardId, userId, role }) {
        const { error } = await sb()
          .from("board_members")
          .insert({ board_id: boardId, user_id: userId, role });
        if (error) return { error: mapSupabaseError(error) };
        return { data: undefined };
      },
      invalidatesTags: (_r, _e, { boardId }) => [
        { type: "BoardMember", id: boardId },
        { type: "BoardMember", id: `ASSIGNABLE-${boardId}` },
      ],
    }),

    removeBoardMember: b.mutation<void, { boardId: string; userId: string }>({
      async queryFn({ boardId, userId }) {
        const { error } = await sb()
          .from("board_members")
          .delete()
          .eq("board_id", boardId)
          .eq("user_id", userId);
        if (error) return { error: mapSupabaseError(error) };
        return { data: undefined };
      },
      invalidatesTags: (_r, _e, { boardId }) => [
        { type: "BoardMember", id: boardId },
        { type: "BoardMember", id: `ASSIGNABLE-${boardId}` },
      ],
    }),

    toggleStarBoard: b.mutation<{ starred: boolean }, { boardId: string }>({
      async queryFn({ boardId }) {
        const supabase = sb();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { message: "Not authenticated" } };

        const { data: existing } = await supabase
          .from("starred_boards")
          .select("board_id")
          .eq("user_id", user.id)
          .eq("board_id", boardId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("starred_boards")
            .delete()
            .eq("user_id", user.id)
            .eq("board_id", boardId);
          return { data: { starred: false } };
        }
        await supabase
          .from("starred_boards")
          .insert({ user_id: user.id, board_id: boardId });
        return { data: { starred: true } };
      },
      invalidatesTags: ["StarredBoard", "Board"],
    }),
  }),
});

export const {
  useListBoardsQuery,
  useGetBoardQuery,
  useListBoardMembersQuery,
  useListBoardColumnsQuery,
  useListAssignableMembersQuery,
  useCreateBoardMutation,
  useUpdateBoardMutation,
  useDeleteBoardMutation,
  useAddBoardMemberMutation,
  useRemoveBoardMemberMutation,
  useToggleStarBoardMutation,
} = boardApi;
