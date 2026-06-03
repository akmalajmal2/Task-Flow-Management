import { createListenerMiddleware, isRejectedWithValue } from '@reduxjs/toolkit';
import { toast } from 'sonner';

/**
 * Centralized place for cross-cutting reactions to mutations.
 *
 * Today: toasts every mutation rejection so individual components don't
 * have to. Components can still .unwrap() and catch if they want bespoke
 * handling — they just need to swallow the error since the toast already
 * fired here.
 */
export const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
  matcher: isRejectedWithValue,
  effect: (action) => {
    const payload = action.payload as { message?: string } | undefined;
    const msg = payload?.message ?? 'Something went wrong';
    // RTK Query also rejects on unmount; ignore those
    if (msg === 'Aborted') return;
    toast.error(msg);
  },
});
