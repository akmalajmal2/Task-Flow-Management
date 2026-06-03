import { baseApi } from "@/store/baseApi";
import { createClient } from "@/lib/supabase/client";
import { mapSupabaseError } from "@/lib/errors/map";
import type { Notification } from "@/types/domain";

const sb = () => createClient();

export const notificationApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listMyNotifications: b.query<Notification[], { limit?: number } | void>({
      async queryFn(args) {
        const limit = args?.limit ?? 50;
        const supabase = sb();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { data: [] };

        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) return { error: mapSupabaseError(error) };
        return { data: (data ?? []) as Notification[] };
      },
      providesTags: ["Notification"],
    }),

    unreadCount: b.query<number, void>({
      async queryFn() {
        const supabase = sb();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { data: 0 };
        const { count, error } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("read_at", null);
        if (error) return { error: mapSupabaseError(error) };
        return { data: count ?? 0 };
      },
      providesTags: ["Notification"],
    }),

    markAsRead: b.mutation<void, { notificationId: string }>({
      async queryFn({ notificationId }) {
        const supabase = sb();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: { message: "Not authenticated" } };

        const { error } = await supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", notificationId)
          .eq("user_id", user.id); // ← ADD THIS

        if (error) return { error: mapSupabaseError(error) };
        return { data: undefined };
      },
      invalidatesTags: ["Notification"],
    }),

    markAllAsRead: b.mutation<void, void>({
      async queryFn() {
        const { error } = await sb().rpc("mark_all_notifications_read");
        if (error) return { error: mapSupabaseError(error) };
        return { data: undefined };
      },
      invalidatesTags: ["Notification"],
    }),
  }),
});

export const {
  useListMyNotificationsQuery,
  useUnreadCountQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
} = notificationApi;
