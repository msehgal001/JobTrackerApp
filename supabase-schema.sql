-- ============================================================
-- JOB TRACKER — SUPABASE SCHEMA
-- ============================================================
-- Paste this entire file into Supabase SQL Editor and Run.
-- This creates tables, security policies, and your access token.
--
-- IMPORTANT: Before running, REPLACE the token below with your own.
-- Generate one at https://www.uuidgenerator.net/ (use UUID v4)
-- or run in your terminal: openssl rand -hex 32
-- ============================================================

-- ============================================================
-- 1. ENABLE EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";


-- ============================================================
-- 2. CREATE TABLES
-- ============================================================

-- Applications table
create table if not exists applications (
  id uuid primary key default uuid_generate_v4(),
  owner_token text not null,
  company text not null,
  role text not null,
  location text,
  salary text,
  jd_url text,
  status text default 'not_applied',
  applied_date date,
  referrer text,
  notes text,
  last_action_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_apps_owner on applications(owner_token);
create index if not exists idx_apps_status on applications(owner_token, status);

-- Connections table
create table if not exists connections (
  id uuid primary key default uuid_generate_v4(),
  owner_token text not null,
  name text not null,
  company text,
  role text,
  linkedin_url text,
  tier text default 'D',
  status text default 'identified',
  notes text,
  last_contact date,
  connected_on date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_conns_owner on connections(owner_token);
create index if not exists idx_conns_tier on connections(owner_token, tier);

-- Settings table (single row per token)
create table if not exists settings (
  owner_token text primary key,
  name text,
  school text,
  focus text,
  pitch text,
  targets text,
  updated_at timestamptz default now()
);


-- ============================================================
-- 3. AUTO-UPDATE updated_at TIMESTAMPS
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists apps_updated on applications;
create trigger apps_updated before update on applications
  for each row execute function set_updated_at();

drop trigger if exists conns_updated on connections;
create trigger conns_updated before update on connections
  for each row execute function set_updated_at();

drop trigger if exists settings_updated on settings;
create trigger settings_updated before update on settings
  for each row execute function set_updated_at();


-- ============================================================
-- 4. ROW-LEVEL SECURITY (THE IMPORTANT PART)
-- ============================================================
-- Without this, anyone with your Supabase anon key could read
-- everyone's data. With this, only rows matching the token in
-- the request header are visible.

alter table applications enable row level security;
alter table connections enable row level security;
alter table settings enable row level security;

-- Drop existing policies if rerunning
drop policy if exists "apps_token_policy" on applications;
drop policy if exists "conns_token_policy" on connections;
drop policy if exists "settings_token_policy" on settings;

-- Policy: only allow access to rows whose owner_token matches
-- the token sent in the custom HTTP header "x-owner-token"
create policy "apps_token_policy" on applications
  for all
  using (owner_token = current_setting('request.headers', true)::json->>'x-owner-token')
  with check (owner_token = current_setting('request.headers', true)::json->>'x-owner-token');

create policy "conns_token_policy" on connections
  for all
  using (owner_token = current_setting('request.headers', true)::json->>'x-owner-token')
  with check (owner_token = current_setting('request.headers', true)::json->>'x-owner-token');

create policy "settings_token_policy" on settings
  for all
  using (owner_token = current_setting('request.headers', true)::json->>'x-owner-token')
  with check (owner_token = current_setting('request.headers', true)::json->>'x-owner-token');


-- ============================================================
-- 5. v2.1 MIGRATION — resumes, timeline, daily goals
-- ============================================================
-- Safe to re-run; all statements are idempotent.

-- Per-application resume + timeline + outreach-suggestion fields
alter table applications add column if not exists resume_url text;
alter table applications add column if not exists resume_file_path text;
alter table applications add column if not exists timeline jsonb default '[]'::jsonb;

-- Per-user daily goals
alter table settings add column if not exists daily_apps_goal int default 25;
alter table settings add column if not exists daily_messages_goal int default 10;

-- v2.3: personalized outreach
alter table connections add column if not exists school text;
alter table settings add column if not exists school_short text;

-- v2.4: daily jobs feed
alter table settings add column if not exists resume_text text;
alter table settings add column if not exists jsearch_queries text;
alter table settings add column if not exists ats_slugs text;

-- v2.6: integrated resume builder
-- Stored on the existing token-scoped settings row so the static PWA can
-- sync resume profile data, reusable bullet library, current draft, and
-- saved tailored versions without a separate backend.
alter table settings add column if not exists resume_profile jsonb;
alter table settings add column if not exists resume_library jsonb;
alter table settings add column if not exists resume_draft jsonb;
alter table settings add column if not exists resume_versions jsonb default '[]'::jsonb;

create table if not exists jobs_feed (
  id uuid primary key default uuid_generate_v4(),
  owner_token text not null,
  title text not null,
  company text not null,
  location text,
  url text not null,
  posted_at timestamptz,
  source text,
  description text,
  relevance_score int default 0,
  dismissed boolean default false,
  fetched_at timestamptz default now()
);

create unique index if not exists ux_jobsfeed_owner_url on jobs_feed(owner_token, url);
create index if not exists idx_jobsfeed_owner_date on jobs_feed(owner_token, posted_at desc);

alter table jobs_feed enable row level security;
drop policy if exists "jobsfeed_token_policy" on jobs_feed;
create policy "jobsfeed_token_policy" on jobs_feed
  for all
  using (owner_token = current_setting('request.headers', true)::json->>'x-owner-token')
  with check (owner_token = current_setting('request.headers', true)::json->>'x-owner-token');

-- Resume storage bucket (public-read so links work without signed URLs;
-- file paths are random uuids under the owner_token folder, so they're
-- not enumerable from outside)
insert into storage.buckets (id, name, public)
  values ('resumes', 'resumes', true)
  on conflict (id) do nothing;

-- Storage write/update/delete policies: only the token holder can write
-- to their own <owner_token>/... folder. Read is public.
drop policy if exists "resumes_token_insert" on storage.objects;
drop policy if exists "resumes_token_update" on storage.objects;
drop policy if exists "resumes_token_delete" on storage.objects;
drop policy if exists "resumes_public_read" on storage.objects;

create policy "resumes_public_read" on storage.objects for select
  using (bucket_id = 'resumes');

create policy "resumes_token_insert" on storage.objects for insert
  with check (
    bucket_id = 'resumes' and
    (storage.foldername(name))[1] = current_setting('request.headers', true)::json->>'x-owner-token'
  );

create policy "resumes_token_update" on storage.objects for update
  using (
    bucket_id = 'resumes' and
    (storage.foldername(name))[1] = current_setting('request.headers', true)::json->>'x-owner-token'
  );

create policy "resumes_token_delete" on storage.objects for delete
  using (
    bucket_id = 'resumes' and
    (storage.foldername(name))[1] = current_setting('request.headers', true)::json->>'x-owner-token'
  );


-- ============================================================
-- 6. DONE
-- ============================================================
-- Next steps:
--   1. Generate a random token: openssl rand -hex 32
--      (or use https://www.uuidgenerator.net/)
--   2. Copy that token — you'll paste it into the app on first launch
--   3. In Supabase: Settings → API → copy your Project URL + anon (public) key
--   4. Open app.js, paste URL + anon key at the top
--   5. Push to GitHub, enable Pages, open the URL
--   6. App will prompt you to paste your token. Done.
--
-- To reset everything later:
--   delete from applications;
--   delete from connections;
--   delete from settings;
-- ============================================================
