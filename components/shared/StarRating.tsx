'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Props {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: number;
}

export function StarRating({ value, onChange, readOnly, size = 16 }: Props) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n === value ? 0 : n)}
          className={cn('transition-transform hover:scale-110 disabled:hover:scale-100', readOnly && 'cursor-default')}
        >
          <Star
            width={size}
            height={size}
            className={cn(
              'transition-colors',
              n <= value ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'
            )}
          />
        </button>
      ))}
    </div>
  );
}
