-- Apply once to the JobAI Supabase project. No service-role key belongs in the browser.
begin;
create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'My CV' check (char_length(title) <= 250),
  document jsonb not null check (jsonb_typeof(document) = 'object' and octet_length(document::text) <= 250000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index resumes_user_updated_idx on public.resumes (user_id, updated_at desc);
alter table public.resumes enable row level security;
revoke all on public.resumes from anon;
grant select, insert, update, delete on public.resumes to authenticated;
create policy "Read own CVs" on public.resumes for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own CVs" on public.resumes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own CVs" on public.resumes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own CVs" on public.resumes for delete to authenticated using ((select auth.uid()) = user_id);

create function public.touch_resume_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger resume_updated_at before update on public.resumes for each row execute function public.touch_resume_updated_at();

-- Atomic quotas shared by every serverless instance. Clients cannot access counters directly.
create schema if not exists private;
create table private.service_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation in ('ai', 'jobs')),
  window_start timestamptz not null,
  request_count integer not null default 1,
  primary key (user_id, operation, window_start)
);
alter table private.service_usage enable row level security;
revoke all on private.service_usage from public, anon, authenticated;
create function public.consume_service_quota(requested_operation text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  quota integer;
  affected integer;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if requested_operation = 'ai' then quota := 30;
  elsif requested_operation = 'jobs' then quota := 40;
  else raise exception 'Unsupported operation'; end if;
  insert into private.service_usage (user_id, operation, window_start, request_count)
  values (caller, requested_operation, date_trunc('hour', now()), 1)
  on conflict (user_id, operation, window_start) do update
    set request_count = private.service_usage.request_count + 1
    where private.service_usage.request_count < quota;
  get diagnostics affected = row_count;
  -- A caller can only clear their own expired counters, never another user's quota.
  delete from private.service_usage where user_id = caller and window_start < now() - interval '2 days';
  return affected = 1;
end;
$$;
revoke all on function public.consume_service_quota(text) from public, anon;
grant execute on function public.consume_service_quota(text) to authenticated;
commit;
