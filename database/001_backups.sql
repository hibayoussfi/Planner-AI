-- Run once in the SQL editor of YOUR Supabase project. No service-role key is needed in the app.
create table if not exists public.planner_backups (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 1048576),
  created_at timestamptz not null default now()
);
create index if not exists planner_backups_owner_idx on public.planner_backups(user_id, id desc);
alter table public.planner_backups enable row level security;
revoke all on public.planner_backups from anon, authenticated;
grant select, insert, delete on public.planner_backups to authenticated;
grant usage, select on sequence public.planner_backups_id_seq to authenticated;
create policy "Read own backups" on public.planner_backups for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own backups" on public.planner_backups for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Delete own backups" on public.planner_backups for delete to authenticated using ((select auth.uid()) = user_id);
