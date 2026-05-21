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
  settings: { name: '', school: '', focus: '', pitch: '', targets: '', daily_apps_goal: 25, daily_messages_goal: 10 }
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
async function loadAll() {
  setSyncState('syncing');
  try {
    const [apps, conns, settingsRow] = await Promise.all([
      supabase.from('applications').select('*').order('created_at', { ascending: false }),
      supabase.from('connections').select('*').order('name', { ascending: true }),
      supabase.from('settings').select('*').eq('owner_token', userToken).maybeSingle()
    ]);
    if (apps.error) throw apps.error;
    if (conns.error) throw conns.error;
    if (settingsRow.error && settingsRow.error.code !== 'PGRST116') throw settingsRow.error;
    state.apps = apps.data || [];
    state.conns = conns.data || [];
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
  return state.conns.filter(c => {
    const cc = (c.company || '').toLowerCase();
    if (!cc) return false;
    return cc.includes(cl) || cl.includes(cc);
  }).sort((a, b) => (a.tier || 'Z').localeCompare(b.tier || 'Z')).slice(0, 5);
}

function updateContactSuggestion() {
  const company = document.getElementById('app-company').value;
  const banner = document.getElementById('app-suggest');
  const suggestions = suggestionsForCompany(company);
  if (suggestions.length === 0) { banner.style.display = 'none'; return; }
  banner.style.display = '';
  banner.innerHTML = `
    <div class="suggest-head">💡 You know ${suggestions.length} ${suggestions.length === 1 ? 'person' : 'people'} at ${escapeHTML(company)}:</div>
    <div class="suggest-list">
      ${suggestions.map(c => `
        <div class="suggest-row">
          <div>
            <span class="pill tier-${c.tier || 'D'}">Tier ${c.tier || 'D'}</span>
            <strong>${escapeHTML(c.name)}</strong>
            <span class="suggest-role">${escapeHTML(c.role || '')}</span>
          </div>
          <div class="suggest-actions">
            ${c.linkedin_url ? `<a class="link-btn" href="${escapeHTML(c.linkedin_url)}" target="_blank" rel="noopener">↗ in</a>` : ''}
            <button class="primary" onclick="openMessageFor('conn','${c.id}')">✎ Draft message</button>
          </div>
        </div>
      `).join('')}
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
  const filtered = state.conns.filter(c => {
    const matchS = !search || ((c.name || '') + ' ' + (c.company || '') + ' ' + (c.role || '')).toLowerCase().includes(search);
    const matchT = !tier || c.tier === tier;
    const matchSt = !status || c.status === status;
    return matchS && matchT && matchSt;
  }).sort((a, b) => (a.tier || 'Z').localeCompare(b.tier || 'Z'));

  if (filtered.length === 0) {
    document.getElementById('conn-table').innerHTML = `<div class="empty"><div class="big">◉</div><h4>No connections yet</h4><div>Upload your LinkedIn CSV or add contacts manually.</div></div>`;
    return;
  }
  const rows = filtered.map(c => {
    const n = computeNextAction(c, 'conn');
    const overdue = n.date && n.date < today();
    const linkBtn = c.linkedin_url ? `<a class="link-btn" href="${escapeHTML(c.linkedin_url)}" target="_blank" rel="noopener" title="Open LinkedIn">↗ in</a>` : '';
    return `<tr>
      <td><div class="row-name">${escapeHTML(c.name || '—')}</div></td>
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
          <div class="list-card-title">${escapeHTML(c.name || '—')}</div>
          <div class="list-card-sub">${escapeHTML(c.company || '')}${c.role ? ' — ' + escapeHTML(c.role) : ''}</div>
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

  document.getElementById('conn-table').innerHTML = `
    <div class="table-scroll desktop-only"><table>
      <thead><tr><th>Name</th><th>Company / Role</th><th>Tier</th><th>Status</th><th>Next action</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="list-cards mobile-only">${cards}</div>`;
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
    document.getElementById('conn-url').value = c.linkedin_url || '';
    document.getElementById('conn-tier').value = c.tier || 'D';
    document.getElementById('conn-status').value = c.status || 'identified';
    document.getElementById('conn-notes').value = c.notes || '';
    document.getElementById('modal-conn').dataset.editId = id;
  } else {
    ['conn-name','conn-company','conn-role','conn-url','conn-notes'].forEach(i => document.getElementById(i).value = '');
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

// ============ MESSAGE TEMPLATES ============
const TEMPLATES = [
  {
    id: 'connect_alum',
    name: 'Connection request — UMich alum',
    when: 'First touch to a fellow Michigan alum at a target company',
    body: (ctx) => `Hi ${ctx.firstName} — fellow Wolverine here, finishing my ${ctx.school} with a focus on ${ctx.focus}. Saw your work at ${ctx.company} and would love to connect and learn from your path.`
  },
  {
    id: 'connect_cold',
    name: 'Connection request — cold',
    when: 'First touch when you have no shared connection',
    body: (ctx) => `Hi ${ctx.firstName} — I'm a ${ctx.school} grad student focused on ${ctx.focus} and a big admirer of the ${ctx.company} ${ctx.team || 'team'}. Would love to connect and follow your work.`
  },
  {
    id: 'coffee_chat',
    name: 'Coffee chat ask (after they accept)',
    when: 'Send 1-2 days after a connection request is accepted',
    body: (ctx) => `Thanks for connecting, ${ctx.firstName}. I'm finishing my ${ctx.school} focused on ${ctx.focus} and exploring full-time roles. I'm not asking you to refer me — I'd just genuinely value 15 minutes to hear how you ended up at ${ctx.company} and what you'd look for in a new ${ctx.targetRole || 'CFD'} hire today. Free any time next week?`
  },
  {
    id: 'thank_you_chat',
    name: 'Thank-you after coffee chat',
    when: 'Send within 24 hours of the call',
    body: (ctx) => `Thanks again for the time today, ${ctx.firstName}. Two things really stuck with me: [SPECIFIC THING 1] and [SPECIFIC THING 2 — fill in]. Going to look more into ${ctx.followUpTopic || '[topic they suggested]'} this week. Will keep you posted on how the search goes — and if I can ever be useful in return, just say the word.`
  },
  {
    id: 'referral_ask',
    name: 'Referral ask (end of chat or via email)',
    when: 'At end of coffee chat OR follow-up if you forgot in the call',
    body: (ctx) => `${ctx.firstName} — based on what we discussed, I think the ${ctx.targetRole || '[role]'} on your team (req ${ctx.reqId || '#XXXXX'}) lines up well with my background in ${ctx.focus}. Would you be open to passing my resume along internally? Attaching it here — happy to tailor anything if useful.`
  },
  {
    id: 'recruiter_d7',
    name: 'Recruiter D+7 follow-up (with referral)',
    when: '7 days after applying with a referral',
    body: (ctx) => `Hi ${ctx.firstName} — checking in on req ${ctx.reqId || '#XXXXX'} for ${ctx.role} at ${ctx.company}. ${ctx.referrer || '[Referrer name]'} on your team kindly passed my resume along last week. My background in ${ctx.focus} maps closely to the JD's emphasis on [specific requirement]. Happy to share more or set up a call.`
  },
  {
    id: 'hm_d14',
    name: 'Hiring manager D+14 nudge',
    when: '14 days after applying, no recruiter response',
    body: (ctx) => `Hi ${ctx.firstName} — I applied to the ${ctx.role} role on your team (req ${ctx.reqId || '#XXXXX'}) about two weeks ago and wanted to introduce myself directly. My work on ${ctx.projectHook || '[specific project]'} feels like a strong fit with what your team is building. Happy to send a 2-min Loom walkthrough if useful.`
  },
  {
    id: 'nurture_3wk',
    name: 'Nurture check-in (3 weeks post-chat)',
    when: 'Every 3 weeks to keep referrers warm',
    body: (ctx) => `Hi ${ctx.firstName} — quick update: ${ctx.update || '[shipped X / read Y paper / went to Z conference]'}. Thought of you because of ${ctx.connectReason || '[their work / our chat about Z]'}. How are things at ${ctx.company}?`
  },
  {
    id: 'thank_you_interview',
    name: 'Post-interview thank-you',
    when: 'Within 24 hours of any interview',
    body: (ctx) => `${ctx.firstName} — really appreciated the conversation today. The discussion on ${ctx.topic || '[specific technical topic]'} got me thinking; will follow up offline with [thought / paper / data]. Excited about the possibility of working on ${ctx.teamProblem || "[their team's problem]"}. Let me know if you need anything else from my end.`
  }
];

function defaultCtx() {
  return {
    firstName: '[NAME]', school: state.settings.school || '[your school]', focus: state.settings.focus || '[your focus]',
    company: '[COMPANY]', team: '[team]', targetRole: '[role]', reqId: '#XXXXX', role: '[ROLE]',
    referrer: '[Referrer]', projectHook: '[project]', update: '[update]', connectReason: '[reason]',
    topic: '[topic]', teamProblem: '[problem]', followUpTopic: '[topic]'
  };
}

function renderTemplates() {
  const ctx = defaultCtx();
  document.getElementById('templates-list').innerHTML = TEMPLATES.map(t => `
    <div class="template-card">
      <h4>${t.name}</h4>
      <div class="meta">${t.when}</div>
      <div class="body">${escapeHTML(t.body(ctx))}</div>
      <div class="actions">
        <button class="primary" onclick="copyTemplate('${t.id}')">⎘ Copy</button>
      </div>
    </div>
  `).join('');
}

function copyTemplate(id) {
  const t = TEMPLATES.find(x => x.id === id);
  navigator.clipboard.writeText(t.body(defaultCtx())).then(() => toast('Copied — paste & personalize.', 'success'));
}

function openMessageFor(type, id) {
  let template, ctx;
  if (type === 'conn') {
    const c = state.conns.find(x => x.id === id);
    if (!c) return;
    const firstName = (c.name || '').split(' ')[0];
    ctx = {
      ...defaultCtx(),
      firstName,
      company: c.company || 'your company',
      team: c.role ? c.role.split(' ')[0] + ' team' : 'team',
      targetRole: 'CFD Engineer'
    };
    if (c.status === 'identified') template = TEMPLATES.find(t => t.id === 'connect_alum') || TEMPLATES[0];
    else if (c.status === 'connected') template = TEMPLATES.find(t => t.id === 'coffee_chat');
    else if (c.status === 'chat_done') template = TEMPLATES.find(t => t.id === 'thank_you_chat');
    else if (c.status === 'referred' || c.status === 'nurture') template = TEMPLATES.find(t => t.id === 'nurture_3wk');
    else template = TEMPLATES.find(t => t.id === 'coffee_chat');
    document.getElementById('msg-target').textContent = `${c.name} • ${c.company || ''} • ${c.role || ''}`;
  } else {
    const a = state.apps.find(x => x.id === id);
    if (!a) return;
    ctx = {
      ...defaultCtx(),
      firstName: '[Recruiter / HM]',
      company: a.company, role: a.role,
      referrer: a.referrer || '[Referrer]'
    };
    template = a.referrer ? TEMPLATES.find(t => t.id === 'recruiter_d7') : TEMPLATES.find(t => t.id === 'hm_d14');
    document.getElementById('msg-target').textContent = `${a.company} • ${a.role}`;
  }
  currentMessageContext = { type, id };
  document.getElementById('msg-body').value = template.body(ctx);
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
  document.getElementById('set-focus').value = state.settings.focus || '';
  document.getElementById('set-pitch').value = state.settings.pitch || '';
  document.getElementById('set-targets').value = state.settings.targets || '';
  const appsGoal = document.getElementById('set-apps-goal');
  const msgGoal = document.getElementById('set-msg-goal');
  if (appsGoal) appsGoal.value = state.settings.daily_apps_goal ?? 25;
  if (msgGoal) msgGoal.value = state.settings.daily_messages_goal ?? 10;
}

let settingsSaveTimer = null;
async function saveSettings() {
  clearTimeout(settingsSaveTimer);
  settingsSaveTimer = setTimeout(async () => {
    const appsGoalEl = document.getElementById('set-apps-goal');
    const msgGoalEl = document.getElementById('set-msg-goal');
    const data = {
      owner_token: userToken,
      name: document.getElementById('set-name').value,
      school: document.getElementById('set-school').value,
      focus: document.getElementById('set-focus').value,
      pitch: document.getElementById('set-pitch').value,
      targets: document.getElementById('set-targets').value,
      daily_apps_goal: appsGoalEl ? (parseInt(appsGoalEl.value, 10) || 0) : (state.settings.daily_apps_goal ?? 25),
      daily_messages_goal: msgGoalEl ? (parseInt(msgGoalEl.value, 10) || 0) : (state.settings.daily_messages_goal ?? 10)
    };
    setSyncState('syncing');
    try {
      const { error } = await supabase.from('settings').upsert(data, { onConflict: 'owner_token' });
      if (error) throw error;
      state.settings = data;
      setSyncState('online');
      toast('Saved.', 'success');
      renderDailyAccountability();
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
