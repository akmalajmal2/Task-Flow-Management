import type { Task } from "./types";

const date = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export const fmtDate = (iso: string) => date.format(new Date(iso));
export const fmtDateTime = (iso: string) => `${date.format(new Date(iso))}, ${time.format(new Date(iso))}`;

export function duration(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 && h < 10 ? `${h}h ${m % 60}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

export interface DueInfo {
  overdue: boolean;
  label: string;
}

/** `now` is 0 until the client has hydrated, so server and client markup match. */
export function dueInfo(t: Pick<Task, "status" | "due_at">, now: number): DueInfo {
  const due = new Date(t.due_at).getTime();
  if (t.status === "done" || !now) return { overdue: false, label: fmtDate(t.due_at) };
  if (due < now) return { overdue: true, label: `${duration(now - due)} overdue` };
  return { overdue: false, label: due - now < 86_400_000 ? `Due in ${duration(due - now)}` : fmtDate(t.due_at) };
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** yyyy-mm-dd in the viewer's timezone (for <input type="date">). */
export function toLocalDate(iso: string): string {
  return toLocalInput(iso).slice(0, 10);
}

/** A picked calendar day means "end of that day" locally, so a task is never overdue on its due day. */
export function endOfDayIso(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 23, 59, 0, 0).toISOString();
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
