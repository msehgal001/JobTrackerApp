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
-- 5. DONE
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
