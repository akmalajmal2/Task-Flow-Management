import { baseApi } from '@/store/baseApi';
import { createClient } from '@/lib/supabase/client';
import { mapSupabaseError } from '@/lib/errors/map';
import type {
  Workspace,
  WorkspaceWithRole,
  WorkspaceMember,
  WorkspaceRole,
  Profile,
} from '@/types/domain';
import type { WorkspaceCreateInput, WorkspaceUpdateInput } from '@/lib/validations/workspace';

const sb = () => createClient();

export const workspaceApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listMyWorkspaces: b.query<WorkspaceWithRole[], void>({
      async queryFn() {
        const supabase = sb();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { data: [] };

        const { data, error } = await supabase
          .from('workspace_members')
          .select('role, workspace:workspaces(*)')
          .eq('user_id', user.id);

        if (error) return { error: mapSupabaseError(error) };

        const list = (data ?? [])
          .filter((r: any) => r.workspace)
          .map((r: any) => ({ ...r.workspace, role: r.role as WorkspaceRole }));
        return { data: list as WorkspaceWithRole[] };
      },
      providesTags: ['Workspace'],
    }),

    getWorkspace: b.query<WorkspaceWithRole | null, { workspaceId: string }>({
      async queryFn({ workspaceId }) {
        const supabase = sb();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { data: null };

        const { data: ws, error } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', workspaceId)
          .maybeSingle();
        if (error) return { error: mapSupabaseError(error) };
        if (!ws) return { data: null };

        const { data: m } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', workspaceId)
          .eq('user_id', user.id)
          .maybeSingle();

        return { data: { ...ws, role: (m?.role ?? 'member') as WorkspaceRole } };
      },
      providesTags: (_r, _e, { workspaceId }) => [{ type: 'Workspace', id: workspaceId }],
    }),

    listWorkspaceMembers: b.query<WorkspaceMember[], { workspaceId: string }>({
      async queryFn({ workspaceId }) {
        const { data, error } = await sb()
          .from('workspace_members')
          .select('workspace_id, user_id, role, profile:profiles(*)')
          .eq('workspace_id', workspaceId)
          .order('role'); // owners first, then admins, members, viewers
        if (error) return { error: mapSupabaseError(error) };
        return {
          data: ((data ?? []) as any[])
            .filter((r) => r.profile)
            .map((r) => ({
              workspace_id: r.workspace_id,
              user_id: r.user_id,
              role: r.role,
              profile: r.profile as Profile,
            })),
        };
      },
      // FIX: include ALL three tag forms so any invalidation variant hits this query:
      //   - generic string "WorkspaceMember" (acceptInvitation fires this)
      //   - { type, id: workspaceId } (updateMemberRole/removeMember fire this)
      //   - { type, id: 'LIST' }      (acceptInvitation also fires this)
      providesTags: (_r, _e, { workspaceId }) => [
        'WorkspaceMember',
        { type: 'WorkspaceMember', id: workspaceId },
        { type: 'WorkspaceMember', id: 'LIST' },
      ],
      // Belt-and-suspenders: refetch when the window regains focus (owner
      // switches tabs after the invitee accepted in another window)
      keepUnusedDataFor: 60,
    }),

    createWorkspace: b.mutation<Workspace, WorkspaceCreateInput>({
      async queryFn(input) {
        const supabase = sb();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { message: 'Not authenticated' } };

        const { data, error } = await supabase
          .from('workspaces')
          .insert({ ...input, owner_id: user.id })
          .select()
          .single();
        if (error) return { error: mapSupabaseError(error) };
        return { data: data as Workspace };
      },
      invalidatesTags: ['Workspace'],
    }),

    updateWorkspace: b.mutation<Workspace, { workspaceId: string; input: WorkspaceUpdateInput }>({
      async queryFn({ workspaceId, input }) {
        const { data, error } = await sb()
          .from('workspaces')
          .update(input)
          .eq('id', workspaceId)
          .select()
          .single();
        if (error) return { error: mapSupabaseError(error) };
        return { data: data as Workspace };
      },
      invalidatesTags: (_r, _e, { workspaceId }) => [
        'Workspace',
        { type: 'Workspace', id: workspaceId },
      ],
    }),

    deleteWorkspace: b.mutation<void, { workspaceId: string }>({
      async queryFn({ workspaceId }) {
        const { error } = await sb().from('workspaces').delete().eq('id', workspaceId);
        if (error) return { error: mapSupabaseError(error) };
        return { data: undefined };
      },
      invalidatesTags: ['Workspace'],
    }),

    updateMemberRole: b.mutation<void, { workspaceId: string; userId: string; role: WorkspaceRole }>({
      async queryFn({ workspaceId, userId, role }) {
        const { error } = await sb()
          .from('workspace_members')
          .update({ role })
          .eq('workspace_id', workspaceId)
          .eq('user_id', userId);
        if (error) return { error: mapSupabaseError(error) };
        return { data: undefined };
      },
      invalidatesTags: (_r, _e, { workspaceId }) => [
        { type: 'WorkspaceMember', id: workspaceId },
        { type: 'WorkspaceMember', id: 'LIST' },
      ],
    }),

    removeMember: b.mutation<void, { workspaceId: string; userId: string }>({
      async queryFn({ workspaceId, userId }) {
        const { error } = await sb()
          .from('workspace_members')
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('user_id', userId);
        if (error) return { error: mapSupabaseError(error) };
        return { data: undefined };
      },
      invalidatesTags: (_r, _e, { workspaceId }) => [
        { type: 'WorkspaceMember', id: workspaceId },
        { type: 'WorkspaceMember', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useListMyWorkspacesQuery,
  useGetWorkspaceQuery,
  useListWorkspaceMembersQuery,
  useCreateWorkspaceMutation,
  useUpdateWorkspaceMutation,
  useDeleteWorkspaceMutation,
  useUpdateMemberRoleMutation,
  useRemoveMemberMutation,
} = workspaceApi;
