'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { Mail, UserPlus, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { cn } from '@/lib/utils/cn';
import type { Profile } from '@/types/domain';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface MemberChip {
  kind: 'member';
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
}
export interface InviteChip {
  kind: 'invite';
  email: string;
  isAdmin: boolean;
}
export type RecipientChip = MemberChip | InviteChip;

interface Props {
  existingMembers: Array<{ user_id: string; profile: Profile }>;
  excludeUserIds?: string[];
  value: RecipientChip[];
  onChange: (chips: RecipientChip[]) => void;
  allowAdminToggle?: boolean;
  placeholder?: string;
  error?: string;
}

export function MemberOrEmailCombobox({
  existingMembers,
  excludeUserIds = [],
  value,
  onChange,
  allowAdminToggle = true,
  placeholder = 'Add people by name or email…',
  error,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const excludedUsers = new Set([
    ...excludeUserIds,
    ...value.filter((c): c is MemberChip => c.kind === 'member').map((c) => c.userId),
  ]);
  const excludedEmails = new Set(value.map((c) => c.email.toLowerCase()));

  const q = query.trim().toLowerCase();

  const suggestions = q
    ? existingMembers
        .filter((m) => !excludedUsers.has(m.user_id))
        .filter((m) =>
          (m.profile.full_name ?? '').toLowerCase().includes(q) ||
          m.profile.email.toLowerCase().includes(q)
        )
        .slice(0, 8)
    : existingMembers.filter((m) => !excludedUsers.has(m.user_id)).slice(0, 8);

  const queryLooksLikeEmail = EMAIL_RE.test(q);
  const queryMatchesMember = existingMembers.some((m) => m.profile.email.toLowerCase() === q);
  const queryAlreadyChipped = excludedEmails.has(q);
  const showInviteRow = queryLooksLikeEmail && !queryMatchesMember && !queryAlreadyChipped;

  const addMember = (m: { user_id: string; profile: Profile }) => {
    if (excludedUsers.has(m.user_id)) return;
    onChange([
      ...value,
      {
        kind: 'member',
        userId: m.user_id,
        email: m.profile.email,
        fullName: m.profile.full_name,
        avatarUrl: m.profile.avatar_url,
        isAdmin: false,
      },
    ]);
    setQuery('');
    inputRef.current?.focus();
  };

  const addInvite = (email: string) => {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized) || excludedEmails.has(normalized)) return;
    onChange([...value, { kind: 'invite', email: normalized, isAdmin: false }]);
    setQuery('');
    inputRef.current?.focus();
  };

  const remove = (i: number) => {
    const next = [...value];
    next.splice(i, 1);
    onChange(next);
  };

  const toggleAdmin = (i: number) => {
    if (!allowAdminToggle) return;
    const next = [...value];
    const c = next[i]!;
    next[i] = { ...c, isAdmin: !c.isAdmin } as RecipientChip;
    onChange(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      if (q && queryLooksLikeEmail && !queryMatchesMember) {
        e.preventDefault();
        addInvite(q);
      } else if (suggestions.length > 0 && e.key === 'Enter') {
        e.preventDefault();
        addMember(suggestions[0]!);
      }
      return;
    }
    if (e.key === 'Backspace' && q === '' && value.length > 0) {
      remove(value.length - 1);
    }
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            className={cn(
              'flex min-h-10 w-full cursor-text flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-sm focus-within:ring-2 focus-within:ring-ring',
              error && 'border-destructive'
            )}
            onClick={() => {
              setOpen(true);
              inputRef.current?.focus();
            }}
          >
            {value.map((chip, i) => (
              <div
                key={`${chip.kind}-${chip.kind === 'member' ? chip.userId : chip.email}`}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border bg-muted/40 py-0.5 pl-1.5 pr-1',
                  chip.kind === 'invite' && 'border-dashed border-primary/40 bg-primary/5'
                )}
              >
                {chip.kind === 'member' ? (
                  <UserAvatar name={chip.fullName} src={chip.avatarUrl} className="h-4 w-4" />
                ) : (
                  <Mail className="h-3.5 w-3.5 text-primary" />
                )}
                <span className="max-w-[14ch] truncate text-xs">
                  {chip.kind === 'member' ? chip.fullName ?? chip.email : chip.email}
                </span>
                {allowAdminToggle && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAdmin(i);
                    }}
                    className={cn(
                      'rounded px-1 text-[10px] font-medium',
                      chip.isAdmin
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
                    )}
                  >
                    {chip.isAdmin ? 'Admin' : 'Member'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(i);
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted-foreground/10"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              placeholder={value.length === 0 ? placeholder : ''}
              className="h-7 flex-1 border-0 px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="max-h-64 overflow-y-auto p-1">
            {showInviteRow && (
              <button
                type="button"
                onClick={() => addInvite(q)}
                className="flex w-full items-center gap-2 rounded-sm border-b px-2 py-2 text-left text-sm hover:bg-accent"
              >
                <UserPlus className="h-4 w-4 text-primary" />
                <span className="flex-1 truncate">
                  Invite <span className="font-medium">{q}</span> by email
                </span>
                <span className="rounded bg-primary/10 px-1 text-[10px] text-primary">New</span>
              </button>
            )}
            {suggestions.length === 0 && !showInviteRow ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {q ? 'Type a valid email to invite someone new.' : 'Type a name or email.'}
              </p>
            ) : (
              suggestions.map((m) => (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => addMember(m)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <UserAvatar name={m.profile.full_name} src={m.profile.avatar_url} className="h-6 w-6" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.profile.full_name ?? m.profile.email}</p>
                    {m.profile.full_name && (
                      <p className="truncate text-xs text-muted-foreground">{m.profile.email}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
