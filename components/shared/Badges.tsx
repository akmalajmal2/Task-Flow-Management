import { cn } from '@/lib/utils/cn';
import type { TaskPriority, BugSeverity } from '@/types/domain';

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: 'bg-slate-500 text-white',
  medium: 'bg-sky-500 text-white',
  high: 'bg-orange-500 text-white',
  critical: 'bg-red-600 text-white',
};

const SEVERITY_STYLES: Record<BugSeverity, string> = {
  trivial: 'bg-slate-400 text-white',
  minor: 'bg-sky-500 text-white',
  major: 'bg-orange-500 text-white',
  critical: 'bg-red-600 text-white',
  blocker: 'bg-purple-700 text-white',
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={cn(
        'status-pill capitalize',
        PRIORITY_STYLES[priority]
      )}
    >
      {priority}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: BugSeverity }) {
  return (
    <span className={cn('status-pill capitalize', SEVERITY_STYLES[severity])}>
      {severity}
    </span>
  );
}
