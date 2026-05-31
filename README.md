# Job Command — Personal Job Tracker (PWA + Cloud Sync)

A private, cross-platform job search tracker with cloud sync, offline support, and "install to home screen" capability.

**Privacy model:** Your data lives in your own private Supabase database, protected by row-level security tied to a secret token only you have. The app code is public (on GitHub), but no one can read your data without your token. The token never goes in the URL, never in the code, and never in the repo — it lives only in your devices' localStorage.

---

## ⏱ Total setup time: ~20 minutes (one time)

You will:
1. Create a free Supabase project (10 min)
2. Generate your secret token + configure the app (3 min)
3. Push to GitHub + enable Pages (5 min)
4. Open the URL, paste token, done (2 min)

---

## STEP 1 — Supabase setup (10 min)

### 1a. Create a free account + project
1. Go to [supabase.com](https://supabase.com) → "Start your project"
2. Sign in with GitHub
3. "New project" — name it `job-command` (or anything), set a strong database password (you won't need it again; save it somewhere just in case), pick a region close to you
4. Wait ~2 minutes for provisioning

### 1b. Run the SQL schema
1. In Supabase dashboard left sidebar: **SQL Editor** → "New query"
2. Open `supabase-schema.sql` from this folder, copy the entire contents
3. Paste into the SQL Editor and click **Run** (bottom right)
4. You should see "Success. No rows returned." — that means tables, policies, and triggers are all set up

### 1c. Grab your API credentials
1. In Supabase dashboard: **Project Settings** (gear icon, bottom left) → **API**
2. Copy two values:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon / public key** (a long string starting with `eyJ...`)
3. These are both safe to commit to GitHub publicly — they identify your project but cannot read data without the token

---

## STEP 2 — Generate your secret token (3 min)

Pick ONE of these methods. The token is what unlocks your data on each device.

### Method A — terminal (recommended if you have one)
```bash
openssl rand -hex 32
```
Copy the long string it outputs.

### Method B — online
Go to [uuidgenerator.net](https://www.uuidgenerator.net/) and copy a UUID v4.

### Method C — manual
Make up any random 32+ character string. Mix letters, numbers, symbols.

**SAVE THIS TOKEN.** Put it in your password manager, write it down somewhere safe. If you lose it, your data is locked away forever (this is by design — that's the security model).

### Configure the app
1. Open `config.js`
2. Replace `YOUR-PROJECT-REF` with your Project URL from Step 1c
3. Replace `YOUR-ANON-PUBLIC-KEY-HERE` with your anon key from Step 1c
4. Save the file

The token does **not** go in this file. You'll paste it into the app on first use.

---

## STEP 3 — Deploy to GitHub Pages (5 min)

### 3a. Create the repo
1. Go to [github.com/new](https://github.com/new)
2. Repo name: `job-tracker` (or anything — this becomes part of the URL)
3. **Public** is fine. The code holds no secrets; your data is protected by the token.
   - If you really want it private, you need GitHub Pro ($4/mo) since free accounts can't deploy Pages from private repos.
4. Check "Add a README" — no wait, skip that, we have our own files
5. Click "Create repository"

### 3b. Push the files
Two options:

**Option A — drag and drop (easiest if you don't use git)**
1. On the new empty repo page, click "uploading an existing file"
2. Drag every file from this folder onto the page (index.html, app.js, resume-builder.js, styles.css, resume-builder.css, config.js, manifest.json, service-worker.js, icon-192.png, icon-512.png, supabase-schema.sql, README.md, .gitignore)
3. Click "Commit changes"

**Option B — git command line**
```bash
cd /path/to/this/folder
git init
git add .
git commit -m "Initial deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/job-tracker.git
git push -u origin main
```

### 3c. Enable GitHub Pages
1. In your repo: **Settings** → **Pages** (left sidebar)
2. Under "Build and deployment", Source: **Deploy from a branch**
3. Branch: **main**, Folder: **/ (root)** → Save
4. Wait ~1 minute. The page will refresh and show: "Your site is live at https://YOUR_USERNAME.github.io/job-tracker/"

---

## STEP 4 — First use (2 min)

### On laptop
1. Open `https://YOUR_USERNAME.github.io/job-tracker/`
2. Setup screen appears. Paste your secret token from Step 2.
3. Click **Unlock**. If your Supabase setup is correct, you're in.

### On phone
1. Open the same URL in Safari (iPhone) or Chrome (Android)
2. Paste your token, unlock
3. Add to home screen:
   - **iPhone (Safari):** Share button → "Add to Home Screen"
   - **Android (Chrome):** menu → "Install app" / "Add to Home Screen"
4. Now it lives on your home screen like a native app, fullscreen, with its own icon

Both devices read and write to the same Supabase database, so they stay in sync.

---

## How to use the app

### Daily workflow
1. **Morning:** Open Dashboard. Do everything in "Overdue" first, then "Today".
2. **Finding a job:** Add Job → paste the JD → review parsed fields → save
3. **Tailoring a resume:** Resume Builder → choose the tracked job or paste Company/Role/JD → Analyze JD → drag bullets from the right rail into the resume → save a named version → export Word/PDF
4. **CSV import:** Connections → Upload LinkedIn CSV (export from LinkedIn Settings → Data Privacy → Get a copy of your data → Connections)
5. **Outreach:** Click ✎ Message on any contact → personalize → copy → paste in LinkedIn/email
6. **Status changes:** Edit any application or connection. The follow-up dates auto-recompute.

### Resume Builder

The app includes a full resume-tailoring workspace:

- Your Madhav Sehgal aerospace/CFD resume is the default template and starter content.
- The center pane is an ATS-safe Times New Roman resume preview matching the uploaded resume template.
- The right rail is a reusable bullet library. Drag individual bullets into any role, or drag a whole role/project block into the draft.
- Paste a target company, role, and JD, then click **Analyze JD** to see keyword coverage, matched terms, missing terms, and per-bullet keyword badges.
- Save tailored resumes as named versions. Versions store the full tailored draft while your base profile/library stay shared.
- Export filenames follow `FirstNameLastName_Company_Role_YYYY-MM-DD`.
- PDF export uses the browser print dialog so text stays selectable. Word export downloads a Word-openable `.doc` file from the static PWA.

From any Application modal, use **▤ Build** in the "Resume used for this job" row to jump into Resume Builder with that company, role, and notes/JD prefilled.

### Follow-up rules (auto-computed)
- Applied **with referral**: D+7 message recruiter → D+14 message hiring manager → D+21 archive
- Applied **without referral**: D+10 LinkedIn HM → D+20 archive
- Connection request sent: D+7 re-check
- Connected (accepted): D+2 send coffee chat
- After coffee chat: D+1 thank-you, then D+21 nurture cadence

---

## Troubleshooting

### "Connection failed: check your token"
- Verify you ran the SQL schema completely (no errors)
- Verify Project URL and anon key in `config.js` are correct (no extra spaces)
- Try generating a fresh token

### "Sync error" banner appears
- Network issue. The app will retry. Your local view still works; changes sync when you reconnect.
- If persistent, click Reset token and re-paste

### App doesn't install on iPhone
- Must be opened in **Safari** for "Add to Home Screen" to install as PWA. Chrome on iOS won't show that option.

### Lost token
- If you saved a JSON backup (Settings → Export), you can paste a new token, then Import to restore data
- If you didn't back up, the data is gone — Supabase's row-level security prevents recovery without the token (this is intentional)

### Want to use on a 3rd device
- Open URL → paste same token → done. The token isn't device-locked, just stored per-device.

---

## Cost

- **Supabase free tier**: 500MB database, 50K monthly active users, unlimited API requests. You will not approach these limits unless you import 100K+ connections.
- **GitHub Pages free tier**: 100GB bandwidth/month. Not even close.
- **Total monthly cost: $0.**

---

## Upgrading from v2.0 → v2.2 (resumes, step tracker, daily goals)

If you set up the tracker before this release, run the **v2.1 MIGRATION** block at the bottom of `supabase-schema.sql` once in your Supabase SQL Editor. It's idempotent (safe to run multiple times) and adds:

- Resume file storage bucket (`resumes`) with token-scoped write policies
- Per-application columns: `resume_url`, `resume_file_path`, `timeline` (jsonb event log)
- Per-user settings: `daily_apps_goal`, `daily_messages_goal`

If you skip this step, saving applications will fail with a "column does not exist" error.

## Upgrading to v2.6 (integrated resume builder)

Run the migration section in `supabase-schema.sql` again. It is idempotent and adds four token-scoped JSON columns to `settings`:

- `resume_profile`
- `resume_library`
- `resume_draft`
- `resume_versions`

These power the new Resume Builder view and keep your tailored versions synced across devices.

## Daily Jobs Feed (optional, GitHub Actions cron)

If you want the Dashboard's "Fresh jobs — last 24h" panel to populate every morning automatically, set up the daily fetch workflow.

**One-time setup:**

1. In Supabase Dashboard → **Project Settings → API** → copy your **service_role** key (different from the anon key — keep this one secret, never commit it).
2. In your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**. Add these:
   - `SUPABASE_URL` — your project URL (same as anon)
   - `SUPABASE_SERVICE_KEY` — the service_role key from step 1
   - `OWNER_TOKEN` — your tracker's owner token (the one you paste on first launch)
   - `RAPIDAPI_KEY` — *optional*; sign up free at [rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) for 500 free calls/mo. Skip if you only want Greenhouse + Lever (target-company) jobs.
3. In the app → **Settings → Daily jobs feed** section:
   - Paste your **resume text** (used for relevance scoring)
   - Add **JSearch keyword queries** (one per line, e.g. "CFD engineer", "aerodynamics new grad") — only used if you set `RAPIDAPI_KEY`
   - Optional: **ATS slug overrides** for companies where the URL slug doesn't match the name (e.g. `Snowflake:snowflake-inc:greenhouse`)
   - Make sure your **Target companies** list (the existing field) is populated — those drive the Greenhouse/Lever fetches
4. Push to your repo. GitHub Actions runs the fetch at 13:00 UTC daily; trigger it now via **Actions → Daily Jobs Fetch → Run workflow**.

The Dashboard will show top 30 freshest jobs ranked by keyword overlap with your resume, with alum + connection counts per company and a one-click "+ Track" to add to your applications pipeline.

## Upgrading from v2.0 → v2.2 (resumes, step tracker, daily goals)

If a new version doesn't appear, do a hard refresh (Ctrl+Shift+R or Cmd+Shift+R) or close + reopen the PWA.

---

## Backup recommendation

Every Sunday: open Settings → Export. Save the JSON file somewhere safe (Drive, Dropbox). If anything ever goes wrong with Supabase or you lose your token, this backup is your safety net.

---

## File map

```
index.html             ← App shell
styles.css             ← All styling
resume-builder.css     ← Resume Builder styling + print stylesheet
app.js                 ← All logic + Supabase sync
resume-builder.js      ← Resume Builder logic, JD keyword analysis, versions, Word/PDF export
config.js              ← Your Supabase URL + anon key (edit this once)
manifest.json          ← PWA install metadata
service-worker.js      ← Offline caching
icon-192.png           ← App icon (small)
icon-512.png           ← App icon (large)
supabase-schema.sql    ← Database setup (paste into Supabase once)
README.md              ← This file
.gitignore             ← Standard ignores
```
