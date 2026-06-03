import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils/cn';

interface Props {
  name: string | null | undefined;
  src?: string | null;
  className?: string;
}

export function UserAvatar({ name, src, className }: Props) {
  const initials = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

  return (
    <Avatar className={cn('h-8 w-8', className)}>
      {src && <AvatarImage src={src} alt={name ?? 'User'} />}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
