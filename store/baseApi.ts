import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Single shared RTK Query slice. Each feature `injectEndpoints` into this
 * one — that gives us a unified cache + invalidation graph across features.
 *
 * We use fakeBaseQuery instead of fetchBaseQuery because every endpoint
 * goes through the Supabase SDK (which handles auth, retries, and realtime
 * out of the box). Each endpoint defines its own queryFn.
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery<{ message: string; code?: string }>(),
  // Keep inactive queries warm for 5 minutes before evicting from cache.
  // Reduces refetch flicker when navigating back to a board.
  keepUnusedDataFor: 300,
  // Tags are how mutations invalidate queries. Keep them domain-grouped.
  tagTypes: [
    'Workspace',
    'WorkspaceMember',
    'Board',
    'BoardMember',
    'BoardColumn',
    'Label',
    'Task',
    'Subtask',   // FIX: was missing — subtaskApi uses { type: 'Subtask' }
    'Bug',
    'Comment',
    'Notification',
    'Invitation',
    'Profile',
    'StarredBoard',
  ],
  endpoints: () => ({}),
});
