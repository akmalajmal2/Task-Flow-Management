# Which SQL file do I run?

| Your situation | Run |
|---|---|
| **Brand-new Supabase project** | `schema.sql` only. It already contains everything below. Do **not** run any migration. |
| **Existing database, not sure what it has** (errors like "function not found in the schema cache", "Only admins can create projects", "That move is not allowed in this workflow") | `migration-v7-sync-all.sql` (one file, replaces v2b to v6) |
| **Existing database** that already has the *Proposed / Declined* columns working | `migration-v3-start-and-sendback.sql`, then `migration-v4-order-and-reorder.sql`, then `migration-v5-anyone-creates-projects.sql`, then `migration-v6-delete-project.sql` |
| **Existing database from the very first version** (no proposals yet) | `migration-v2a-enum.sql` **alone, first**, then v2b, v3, v4, v5, v6 |

Never run `schema.sql` on a database that already has tables (it would fail on `create type`).

All migrations are safe to run again: they use `create or replace`, `if not exists`, or only touch rows that still need it. Keep the order v2a → v2b → v3 → v4 → v5 → v6.

| File | What it does |
|---|---|
| `migration-v2a-enum.sql` | Adds the `proposed` and `declined` statuses (must commit before v2b) |
| `migration-v2b-functions.sql` | Proposal workflow functions, optional estimate |
| `migration-v3-start-and-sendback.sql` | Only the assignee starts work; review "send back" returns to To do |
| `migration-v4-order-and-reorder.sql` | `tasks.position` + `reorder_task()` (drag to reorder inside a column) |
| `migration-v5-anyone-creates-projects.sql` | Any signed-in user can create a project and becomes its manager |
| `migration-v6-delete-project.sql` | `delete_project()`: only the project's creator can delete it (the key must be typed to confirm) |
| `migration-v7-sync-all.sql` | v2b + v3 + v4 + v5 + v6 + v8 in one run (stops with a clear message if v2a is still needed), then reloads the API schema cache |
| `migration-v8-feedback-files.sql` | Photos / PDFs on review remarks: private `task-files` bucket, access rules, `set_decision_files()`. Already ran v7 before this version? Run only this file. |
