-- 0001_extensions.sql
-- Required Postgres extensions. All idempotent.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";       -- fast LIKE / similarity search
create extension if not exists "moddatetime";   -- updated_at triggers
