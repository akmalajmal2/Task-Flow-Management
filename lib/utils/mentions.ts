/**
 * Walk a Tiptap JSON document and collect all mention user IDs.
 * The mention extension stores the user id under `attrs.id`.
 */
export function extractMentions(doc: unknown): string[] {
  const ids = new Set<string>();
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'mention' && node.attrs?.id) {
      ids.add(String(node.attrs.id));
    }
    if (Array.isArray(node.content)) node.content.forEach(visit);
  };
  visit(doc);
  return [...ids];
}
