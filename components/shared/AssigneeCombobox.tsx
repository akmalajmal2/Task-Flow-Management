"use client";

/**
 * AssigneeCombobox — Enterprise multi-select assignee picker
 *
 * Behaviour (matches Linear / GitHub Issues / Jira):
 *  • Click the field → opens a filtered dropdown
 *  • Type to fuzzy-search by name or email
 *  • Click a member to toggle them in/out of selection
 *  • Selected members render as inline avatar chips
 *  • Backspace on empty input removes the last chip
 *  • Escape or outside click closes the dropdown
 *  • ↑ ↓ Arrow keys + Enter for full keyboard nav
 *  • "Clear all" footer when 2+ are selected
 */

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import { X, ChevronDown, Search, UserCircle2, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface AssigneeMember {
  user_id: string;
  profile: {
    full_name: string | null;
    email: string;
    avatar_url?: string | null;
  };
}

interface Props {
  members: AssigneeMember[];
  value: string[]; // selected user_ids
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function AssigneeCombobox({
  members,
  value,
  onChange,
  placeholder = "Unassigned",
  disabled = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const selectedMembers = members.filter((m) => value.includes(m.user_id));

  const filtered = members.filter((m) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      m.profile.full_name?.toLowerCase().includes(q) ||
      m.profile.email.toLowerCase().includes(q)
    );
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const toggle = useCallback(
    (userId: string) => {
      onChange(
        value.includes(userId)
          ? value.filter((id) => id !== userId)
          : [...value, userId],
      );
    },
    [value, onChange],
  );

  const removeChip = (userId: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    onChange(value.filter((id) => id !== userId));
  };

  const openDropdown = () => {
    if (disabled) return;
    setOpen(true);
    setCursor(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "Backspace":
        if (query === "" && value.length > 0) {
          // Remove last chip
          onChange(value.slice(0, -1));
        }
        break;
      case "Escape":
        setOpen(false);
        setQuery("");
        break;
      case "ArrowDown":
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[cursor]) toggle(filtered[cursor].user_id);
        break;
    }
  };

  const displayName = (m: AssigneeMember) =>
    m.profile.full_name?.trim() || m.profile.email;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* ── Trigger / chip input row ── */}
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-disabled={disabled}
        onClick={openDropdown}
        className={cn(
          "flex min-h-[38px] w-full flex-wrap items-center gap-1.5 rounded-md border border-input",
          "bg-background px-2.5 py-1.5 text-sm ring-offset-background",
          "cursor-pointer transition-colors",
          !disabled && "hover:border-ring",
          open && "border-ring ring-2 ring-ring/20",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        {/* Selected chips */}
        {selectedMembers.map((m) => (
          <span
            key={m.user_id}
            className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium leading-none"
          >
            <MemberAvatar member={m} size={14} />
            <span className="max-w-[110px] truncate">{displayName(m)}</span>
            {!disabled && (
              <button
                type="button"
                onMouseDown={(e) => removeChip(m.user_id, e)}
                className="ml-0.5 flex items-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none"
                aria-label={`Remove ${displayName(m)}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}

        {/* Inline search input */}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
            if (!open) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => !disabled && setOpen(true)}
          placeholder={selectedMembers.length === 0 ? placeholder : ""}
          disabled={disabled}
          className="min-w-[60px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          aria-autocomplete="list"
          aria-controls="assignee-listbox"
        />

        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </div>

      {/* ── Dropdown ── */}
      {open && (
        <div
          id="assignee-listbox"
          role="listbox"
          aria-multiselectable="true"
          className={cn(
            "absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md",
            "animate-in fade-in-0 zoom-in-95 duration-100",
          )}
        >
          {/* Search hint header */}
          <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
            <Search className="h-3 w-3 shrink-0" />
            <span>
              {query
                ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`
                : "Search members…"}
            </span>
          </div>

          {/* Member list */}
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-5 text-center text-sm text-muted-foreground">
                No members match &ldquo;{query}&rdquo;
              </li>
            ) : (
              filtered.map((m, i) => {
                const isSelected = value.includes(m.user_id);
                return (
                  <li
                    key={m.user_id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggle(m.user_id)}
                    onMouseEnter={() => setCursor(i)}
                    className={cn(
                      "flex cursor-pointer select-none items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                      i === cursor && "bg-accent",
                      isSelected && "font-medium",
                    )}
                  >
                    {/* Checkbox */}
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40 bg-background",
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3 stroke-[2.5]" />}
                    </span>

                    {/* Avatar */}
                    <MemberAvatar member={m} size={22} />

                    {/* Name + email */}
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate leading-tight">
                        {displayName(m)}
                      </span>
                      {m.profile.full_name?.trim() && (
                        <span className="truncate text-[11px] text-muted-foreground">
                          {m.profile.email}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          {/* Footer — clear all */}
          {value.length > 1 && (
            <div className="border-t px-3 py-1">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full rounded px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Clear all ({value.length} selected)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Avatar helper ─────────────────────────────────────────────────────────────

function MemberAvatar({
  member,
  size,
}: {
  member: AssigneeMember;
  size: number;
}) {
  const name = member.profile.full_name?.trim() || member.profile.email;
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  if (member.profile.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.profile.avatar_url}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground"
      style={{ width: size, height: size, fontSize: Math.max(8, size * 0.42) }}
    >
      {initials || (
        <UserCircle2 style={{ width: size * 0.7, height: size * 0.7 }} />
      )}
    </span>
  );
}
