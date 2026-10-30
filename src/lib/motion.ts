import { flushSync } from "react-dom";

type VT = Document & { startViewTransition?: (cb: () => void) => unknown };

/**
 * Run a state update inside a View Transition so cards glide to their new place
 * instead of jumping. Falls back to a plain update when the browser has no
 * support or the person prefers reduced motion.
 */
export function withTransition(update: () => void) {
  const d = typeof document === "undefined" ? undefined : (document as VT);
  if (!d?.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return update();
  d.startViewTransition(() => flushSync(update));
}
