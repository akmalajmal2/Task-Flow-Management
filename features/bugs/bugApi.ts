import { baseApi } from '@/store/baseApi';
import { createClient } from '@/lib/supabase/client';
import { mapSupabaseError } from '@/lib/errors/map';
import type { Bug, BugSeverity, BugStatus, Profile } from '@/types/domain';

const sb = () => createClient();

interface BugCreateInput {
  board_id: string;
  title: string;
  description?: string;
  steps_to_repro?: string;
  expected?: string;
  actual?: string;
  severity: BugSeverity;
  assignee_id?: string;
}

interface BugUpdateInput {
  title?: string;
  description?: string;
  steps_to_repro?: string;
  expected?: string;
  actual?: string;
  severity?: BugSeverity;
  status?: BugStatus;
  assignee_id?: string | null;
}

export const bugApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listBoardBugs: b.query<Bug[], { boardId: string }>({
      async queryFn({ boardId }) {
        const { data, error } = await sb()
          .from('bugs')
          .select('*, reporter:profiles!bugs_reporter_id_fkey(*), assignee:profiles!bugs_assignee_id_fkey(*)')
          .eq('board_id', boardId)
          .order('created_at', { ascending: false });
        if (error) return { error: mapSupabaseError(error) };
        return {
          data: ((data ?? []) as any[]).map((r) => ({
            ...r,
            reporter: r.reporter as Profile | undefined,
            assignee: r.assignee as Profile | null,
          })),
        };
      },
      providesTags: (_r, _e, { boardId }) => [{ type: 'Bug', id: `BOARD-${boardId}` }],
    }),

    getBug: b.query<Bug | null, { bugId: string }>({
      async queryFn({ bugId }) {
        const { data, error } = await sb()
          .from('bugs')
          .select('*, reporter:profiles!bugs_reporter_id_fkey(*), assignee:profiles!bugs_assignee_id_fkey(*)')
          .eq('id', bugId)
          .maybeSingle();
        if (error) return { error: mapSupabaseError(error) };
        return { data: (data as Bug | null) ?? null };
      },
      providesTags: (_r, _e, { bugId }) => [{ type: 'Bug', id: bugId }],
    }),

    createBug: b.mutation<Bug, BugCreateInput>({
      async queryFn(input) {
        const supabase = sb();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { message: 'Not authenticated' } };

        const { data, error } = await supabase
          .from('bugs')
          .insert({
            ...input,
            reporter_id: user.id,
            status: input.assignee_id ? 'assigned' : 'open',
          })
          .select()
          .single();
        if (error) return { error: mapSupabaseError(error) };
        return { data: data as Bug };
      },
      invalidatesTags: (_r, _e, { board_id }) => [{ type: 'Bug', id: `BOARD-${board_id}` }],
    }),

    updateBug: b.mutation<Bug, { bugId: string; boardId: string; input: BugUpdateInput }>({
      async queryFn({ bugId, input }) {
        const { data, error } = await sb()
          .from('bugs')
          .update(input)
          .eq('id', bugId)
          .select()
          .single();
        if (error) return { error: mapSupabaseError(error) };
        return { data: data as Bug };
      },
      invalidatesTags: (_r, _e, { bugId, boardId }) => [
        { type: 'Bug', id: bugId },
        { type: 'Bug', id: `BOARD-${boardId}` },
      ],
    }),

    deleteBug: b.mutation<void, { bugId: string; boardId: string }>({
      async queryFn({ bugId }) {
        const { error } = await sb().from('bugs').delete().eq('id', bugId);
        if (error) return { error: mapSupabaseError(error) };
        return { data: undefined };
      },
      invalidatesTags: (_r, _e, { boardId }) => [{ type: 'Bug', id: `BOARD-${boardId}` }],
    }),
  }),
});

export const {
  useListBoardBugsQuery,
  useGetBugQuery,
  useCreateBugMutation,
  useUpdateBugMutation,
  useDeleteBugMutation,
} = bugApi;
