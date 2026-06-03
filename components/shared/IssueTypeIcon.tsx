import { ListTodo, Bug, CheckSquare, Bookmark, Zap } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type IssueType = 'task' | 'subtask' | 'bug' | 'story' | 'epic';

const TYPE_STYLES: Record<
  IssueType,
  { icon: React.ComponentType<{ className?: string }>; bg: string; label: string }
> = {
  task:    { icon: ListTodo,    bg: 'bg-sky-500',     label: 'Task' },
  subtask: { icon: CheckSquare, bg: 'bg-cyan-500',    label: 'Subtask' },
  bug:     { icon: Bug,         bg: 'bg-red-600',     label: 'Bug' },
  story:   { icon: Bookmark,    bg: 'bg-emerald-600', label: 'Story' },
  epic:    { icon: Zap,         bg: 'bg-purple-600',  label: 'Epic' },
};

interface Props {
  type: IssueType;
  className?: string;
  size?: 'sm' | 'md';
  withLabel?: boolean;
}

/**
 * Jira-style colored square tile with white icon. Optional inline label.
 * The tile's color encodes the type at a glance — the single most
 * recognizable Jira UI signal.
 */
export function IssueTypeIcon({ type, className, size = 'sm', withLabel = false }: Props) {
  const { icon: Icon, bg, label } = TYPE_STYLES[type];
  const dim = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  const iconDim = size === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5';
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className={cn('flex shrink-0 items-center justify-center rounded-sm text-white', dim, bg)}>
        <Icon className={iconDim} />
      </span>
      {withLabel && <span className="text-xs font-medium">{label}</span>}
    </span>
  );
}
