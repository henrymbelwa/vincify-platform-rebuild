-- Vincify schema. Every private table carries user_id and is protected by RLS (owner only).
create extension if not exists pgcrypto;

-- ---------- Enums ----------
create type public.task_status as enum ('not_started','in_progress','completed','postponed','cancelled');
create type public.task_priority as enum ('low','medium','high','urgent');
create type public.project_status as enum ('planning','active','on_hold','completed','archived');
create type public.doc_status as enum ('uploaded','processing','ready','failed');

-- ---------- Generic updated_at trigger ----------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- 1-2 Profiles & preferences ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid generated always as (id) stored,
  full_name text not null default '' check (char_length(full_name) <= 120),
  preferred_name text not null default '' check (char_length(preferred_name) <= 60),
  phone text check (char_length(phone) <= 32),
  occupation text check (char_length(occupation) <= 80),
  organization text check (char_length(organization) <= 120),
  goals text[] not null default '{}',
  timezone text not null default 'UTC',
  work_start time default '08:00',
  work_end time default '17:00',
  onboarded boolean not null default false,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light','dark','system')),
  date_format text not null default 'dd MMM yyyy',
  time_format text not null default '24h' check (time_format in ('12h','24h')),
  week_starts_on int not null default 1 check (week_starts_on between 0 and 6),
  memory_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 3-6 Planning ----------
create table public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  mood int check (mood between 1 and 5),
  energy int check (energy between 1 and 5),
  priorities text[] not null default '{}',
  intention text check (char_length(intention) <= 2000),
  review text check (char_length(review) <= 4000),
  wins text check (char_length(wins) <= 2000),
  blockers text check (char_length(blockers) <= 2000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);
create table public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  focus text check (char_length(focus) <= 2000),
  outcomes text[] not null default '{}',
  reflection text check (char_length(reflection) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);
create table public.monthly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  theme text check (char_length(theme) <= 2000),
  outcomes text[] not null default '{}',
  reflection text check (char_length(reflection) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);
create table public.planned_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_id uuid references public.daily_checkins(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  starts_at timestamptz,
  ends_at timestamptz,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 8-9 Goals & projects (before tasks for FK) ----------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 4000),
  horizon text not null default 'month' check (horizon in ('week','month','quarter','year')),
  target_date date,
  progress int not null default 0 check (progress between 0 and 100),
  achieved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  description text check (char_length(description) <= 8000),
  status public.project_status not null default 'active',
  color text not null default 'purple',
  start_date date,
  due_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 7 Tasks (12 project tasks = tasks with project_id) ----------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  goal_id uuid references public.goals(id) on delete set null,
  milestone_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 8000),
  category text check (char_length(category) <= 60),
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'not_started',
  due_at timestamptz,
  completed_at timestamptz,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create or replace function public.task_completed_stamp() returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and (old is null or old.status <> 'completed') then new.completed_at = now();
  elsif new.status <> 'completed' then new.completed_at = null; end if;
  return new;
end $$;
create trigger tasks_completed before insert or update of status on public.tasks for each row execute function public.task_completed_stamp();

-- ---------- 10-17 Project workspace ----------
create table public.project_objectives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  achieved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tasks add constraint tasks_milestone_fk foreign key (milestone_id) references public.project_milestones(id) on delete set null;
create table public.project_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null default 'Untitled note' check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.custom_tables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.custom_table_columns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  table_id uuid not null references public.custom_tables(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null default 'text' check (kind in ('text','number','date','checkbox')),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.custom_table_rows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  table_id uuid not null references public.custom_tables(id) on delete cascade,
  data jsonb not null default '{}',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.project_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  url text check (char_length(url) <= 2000),
  document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 18-21 Documents & timetables ----------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  name text not null check (char_length(name) between 1 and 255),
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  status public.doc_status not null default 'uploaded',
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.project_resources add constraint resources_doc_fk foreign key (document_id) references public.documents(id) on delete set null;
create table public.document_processing (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  kind text not null check (kind in ('summary','timetable')),
  status text not null default 'pending' check (status in ('pending','succeeded','failed','confirmed','discarded')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.timetables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  valid_from date,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  timetable_id uuid not null references public.timetables(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  location text check (char_length(location) <= 200),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 22 Calendar ----------
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 4000),
  location text check (char_length(location) <= 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  remind_minutes int check (remind_minutes between 0 and 10080),
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);

-- ---------- 23-24 Metrics & reports ----------
create table public.productivity_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  tasks_completed int not null default 0,
  tasks_eligible int not null default 0,
  checkin_done boolean not null default false,
  review_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null check (period in ('daily','weekly','monthly')),
  period_start date not null,
  period_end date not null,
  data jsonb not null default '{}',
  narrative text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 25-27 AI ----------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) <= 40000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.ai_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  category text not null default 'preference' check (category in ('preference','fact','goal','routine')),
  enabled boolean not null default true,
  source_message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 28-29 Notifications ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'system' check (category in ('task','event','project','ai','automation','reward','system')),
  title text not null check (char_length(title) <= 200),
  body text check (char_length(body) <= 2000),
  link text check (char_length(link) <= 300),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app jsonb not null default '{"task":true,"event":true,"project":true,"ai":true,"automation":true,"reward":true,"system":true}',
  email jsonb not null default '{"task":false,"event":true,"project":false,"ai":false,"automation":true,"reward":false,"system":true}',
  quiet_start time,
  quiet_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 30-32 Integrations & automations ----------
create table public.connected_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('email')),
  address text not null check (char_length(address) <= 255),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);
