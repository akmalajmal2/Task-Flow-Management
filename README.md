# TaskFlow

Team task management app. Kanban boards, real-time sync, role-based access control, invitations with email delivery.

## Tech stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn-style UI primitives
- **State:** Redux Toolkit + RTK Query (cached server state), React Context (UI state)
- **Backend:** Supabase (Postgres + Auth + Realtime + Storage)
- **Auth:** Email/password + password reset + OAuth-ready
- **Drag & drop:** dnd-kit with fractional-position ordering
- **Email:** Resend
- **Forms:** react-hook-form + zod

## Quick start (Supabase Cloud)

```bash
# 1. Install
npm install

# 2. Copy env template
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY from your Supabase project (Settings → API)

# 3. Apply migrations
# Option A — paste each file from supabase/migrations/ into your Supabase
# Dashboard → SQL Editor in order (0001 through 0007).
#
# Option B — use the CLI:
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push

# 4. (Optional) Generate TypeScript types from your live schema
npx supabase gen types typescript --project-id <your-project-ref> > types/database.ts

# 5. Run
npm run dev
```

Open [localhost:3000](http://localhost:3000).

## Architecture

### Three-layer permission enforcement

1. **UI** hides buttons the user shouldn't see (cosmetic)
2. **API route handlers** validate auth and role (defense in depth)
3. **Postgres RLS** — the authoritative security boundary

Every feature trust flows bottom-up: if RLS denies, the UI never finds out the row exists.

### Role model

| Scope | Roles | Capabilities |
|---|---|---|
| Workspace | owner · admin · member · viewer | Owner = delete workspace + all admin powers. Admin = invite, manage roles, manage boards. Member = create/use boards. Viewer = read-only + comments. |
| Board (private) | admin · member | Admin = change board settings, add/remove members, delete. Member = create/move/edit tasks, comment. |
| Board (public) | — | Any non-viewer workspace member can write. Viewers read-only + comments. |

### Folder layout

```
app/                  Next.js routes
  (auth)/             login / signup / reset
  (app)/              authenticated shell + pages
    workspaces/[wsId]/
      boards/[boardId]/
  api/                route handlers
  invite/[token]/     public invitation landing
components/
  ui/                 primitives (button, dialog, popover, …)
  kanban/             Board, Column, TaskCard
  tasks/              TaskForm, TaskDetailDrawer, SubtaskList
  comments/           CommentThread
  layout/             Sidebar, Header, NotificationBell
  shared/             ActionMenu, ConfirmDialog, UserAvatar, …
features/             Redux slices + RTK Query APIs (by domain)
store/                store, base API, listener middleware
hooks/                useCurrentUser, useAppStore, useRealtime, usePermissions
lib/
  supabase/           browser / server / admin / middleware clients
  email/              Resend wrapper + sender
  validations/        Zod schemas
  errors/             Postgres → user-readable error mapper
  utils/              cn, dates, mentions, slug
types/                branded IDs + domain types + DB stub
supabase/
  migrations/         numbered SQL files (idempotent, ordered)
  config.toml
  seed.sql
```

### Key decisions

- **Flat layout (no `src/`)** — `@/` alias points to project root for cleaner imports.
- **Branded ID types** — compile-time prevention of mixing up `WorkspaceId` / `BoardId` / `TaskId`.
- **Single shared `baseApi`** — every feature `injectEndpoints`, so cache invalidation spans domains.
- **`fakeBaseQuery` + Supabase SDK** — each endpoint defines its own `queryFn` so we get retries / auth / realtime out of the box without a REST facade.
- **Fractional positioning** on tasks — drag doesn't rewrite every sibling, just the moved card.
- **Optimistic kanban moves** — card updates instantly, rolls back on RLS reject via `onQueryStarted`.
- **Listener middleware** toasts every rejected mutation so components don't duplicate that code.
- **VOLATILE RLS helpers** — avoid snapshot-caching bugs where a trigger's insert isn't visible to a subsequent SELECT check.

## Email setup

See [`docs/EMAIL_SETUP.md`](./docs/EMAIL_SETUP.md) for the complete guide.

TL;DR:

1. Sign up at [resend.com](https://resend.com), create an API key.
2. In `.env.local`: `RESEND_API_KEY=re_your_key`
3. In `.env.local`: `RESEND_FROM_EMAIL=TaskFlow <onboarding@resend.dev>` (no quotes, no smart quotes).
4. Restart `npm run dev`.
5. **Resend sandbox** only delivers to your registered address until you verify a domain at [resend.com/domains](https://resend.com/domains). The app surfaces this clearly as a toast when it happens.

## What's included

- Auth: signup, login, password reset, OAuth callback
- Workspaces: create, rename, delete, members, roles, invitations
- Boards: public/private, color, star/unstar, kanban with drag-and-drop
- Tasks: priority, due dates, assignees, star rating, subtasks with review workflow
- Comments: plain-text with realtime sync
- Notifications: unread bell, mark read, full inbox, realtime updates
- Invitations: Gmail-style email picker with chips, email delivery via Resend, accept/reject landing

## What's not included (yet)

These are tracked as future work but not in this scaffold:

- Bug tracking UI (DB tables + RLS are ready)
- Tiptap rich-text editor with @mentions
- Per-board chat rooms
- List view toggle on boards
- Board settings / member management page
- Edge function email worker
- Attachments / file uploads

## Scripts

```
npm run dev         # start dev server
npm run build       # production build
npm run typecheck   # type-check without emit
npm run db:push     # apply migrations to linked Supabase project
npm run db:reset    # wipe + reapply migrations (local only)
npm run db:types    # regenerate types/database.ts from live schema
```

## Testing checklist

1. Sign up User 1 → create workspace → see empty dashboard
2. Invite User 2 (must be your Resend-registered email in sandbox mode)
3. User 2 accepts → shared workspace visible to both
4. User 1 creates a private board, adds User 2 → both see it
5. User 1 creates a public board, does NOT add User 2 → User 2 still sees it (public)
6. User 1 creates a task → drag between columns → User 2 sees move in realtime
7. Task drawer → add subtask → send to review → User 1 gets notification → approve
8. Change User 2's role to Viewer → verify they can no longer create tasks

## License

MIT. Use freely.
