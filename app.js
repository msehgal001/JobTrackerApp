// ============================================================
// JOB COMMAND — Cloud sync version
// Data is stored in Supabase, secured by row-level security
// on a user-provided token kept in localStorage.
// ============================================================

const TOKEN_KEY = 'jt_token_v2';

let supabase = null;
let userToken = null;
let state = {
  apps: [],
  conns: [],
  feed: [],
  settings: {
    name: '',
    school: '',
    focus: '',
    pitch: '',
    targets: '',
    daily_apps_goal: 25,
    daily_messages_goal: 10,
    resume_profile: null,
    resume_library: null,
    resume_draft: null,
    resume_versions: []
  }
};
let pendingResume = null; // {file_path, file_name} between upload and save
let currentMessageContext = null;
let syncState = 'idle'; // idle | syncing | online | error

// ============ BOOT ============
(async function boot() {
  // Check config
  if (!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.url || window.SUPABASE_CONFIG.url.includes('YOUR-PROJECT')) {
    showFatalError('Supabase not configured. Edit config.js with your project URL and anon key, then redeploy.');
    return;
  }

  // Check for existing token
  const storedToken = localStorage.getItem(TOKEN_KEY);
  if (storedToken) {
    userToken = storedToken;
    await initSupabase();
    await loadAll();
    showApp();
  } else {
    showSetup();
  }
})();

function showFatalError(msg) {
  document.body.innerHTML = `<div style="padding:40px;font-family:monospace;color:#f87171;background:#0a0a0f;min-height:100vh">
    <h1 style="color:#ff6b35;font-size:24px;margin-bottom:16px">Configuration Error</h1>
    <p>${msg}</p>
  </div>`;
}

function showSetup() {
  document.getElementById('setup-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  setTimeout(() => document.getElementById('setup-token').focus(), 100);
}

function showApp() {
  document.getElementById('setup-screen').style.display = 'none';
  // Clear inline display so CSS (block on mobile, grid on desktop) controls layout.
  document.getElementById('app').style.display = '';
  loadSettingsForm();
  renderDashboard();
  setSyncState('online');
}

// ============ SUPABASE ============
async function initSupabase() {
  const { createClient } = window.supabase;
  supabase = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey, {
    global: {
      headers: { 'x-owner-token': userToken }
    },
    auth: { persistSession: false }
  });
}

async function setupToken() {
  const token = document.getElementById('setup-token').value.trim();
  if (!token || token.length < 16) {
    document.getElementById('setup-error').textContent = 'Token looks too short. Should be a long random string.';
    return;
  }
  userToken = token;
  await initSupabase();
  // Test the token by attempting a query
  setSyncState('syncing');
  try {
    const { error } = await supabase.from('settings').select('owner_token').limit(1);
    if (error) throw error;
    localStorage.setItem(TOKEN_KEY, token);
    await loadAll();
    showApp();
    toast('Connected. Welcome.', 'success');
  } catch (e) {
    document.getElementById('setup-error').textContent = 'Connection failed: ' + (e.message || 'check your token and Supabase setup');
    setSyncState('error');
    userToken = null;
    supabase = null;
  }
}

function logout() {
  if (!confirm('Remove this token from this device? Your cloud data is safe; you can paste the token again to re-link.')) return;
  localStorage.removeItem(TOKEN_KEY);
  location.reload();
}

async function confirmWipe() {
  const text = prompt('This will DELETE all your cloud data (applications, connections, settings). Type WIPE to confirm.');
  if (text !== 'WIPE') return;
  try {
    setSyncState('syncing');
    await supabase.from('applications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('connections').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('settings').delete().eq('owner_token', userToken);
    state.apps = [];
    state.conns = [];
    state.settings = { name: '', school: '', focus: '', pitch: '', targets: '' };
    setSyncState('online');
    toast('Wiped.', 'success');
    renderDashboard();
    renderApps();
    renderConnections();
    loadSettingsForm();
  } catch (e) {
    setSyncState('error');
    toast('Wipe failed: ' + e.message, 'error');
  }
}

// ============ SYNC INDICATOR ============
function setSyncState(s) {
  syncState = s;
  const labels = { idle: 'Idle', syncing: 'Syncing...', online: 'Synced', error: 'Offline' };
  ['sync-status', 'sync-status-mobile'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('online', 'syncing', 'error');
    el.classList.add(s);
  });
  const label = document.getElementById('sync-label');
  if (label) label.textContent = labels[s] || s;
}

async function checkConnection() {
  if (!supabase) return;
  setSyncState('syncing');
  try {
    const { error } = await supabase.from('settings').select('owner_token').limit(1);
    if (error) throw error;
    document.getElementById('connection-error').style.display = 'none';
    setSyncState('online');
    await loadAll();
    renderDashboard();
  } catch (e) {
    setSyncState('error');
    document.getElementById('connection-error-text').textContent = 'Connection error: ' + e.message;
    document.getElementById('connection-error').style.display = 'flex';
  }
}

// ============ DATA LOAD ============
// PostgREST caps a single .select() at max-rows (1000 in Supabase defaults),
// so paginate until we get a short page back. CSV imports of LinkedIn
// connection lists can easily exceed this.
async function fetchAllRows(table, orderCol, ascending = true) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderCol, { ascending })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function loadAll() {
  setSyncState('syncing');
  try {
    const [apps, conns, feed, settingsRow] = await Promise.all([
      fetchAllRows('applications', 'created_at', false),
      fetchAllRows('connections', 'name', true),
      fetchAllRows('jobs_feed', 'posted_at', false).catch(() => []),  // graceful if table not migrated yet
      supabase.from('settings').select('*').eq('owner_token', userToken).maybeSingle()
    ]);
    if (settingsRow.error && settingsRow.error.code !== 'PGRST116') throw settingsRow.error;
    state.apps = apps;
    state.conns = conns;
    state.feed = feed;
    if (settingsRow.data) state.settings = settingsRow.data;
    setSyncState('online');
  } catch (e) {
    setSyncState('error');
    toast('Load failed: ' + e.message, 'error');
    console.error(e);
  }
}

// ============ HELPERS ============
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (d1, d2) => Math.floor((new Date(d2) - new Date(d1)) / 86400000);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const fmtDate = (d) => d ? new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

