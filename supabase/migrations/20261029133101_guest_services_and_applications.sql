-- Additive: leaves existing resumes, ownership policies and account quotas intact.
begin;
create table private.service_settings (
  name text primary key,
  value text not null
);
create table private.public_service_usage (
  bucket text not null,
  operation text not null check (operation in ('ai','jobs')),
  window_start timestamptz not null,
  expires_at timestamptz not null,
  request_count integer not null default 0,
  primary key(bucket,operation,window_start)
);
create table private.job_search_cache (
  cache_key text primary key check (cache_key ~ '^[a-f0-9]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=2500000),
  expires_at timestamptz not null
);
alter table private.service_settings enable row level security;
alter table private.public_service_usage enable row level security;
alter table private.job_search_cache enable row level security;
revoke all on private.service_settings,private.public_service_usage,private.job_search_cache from public,anon,authenticated;

create function private.verify_service_proof(proof text) returns void
language plpgsql security definer set search_path='' as $$
declare expected text;
begin
  select value into expected from private.service_settings where name='service_proof_sha256';
  if expected is null or proof is null or length(proof)<>64 or
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(proof,'UTF8')),'hex')<>expected
  then raise exception 'Service access denied' using errcode='42501'; end if;
end;
$$;
revoke all on function private.verify_service_proof(text) from public,anon,authenticated;

create function public.consume_public_service_quota(subject text, requested_operation text, proof text) returns boolean
language plpgsql security definer set search_path='' as $$
declare
  op text := requested_operation;
  stamp timestamptz := now();
  hour_start timestamptz := date_trunc('hour',now());
  day_start timestamptz := date_trunc('day',now());
  month_start timestamptz := date_trunc('month',now());
  personal_limit integer;
  daily_limit integer;
  monthly_limit integer;
  row record;
begin
  perform private.verify_service_proof(proof);
  if subject !~ '^(guest|user):[a-f0-9]{64}$' or subject is null then raise exception 'Invalid subject'; end if;
  if op='ai' then
    personal_limit := case when subject like 'user:%' then 30 else 5 end;
    daily_limit := 300; monthly_limit := 3000;
  elsif op='jobs' then
    personal_limit := case when subject like 'user:%' then 40 else 10 end;
    daily_limit := 15; monthly_limit := 90;
  else raise exception 'Unsupported operation'; end if;
  -- Serialize reservations for this provider operation across all server instances.
  perform pg_advisory_xact_lock(hashtextextended('roleaide:public-service:'||op,0));
  for row in select * from (values
    (subject,hour_start,personal_limit),('global:day',day_start,daily_limit),('global:month',month_start,monthly_limit)
  ) as limits(bucket,starts,maximum) loop
    if coalesce((select request_count from private.public_service_usage u where u.bucket=row.bucket and u.operation=op and u.window_start=row.starts),0)>=row.maximum then return false; end if;
  end loop;
  insert into private.public_service_usage(bucket,operation,window_start,expires_at,request_count) values
    (subject,op,hour_start,hour_start+interval '1 hour',1),
    ('global:day',op,day_start,day_start+interval '1 day',1),
    ('global:month',op,month_start,month_start+interval '1 month',1)
  on conflict(bucket,operation,window_start) do update set request_count=private.public_service_usage.request_count+1;
  delete from private.public_service_usage where expires_at<stamp-interval '2 days';
  return true;
end;
$$;

create function public.read_job_search_cache(key text, proof text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform private.verify_service_proof(proof);
  select payload into result from private.job_search_cache where cache_key=key and expires_at>now();
  return result;
end;
$$;
create function public.write_job_search_cache(key text, data jsonb, proof text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.verify_service_proof(proof);
  insert into private.job_search_cache(cache_key,payload,expires_at) values(key,data,now()+interval '6 hours')
    on conflict(cache_key) do update set payload=excluded.payload,expires_at=excluded.expires_at;
  delete from private.job_search_cache where expires_at<now();
end;
$$;
revoke all on function public.consume_public_service_quota(text,text,text),public.read_job_search_cache(text,text),public.write_job_search_cache(text,jsonb,text) from public;
grant execute on function public.consume_public_service_quota(text,text,text),public.read_job_search_cache(text,text),public.write_job_search_cache(text,jsonb,text) to anon,authenticated;

create table public.application_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_key text not null check(char_length(job_key)<=300),
  job jsonb not null check(jsonb_typeof(job)='object' and octet_length(job::text)<=150000),
  profile jsonb not null default '{}' check(jsonb_typeof(profile)='object' and octet_length(profile::text)<=150000),
  cover_letter text not null default '' check(char_length(cover_letter)<=20000),
  status text not null default 'saved' check(status in ('saved','opened','submitted','interview','offer','rejected','withdrawn')),
  method text not null default 'manual' check(method in ('manual','assisted','saved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,job_key)
);
create index application_activity_user_updated on public.application_activity(user_id,updated_at desc);
alter table public.application_activity enable row level security;
revoke all on public.application_activity from public,anon;
grant select,insert,update,delete on public.application_activity to authenticated;
create policy "Read own applications" on public.application_activity for select to authenticated using((select auth.uid())=user_id);
create policy "Create own applications" on public.application_activity for insert to authenticated with check((select auth.uid())=user_id);
create policy "Update own applications" on public.application_activity for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "Delete own applications" on public.application_activity for delete to authenticated using((select auth.uid())=user_id);
create trigger application_activity_updated before update on public.application_activity for each row execute function public.touch_resume_updated_at();
commit;
