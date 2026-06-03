import { baseApi } from '@/store/baseApi';
import { createClient } from '@/lib/supabase/client';
import { mapSupabaseError } from '@/lib/errors/map';
import type { Comment, CommentParentType, Profile } from '@/types/domain';

const sb = () => createClient();

export const commentApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listComments: b.query<Comment[], { parentType: CommentParentType; parentId: string }>({
      async queryFn({ parentType, parentId }) {
        const { data, error } = await sb()
          .from('comments')
          .select('*, author:profiles(*)')
          .eq('parent_type', parentType)
          .eq('parent_id', parentId)
          .order('created_at');
        if (error) return { error: mapSupabaseError(error) };
        return {
          data: ((data ?? []) as any[]).map((r) => ({ ...r, author: r.author as Profile })),
        };
      },
      providesTags: (_r, _e, { parentType, parentId }) => [
        { type: 'Comment', id: `${parentType}-${parentId}` },
      ],
    }),

    createComment: b.mutation<
      Comment,
      {
        parentType: CommentParentType;
        parentId: string;
        body: string;
        bodyJson: unknown;
      }
    >({
      async queryFn({ parentType, parentId, body, bodyJson }) {
        const supabase = sb();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { message: 'Not authenticated' } };

        const { data, error } = await supabase
          .from('comments')
          .insert({
            parent_type: parentType,
            parent_id: parentId,
            body,
            body_json: bodyJson,
            author_id: user.id,
          })
          .select('*, author:profiles(*)')
          .single();
        if (error) return { error: mapSupabaseError(error) };
        return { data: data as Comment };
      },
      invalidatesTags: (_r, _e, { parentType, parentId }) => [
        { type: 'Comment', id: `${parentType}-${parentId}` },
      ],
    }),

    deleteComment: b.mutation<
      void,
      { commentId: string; parentType: CommentParentType; parentId: string }
    >({
      async queryFn({ commentId }) {
        const { error } = await sb().from('comments').delete().eq('id', commentId);
        if (error) return { error: mapSupabaseError(error) };
        return { data: undefined };
      },
      invalidatesTags: (_r, _e, { parentType, parentId }) => [
        { type: 'Comment', id: `${parentType}-${parentId}` },
      ],
    }),
  }),
});

export const { useListCommentsQuery, useCreateCommentMutation, useDeleteCommentMutation } = commentApi;
