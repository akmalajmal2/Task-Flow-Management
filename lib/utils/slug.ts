/**
 * Compute a board's auto-generated key from its name.
 * "Mobile App" → "MOB". Capped to 6 chars; user can override.
 */
export function generateBoardKey(name: string) {
  const cleaned = name
    .replace(/[^a-zA-Z\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (cleaned.length === 0) return '';
  if (cleaned.length === 1) {
    return cleaned[0]!.slice(0, 4).toUpperCase();
  }
  return cleaned
    .slice(0, 4)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/**
 * Average two fractional positions. Used by the kanban drag handler to
 * place a card between two siblings without renumbering everything.
 *
 * If `before` and `after` are within RENUMBER_THRESHOLD of each other,
 * the caller should trigger a column renormalization.
 */
export function avgPosition(before: number | null, after: number | null): number {
  if (before == null && after == null) return 1024;
  if (before == null) return after! / 2;
  if (after == null) return before + 1024;
  return (before + after) / 2;
}

/**
 * Minimum gap between positions before we consider a column "crowded"
 * and needing renormalization. When avgPosition returns a value where
 * the gap to its neighbours is below this threshold, call renormalizePositions.
 */
export const POSITION_MIN_GAP = 0.001;

/**
 * Rewrite positions for a set of tasks in a column to be evenly spaced
 * starting at POSITION_GAP. Returns an array of { id, position } patches
 * to apply — the caller owns writing them back to the DB.
 *
 * This avoids the "infinite bisection" problem where repeated drags between
 * the same two cards produce positions that converge to zero precision.
 */
export function renormalizePositions(
  tasks: Array<{ id: string; position: number }>,
  gap = 1024,
): Array<{ id: string; position: number }> {
  const sorted = [...tasks].sort((a, b) => a.position - b.position);
  return sorted.map((t, i) => ({ id: t.id, position: (i + 1) * gap }));
}
