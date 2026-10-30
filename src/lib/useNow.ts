"use client";
import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  const id = setInterval(cb, 30_000);
  return () => clearInterval(id);
};

/** Current time, bucketed to 30s. Returns 0 during SSR/hydration. */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 30_000) * 30_000,
    () => 0,
  );
}
