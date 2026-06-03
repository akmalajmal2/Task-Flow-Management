'use client';

import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

export interface ActionItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onSelect: (e: Event) => void;
  destructive?: boolean;
  separatorBefore?: boolean;
}

interface Props {
  items: ActionItem[];
  className?: string;
  stopPropagation?: boolean;
  size?: 'sm' | 'default';
}

export function ActionMenu({ items, className, stopPropagation = true, size = 'sm' }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(size === 'sm' ? 'h-7 w-7' : 'h-9 w-9', className)}
          onClick={(e) => {
            if (stopPropagation) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <MoreHorizontal className={cn(size === 'sm' ? 'h-4 w-4' : 'h-5 w-5')} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(e) => stopPropagation && e.stopPropagation()}
      >
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i}>
              {item.separatorBefore && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onSelect={item.onSelect}
                className={cn('gap-2', item.destructive && 'text-destructive focus:text-destructive')}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {item.label}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
