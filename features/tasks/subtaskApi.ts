import { baseApi } from '@/store/baseApi';
import { createClient } from '@/lib/supabase/client';
import { mapSupabaseError } from '@/lib/errors/map';
import type { Subtask, SubtaskStatus } from '@/types/domain';

const sb = () => createClient();

export const subtaskApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    createSubtask: b.mutation<
      Subtask,
      { taskId: string; boardId: string; title: string; assigneeId?: string }
    >({
      async queryFn({ taskId, title, assigneeId }) {
        const supabase = sb();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { message: 'Not authenticated' } };

        const { data, error } = await supabase
          .from('subtasks')
          .insert({
            task_id: taskId,
            title,
            assignee_id: assigneeId ?? user.id,
            created_by: user.id,
          })
          .select()
          .single();
        if (error) return { error: mapSupabaseError(error) };
        return { data: data as Subtask };
      },
      invalidatesTags: (_r, _e, { taskId, boardId }) => [
        { type: 'Task', id: taskId },
        { type: 'Task', id: `BOARD-${boardId}` },
      ],
    }),

    updateSubtaskStatus: b.mutation<
      Subtask,
      {
        subtaskId: string;
        taskId: string;
        boardId: string;
        status: SubtaskStatus;
        reviewNote?: string;
      }
    >({
      async queryFn({ subtaskId, status, reviewNote }) {
        const supabase = sb();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { message: 'Not authenticated' } };

        const updates: Record<string, unknown> = { status };
        if (status === 'done' || status === 'rejected') {
          updates.reviewed_by = user.id;
          updates.review_note = reviewNote ?? null;
        }

        const { data, error } = await supabase
          .from('subtasks')
          .update(updates)
          .eq('id', subtaskId)
          .select()
          .single();
        if (error) return { error: mapSupabaseError(error) };
        return { data: data as Subtask };
      },
      invalidatesTags: (_r, _e, { taskId, boardId }) => [
        { type: 'Task', id: taskId },
        { type: 'Task', id: `BOARD-${boardId}` },
      ],
    }),

    updateSubtaskTitle: b.mutation<
      Subtask,
      { subtaskId: string; taskId: string; boardId: string; title: string }
    >({
      async queryFn({ subtaskId, title }) {
        const { data, error } = await sb()
          .from('subtasks')
          .update({ title })
          .eq('id', subtaskId)
          .select()
          .single();
        if (error) return { error: mapSupabaseError(error) };
        return { data: data as Subtask };
      },
      invalidatesTags: (_r, _e, { taskId }) => [{ type: 'Task', id: taskId }],
    }),

    deleteSubtask: b.mutation<void, { subtaskId: string; taskId: string; boardId: string }>({
      async queryFn({ subtaskId }) {
        const { error } = await sb().from('subtasks').delete().eq('id', subtaskId);
        if (error) return { error: mapSupabaseError(error) };
        return { data: undefined };
      },
      invalidatesTags: (_r, _e, { taskId, boardId }) => [
        { type: 'Task', id: taskId },
        { type: 'Task', id: `BOARD-${boardId}` },
      ],
    }),
  }),
});

export const {
  useCreateSubtaskMutation,
  useUpdateSubtaskStatusMutation,
  useUpdateSubtaskTitleMutation,
  useDeleteSubtaskMutation,
} = subtaskApi;