create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  trigger text not null check (trigger in ('daily_summary','weekly_report','overdue_tasks','upcoming_events')),
  channel text not null default 'email' check (channel in ('email')),
  send_hour int not null default 7 check (send_hour between 0 and 23),
  weekday int check (weekday between 0 and 6),
  enabled boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id uuid references public.automation_rules(id) on delete set null,
  status text not null check (status in ('sent','skipped','failed')),
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 33-35 Referrals ----------
create table public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{8}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','qualified','rejected')),
  qualified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (referrer_id <> referred_id)
);
create table public.reward_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  points int not null,
  reason text not null check (char_length(reason) <= 200),
  referral_id uuid unique references public.referrals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Indexes ----------
create index on public.tasks (user_id, status, due_at);
create index on public.tasks (project_id);
create index on public.calendar_events (user_id, starts_at);
create index on public.messages (conversation_id, created_at);
create index on public.conversations (user_id, updated_at desc);
create index on public.notifications (user_id, read_at, created_at desc);
create index on public.documents (user_id, created_at desc);
create index on public.timetable_entries (user_id, weekday);
create index on public.projects (user_id, status);
create index on public.ai_memories (user_id, enabled);
create index on public.automation_rules (enabled, send_hour);
create index on public.referrals (referrer_id);

-- ---------- Grants, RLS, updated_at on every owner table ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','user_preferences','daily_checkins','weekly_plans','monthly_plans','planned_activities','goals','projects','tasks','project_objectives','project_milestones','project_notes','custom_tables','custom_table_columns','custom_table_rows','project_resources','documents','document_processing','timetables','timetable_entries','calendar_events','productivity_metrics','reports','conversations','messages','ai_memories','notifications','notification_preferences','connected_integrations','automation_rules','automation_runs']
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner_all" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- Referral & reward tables: read-only for owners, written by trusted functions only.
grant select on public.referral_codes, public.referrals, public.reward_transactions to authenticated;
grant all on public.referral_codes, public.referrals, public.reward_transactions to service_role;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.reward_transactions enable row level security;
create policy "own code" on public.referral_codes for select to authenticated using (user_id = auth.uid());
create policy "own referrals" on public.referrals for select to authenticated using (referrer_id = auth.uid() or referred_id = auth.uid());
create policy "own rewards" on public.reward_transactions for select to authenticated using (user_id = auth.uid());

-- Protect child rows from pointing at another user's parent (defence in depth).
create or replace function public.assert_same_owner() returns trigger language plpgsql security definer set search_path = public as $$
declare parent_owner uuid; col text := tg_argv[0]; parent text := tg_argv[1]; pid uuid;
begin
  execute format('select ($1).%I', col) into pid using new;
  if pid is null then return new; end if;
  execute format('select user_id from public.%I where id = $1', parent) into parent_owner using pid;
  if parent_owner is distinct from new.user_id then raise exception 'Parent record not found'; end if;
  return new;
