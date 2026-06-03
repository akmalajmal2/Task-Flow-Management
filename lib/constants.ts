import type {
  WorkspaceRole,
  BoardRole,
  TaskPriority,
  BugSeverity,
  BugStatus,
} from '@/types/domain';

export const WORKSPACE_ROLES: WorkspaceRole[] = ['owner', 'admin', 'member', 'viewer'];
export const BOARD_ROLES: BoardRole[] = ['admin', 'member'];

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

export const TASK_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

/** Hex values used for the colored left-strip on TaskCard (Jira look). */
export const PRIORITY_HEX: Record<TaskPriority, string> = {
  low: '#64748b',       // slate-500
  medium: '#0ea5e9',    // sky-500
  high: '#f97316',      // orange-500
  critical: '#dc2626',  // red-600
};

export const BUG_SEVERITIES: BugSeverity[] = ['trivial', 'minor', 'major', 'critical', 'blocker'];

export const SEVERITY_COLORS: Record<BugSeverity, string> = {
  trivial: 'bg-gray-100 text-gray-700',
  minor: 'bg-blue-100 text-blue-700',
  major: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
  blocker: 'bg-red-200 text-red-900',
};

export const BUG_STATUSES: BugStatus[] = [
  'open',
  'assigned',
  'fixing',
  'fixed',
  'reopened',
  'closed',
];

export const BOARD_COLORS = [
  '#2563eb', // blue
  '#16a34a', // green
  '#9333ea', // purple
  '#db2777', // pink
  '#ea580c', // orange
  '#0891b2', // cyan
  '#65a30d', // lime
  '#dc2626', // red
];

export const DEFAULT_COLUMNS: Array<{ name: string; color: string }> = [
  { name: 'Backlog', color: '#94a3b8' },
  { name: 'In Progress', color: '#2563eb' },
  { name: 'In Review', color: '#9333ea' },
  { name: 'Done', color: '#16a34a' },
];

/**
 * Spacing between fractional positions when initializing a column. Picked
 * large enough that thousands of inserts can happen between any two cards
 * before we'd need to renumber.
 */
export const POSITION_GAP = 1024;
