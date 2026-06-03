import { baseApi } from "@/store/baseApi";
import { createClient } from "@/lib/supabase/client";
import { mapSupabaseError } from "@/lib/errors/map";
import { POSITION_GAP } from "@/lib/constants";
import type { Task } from "@/types/domain";
import type { TaskCreateInput, TaskUpdateInput } from "@/lib/validations/task";

const sb = () => createClient();

/** Shared select string so both listBoardTasks and getTask stay in sync. */
const TASK_SELECT = `
  *,
  assignees:task_assignees(user_id, profile:profiles(*)),
  labels:task_labels(label:labels(*)),
  subtasks(*)
`;

/** Flatten the nested label join-rows that Supabase returns. */
function flattenLabels(t: any): Task {
  return {
    ...t,
    labels: (t.labels ?? []).map((x: any) => x.label).filter(Boolean),
  } as Task;
}

export const taskApi = baseApi.injectEndpoints(
  {
    endpoints: (b) => ({
      /**
       * All active tasks on a board, with assignees/labels/subtasks joined in.
       * RLS filters to what the caller can view.
       */
      listBoardTasks: b.query<Task[], { boardId: string }>({
        async queryFn({ boardId }) {
          const { data, error } = await sb()
            .from("tasks")
            .select(TASK_SELECT)
            .eq("board_id", boardId)
            .is("archived_at", null)
            .order("position");
          if (error) return { error: mapSupabaseError(error) };
          return { data: (data ?? []).map(flattenLabels) };
        },
        providesTags: (_r, _e, { boardId }) => [
          { type: "Task", id: `BOARD-${boardId}` },
        ],
      }),

      getTask: b.query<Task | null, { taskId: string }>({
        async queryFn({ taskId }) {
          const { data, error } = await sb()
            .from("tasks")
            .select(TASK_SELECT)
            .eq("id", taskId)
            .maybeSingle();
          if (error) return { error: mapSupabaseError(error) };
          if (!data) return { data: null };
          return { data: flattenLabels(data) };
        },
        providesTags: (_r, _e, { taskId }) => [{ type: "Task", id: taskId }],
      }),

      createTask: b.mutation<Task, TaskCreateInput>({
        async queryFn({ assignee_ids, label_ids, column_id, board_id, ...rest }) {
          const supabase = sb();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) return { error: { message: "Not authenticated" } };

          // Resolve column — use provided one or fall back to first by position
          let columnId = column_id;
          if (!columnId) {
            const { data: firstCol } = await supabase
              .from("board_columns")
              .select("id")
              .eq("board_id", board_id)
              .order("position")
              .limit(1)
              .maybeSingle();
            columnId = firstCol?.id ?? undefined;
          }
          if (!columnId) {
            return { error: { message: "No columns exist on this board." } };
          }

          // Append to bottom of column
          const { data: last } = await supabase
            .from("tasks")
            .select("position")
            .eq("column_id", columnId)
            .order("position", { ascending: false })
            .limit(1)
            .maybeSingle();
          const position = (last?.position ?? 0) + POSITION_GAP;

          // FIX: Use .select().single() on the insert instead of a separate fetch
          // — eliminates the race condition where another user's concurrent insert
          // could cause the refetch to return the wrong task.
          const { data: task, error: insertError } = await supabase
            .from("tasks")
            .insert({
              ...rest,
              board_id,
              column_id: columnId,
              position,
              created_by: user.id,
            })
            .select()
            .single();

          if (insertError) return { error: mapSupabaseError(insertError) };

          // Insert assignees and labels in parallel
          await Promise.all([
            assignee_ids?.length
              ? supabase
                  .from("task_assignees")
                  .insert(
                    assignee_ids.map((uid) => ({ task_id: task.id, user_id: uid })),
                  )
              : Promise.resolve(),
            label_ids?.length
              ? supabase
                  .from("task_labels")
                  .insert(
                    label_ids.map((lid) => ({ task_id: task.id, label_id: lid })),
                  )
              : Promise.resolve(),
          ]);

          return { data: task as Task };
        },
        invalidatesTags: (_r, _e, { board_id }) => [
          { type: "Task", id: `BOARD-${board_id}` },
        ],
      }),

      updateTask: b.mutation<
        Task,
        { taskId: string; boardId: string; input: TaskUpdateInput }
      >({
        async queryFn({ taskId, input }) {
          const { data, error } = await sb()
            .from("tasks")
            .update(input)
            .eq("id", taskId)
            .select()
            .single();
          if (error) return { error: mapSupabaseError(error) };
          return { data: data as Task };
        },
        invalidatesTags: (_r, _e, { taskId, boardId }) => [
          { type: "Task", id: taskId },
          { type: "Task", id: `BOARD-${boardId}` },
        ],
      }),

      moveTask: b.mutation<
        void,
        { taskId: string; boardId: string; columnId: string; position: number }
      >({
        async queryFn({ taskId, columnId, position }) {
          const { error } = await sb()
            .from("tasks")
            .update({ column_id: columnId, position })
            .eq("id", taskId);
          if (error) return { error: mapSupabaseError(error) };
          return { data: undefined };
        },
        async onQueryStarted(
          { taskId, boardId, columnId, position },
          { dispatch, queryFulfilled },
        ) {
          const patch = dispatch(
            taskApi.util.updateQueryData(
              "listBoardTasks",
              { boardId },
              (draft) => {
                const t = draft.find((x) => x.id === taskId);
                if (t) {
                  t.column_id = columnId;
                  t.position = position;
                }
                draft.sort((a, b) => a.position - b.position);
              },
            ),
          );
          try {
            await queryFulfilled;
          } catch {
            patch.undo();
          }
        },
      }),

      deleteTask: b.mutation<void, { taskId: string; boardId: string }>({
        async queryFn({ taskId }) {
          const { error } = await sb().from("tasks").delete().eq("id", taskId);
          if (error) return { error: mapSupabaseError(error) };
          return { data: undefined };
        },
        // Optimistic removal from list cache
        async onQueryStarted({ taskId, boardId }, { dispatch, queryFulfilled }) {
          const patch = dispatch(
            taskApi.util.updateQueryData("listBoardTasks", { boardId }, (draft) => {
              const idx = draft.findIndex((t) => t.id === taskId);
              if (idx !== -1) draft.splice(idx, 1);
            }),
          );
          try {
            await queryFulfilled;
          } catch {
            patch.undo();
          }
        },
        invalidatesTags: (_r, _e, { boardId }) => [
          { type: "Task", id: `BOARD-${boardId}` },
        ],
      }),

      setAssignees: b.mutation<
        void,
        { taskId: string; boardId: string; userIds: string[] }
      >({
        async queryFn({ taskId, userIds }) {
          const supabase = sb();
          const { data: existing } = await supabase
            .from("task_assignees")
            .select("user_id")
            .eq("task_id", taskId);
          const existingSet = new Set((existing ?? []).map((r) => r.user_id));
          const desiredSet = new Set(userIds);
          const toAdd = [...desiredSet].filter((u) => !existingSet.has(u));
          const toRemove = [...existingSet].filter((u) => !desiredSet.has(u));

          // Run add and remove in parallel
          await Promise.all([
            toAdd.length
              ? supabase
                  .from("task_assignees")
                  .insert(toAdd.map((uid) => ({ task_id: taskId, user_id: uid })))
              : Promise.resolve(),
            toRemove.length
              ? supabase
                  .from("task_assignees")
                  .delete()
                  .eq("task_id", taskId)
                  .in("user_id", toRemove)
              : Promise.resolve(),
          ]);

          return { data: undefined };
        },
        invalidatesTags: (_r, _e, { taskId, boardId }) => [
          { type: "Task", id: taskId },
          { type: "Task", id: `BOARD-${boardId}` },
        ],
      }),

      /** Sync the full set of labels on a task (replace-all semantics). */
      setLabels: b.mutation<
        void,
        { taskId: string; boardId: string; labelIds: string[] }
      >({
        async queryFn({ taskId, labelIds }) {
          const supabase = sb();
          const { error: delError } = await supabase
            .from("task_labels")
            .delete()
            .eq("task_id", taskId);
          if (delError) return { error: mapSupabaseError(delError) };
          if (labelIds.length > 0) {
            const { error: insError } = await supabase
              .from("task_labels")
              .insert(labelIds.map((lid) => ({ task_id: taskId, label_id: lid })));
            if (insError) return { error: mapSupabaseError(insError) };
          }
          return { data: undefined };
        },
        invalidatesTags: (_r, _e, { taskId, boardId }) => [
          { type: "Task", id: taskId },
          { type: "Task", id: `BOARD-${boardId}` },
        ],
      }),

      rateTask: b.mutation<
        void,
        { taskId: string; boardId: string; stars: number }
      >({
        async queryFn({ taskId, stars }) {
          const { error } = await sb()
            .from("tasks")
            .update({ weight_stars: stars })
            .eq("id", taskId);
          if (error) return { error: mapSupabaseError(error) };
          return { data: undefined };
        },
        invalidatesTags: (_r, _e, { taskId, boardId }) => [
          { type: "Task", id: taskId },
          { type: "Task", id: `BOARD-${boardId}` },
        ],
      }),
    }),
  },
);

export const {
  useListBoardTasksQuery,
  useGetTaskQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useMoveTaskMutation,
  useDeleteTaskMutation,
  useSetAssigneesMutation,
  useSetLabelsMutation,
  useRateTaskMutation,
} = taskApi;

// Export the renormalize helper so board components can call it
export async function renormalizeColumnPositions(
  boardId: string,
  columnId: string,
): Promise<void> {
  const supabase = (await import('@/lib/supabase/client')).createClient();
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, position')
    .eq('column_id', columnId)
    .is('archived_at', null)
    .order('position');

  if (!tasks || tasks.length === 0) return;

  const { renormalizePositions } = await import('@/lib/utils/slug');
  const patches = renormalizePositions(tasks);

  // Batch update using upsert
  await supabase
    .from('tasks')
    .upsert(patches.map((p) => ({ id: p.id, position: p.position, board_id: boardId })));
}