end $$;
create trigger own_project before insert or update on public.tasks for each row execute function public.assert_same_owner('project_id','projects');
create trigger own_goal before insert or update on public.tasks for each row execute function public.assert_same_owner('goal_id','goals');
create trigger own_project before insert or update on public.project_objectives for each row execute function public.assert_same_owner('project_id','projects');
create trigger own_project before insert or update on public.project_milestones for each row execute function public.assert_same_owner('project_id','projects');
create trigger own_project before insert or update on public.project_notes for each row execute function public.assert_same_owner('project_id','projects');
create trigger own_project before insert or update on public.custom_tables for each row execute function public.assert_same_owner('project_id','projects');
create trigger own_project before insert or update on public.project_resources for each row execute function public.assert_same_owner('project_id','projects');
create trigger own_table before insert or update on public.custom_table_columns for each row execute function public.assert_same_owner('table_id','custom_tables');
create trigger own_table before insert or update on public.custom_table_rows for each row execute function public.assert_same_owner('table_id','custom_tables');
create trigger own_conv before insert or update on public.messages for each row execute function public.assert_same_owner('conversation_id','conversations');
create trigger own_doc before insert or update on public.document_processing for each row execute function public.assert_same_owner('document_id','documents');
create trigger own_tt before insert or update on public.timetable_entries for each row execute function public.assert_same_owner('timetable_id','timetables');

-- ---------- New user bootstrap: profile, preferences, referral code, referral link ----------
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare ref_code text; referrer uuid; new_code text;
begin
  insert into public.profiles (id, full_name, phone)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), new.raw_user_meta_data->>'phone');
  insert into public.user_preferences (user_id) values (new.id);
  insert into public.notification_preferences (user_id) values (new.id);
  loop
    new_code := upper(substr(translate(encode(gen_random_bytes(9), 'base64'), '+/=0O1IL', ''), 1, 8));
    exit when char_length(new_code) = 8 and not exists (select 1 from public.referral_codes where code = new_code);
  end loop;
  insert into public.referral_codes (user_id, code) values (new.id, new_code);
  ref_code := upper(nullif(new.raw_user_meta_data->>'referral_code', ''));
  if ref_code is not null then
    select user_id into referrer from public.referral_codes where code = ref_code;
    if referrer is not null and referrer <> new.id then
      insert into public.referrals (referrer_id, referred_id) values (referrer, new.id) on conflict do nothing;
    end if;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Referral qualification: referred user verified email, finished onboarding and completed 3 tasks.
-- Anti-abuse: one referral per referred account, no self referral, max 50 rewarded referrals per referrer.
create or replace function public.qualify_referral(_user uuid) returns void language plpgsql security definer set search_path = public as $$
declare r record; done int; confirmed timestamptz; onboard boolean; rewarded int;
begin
  select * into r from public.referrals where referred_id = _user and status = 'pending';
  if not found then return; end if;
  select email_confirmed_at into confirmed from auth.users where id = _user;
  select onboarded into onboard from public.profiles where id = _user;
  select count(*) into done from public.tasks where user_id = _user and status = 'completed';
  if confirmed is null or not coalesce(onboard,false) or done < 3 then return; end if;
  select count(*) into rewarded from public.referrals where referrer_id = r.referrer_id and status = 'qualified';
  if rewarded >= 50 then
    update public.referrals set status = 'rejected' where id = r.id; return;
  end if;
  update public.referrals set status = 'qualified', qualified_at = now() where id = r.id;
  insert into public.reward_transactions (user_id, points, reason, referral_id) values (r.referrer_id, 100, 'Qualified referral', r.id) on conflict do nothing;
  insert into public.reward_transactions (user_id, points, reason) values (_user, 50, 'Welcome bonus for joining through a referral');
  insert into public.notifications (user_id, category, title, body, link) values (r.referrer_id, 'reward', 'Referral qualified', 'You earned 100 points.', '/app/rewards');
end $$;
create or replace function public.on_task_completed_referral() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' then perform public.qualify_referral(new.user_id); end if;
  return new;
end $$;
create trigger referral_check after update of status on public.tasks for each row execute function public.on_task_completed_referral();
revoke execute on function public.qualify_referral(uuid) from public, anon, authenticated;

-- ---------- Storage: private documents bucket, owner folder = auth.uid() ----------
insert into storage.buckets (id, name, public, file_size_limit) values ('documents', 'documents', false, 20971520) on conflict (id) do nothing;
create policy "doc owner read" on storage.objects for select to authenticated using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "doc owner write" on storage.objects for insert to authenticated with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "doc owner delete" on storage.objects for delete to authenticated using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