function escapeHTML(s) { return (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ============ NAVIGATION ============
function openView(name) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  if (name === 'dashboard') renderDashboard();
  if (name === 'applications') renderApps();
  if (name === 'connections') renderConnections();
  if (name === 'templates') renderTemplates();
  if (name === 'resume') window.JobResumeBuilder?.render();
  if (name === 'agents') window.JobAgents?.render();
  if (name === 'settings') loadSettingsForm();
  window.scrollTo(0, 0);
}

document.querySelectorAll('.nav-item').forEach(n => n.addEventListener('click', () => openView(n.dataset.view)));

// ============ FOLLOW-UP RULES ============
function computeNextAction(item, type) {
  if (type === 'app') {
    if (!item.applied_date) return { date: null, action: 'Apply' };
    const days = daysBetween(item.applied_date, today());
    const hasRef = item.referrer && item.referrer.trim();
    if (['offer', 'rejected', 'archived'].includes(item.status)) return { date: null, action: '—' };
    if (item.status === 'applied') {
      if (hasRef) {
        if (days < 7) return { date: addDays(item.applied_date, 7), action: 'Message recruiter (D+7)' };
        if (days < 14) return { date: addDays(item.applied_date, 14), action: 'Message hiring manager (D+14)' };
        if (days < 21) return { date: addDays(item.applied_date, 21), action: 'Final nudge (D+21)' };
        return { date: today(), action: 'Archive or move on' };
      } else {
        if (days < 10) return { date: addDays(item.applied_date, 10), action: 'LinkedIn HM message (D+10)' };
        if (days < 20) return { date: addDays(item.applied_date, 20), action: 'Final nudge (D+20)' };
        return { date: today(), action: 'Archive or move on' };
      }
    }
    if (item.status === 'recruiter_screen') return { date: addDays(today(), 3), action: 'Follow up post-screen' };
    if (item.status === 'hm_call') return { date: addDays(today(), 2), action: 'Thank-you note' };
    if (item.status === 'onsite') return { date: addDays(today(), 1), action: 'Thank-you to all interviewers' };
  }
  if (type === 'conn') {
    if (item.status === 'identified') return { date: today(), action: 'Send connection request' };
    if (item.status === 'request_sent') {
      const d = item.last_contact || today();
      return { date: addDays(d, 7), action: 'Re-check accept status' };
    }
    if (item.status === 'connected') {
      const d = item.last_contact || today();
      return { date: addDays(d, 2), action: 'Send coffee-chat message' };
    }
    if (item.status === 'chat_scheduled') return { date: null, action: 'Prep for call' };
    if (item.status === 'chat_done') {
      const d = item.last_contact || today();
      return { date: addDays(d, 1), action: 'Send thank-you' };
    }
    if (item.status === 'referred' || item.status === 'nurture') {
      return { date: addDays(item.last_contact || today(), 21), action: 'Nurture check-in' };
    }
  }
  return { date: null, action: '—' };
}

// ============ DASHBOARD ============
// ============ JOBS FEED ============
function relativeTimeSince(iso) {
  if (!iso) return 'unknown';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function feedFreshness() {
  if (!state.feed.length) return null;
  const newest = state.feed.reduce((max, j) => {
    const t = new Date(j.fetched_at || j.posted_at || 0).getTime();
    return t > max ? t : max;
  }, 0);
  return newest;
}

function jobsConnSummary(company) {
  if (!company) return { conns: [], alumCount: 0, total: 0 };
  const cl = company.toLowerCase().trim();
  const userSchool = state.settings.school || '';
  const matches = state.conns.filter(c => {
    const cc = (c.company || '').toLowerCase();
    return cc && (cc.includes(cl) || cl.includes(cc));
  });
  const alumCount = matches.filter(c => isAlumOf(c.school, userSchool)).length;
  return { conns: matches, alumCount, total: matches.length };
}

function isAppAlreadyTracked(job) {
  // Detect by URL match first, then fall back to company+title
  return state.apps.some(a =>
    (a.jd_url && a.jd_url === job.url) ||
    ((a.company || '').toLowerCase() === (job.company || '').toLowerCase() &&
     (a.role || '').toLowerCase() === (job.title || '').toLowerCase())
  );
}

function renderJobsFeed() {
  const card = document.getElementById('feed-card');
  if (!card) return;

  // Filter to visible (non-dismissed) jobs in last 14 days
  const visible = state.feed.filter(j => !j.dismissed);

  if (visible.length === 0) {
    card.innerHTML = `
      <div class="feed-head">
        <h3>Fresh jobs <span class="feed-since">— last 24h</span></h3>
      </div>
      <div class="feed-empty">
        <div>📭 No jobs in the feed yet.</div>
        <div class="feed-empty-sub">The daily cron runs at 13:00 UTC. To trigger now, push to your repo and run the <strong>Daily Jobs Fetch</strong> workflow manually in GitHub Actions. See README for setup.</div>
      </div>
    `;
    return;
  }

  const sort = document.getElementById('feed-sort')?.value || 'relevance';
  const filter = document.getElementById('feed-filter')?.value || 'all';

  const userSchool = state.settings.school || '';

  let filtered = visible;
  if (filter === 'greenhouse' || filter === 'lever' || filter === 'jsearch') {
    filtered = visible.filter(j => j.source === filter);
  } else if (filter === 'alum') {
    filtered = visible.filter(j => {
      const s = jobsConnSummary(j.company);
      return s.alumCount > 0;
    });
  } else if (filter === 'conn') {
    filtered = visible.filter(j => jobsConnSummary(j.company).total > 0);
  }

  if (sort === 'posted_at') {
    filtered = filtered.slice().sort((a, b) => (b.posted_at || '').localeCompare(a.posted_at || ''));
  } else if (sort === 'company') {
    filtered = filtered.slice().sort((a, b) => (a.company || '').localeCompare(b.company || ''));
  } else { // relevance
    filtered = filtered.slice().sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
  }

  // Header + controls (preserve from initial HTML)
  const newest = feedFreshness();
  const sinceLabel = newest ? `· updated ${relativeTimeSince(new Date(newest).toISOString())}` : '';

  const headerHtml = `
    <div class="feed-head">
      <h3>Fresh jobs <span class="feed-since">— ${filtered.length} listings ${sinceLabel}</span></h3>
      <div class="feed-controls">
        <select id="feed-sort" onchange="renderJobsFeed()">
          <option value="relevance" ${sort==='relevance'?'selected':''}>Sort: relevance</option>
          <option value="posted_at" ${sort==='posted_at'?'selected':''}>Sort: most recent</option>
          <option value="company" ${sort==='company'?'selected':''}>Sort: company</option>
        </select>
        <select id="feed-filter" onchange="renderJobsFeed()">
          <option value="all" ${filter==='all'?'selected':''}>All sources</option>
          <option value="greenhouse" ${filter==='greenhouse'?'selected':''}>Greenhouse only</option>
          <option value="lever" ${filter==='lever'?'selected':''}>Lever only</option>
          <option value="jsearch" ${filter==='jsearch'?'selected':''}>JSearch only</option>
          <option value="alum" ${filter==='alum'?'selected':''}>Has alum at company</option>
          <option value="conn" ${filter==='conn'?'selected':''}>Has any connection</option>
        </select>
      </div>
    </div>`;

  const items = filtered.slice(0, 30).map(j => {
    const summary = jobsConnSummary(j.company);
    const tracked = isAppAlreadyTracked(j);
    const scoreClass = (j.relevance_score || 0) >= 8 ? 'high' : (j.relevance_score || 0) >= 4 ? 'mid' : 'low';
    const connsLine = summary.total > 0
      ? `<div class="job-conns">
          ${summary.alumCount > 0 ? `<span class="alum-badge">🎓 ${summary.alumCount} alum${summary.alumCount > 1 ? 's' : ''}</span>` : ''}
          <span class="job-conn-count">👥 ${summary.total} connection${summary.total > 1 ? 's' : ''} at ${escapeHTML(j.company)}</span>
          <div class="job-conn-names">${summary.conns.slice(0, 3).map(c => escapeHTML(c.name)).join(', ')}${summary.conns.length > 3 ? ` +${summary.conns.length - 3} more` : ''}</div>
        </div>`
      : `<div class="job-conns no-conns">No connections at ${escapeHTML(j.company)}</div>`;
    return `
      <div class="job-card">
        <div class="job-card-main">
          <div class="job-card-head">
            <div class="job-title-row">
              <strong>${escapeHTML(j.title || '')}</strong>
              <span class="score-badge ${scoreClass}" title="Keyword match against your resume">${j.relevance_score || 0}</span>
            </div>
            <div class="job-meta">
              <span>${escapeHTML(j.company || '')}</span>
              ${j.location ? `<span class="dot">·</span><span>${escapeHTML(j.location)}</span>` : ''}
              <span class="dot">·</span><span class="job-source">${escapeHTML(j.source || '')}</span>
              <span class="dot">·</span><span class="job-time">${relativeTimeSince(j.posted_at)}</span>
            </div>
          </div>
          ${connsLine}
        </div>
        <div class="job-card-actions">
          <a class="link-btn" href="${escapeHTML(j.url)}" target="_blank" rel="noopener">↗ Open JD</a>
          ${tracked
            ? `<button disabled title="Already in your applications">✓ Tracked</button>`
            : `<button class="primary" onclick="trackJobFromFeed('${j.id}')">+ Track</button>`}
          <button class="ghost" onclick="dismissJob('${j.id}')" title="Hide from feed">✕</button>
        </div>
      </div>
    `;
  }).join('');

  card.innerHTML = headerHtml + `<div id="feed-list">${items}</div>`;
}

async function trackJobFromFeed(jobId) {
  const j = state.feed.find(x => x.id === jobId);
  if (!j) return;
  setSyncState('syncing');
  try {
    const row = {
      owner_token: userToken,
      company: j.company,
      role: j.title,
      location: j.location || '',
      jd_url: j.url,
      status: 'not_applied',
      notes: (j.description || '').slice(0, 1000),
      timeline: [{ date: today(), type: 'created', label: `Job added from daily feed (${j.source})` }]
    };
    const { data: inserted, error } = await supabase.from('applications').insert(row).select().single();
    if (error) throw error;
    state.apps.unshift(inserted);
    setSyncState('online');
    toast(`Tracking ${j.title} at ${j.company}.`, 'success');
    renderJobsFeed();
    renderDashboard();
  } catch (e) {
    setSyncState('error');
    toast('Track failed: ' + e.message, 'error');
  }
}

async function dismissJob(jobId) {
  const j = state.feed.find(x => x.id === jobId);
  if (!j) return;
  j.dismissed = true;
  renderJobsFeed();
  try {
    await supabase.from('jobs_feed').update({ dismissed: true }).eq('id', jobId);
  } catch (e) {
    j.dismissed = false;
    renderJobsFeed();
    toast('Dismiss failed: ' + e.message, 'error');
  }
}

// ============ DAILY ACCOUNTABILITY ============
const APP_STATUS_FLOW = ['not_applied', 'applied', 'recruiter_screen', 'hm_call', 'onsite', 'offer'];

function timelineEvents(app) {
  // Always return an array, even if column is null/missing.
  return Array.isArray(app && app.timeline) ? app.timeline : [];
}

function countAppsAppliedOn(date) {
  // An app counts toward "applied today" if EITHER applied_date == today
  // OR its timeline has an 'applied' event on today (so changing status
  // to 'applied' fires the counter even without a date field).
  return state.apps.filter(a => {
    if (a.applied_date === date) return true;
    return timelineEvents(a).some(e => e.type === 'applied' && e.date === date);
  }).length;
}

function countMessagesSentOn(date) {
  // Outreach counter: connections whose last_contact === today.
  return state.conns.filter(c => c.last_contact === date).length;
}

function computeStreak() {
  // Streak = consecutive prior days (incl. today) where you met EITHER goal
  // (or did at least one of each kind of action if goals are 0).
  const t = today();
  const minApps = state.settings.daily_apps_goal || 0;
  const minMsgs = state.settings.daily_messages_goal || 0;

  // Build per-date counts from apps + conns
  const dateCounts = {};
  state.apps.forEach(a => {
    timelineEvents(a).forEach(e => {
      if (e.type === 'applied' && e.date) {
        dateCounts[e.date] = dateCounts[e.date] || { apps: 0, msgs: 0 };
        dateCounts[e.date].apps++;
      }
    });
    if (a.applied_date) {
      dateCounts[a.applied_date] = dateCounts[a.applied_date] || { apps: 0, msgs: 0 };
      // Only count once; if timeline already has it, the above already counted it
      const hasInTimeline = timelineEvents(a).some(e => e.type === 'applied' && e.date === a.applied_date);
      if (!hasInTimeline) dateCounts[a.applied_date].apps++;
    }
  });
  state.conns.forEach(c => {
    if (c.last_contact) {
      dateCounts[c.last_contact] = dateCounts[c.last_contact] || { apps: 0, msgs: 0 };
      dateCounts[c.last_contact].msgs++;
    }
  });

  // Walk back from today
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = addDays(t, -i);
    const c = dateCounts[d] || { apps: 0, msgs: 0 };
    const metApps = minApps > 0 ? c.apps >= minApps : c.apps > 0;
    const metMsgs = minMsgs > 0 ? c.msgs >= minMsgs : c.msgs > 0;
    // Met the day if either goal hit (or, if both goals are 0, any activity)
    const anyGoal = minApps > 0 || minMsgs > 0;
    const metDay = anyGoal ? (metApps || metMsgs) : (c.apps > 0 || c.msgs > 0);
    if (metDay) streak++;
    else if (i === 0) break; // today not yet met → streak 0
    else break;
  }
  return streak;
}

function renderDailyAccountability() {
  const t = today();
  const appsCount = countAppsAppliedOn(t);
  const msgsCount = countMessagesSentOn(t);
  const appsGoal = state.settings.daily_apps_goal ?? 25;
  const msgsGoal = state.settings.daily_messages_goal ?? 10;
  const streak = computeStreak();

  // Apps goal
  const appsRow = document.getElementById('goal-apps-count').parentElement.parentElement;
  if (appsGoal > 0) {
    appsRow.style.display = '';
    document.getElementById('goal-apps-count').textContent = `${appsCount} / ${appsGoal}`;
    const pct = Math.min(100, (appsCount / appsGoal) * 100);
    const fill = document.getElementById('goal-apps-fill');
    fill.style.width = pct + '%';
    fill.classList.toggle('met', appsCount >= appsGoal);
  } else {
    appsRow.style.display = 'none';
  }

  // Messages goal
  const msgRow = document.getElementById('goal-msg-count').parentElement.parentElement;
  if (msgsGoal > 0) {
    msgRow.style.display = '';
    document.getElementById('goal-msg-count').textContent = `${msgsCount} / ${msgsGoal}`;
    const pct = Math.min(100, (msgsCount / msgsGoal) * 100);
    const fill = document.getElementById('goal-msg-fill');
    fill.style.width = pct + '%';
    fill.classList.toggle('met', msgsCount >= msgsGoal);
  } else {
    msgRow.style.display = 'none';
  }

  document.getElementById('streak-display').textContent = streak > 0 ? `🔥 ${streak}-day streak` : '○ no streak yet';

  // Hide the whole card if both goals are 0
  document.getElementById('goals-card').style.display = (appsGoal === 0 && msgsGoal === 0) ? 'none' : '';
}

// ============ DASHBOARD ============
function renderDashboard() {
  document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  renderJobsFeed();
  renderDailyAccountability();
  const active = state.apps.filter(a => !['rejected', 'archived'].includes(a.status)).length;
  const interviews = state.apps.filter(a => ['recruiter_screen','hm_call','onsite'].includes(a.status)).length;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-interviews').textContent = interviews;
  document.getElementById('stat-connections').textContent = state.conns.length;

  const actions = [];
  state.apps.forEach(a => {
    const n = computeNextAction(a, 'app');
    if (n.date) actions.push({ ...n, type: 'app', id: a.id, target: a.company, sub: a.role, raw: a });
  });
  state.conns.forEach(c => {
    const n = computeNextAction(c, 'conn');
    if (n.date) actions.push({ ...n, type: 'conn', id: c.id, target: c.name, sub: `${c.company || ''} • ${c.role || ''}`, raw: c });
  });

  const t = today();
  const overdue = actions.filter(a => a.date < t).sort((a, b) => a.date.localeCompare(b.date));
  const todayItems = actions.filter(a => a.date === t);
  const upcoming = actions.filter(a => a.date > t && a.date <= addDays(t, 7)).sort((a, b) => a.date.localeCompare(b.date));

  document.getElementById('stat-overdue').textContent = overdue.length;
  document.getElementById('badge-actions').textContent = overdue.length + todayItems.length;
  document.getElementById('count-overdue').textContent = overdue.length;
  document.getElementById('count-today').textContent = todayItems.length;
  document.getElementById('count-upcoming').textContent = upcoming.length;

  document.getElementById('list-overdue').innerHTML = overdue.length ? overdue.map(a => actionCardHTML(a, 'overdue')).join('') : `<div class="empty" style="padding:20px"><div>Nothing overdue. ✓</div></div>`;
  document.getElementById('list-today').innerHTML = todayItems.length ? todayItems.map(a => actionCardHTML(a, 'today')).join('') : `<div class="empty" style="padding:20px"><div>Nothing scheduled today.</div></div>`;
  document.getElementById('list-upcoming').innerHTML = upcoming.length ? upcoming.map(a => actionCardHTML(a, 'upcoming')).join('') : `<div class="empty" style="padding:20px"><div>No upcoming actions in next 7 days.</div></div>`;

  // Funnel
  const stages = [
    { key: 'identified', label: 'Identified' },
    { key: 'not_applied', label: 'Not applied' },
    { key: 'applied', label: 'Applied' },
    { key: 'recruiter_screen', label: 'Recruiter' },
    { key: 'hm_call', label: 'HM call' },
    { key: 'onsite', label: 'Onsite' },
    { key: 'offer', label: 'Offer' }
  ];
  const counts = stages.map(s => ({ ...s, n: state.apps.filter(a => a.status === s.key).length }));
  const max = Math.max(...counts.map(c => c.n), 1);
  document.getElementById('funnel').innerHTML = counts.map(c => `
    <div class="funnel-row">
      <div class="stage-label">${c.label}</div>
      <div class="bar"><div class="bar-fill" style="width:${(c.n / max * 100).toFixed(0)}%"></div></div>
      <div class="count-val">${c.n}</div>
    </div>
  `).join('');
}

function actionCardHTML(a, kind) {
  const whenLabel = kind === 'overdue' ? `${daysBetween(a.date, today())}d overdue` : kind === 'today' ? 'Today' : fmtDate(a.date);
  const whenClass = kind === 'overdue' ? 'overdue-text' : kind === 'today' ? 'today-text' : '';
  const editFn = a.type === 'app' ? `openAppModal('${a.id}')` : `openConnectionModal('${a.id}')`;
  const msgFn = `openMessageFor('${a.type}','${a.id}')`;
  const directUrl = a.type === 'app' ? a.raw.jd_url : a.raw.linkedin_url;
  const linkLabel = a.type === 'app' ? '↗ JD' : '↗ in';
  const linkBtn = directUrl ? `<a class="link-btn" href="${escapeHTML(directUrl)}" target="_blank" rel="noopener">${linkLabel}</a>` : '';
  return `<div class="action-card ${kind}">
    <div class="when ${whenClass}">${whenLabel}</div>
    <div class="what"><div class="target">${escapeHTML(a.target)}</div><div class="desc">${escapeHTML(a.action)} • ${escapeHTML(a.sub)}</div></div>
    <div class="actions">
      ${linkBtn}
      <button onclick="${msgFn}">✎ Msg</button>
      <button onclick="${editFn}">Edit</button>
      <button onclick="markActionDone('${a.type}','${a.id}')">✓ Done</button>
    </div>
  </div>`;
}

async function markActionDone(type, id) {
  setSyncState('syncing');
  try {
    if (type === 'app') {
      const a = state.apps.find(x => x.id === id);
      const action = a ? computeNextAction(a, 'app').action : 'Follow-up';
      const newTimeline = a ? [...timelineEvents(a), { date: today(), type: 'followup', label: action + ' — done' }] : null;
      const { error } = await supabase.from('applications').update({ last_action_date: today(), timeline: newTimeline }).eq('id', id);
      if (error) throw error;
      if (a) { a.last_action_date = today(); a.timeline = newTimeline; }
    } else {
      const c = state.conns.find(x => x.id === id);
      const { error } = await supabase.from('connections').update({ last_contact: today() }).eq('id', id);
      if (error) throw error;
      if (c) c.last_contact = today();
    }
    setSyncState('online');
    toast('Action marked done.', 'success');
    renderDashboard();
  } catch (e) {
    setSyncState('error');
    toast('Save failed: ' + e.message, 'error');
  }
}

// ============ APPLICATIONS ============
function renderApps() {
  const search = (document.getElementById('apps-search')?.value || '').toLowerCase();
  const filter = document.getElementById('apps-filter-status')?.value || '';
  const filtered = state.apps.filter(a => {
    const matchS = !search || ((a.company || '') + ' ' + (a.role || '')).toLowerCase().includes(search);
    const matchF = !filter || a.status === filter;
    return matchS && matchF;
  });
  if (filtered.length === 0) {
    document.getElementById('apps-table').innerHTML = `<div class="empty"><div class="big">▦</div><h4>No applications yet</h4><div>Add your first job to start tracking.</div></div>`;
    return;
  }
  const rows = filtered.map(a => {
    const n = computeNextAction(a, 'app');
    const overdue = n.date && n.date < today();
    const statusKey = (a.status || '').replace('_screen', '').replace('_call', '').replace('not_applied', '');
    const linkBtn = a.jd_url ? `<a class="link-btn" href="${escapeHTML(a.jd_url)}" target="_blank" rel="noopener" title="Open JD">↗ JD</a>` : '';
    return `<tr>
      <td><div class="row-name">${escapeHTML(a.company || '—')}</div><div class="row-sub">${escapeHTML(a.role || '')}</div></td>
      <td class="muted">${escapeHTML(a.location || '—')}</td>
      <td><span class="pill ${statusKey}">${(a.status || '').replace(/_/g, ' ')}</span></td>
      <td class="muted">${fmtDate(a.applied_date)}</td>
      <td class="muted">${escapeHTML(a.referrer || '—')}</td>
      <td style="color:${overdue ? 'var(--red)' : 'var(--text-dim)'}">${n.date ? fmtDate(n.date) : '—'}<div class="row-sub">${escapeHTML(n.action)}</div></td>
      <td class="actions-col">${linkBtn}<button onclick="openAppModal('${a.id}')">Edit</button></td>
    </tr>`;
  }).join('');

  // Mobile card view (same data, different layout)
  const cards = filtered.map(a => {
    const n = computeNextAction(a, 'app');
    const overdue = n.date && n.date < today();
    const statusKey = (a.status || '').replace('_screen', '').replace('_call', '').replace('not_applied', '');
    const linkBtn = a.jd_url ? `<a class="link-btn" href="${escapeHTML(a.jd_url)}" target="_blank" rel="noopener">↗ Open JD</a>` : '';
    return `<div class="list-card">
      <div class="list-card-head">
        <div>
          <div class="list-card-title">${escapeHTML(a.company || '—')}</div>
          <div class="list-card-sub">${escapeHTML(a.role || '')}</div>
        </div>
        <span class="pill ${statusKey}">${(a.status || '').replace(/_/g, ' ')}</span>
      </div>
      <div class="list-card-meta">
        ${a.location ? `<span>${escapeHTML(a.location)}</span>` : ''}
        ${a.applied_date ? `<span>Applied ${fmtDate(a.applied_date)}</span>` : ''}
        ${a.referrer ? `<span>via ${escapeHTML(a.referrer)}</span>` : ''}
      </div>
      ${n.date ? `<div class="list-card-next ${overdue ? 'overdue' : ''}">${fmtDate(n.date)} — ${escapeHTML(n.action)}</div>` : ''}
      <div class="list-card-actions">
        ${linkBtn}
        <button onclick="openAppModal('${a.id}')">Edit</button>
      </div>
    </div>`;
  }).join('');

  document.getElementById('apps-table').innerHTML = `
    <div class="table-scroll desktop-only"><table>
      <thead><tr><th>Company / Role</th><th>Location</th><th>Status</th><th>Applied</th><th>Referrer</th><th>Next action</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="list-cards mobile-only">${cards}</div>`;
}

// ============ PIPELINE / TIMELINE / SUGGESTIONS / RESUME ============
const PIPELINE_STAGES = [
  { key: 'not_applied', label: 'Saved' },
  { key: 'applied', label: 'Applied' },
  { key: 'recruiter_screen', label: 'Recruiter' },
  { key: 'hm_call', label: 'HM call' },
  { key: 'onsite', label: 'Onsite' },
  { key: 'offer', label: 'Offer' }
];

function stageIndex(status) {
  if (status === 'rejected' || status === 'archived') return -1;
  const i = PIPELINE_STAGES.findIndex(s => s.key === status);
  return i >= 0 ? i : 0;
}

function renderPipeline(app) {
  const wrap = document.getElementById('app-pipeline');
  if (!app) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  const idx = stageIndex(app.status);
  const terminal = app.status === 'rejected' || app.status === 'archived';
  wrap.innerHTML = PIPELINE_STAGES.map((s, i) => {
    let cls = 'pipeline-step';
    if (terminal) cls += ' terminal';
    else if (i < idx) cls += ' done';
    else if (i === idx) cls += ' current';
    return `<div class="${cls}"><div class="dot"></div><div class="label">${s.label}</div></div>`;
  }).join('') + (terminal
    ? `<div class="pipeline-step terminal-flag"><div class="dot"></div><div class="label">${app.status === 'offer' ? 'Offer' : app.status === 'rejected' ? 'Rejected' : 'Archived'}</div></div>`
    : '');
}

function renderTimelineFor(app) {
  const section = document.getElementById('app-timeline-section');
  if (!app) { section.style.display = 'none'; return; }
  section.style.display = '';
  const events = timelineEvents(app).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (events.length === 0) {
    document.getElementById('app-timeline').innerHTML = `<div class="timeline-empty">No steps logged yet. They'll auto-log as you change status, send messages, or mark actions done.</div>`;
    return;
  }
  document.getElementById('app-timeline').innerHTML = events.map(e => `
    <div class="timeline-row">
      <div class="timeline-date">${fmtDate(e.date)}</div>
      <div class="timeline-body">
        <div class="timeline-label">${escapeHTML(e.label || e.type)}</div>
        ${e.note ? `<div class="timeline-note">${escapeHTML(e.note)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function suggestionsForCompany(company) {
  if (!company) return [];
  const cl = company.toLowerCase().trim();
  if (cl.length < 2) return [];
  const userSchool = state.settings.school || '';
  return state.conns.filter(c => {
    const cc = (c.company || '').toLowerCase();
    if (!cc) return false;
    return cc.includes(cl) || cl.includes(cc);
  }).sort((a, b) => {
    // Alums first, then by tier
    const aAlum = isAlumOf(a.school, userSchool) ? 0 : 1;
    const bAlum = isAlumOf(b.school, userSchool) ? 0 : 1;
    if (aAlum !== bAlum) return aAlum - bAlum;
    return (a.tier || 'Z').localeCompare(b.tier || 'Z');
  }).slice(0, 5);
}

function updateContactSuggestion() {
  const company = document.getElementById('app-company').value;
  const banner = document.getElementById('app-suggest');
  const suggestions = suggestionsForCompany(company);
  if (suggestions.length === 0) { banner.style.display = 'none'; return; }
  const userSchool = state.settings.school || '';
  banner.style.display = '';
  banner.innerHTML = `
    <div class="suggest-head">💡 You know ${suggestions.length} ${suggestions.length === 1 ? 'person' : 'people'} at ${escapeHTML(company)}:</div>
    <div class="suggest-list">
      ${suggestions.map(c => {
        const alum = isAlumOf(c.school, userSchool);
        return `
        <div class="suggest-row">
          <div>
            <span class="pill tier-${c.tier || 'D'}">Tier ${c.tier || 'D'}</span>
            ${alum ? `<span class="alum-badge" title="Fellow alum">🎓 alum</span>` : ''}
            <strong>${escapeHTML(c.name)}</strong>
            <span class="suggest-role">${escapeHTML(c.role || '')}</span>
          </div>
          <div class="suggest-actions">
            ${c.linkedin_url ? `<a class="link-btn" href="${escapeHTML(c.linkedin_url)}" target="_blank" rel="noopener">↗ in</a>` : ''}
            <button class="primary" onclick="openMessageFor('conn','${c.id}')">✎ Draft message</button>
          </div>
        </div>
        `;
      }).join('')}
    </div>
  `;
}

async function handleResumeUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    toast('File too big (max 10 MB).', 'error');
    e.target.value = '';
    return;
  }
  const statusEl = document.getElementById('app-resume-status');
  statusEl.innerHTML = `<span class="spinner"></span> Uploading ${escapeHTML(file.name)}...`;
  try {
    const ext = (file.name.match(/\.[a-z0-9]+$/i) || ['.bin'])[0];
    const path = `${userToken}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const { error } = await supabase.storage.from('resumes').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream'
    });
    if (error) throw error;
    pendingResume = { file_path: path, file_name: file.name };
    statusEl.innerHTML = `✓ <strong>${escapeHTML(file.name)}</strong> ready — will save with this application. <button onclick="clearPendingResume()" class="ghost" style="margin-left:8px">Remove</button>`;
  } catch (err) {
    statusEl.innerHTML = `<span style="color:var(--red)">Upload failed: ${escapeHTML(err.message)}</span>`;
    console.error(err);
  }
  e.target.value = '';
}

function clearPendingResume() {
  pendingResume = null;
  const id = document.getElementById('modal-app').dataset.editId;
  const a = id ? state.apps.find(x => x.id === id) : null;
  renderResumeStatus(a);
}

function openResumeBuilderForApp() {
  const company = document.getElementById('app-company')?.value.trim() || '';
  const role = document.getElementById('app-role')?.value.trim() || '';
  const jd = document.getElementById('app-notes')?.value.trim() || '';
  closeModal('modal-app');
  openView('resume');
  setTimeout(() => window.JobResumeBuilder?.prefillTarget({ company, role, jd }), 0);
}

function resumePublicUrl(filePath) {
  if (!filePath || !supabase) return '';
  const { data } = supabase.storage.from('resumes').getPublicUrl(filePath);
  return data?.publicUrl || '';
}

function renderResumeStatus(app) {
  const el = document.getElementById('app-resume-status');
  if (!el) return;
  if (pendingResume) {
    el.innerHTML = `✓ <strong>${escapeHTML(pendingResume.file_name)}</strong> uploaded — will save with this application. <button onclick="clearPendingResume()" class="ghost" style="margin-left:8px">Remove</button>`;
    return;
  }
  if (app && app.resume_file_path) {
    const url = resumePublicUrl(app.resume_file_path);
    const name = app.resume_file_path.split('/').pop();
    el.innerHTML = `Current file: <a href="${escapeHTML(url)}" target="_blank" rel="noopener" class="link-btn">↗ ${escapeHTML(name)}</a> <button class="ghost" onclick="removeResumeFile()" style="margin-left:8px">Remove</button>`;
    return;
  }
  el.innerHTML = '';
}

async function removeResumeFile() {
  const id = document.getElementById('modal-app').dataset.editId;
  if (!id) return;
  const a = state.apps.find(x => x.id === id);
  if (!a || !a.resume_file_path) return;
  if (!confirm('Remove this resume file from storage?')) return;
  try {
    await supabase.storage.from('resumes').remove([a.resume_file_path]);
    await supabase.from('applications').update({ resume_file_path: null }).eq('id', id);
    a.resume_file_path = null;
    renderResumeStatus(a);
    toast('Resume removed.', 'success');
  } catch (e) {
    toast('Remove failed: ' + e.message, 'error');
  }
}

async function addCustomTimelineNote() {
  const id = document.getElementById('modal-app').dataset.editId;
  if (!id) { alert('Save the application first to add timeline notes.'); return; }
  const note = document.getElementById('timeline-note-input').value.trim();
  if (!note) return;
  const a = state.apps.find(x => x.id === id);
  if (!a) return;
  const newTimeline = [...timelineEvents(a), { date: today(), type: 'note', label: 'Note', note }];
  try {
    const { error } = await supabase.from('applications').update({ timeline: newTimeline }).eq('id', id);
    if (error) throw error;
    a.timeline = newTimeline;
    document.getElementById('timeline-note-input').value = '';
    renderTimelineFor(a);
    toast('Step added.', 'success');
  } catch (e) {
    toast('Failed: ' + e.message, 'error');
  }
}

function appendTimelineLocal(app, entry) {
  if (!app) return;
  app.timeline = [...timelineEvents(app), { date: today(), ...entry }];
}

function openAppModal(id) {
  pendingResume = null;
  document.getElementById('app-delete-btn').style.display = id ? 'inline-block' : 'none';
  document.getElementById('modal-app-title').textContent = id ? 'Edit Application' : 'Add Application';
  document.getElementById('connection-list').innerHTML = state.conns.map(c => `<option value="${escapeHTML(c.name)}">`).join('');
  document.getElementById('app-resume-url').value = '';
  document.getElementById('timeline-note-input').value = '';

  if (id) {
    const a = state.apps.find(x => x.id === id);
    if (!a) return;
    document.getElementById('app-company').value = a.company || '';
    document.getElementById('app-role').value = a.role || '';
    document.getElementById('app-location').value = a.location || '';
    document.getElementById('app-salary').value = a.salary || '';
    document.getElementById('app-url').value = a.jd_url || '';
    document.getElementById('app-status').value = a.status || 'not_applied';
    document.getElementById('app-date').value = a.applied_date || '';
    document.getElementById('app-referrer').value = a.referrer || '';
    document.getElementById('app-notes').value = a.notes || '';
    document.getElementById('app-resume-url').value = a.resume_url || '';
    document.getElementById('modal-app').dataset.editId = id;
    renderPipeline(a);
    renderTimelineFor(a);
    renderResumeStatus(a);
  } else {
    ['app-company','app-role','app-location','app-salary','app-url','app-referrer','app-notes'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('app-status').value = 'not_applied';
    document.getElementById('app-date').value = today();
    delete document.getElementById('modal-app').dataset.editId;
    renderPipeline(null);
    renderTimelineFor(null);
    renderResumeStatus(null);
  }
  updateContactSuggestion();
  document.getElementById('modal-app').classList.add('active');
}

async function saveApp() {
  const id = document.getElementById('modal-app').dataset.editId;
  const existing = id ? state.apps.find(x => x.id === id) : null;
  const newStatus = document.getElementById('app-status').value;
  const newDate = document.getElementById('app-date').value || null;

  const data = {
    company: document.getElementById('app-company').value.trim(),
    role: document.getElementById('app-role').value.trim(),
    location: document.getElementById('app-location').value.trim(),
    salary: document.getElementById('app-salary').value.trim(),
    jd_url: document.getElementById('app-url').value.trim(),
    status: newStatus,
    applied_date: newDate,
    referrer: document.getElementById('app-referrer').value.trim(),
    notes: document.getElementById('app-notes').value.trim(),
    resume_url: document.getElementById('app-resume-url').value.trim() || null
  };
  if (pendingResume) data.resume_file_path = pendingResume.file_path;

  if (!data.company || !data.role) { alert('Company and role required.'); return; }

  // Compute timeline updates: log status changes and creation.
  let timeline = existing ? timelineEvents(existing).slice() : [];
  const oldStatus = existing ? existing.status : null;
  if (!existing) {
    timeline.push({ date: today(), type: 'created', label: 'Job added to tracker' });
  }
  if (oldStatus !== newStatus) {
    const stageLabel = (PIPELINE_STAGES.find(s => s.key === newStatus) || {}).label || newStatus.replace(/_/g, ' ');
    timeline.push({ date: newDate || today(), type: newStatus, label: `Status → ${stageLabel}` });
  }
  if (pendingResume) {
    timeline.push({ date: today(), type: 'resume', label: `Resume attached: ${pendingResume.file_name}` });
  }
  data.timeline = timeline;

  setSyncState('syncing');
  try {
    if (id) {
      const { error } = await supabase.from('applications').update(data).eq('id', id);
      if (error) throw error;
      Object.assign(existing, data);
    } else {
      data.owner_token = userToken;
      const { data: inserted, error } = await supabase.from('applications').insert(data).select().single();
      if (error) throw error;
      state.apps.unshift(inserted);
    }
    pendingResume = null;
    setSyncState('online');
    closeModal('modal-app');
    toast(id ? 'Application updated.' : 'Application saved.', 'success');
    renderApps();
    renderDashboard();
  } catch (e) {
    setSyncState('error');
    toast('Save failed: ' + e.message, 'error');
  }
}

async function deleteApp() {
  const id = document.getElementById('modal-app').dataset.editId;
  if (!confirm('Delete this application?')) return;
  setSyncState('syncing');
  try {
    const { error } = await supabase.from('applications').delete().eq('id', id);
    if (error) throw error;
    state.apps = state.apps.filter(a => a.id !== id);
    setSyncState('online');
    closeModal('modal-app');
    toast('Deleted.', 'success');
    renderApps();
    renderDashboard();
  } catch (e) {
    setSyncState('error');
    toast('Delete failed: ' + e.message, 'error');
  }
}

// ============ JD PARSER ============
function parseJD() {
  const text = document.getElementById('parser-text').value;
  if (!text.trim()) { alert('Paste a JD first, or use Fetch & Parse with a URL.'); return; }
  const out = extractFields(text);
  out.jd_url = document.getElementById('parser-url').value.trim();
  renderParserOutput(out, text);
}

async function fetchJDFromURL() {
  const url = document.getElementById('parser-url').value.trim();
  if (!url) { alert('Paste a JD URL first.'); return; }
  if (!/^https?:\/\//i.test(url)) { alert('URL must start with http:// or https://'); return; }

  const btn = document.getElementById('fetch-url-btn');
  const originalLabel = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Fetching...';

  try {
    // r.jina.ai is a free reader-mode proxy that returns clean markdown for any URL.
    // Bypasses CORS and renders JS. Falls back gracefully if blocked.
    const proxyUrl = 'https://r.jina.ai/' + url;
    const resp = await fetch(proxyUrl, {
      method: 'GET',
      headers: { 'Accept': 'text/plain' }
    });
    if (!resp.ok) throw new Error(`Reader returned ${resp.status}`);
    const text = await resp.text();
    if (!text || text.length < 100) throw new Error('Empty or too-short response — site may be blocking the reader.');

    // Stuff into the textarea so the user can see what was fetched and edit if needed.
    document.getElementById('parser-text').value = text;

    const out = extractFields(text);
    out.jd_url = url;
    renderParserOutput(out, text);
    toast('Fetched. Review the parsed fields below.', 'success');
  } catch (e) {
    toast('Fetch failed: ' + e.message + ' — paste the JD text manually.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalLabel;
  }
}

function extractFields(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result = { company: '', role: '', location: '', salary: '', requirements: [] };

  const aboutMatch = text.match(/About ([A-Z][A-Za-z0-9&\.\-' ]{2,40})/);
  if (aboutMatch) result.company = aboutMatch[1].trim();

  const rolePatterns = [
    /(?:Position|Role|Job Title|Title)[:\s]+([^\n]{5,80})/i,
    /^([A-Z][A-Za-z0-9\-\/&,\(\) ]{8,80}(?:Engineer|Scientist|Developer|Analyst|Manager|Designer|Intern|Specialist|Researcher))/m
  ];
  for (const p of rolePatterns) {
    const m = text.match(p);
    if (m) { result.role = m[1].trim(); break; }
  }
  if (!result.role && lines[0] && lines[0].length < 100 && /Engineer|Scientist|Developer|Analyst|Manager/i.test(lines[0])) {
    result.role = lines[0];
  }
  if (!result.company && result.role) {
    const idx = lines.indexOf(result.role);
    if (idx > 0) result.company = lines[idx - 1];
    else if (lines[0] && lines[0] !== result.role) result.company = lines[0];
  }

  const locMatch = text.match(/(?:Location|Based in|Office)[:\s]+([^\n]{3,60})/i);
  if (locMatch) result.location = locMatch[1].trim();
  if (/remote/i.test(text) && !result.location) result.location = 'Remote';
  else if (/remote/i.test(text) && !/remote/i.test(result.location)) result.location += ' / Remote';

  const salMatch = text.match(/\$([0-9]{2,3})[,\s]?([0-9]{3})\s*[-–to]+\s*\$?([0-9]{2,3})[,\s]?([0-9]{3})/) ||
                   text.match(/\$([0-9]{2,3})k\s*[-–to]+\s*\$?([0-9]{2,3})k/i) ||
                   text.match(/(?:Salary|Compensation|Pay)[:\s]+([^\n]{5,80})/i);
  if (salMatch) result.salary = salMatch[0];

  const reqStart = text.search(/(?:Requirements|Qualifications|What you'?ll need|Required Skills|Required Experience|Must Have|Basic Qualifications|Minimum Qualifications)/i);
  if (reqStart > -1) {
    const reqSection = text.slice(reqStart, reqStart + 2000);
    const bullets = reqSection.split(/\n/).filter(l => /^[\s]*[•\-\*\u2022]\s+/.test(l) || /^\d+[\.\)]\s+/.test(l));
    result.requirements = bullets.slice(0, 10).map(b => b.replace(/^[\s]*[•\-\*\u2022\d\.\)]+\s*/, '').trim());
  }

  return result;
}

function renderParserOutput(o, fullText) {
  // ITAR / citizenship check
  const itarBlocked = /US citizen|U\.S\. citizen|United States citizen|security clearance|ITAR|export control|export-control/i.test(fullText);
  const sponsorshipMentioned = /sponsor|visa|work authoriz/i.test(fullText);

  const out = document.getElementById('parser-output');
  out.innerHTML = `
    ${itarBlocked ? `<div class="visa-warn">⚠ F1/OPT LIKELY BLOCKED — JD mentions US citizenship, ITAR, security clearance, or export control. Verify before applying.</div>` : `<div class="visa-ok">✓ No ITAR/citizenship blockers detected in JD text.</div>`}
    ${sponsorshipMentioned ? `<div class="visa-warn" style="background:rgba(255,210,63,0.15);border-color:var(--accent-2);color:var(--accent-2);margin-top:8px">⚡ Visa/sponsorship language present — read JD carefully for sponsorship policy.</div>` : ''}
    <div class="extracted-field" style="margin-top:12px"><div class="label-inline">Company</div><div><input type="text" id="px-company" value="${escapeHTML(o.company)}"></div></div>
    <div class="extracted-field"><div class="label-inline">Role</div><div><input type="text" id="px-role" value="${escapeHTML(o.role)}"></div></div>
    <div class="extracted-field"><div class="label-inline">Location</div><div><input type="text" id="px-location" value="${escapeHTML(o.location)}"></div></div>
    <div class="extracted-field"><div class="label-inline">Salary</div><div><input type="text" id="px-salary" value="${escapeHTML(o.salary)}"></div></div>
    <div class="extracted-field"><div class="label-inline">JD URL</div><div><input type="url" id="px-url" value="${escapeHTML(o.jd_url || '')}"></div></div>
    <div class="extracted-field"><div class="label-inline">Key reqs</div><div><textarea id="px-reqs" style="min-height:100px">${o.requirements.map(r => '• ' + r).join('\n')}</textarea></div></div>
    <div class="flex gap mt-2">
      <button class="primary" onclick="saveParsed()">✓ Save to tracker</button>
      <button onclick="clearParser()">Clear</button>
    </div>
  `;
}

async function saveParsed() {
  const data = {
    company: document.getElementById('px-company').value.trim(),
    role: document.getElementById('px-role').value.trim(),
    location: document.getElementById('px-location').value.trim(),
    salary: document.getElementById('px-salary').value.trim(),
    jd_url: document.getElementById('px-url').value.trim(),
    notes: document.getElementById('px-reqs').value.trim(),
    status: 'not_applied',
    applied_date: null,
    referrer: '',
    timeline: [{ date: today(), type: 'created', label: 'Job added via parser' }],
    owner_token: userToken
  };
  if (!data.company || !data.role) { alert('Company and role required — edit the fields above.'); return; }
  setSyncState('syncing');
  try {
    const { data: inserted, error } = await supabase.from('applications').insert(data).select().single();
    if (error) throw error;
    state.apps.unshift(inserted);
    setSyncState('online');
    toast(`Saved: ${data.company} — ${data.role}`, 'success');
    clearParser();
    openView('applications');
  } catch (e) {
    setSyncState('error');
    toast('Save failed: ' + e.message, 'error');
  }
}

function clearParser() {
  document.getElementById('parser-text').value = '';
  document.getElementById('parser-url').value = '';
  document.getElementById('parser-output').innerHTML = `<div class="empty"><div class="big">⊕</div><h4>Paste a JD, hit Parse</h4><div>Extracted fields appear here, then save to tracker.</div></div>`;
}

// ============ CONNECTIONS ============
function renderConnections() {
  const search = (document.getElementById('conn-search')?.value || '').toLowerCase();
  const tier = document.getElementById('conn-filter-tier')?.value || '';
  const status = document.getElementById('conn-filter-status')?.value || '';
  const alumFilter = document.getElementById('conn-filter-alum')?.value || '';
  const userSchool = state.settings.school || '';
  const filtered = state.conns.filter(c => {
    const matchS = !search || ((c.name || '') + ' ' + (c.company || '') + ' ' + (c.role || '')).toLowerCase().includes(search);
    const matchT = !tier || c.tier === tier;
    const matchSt = !status || c.status === status;
    let matchA = true;
    if (alumFilter === 'alum') matchA = isAlumOf(c.school, userSchool);
    else if (alumFilter === 'no_school') matchA = !c.school;
    return matchS && matchT && matchSt && matchA;
  }).sort((a, b) => {
    // Alums first within same tier
    const tierCmp = (a.tier || 'Z').localeCompare(b.tier || 'Z');
    if (tierCmp !== 0) return tierCmp;
    const aAlum = isAlumOf(a.school, userSchool) ? 0 : 1;
    const bAlum = isAlumOf(b.school, userSchool) ? 0 : 1;
    return aAlum - bAlum;
  });

  if (filtered.length === 0) {
    document.getElementById('conn-table').innerHTML = `<div class="empty"><div class="big">◉</div><h4>No connections match</h4><div>Try clearing filters, uploading your LinkedIn CSV, or adding contacts manually.</div></div>`;
    return;
  }

  const alumBadge = (c) => isAlumOf(c.school, userSchool)
    ? `<span class="alum-badge" title="Fellow ${deriveSchoolShort(userSchool) || 'school'} alum">🎓 alum</span>`
    : '';

  const totalAlums = state.conns.filter(c => isAlumOf(c.school, userSchool)).length;
  const totalNoSchool = state.conns.filter(c => !c.school).length;
  const statsBar = userSchool
    ? `<div class="conn-stats">Showing <strong>${filtered.length}</strong> of <strong>${state.conns.length}</strong> connections · <strong>${totalAlums}</strong> alums · <strong>${totalNoSchool}</strong> missing school</div>`
    : `<div class="conn-stats setup-note" style="margin:0 0 12px 0">Set your school in Settings to enable alum detection across ${state.conns.length} connections.</div>`;

  const rows = filtered.map(c => {
    const n = computeNextAction(c, 'conn');
    const overdue = n.date && n.date < today();
    const linkBtn = c.linkedin_url ? `<a class="link-btn" href="${escapeHTML(c.linkedin_url)}" target="_blank" rel="noopener" title="Open LinkedIn">↗ in</a>` : '';
    return `<tr>
      <td><div class="row-name">${escapeHTML(c.name || '—')} ${alumBadge(c)}</div>${c.school ? `<div class="row-sub">${escapeHTML(c.school)}</div>` : ''}</td>
      <td><div>${escapeHTML(c.company || '—')}</div><div class="row-sub">${escapeHTML(c.role || '')}</div></td>
      <td><span class="pill tier-${c.tier || 'D'}">Tier ${c.tier || 'D'}</span></td>
      <td><span class="pill">${(c.status || 'identified').replace(/_/g, ' ')}</span></td>
      <td style="color:${overdue ? 'var(--red)' : 'var(--text-dim)'}">${n.date ? fmtDate(n.date) : '—'}<div class="row-sub">${escapeHTML(n.action)}</div></td>
      <td class="actions-col">
        ${linkBtn}
        <button onclick="openMessageFor('conn','${c.id}')">✎</button>
        <button onclick="openConnectionModal('${c.id}')">Edit</button>
      </td>
    </tr>`;
  }).join('');

  const cards = filtered.map(c => {
    const n = computeNextAction(c, 'conn');
    const overdue = n.date && n.date < today();
    const linkBtn = c.linkedin_url ? `<a class="link-btn" href="${escapeHTML(c.linkedin_url)}" target="_blank" rel="noopener">↗ LinkedIn</a>` : '';
    return `<div class="list-card">
      <div class="list-card-head">
        <div>
          <div class="list-card-title">${escapeHTML(c.name || '—')} ${alumBadge(c)}</div>
          <div class="list-card-sub">${escapeHTML(c.company || '')}${c.role ? ' — ' + escapeHTML(c.role) : ''}</div>
          ${c.school ? `<div class="list-card-sub" style="font-size:11px;color:var(--text-faint)">🎓 ${escapeHTML(c.school)}</div>` : ''}
        </div>
        <span class="pill tier-${c.tier || 'D'}">Tier ${c.tier || 'D'}</span>
      </div>
      <div class="list-card-meta">
        <span class="pill">${(c.status || 'identified').replace(/_/g, ' ')}</span>
      </div>
      ${n.date ? `<div class="list-card-next ${overdue ? 'overdue' : ''}">${fmtDate(n.date)} — ${escapeHTML(n.action)}</div>` : ''}
      <div class="list-card-actions">
        ${linkBtn}
        <button onclick="openMessageFor('conn','${c.id}')">✎ Msg</button>
        <button onclick="openConnectionModal('${c.id}')">Edit</button>
      </div>
    </div>`;
  }).join('');

  document.getElementById('conn-table').innerHTML = statsBar + `
    <div class="table-scroll desktop-only"><table>
      <thead><tr><th>Name</th><th>Company / Role</th><th>Tier</th><th>Status</th><th>Next action</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="list-cards mobile-only">${cards}</div>`;
}

// ============ BULK SCHOOL FILL ============
// Pasted names → fuzzy-match against state.conns → bulk-set school.
// Robust to LinkedIn paste-dumps (mixed name / role / location lines).

function normalizeForMatch(s) {
  let n = (s || '').toLowerCase();
  n = n.replace(/\b(mr|mrs|ms|dr|prof|sir|hon)\.?\b/g, '');
  n = n.replace(/[,].*$/, ''); // strip trailing ", PhD" / ", MS" suffix
  n = n.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return n;
}
function firstLastKey(name) {
  const tokens = normalizeForMatch(name).split(' ').filter(Boolean);
  if (tokens.length === 0) return '';
  if (tokens.length === 1) return tokens[0];
  return tokens[0] + '|' + tokens[tokens.length - 1];
}
function extractNamesFromPaste(text) {
  const lines = (text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const seen = new Set();
  const names = [];
  const looksLikeName = (s) => {
    if (s.length < 3 || s.length > 60) return false;
    // Reject lines that look like roles / locations / metadata
    if (/(\bat\b|•|·|—|–|\(|\)|@|https?:|view profile|connect|message|followers?|connections?|mutual|degree|verified)/i.test(s)) return false;
    if (/\d/.test(s)) return false;
    const words = s.split(/\s+/);
    if (words.length < 2 || words.length > 5) return false;
    // Most words must start with a capital letter
    const capCount = words.filter(w => /^[A-Z]/.test(w)).length;
    return capCount >= Math.ceil(words.length * 0.8);
  };
  for (const line of lines) {
    if (looksLikeName(line)) {
      const k = firstLastKey(line);
      if (k && !seen.has(k)) { seen.add(k); names.push(line); }
    }
  }
  return names;
}

let bulkSchoolMatched = []; // ids of connections to update

function openBulkSchoolModal() {
  document.getElementById('bulk-school-value').value = state.settings.school || '';
  document.getElementById('bulk-school-names').value = '';
  document.getElementById('bulk-school-preview').innerHTML = '';
  document.getElementById('bulk-school-apply').disabled = true;
  bulkSchoolMatched = [];
  document.getElementById('modal-bulk-school').classList.add('active');
}

function previewBulkSchool() {
  const schoolVal = document.getElementById('bulk-school-value').value.trim();
  const text = document.getElementById('bulk-school-names').value;
  const preview = document.getElementById('bulk-school-preview');
  if (!schoolVal) { preview.innerHTML = `<div class="bulk-error">Enter a school value first.</div>`; return; }
  const names = extractNamesFromPaste(text);
  if (names.length === 0) { preview.innerHTML = `<div class="bulk-error">No names detected. Paste names one per line, or a chunk of LinkedIn search results.</div>`; return; }

  // Build lookup of existing connections by firstLastKey
  const lookup = new Map();
  for (const c of state.conns) {
    const k = firstLastKey(c.name || '');
    if (!k) continue;
    if (!lookup.has(k)) lookup.set(k, []);
    lookup.get(k).push(c);
  }

  const matched = [];
  const ambiguous = [];
  const unmatched = [];
  const alreadySet = [];
  for (const name of names) {
    const k = firstLastKey(name);
    const hits = lookup.get(k) || [];
    if (hits.length === 0) { unmatched.push(name); continue; }
    if (hits.length > 1) {
      ambiguous.push({ name, hits });
      for (const h of hits) matched.push(h);
      continue;
    }
    const c = hits[0];
    if ((c.school || '').toLowerCase() === schoolVal.toLowerCase()) alreadySet.push(c);
    else matched.push(c);
  }

  // Dedupe matched by id
  const seenIds = new Set();
  bulkSchoolMatched = matched.filter(c => { if (seenIds.has(c.id)) return false; seenIds.add(c.id); return true; }).map(c => c.id);

  const sampleMatched = matched.slice(0, 8).map(c => `<li>${escapeHTML(c.name)} <span style="color:var(--text-dim)">— ${escapeHTML(c.company || 'no company')}${c.school ? `, was: <em>${escapeHTML(c.school)}</em>` : ''}</span></li>`).join('');
  const sampleUnmatched = unmatched.slice(0, 8).map(n => `<li>${escapeHTML(n)}</li>`).join('');
  const ambNote = ambiguous.length ? `<div class="bulk-warn">⚠ ${ambiguous.length} name(s) matched multiple connections — they'll all be updated. Verify after.</div>` : '';

  preview.innerHTML = `
    <div class="bulk-summary">
      <div><strong>${names.length}</strong> names parsed from paste</div>
      <div><strong style="color:var(--green)">${bulkSchoolMatched.length}</strong> will be updated to <strong>${escapeHTML(schoolVal)}</strong></div>
      ${alreadySet.length ? `<div><strong style="color:var(--text-dim)">${alreadySet.length}</strong> already had this school</div>` : ''}
      <div><strong style="color:${unmatched.length ? 'var(--red)' : 'var(--text-dim)'}">${unmatched.length}</strong> not found in your connections</div>
    </div>
    ${ambNote}
    ${bulkSchoolMatched.length ? `<details open><summary>Will update (${bulkSchoolMatched.length}, showing up to 8)</summary><ul class="bulk-list">${sampleMatched}${matched.length > 8 ? `<li>… and ${matched.length - 8} more</li>` : ''}</ul></details>` : ''}
    ${unmatched.length ? `<details><summary>Not matched (${unmatched.length}, showing up to 8)</summary><ul class="bulk-list">${sampleUnmatched}${unmatched.length > 8 ? `<li>… and ${unmatched.length - 8} more</li>` : ''}</ul><div class="bulk-hint">These are people you haven't added to the tracker yet — they're skipped, not deleted.</div></details>` : ''}
  `;
  document.getElementById('bulk-school-apply').disabled = bulkSchoolMatched.length === 0;
}

async function applyBulkSchool() {
  const schoolVal = document.getElementById('bulk-school-value').value.trim();
  if (!schoolVal || bulkSchoolMatched.length === 0) return;
  const btn = document.getElementById('bulk-school-apply');
  btn.disabled = true; btn.textContent = 'Applying...';
  setSyncState('syncing');
  try {
    // Chunk updates by 200 ids to keep request size reasonable
    for (let i = 0; i < bulkSchoolMatched.length; i += 200) {
      const chunk = bulkSchoolMatched.slice(i, i + 200);
      const { error } = await supabase.from('connections').update({ school: schoolVal }).in('id', chunk);
      if (error) throw error;
    }
    // Update local state
    const set = new Set(bulkSchoolMatched);
    state.conns.forEach(c => { if (set.has(c.id)) c.school = schoolVal; });
    setSyncState('online');
    closeModal('modal-bulk-school');
    toast(`Updated school on ${bulkSchoolMatched.length} connections.`, 'success');
    renderConnections();
    renderDashboard();
  } catch (e) {
    setSyncState('error');
    btn.disabled = false; btn.textContent = 'Apply to matched';
    toast('Bulk update failed: ' + e.message, 'error');
  }
}

function openConnectionModal(id) {
  document.getElementById('conn-delete-btn').style.display = id ? 'inline-block' : 'none';
  document.getElementById('modal-conn-title').textContent = id ? 'Edit Connection' : 'Add Connection';
  if (id) {
    const c = state.conns.find(x => x.id === id);
    if (!c) return;
    document.getElementById('conn-name').value = c.name || '';
    document.getElementById('conn-company').value = c.company || '';
    document.getElementById('conn-role').value = c.role || '';
    document.getElementById('conn-school').value = c.school || '';
    document.getElementById('conn-url').value = c.linkedin_url || '';
    document.getElementById('conn-tier').value = c.tier || 'D';
    document.getElementById('conn-status').value = c.status || 'identified';
    document.getElementById('conn-notes').value = c.notes || '';
    document.getElementById('modal-conn').dataset.editId = id;
  } else {
    ['conn-name','conn-company','conn-role','conn-school','conn-url','conn-notes'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('conn-tier').value = 'C';
    document.getElementById('conn-status').value = 'identified';
    delete document.getElementById('modal-conn').dataset.editId;
  }
  document.getElementById('modal-conn').classList.add('active');
}

async function saveConn() {
  const id = document.getElementById('modal-conn').dataset.editId;
  const data = {
    name: document.getElementById('conn-name').value.trim(),
    company: document.getElementById('conn-company').value.trim(),
    role: document.getElementById('conn-role').value.trim(),
    school: document.getElementById('conn-school').value.trim(),
    linkedin_url: document.getElementById('conn-url').value.trim(),
    tier: document.getElementById('conn-tier').value,
    status: document.getElementById('conn-status').value,
    notes: document.getElementById('conn-notes').value.trim()
  };
  if (!data.name) { alert('Name required.'); return; }
  setSyncState('syncing');
  try {
    if (id) {
      const { error } = await supabase.from('connections').update(data).eq('id', id);
      if (error) throw error;
      const c = state.conns.find(x => x.id === id);
      Object.assign(c, data);
    } else {
      data.owner_token = userToken;
      const { data: inserted, error } = await supabase.from('connections').insert(data).select().single();
      if (error) throw error;
      state.conns.push(inserted);
    }
    setSyncState('online');
    closeModal('modal-conn');
    toast(id ? 'Connection updated.' : 'Connection saved.', 'success');
    renderConnections();
    renderDashboard();
  } catch (e) {
    setSyncState('error');
    toast('Save failed: ' + e.message, 'error');
  }
}

async function deleteConn() {
  const id = document.getElementById('modal-conn').dataset.editId;
  if (!confirm('Delete this connection?')) return;
  setSyncState('syncing');
  try {
    const { error } = await supabase.from('connections').delete().eq('id', id);
    if (error) throw error;
    state.conns = state.conns.filter(c => c.id !== id);
    setSyncState('online');
    closeModal('modal-conn');
    toast('Deleted.', 'success');
    renderConnections();
    renderDashboard();
  } catch (e) {
    setSyncState('error');
    toast('Delete failed: ' + e.message, 'error');
  }
}

// ============ CSV UPLOAD ============
function handleCSVUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const text = ev.target.result;
    const rows = parseCSV(text);
    if (rows.length === 0) { alert('No rows found in CSV.'); return; }
    const targets = (state.settings.targets || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    const cfdRoles = /cfd|aerodynamic|fluid|aerospace|simulation|propulsion|thermal|combustion|turbomachinery/i;
    const adjacentIndustries = /tesla|ford|hyundai|lucid|rivian|roush|mercedes|ansys|dassault|altair|siemens|airbus|rolls|heart|vertical|zeroavia|nasa|nrel|argonne|ornl|carrier|trane|daikin|ge vernova|vestas|gamesa|convergent|flexcompute/i;

    const existingUrls = new Set(state.conns.map(c => c.linkedin_url).filter(Boolean));
    const toInsert = [];
    let skipped = 0;
    for (const row of rows) {
      const name = `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim();
      const company = (row['Company'] || '').trim();
      const role = (row['Position'] || '').trim();
      const url = (row['URL'] || '').trim();
      if (!name) { skipped++; continue; }
      if (url && existingUrls.has(url)) { skipped++; continue; }
      let tier = 'D';
      const compLow = company.toLowerCase();
      if (targets.length && targets.some(t => compLow.includes(t))) tier = 'A';
      else if (adjacentIndustries.test(company) && cfdRoles.test(role)) tier = 'A';
      else if (adjacentIndustries.test(company)) tier = 'B';
      else if (cfdRoles.test(role)) tier = 'B';
      else if (/recruiter|talent|hr|university|professor/i.test(role)) tier = 'C';
      toInsert.push({
        owner_token: userToken,
        name, company, role, linkedin_url: url,
        tier, status: 'identified', notes: ''
      });
    }
    if (toInsert.length === 0) {
      toast(`Nothing to import (${skipped} skipped).`);
      return;
    }
    setSyncState('syncing');
    try {
      // Batch insert in chunks of 100
      const chunks = [];
      for (let i = 0; i < toInsert.length; i += 100) chunks.push(toInsert.slice(i, i + 100));
      for (const chunk of chunks) {
        const { error } = await supabase.from('connections').insert(chunk);
        if (error) throw error;
      }
      await loadAll();
      setSyncState('online');
      toast(`Imported ${toInsert.length}, skipped ${skipped} duplicates/blanks.`, 'success');
      renderConnections();
      renderDashboard();
    } catch (err) {
      setSyncState('error');
      toast('Import failed: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    if (lines[i].toLowerCase().includes('first name') && lines[i].toLowerCase().includes('last name')) {
      headerIdx = i; break;
    }
  }
  const headers = splitCSVLine(lines[headerIdx]);
  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = splitCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { result.push(cur); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}

// ============ PERSONALIZED OUTREACH ENGINE ============
// Every generated message is built from real context: shared school
// (alum), target-company match, role type (recruiter / IC / senior /
// manager), and the user's own focus + pitch. No more "fellow Wolverine"
// on every message regardless of who's reading.

const SCHOOL_NICKNAMES = [
  ['michigan', 'Michigan'], ['umich', 'Michigan'],
  ['mit', 'MIT'], ['massachusetts institute', 'MIT'],
  ['stanford', 'Stanford'],
  ['berkeley', 'Berkeley'], ['uc berkeley', 'Berkeley'],
  ['carnegie mellon', 'CMU'], ['cmu', 'CMU'],
  ['harvard', 'Harvard'], ['yale', 'Yale'], ['princeton', 'Princeton'],
  ['columbia', 'Columbia'], ['cornell', 'Cornell'], ['dartmouth', 'Dartmouth'],
  ['brown university', 'Brown'], ['penn', 'Penn'], ['upenn', 'Penn'],
  ['georgia tech', 'Georgia Tech'], ['gatech', 'Georgia Tech'],
  ['ut austin', 'UT'], ['texas at austin', 'UT'],
  ['ucla', 'UCLA'], ['usc', 'USC'], ['nyu', 'NYU'],
  ['caltech', 'Caltech'], ['purdue', 'Purdue'],
  ['illinois', 'Illinois'], ['urbana', 'Illinois'], ['uiuc', 'Illinois'],
  ['wisconsin', 'Wisconsin'], ['ohio state', 'Ohio State'],
  ['penn state', 'Penn State'], ['duke', 'Duke'], ['rice', 'Rice'],
  ['waterloo', 'Waterloo'], ['toronto', 'Toronto'],
  ['oxford', 'Oxford'], ['cambridge', 'Cambridge'], ['imperial', 'Imperial'],
  ['eth zurich', 'ETH'], ['eth ', 'ETH'],
  ['iit ', 'IIT'], ['indian institute of technology', 'IIT'],
  ['nit ', 'NIT'], ['bits pilani', 'BITS']
];

function deriveSchoolShort(full) {
  if (!full) return '';
  const s = full.toLowerCase();
  for (const [needle, label] of SCHOOL_NICKNAMES) {
    if (s.includes(needle)) return label;
  }
  // Fallback: first capitalized standalone word that's not "University"/"Institute"/etc.
  const skip = /^(university|institute|college|school|of|the)$/i;
  const words = full.split(/[\s,]+/).filter(w => /^[A-Z][a-z]+/.test(w) && !skip.test(w));
  return words[0] || '';
}

function isAlumOf(connSchool, userSchool) {
  if (!connSchool || !userSchool) return false;
  const cs = deriveSchoolShort(connSchool);
  const us = deriveSchoolShort(userSchool);
  if (cs && us && cs.toLowerCase() === us.toLowerCase()) return true;
  // Substring fallback for unrecognized schools
  const a = connSchool.toLowerCase();
  const b = userSchool.toLowerCase();
  return (b.length >= 6 && a.includes(b.slice(0, 12))) ||
         (a.length >= 6 && b.includes(a.slice(0, 12)));
}

function connectionContext(conn, user) {
  const fullName = (conn.name || '').trim();
  const firstName = fullName.split(/\s+/)[0] || 'there';
  const role = (conn.role || '').toLowerCase();
  const userSchoolShort = (user.school_short || deriveSchoolShort(user.school) || '').trim();
  const alum = isAlumOf(conn.school, user.school);
  const targets = (user.targets || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  const compLower = (conn.company || '').toLowerCase();
  const isTarget = compLower && targets.some(t => t && (compLower.includes(t) || t.includes(compLower)));
  const isRecruiter = /\b(recruiter|talent|sourcer|hr|people ops|talent acq)\b/.test(role);
  const isSenior = /\b(senior|staff|principal|architect|distinguished|fellow|sr\.)\b/.test(role);
  const isManager = /\b(manager|director|head|vp|chief|cto|cpo|coo|lead)\b/.test(role);
  return {
    firstName, fullName,
    company: conn.company || '',
    role: conn.role || '',
    school: conn.school || '',
    tier: conn.tier || 'D',
    alum, isTarget, isRecruiter, isSenior, isManager,
    userName: user.name || '',
    userSchool: user.school || '',
    userSchoolShort,
    userFocus: user.focus || '',
    userPitch: (user.pitch || '').trim()
  };
}

function opener(ctx) {
  if (ctx.alum && ctx.userSchoolShort) return `Hi ${ctx.firstName} — fellow ${ctx.userSchoolShort} alum here.`;
  if (ctx.isTarget && ctx.company) return `Hi ${ctx.firstName} — long-time admirer of ${ctx.company}'s work.`;
  if (ctx.isRecruiter) return `Hi ${ctx.firstName} — hope the week's treating you well.`;
  if (ctx.isSenior && ctx.company) return `Hi ${ctx.firstName} — your path at ${ctx.company} stood out to me.`;
  return `Hi ${ctx.firstName} —`;
}

function identity(ctx) {
  if (ctx.userPitch) return ctx.userPitch;
  const name = ctx.userName ? `${ctx.userName}, ` : '';
  const program = ctx.userSchool ? `finishing my ${ctx.userSchool}` : 'a grad student';
  const focus = ctx.userFocus ? ` focused on ${ctx.userFocus}` : '';
  return `I'm ${name}${program}${focus}.`;
}

function closingHook(ctx) {
  if (ctx.isRecruiter) return `I'm targeting roles${ctx.userFocus ? ' in ' + ctx.userFocus : ''} — would love to connect for when something aligned opens up.`;
  if (ctx.alum) return `Would love to connect and hear how you ended up at ${ctx.company || 'your team'}.`;
  if (ctx.isTarget) return `Would love to connect and follow your work.`;
  if (ctx.isSenior) return `Would love to connect — even just to learn from your trajectory.`;
  return `Would love to connect and follow your work${ctx.company ? ' at ' + ctx.company : ''}.`;
}

function generateMessage(intent, conn, user) {
  const ctx = connectionContext(conn, user);
  const op = opener(ctx);
  const me = identity(ctx);
  const co = ctx.company || '[company]';

  switch (intent) {
    case 'connect':
      return `${op} ${me} ${closingHook(ctx)}`;

    case 'coffee_chat': {
      const alumNote = ctx.alum && ctx.userSchoolShort ? ` Always good to chat with a fellow ${ctx.userSchoolShort}.` : '';
      const hireWord = ctx.isRecruiter ? 'candidate' : ctx.isManager ? 'hire on your team' : 'hire';
      return `Thanks for connecting, ${ctx.firstName}. ${me} I'm exploring full-time roles right now and I'm not asking you to refer me — I'd just value 15 minutes to hear how you ended up at ${co} and what you'd look for in a new ${hireWord} today.${alumNote} Free any time next week?`;
    }

    case 'thank_you_chat':
      return `Thanks again for the time today, ${ctx.firstName}. Two things stuck with me: [SPECIFIC THING 1] and [SPECIFIC THING 2]. Going to dig into [topic they suggested] this week. Will keep you posted on the search — and if I can ever return the favor, just say the word.`;

    case 'referral_ask': {
      const alumLine = ctx.alum && ctx.userSchoolShort ? ` (good to know there are ${ctx.userSchoolShort} folks on your team)` : '';
      return `${ctx.firstName} — based on our chat${alumLine}, I think the [role] on your team (req #XXXXX) lines up closely with my background${ctx.userFocus ? ' in ' + ctx.userFocus : ''}. Would you be open to passing my resume along internally? Happy to tailor anything if useful.`;
    }

    case 'recruiter_d7': {
      const opener2 = ctx.alum && ctx.userSchoolShort
        ? `Hi ${ctx.firstName} — fellow ${ctx.userSchoolShort} grad here, checking in on`
        : `Hi ${ctx.firstName} — checking in on`;
      return `${opener2} req #XXXXX for [role] at ${co}. [Referrer] on your team kindly passed my resume along last week. My background${ctx.userFocus ? ' in ' + ctx.userFocus : ''} maps closely to the JD's emphasis on [specific requirement]. Happy to share more or set up a call.`;
    }

    case 'hm_d14': {
      const intro = ctx.alum && ctx.userSchoolShort ? `fellow ${ctx.userSchoolShort} grad here — ` : '';
      return `Hi ${ctx.firstName} — ${intro}I applied to the [role] on your team (req #XXXXX) about two weeks ago and wanted to introduce myself directly. My work on [specific project] feels like a strong fit with what your team is building. Happy to send a 2-min Loom walkthrough if useful.`;
    }

    case 'nurture': {
      const reason = ctx.alum && ctx.userSchoolShort
        ? `we connected as fellow ${ctx.userSchoolShort} folks`
        : `our chat about ${co}`;
      return `Hi ${ctx.firstName} — quick update: [shipped X / read Y paper / went to Z conference]. Thought of you because of ${reason}. How are things at ${co}?`;
    }

    case 'post_interview':
      return `${ctx.firstName} — really appreciated the conversation today. The discussion on [specific technical topic] got me thinking; will follow up with [thought / paper / data]. Excited about the possibility of working on [their team's problem]. Let me know if you need anything else from me.`;

    default:
      return `${op} ${me}`;
  }
}

const INTENT_LIST = [
  { id: 'connect',         name: 'Connection request',      when: 'First touch on LinkedIn — adapts to alum / target / cold' },
  { id: 'coffee_chat',     name: 'Coffee chat ask',          when: 'Send 1-2 days after they accept your connection request' },
  { id: 'thank_you_chat',  name: 'Thank-you after coffee',   when: 'Within 24 hrs of the call' },
  { id: 'referral_ask',    name: 'Referral ask',             when: 'End of chat or as a follow-up' },
  { id: 'recruiter_d7',    name: 'Recruiter D+7 follow-up',  when: '7 days after applying with a referral' },
  { id: 'hm_d14',          name: 'Hiring manager D+14',      when: '14 days after applying, no response yet' },
  { id: 'nurture',         name: 'Nurture check-in',         when: 'Every 3 weeks to keep referrers warm' },
  { id: 'post_interview',  name: 'Post-interview thank-you', when: 'Within 24 hours of any interview' }
];

function intentForConnectionStatus(status) {
  if (status === 'identified' || status === 'request_sent') return 'connect';
  if (status === 'connected') return 'coffee_chat';
  if (status === 'chat_scheduled') return 'coffee_chat';
  if (status === 'chat_done') return 'thank_you_chat';
  if (status === 'referred' || status === 'nurture') return 'nurture';
  return 'coffee_chat';
}

function renderTemplates() {
  // Two preview "personas" so you can see how the same intent reads
  // for an alum at a target company vs. a cold senior contact.
  const alumPersona = {
    name: 'Jane Patel',
    company: (state.settings.targets || '').split(',')[0].trim() || 'Acme Aerospace',
    role: 'Senior Engineer',
    school: state.settings.school || 'University of Michigan'
  };
  const coldPersona = {
    name: 'John Smith',
    company: 'NewCo Robotics',
    role: 'Director of Engineering',
    school: 'Different University'
  };

  const setupNote = (!state.settings.school || !state.settings.school_short)
    ? `<div class="setup-note">💡 Tip: set your <strong>school</strong> and <strong>school short name</strong> in Settings — and add the <strong>school</strong> field to your connections — so alum detection works.</div>`
    : '';

  document.getElementById('templates-list').innerHTML = setupNote + INTENT_LIST.map(t => {
    const alumBody = generateMessage(t.id, alumPersona, state.settings);
    const coldBody = generateMessage(t.id, coldPersona, state.settings);
    return `
      <div class="template-card">
        <h4>${escapeHTML(t.name)}</h4>
        <div class="meta">${escapeHTML(t.when)}</div>
        <div class="template-variant">
          <div class="template-variant-label">If alum + target company →</div>
          <div class="body">${escapeHTML(alumBody)}</div>
          <button class="primary" onclick="copyText(this.previousElementSibling.textContent)">⎘ Copy alum version</button>
        </div>
        <div class="template-variant">
          <div class="template-variant-label">If cold (no shared school, non-target) →</div>
          <div class="body">${escapeHTML(coldBody)}</div>
          <button onclick="copyText(this.previousElementSibling.textContent)">⎘ Copy cold version</button>
        </div>
      </div>
    `;
  }).join('');
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast('Copied — review brackets, then send.', 'success'));
}

function openMessageFor(type, id) {
  let body, targetLabel, intent;
  if (type === 'conn') {
    const c = state.conns.find(x => x.id === id);
    if (!c) return;
    intent = intentForConnectionStatus(c.status);
    body = generateMessage(intent, c, state.settings);
    const ctx = connectionContext(c, state.settings);
    const tags = [];
    if (ctx.alum) tags.push(`✓ ${ctx.userSchoolShort || 'school'} alum`);
    if (ctx.isTarget) tags.push('✓ target company');
    if (ctx.isRecruiter) tags.push('recruiter tone');
    else if (ctx.isSenior) tags.push('senior contact');
    targetLabel = `${c.name} • ${c.company || ''} • ${c.role || ''}` + (tags.length ? `  —  ${tags.join(' · ')}` : '');
  } else {
    const a = state.apps.find(x => x.id === id);
    if (!a) return;
    intent = a.referrer ? 'recruiter_d7' : 'hm_d14';
    // Try to look up the referrer connection (so alum detection works)
    let pseudoConn;
    if (a.referrer) {
      const match = state.conns.find(c => (c.name || '').toLowerCase() === a.referrer.toLowerCase());
      pseudoConn = match || { name: a.referrer, company: a.company, role: 'Recruiter' };
    } else {
      pseudoConn = { name: '[Hiring Manager]', company: a.company, role: 'Hiring Manager' };
    }
    body = generateMessage(intent, pseudoConn, state.settings);
    targetLabel = `${a.company} • ${a.role}`;
  }
  currentMessageContext = { type, id, intent };
  document.getElementById('msg-target').textContent = targetLabel;
  document.getElementById('msg-body').value = body;
  document.getElementById('modal-message').classList.add('active');
}

function copyMessage() {
  navigator.clipboard.writeText(document.getElementById('msg-body').value).then(() => toast('Copied. Paste, personalize, send.', 'success'));
}

async function markMessageSent() {
  if (!currentMessageContext) return;
  const { type, id } = currentMessageContext;
  setSyncState('syncing');
  try {
    if (type === 'conn') {
      const c = state.conns.find(x => x.id === id);
      if (c) {
        const flow = ['identified', 'request_sent', 'connected', 'chat_scheduled', 'chat_done', 'referred', 'nurture'];
        const idx = flow.indexOf(c.status || 'identified');
        const newStatus = (idx >= 0 && idx < flow.length - 1) ? flow[idx + 1] : c.status;
        const { error } = await supabase.from('connections').update({ last_contact: today(), status: newStatus }).eq('id', id);
        if (error) throw error;
        c.last_contact = today();
        c.status = newStatus;
      }
    } else {
      const a = state.apps.find(x => x.id === id);
      if (a) {
        const newTimeline = [...timelineEvents(a), { date: today(), type: 'outreach', label: 'Outreach message sent' }];
        const { error } = await supabase.from('applications').update({ last_action_date: today(), timeline: newTimeline }).eq('id', id);
        if (error) throw error;
        a.last_action_date = today();
        a.timeline = newTimeline;
      }
    }
    setSyncState('online');
    closeModal('modal-message');
    toast('Marked as sent. Next action updated.', 'success');
    renderDashboard();
    renderConnections();
    renderApps();
  } catch (e) {
    setSyncState('error');
    toast('Update failed: ' + e.message, 'error');
  }
}

function closeModal(id) { document.getElementById(id).classList.remove('active'); }
document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('active'); }));

// ============ SETTINGS ============
function loadSettingsForm() {
  document.getElementById('set-name').value = state.settings.name || '';
  document.getElementById('set-school').value = state.settings.school || '';
  const ssEl = document.getElementById('set-school-short');
  if (ssEl) ssEl.value = state.settings.school_short || '';
  document.getElementById('set-focus').value = state.settings.focus || '';
  document.getElementById('set-pitch').value = state.settings.pitch || '';
  document.getElementById('set-targets').value = state.settings.targets || '';
  const appsGoal = document.getElementById('set-apps-goal');
  const msgGoal = document.getElementById('set-msg-goal');
  if (appsGoal) appsGoal.value = state.settings.daily_apps_goal ?? 25;
  if (msgGoal) msgGoal.value = state.settings.daily_messages_goal ?? 10;
  const resumeEl = document.getElementById('set-resume-text');
  const queriesEl = document.getElementById('set-jsearch-queries');
  const slugsEl = document.getElementById('set-ats-slugs');
  if (resumeEl) resumeEl.value = state.settings.resume_text || '';
  if (queriesEl) queriesEl.value = state.settings.jsearch_queries || '';
  if (slugsEl) slugsEl.value = state.settings.ats_slugs || '';
}

let settingsSaveTimer = null;
async function saveSettings() {
  clearTimeout(settingsSaveTimer);
  settingsSaveTimer = setTimeout(async () => {
    const appsGoalEl = document.getElementById('set-apps-goal');
    const msgGoalEl = document.getElementById('set-msg-goal');
    const ssEl = document.getElementById('set-school-short');
    const resumeEl = document.getElementById('set-resume-text');
    const queriesEl = document.getElementById('set-jsearch-queries');
    const slugsEl = document.getElementById('set-ats-slugs');
    const schoolFull = document.getElementById('set-school').value;
    const data = {
      owner_token: userToken,
      name: document.getElementById('set-name').value,
      school: schoolFull,
      school_short: (ssEl ? ssEl.value.trim() : '') || deriveSchoolShort(schoolFull),
      focus: document.getElementById('set-focus').value,
      pitch: document.getElementById('set-pitch').value,
      targets: document.getElementById('set-targets').value,
      daily_apps_goal: appsGoalEl ? (parseInt(appsGoalEl.value, 10) || 0) : (state.settings.daily_apps_goal ?? 25),
      daily_messages_goal: msgGoalEl ? (parseInt(msgGoalEl.value, 10) || 0) : (state.settings.daily_messages_goal ?? 10),
      resume_text: resumeEl ? resumeEl.value : (state.settings.resume_text || ''),
      jsearch_queries: queriesEl ? queriesEl.value : (state.settings.jsearch_queries || ''),
      ats_slugs: slugsEl ? slugsEl.value : (state.settings.ats_slugs || ''),
      resume_profile: state.settings.resume_profile || null,
      resume_library: state.settings.resume_library || null,
      resume_draft: state.settings.resume_draft || null,
      resume_versions: state.settings.resume_versions || []
    };
    setSyncState('syncing');
    try {
      const { error } = await supabase.from('settings').upsert(data, { onConflict: 'owner_token' });
      if (error) throw error;
      state.settings = { ...state.settings, ...data };
      setSyncState('online');
      toast('Saved.', 'success');
      renderDailyAccountability();
      window.JobResumeBuilder?.render();
    } catch (e) {
      setSyncState('error');
      toast('Settings save failed: ' + e.message, 'error');
    }
  }, 400);
}

// ============ DATA EXPORT / IMPORT ============
function exportData() {
  const blob = new Blob([JSON.stringify({
    apps: state.apps,
    conns: state.conns,
    settings: state.settings,
    exported_at: new Date().toISOString()
  }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `job-command-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup downloaded.', 'success');
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = async (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!confirm(`Import ${data.apps?.length || 0} applications and ${data.conns?.length || 0} connections? This ADDS to existing data; does not replace.`)) return;
      setSyncState('syncing');
      const appsToAdd = (data.apps || []).map(a => ({ ...a, id: undefined, owner_token: userToken, created_at: undefined, updated_at: undefined }));
      const connsToAdd = (data.conns || []).map(c => ({ ...c, id: undefined, owner_token: userToken, created_at: undefined, updated_at: undefined }));
      if (appsToAdd.length) {
        const { error } = await supabase.from('applications').insert(appsToAdd);
        if (error) throw error;
      }
      if (connsToAdd.length) {
        for (let i = 0; i < connsToAdd.length; i += 100) {
          const chunk = connsToAdd.slice(i, i + 100);
          const { error } = await supabase.from('connections').insert(chunk);
          if (error) throw error;
        }
      }
      if (data.settings) {
        const settingsToImport = {
          ...data.settings,
          owner_token: userToken,
          updated_at: undefined
        };
        const { error } = await supabase.from('settings').upsert(settingsToImport, { onConflict: 'owner_token' });
        if (error) throw error;
      }
      await loadAll();
      setSyncState('online');
      toast('Import complete.', 'success');
      renderDashboard();
      renderApps();
      renderConnections();
    } catch (err) {
      setSyncState('error');
      alert('Import failed: ' + err.message);
    }
  };
  r.readAsText(file);
  e.target.value = '';
}

// ============ ONLINE / OFFLINE DETECTION ============
window.addEventListener('online', () => {
  document.getElementById('connection-error').style.display = 'none';
  checkConnection();
});
window.addEventListener('offline', () => {
  setSyncState('error');
});
