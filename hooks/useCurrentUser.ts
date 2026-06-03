'use client';

import { useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAppDispatch, useAppSelector } from './useAppStore';
import { setUser, clearUser } from '@/features/auth/authSlice';
import type { Profile } from '@/types/domain';

/**
 * Reads the current user (and profile) from Supabase, syncs into Redux,
 * and subscribes to auth state changes so logout in another tab clears
 * the session here too.
 */
export function useCurrentUser() {
  const dispatch = useAppDispatch();
  const { user, initialized } = useAppSelector((s) => s.auth);

  // FIX: wrap sync in useCallback so it's stable across renders and
  // can safely be called from the auth state change listener.
  const sync = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      dispatch(clearUser());
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    dispatch(setUser((profile as Profile) ?? null));
  }, [dispatch]);

  useEffect(() => {
    sync();

    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // FIX: on SIGNED_OUT we know the user is gone — no need to fetch profile
      if (event === 'SIGNED_OUT' || !session) {
        dispatch(clearUser());
      } else {
        sync();
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [sync, dispatch]);

  return { user, isLoading: !initialized };
}
