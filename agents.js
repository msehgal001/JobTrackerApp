// ============================================================
// AI AGENTS MODULE — drop-in tab for JobTrackerApp
// ============================================================
// Adds a Claude-powered "AI Agents" view: Role Scout (live web
// search), Gap Analyzer, Outreach Composer, Daily Brief.
// Writes results into your existing Supabase `applications`
// and `connections` tables. Zero changes to your other files
// beyond the 3-line patch in SETUP.md.
//
// API key: your own Anthropic key, stored in localStorage
// (same pattern as your owner token). NEVER commit it.
// Get one at https://console.anthropic.com — pay-per-call,
// a full day of agent runs on Sonnet costs cents.
// ============================================================

(function () {
  'use strict';

  const KEY_STORAGE = 'jt_anthropic_key';
  const MODEL = 'claude-sonnet-4-6';

  // ---- fallbacks if host app helpers are absent ----
  const esc = typeof escapeHTML === 'function' ? escapeHTML :
    s => (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const notify = typeof toast === 'function' ? toast : msg => alert(msg);

  const PROFILE = `
CANDIDATE PROFILE - Madhav Sehgal
- M.S. Aerospace Engineering (Space Systems), University of Michigan, graduated May 2026. Available immediately.
- INCOSE ASEP (Feb 2026). GSI for AERO/SPACE 582 Spacecraft Systems Engineering.
- Visa: F-1 OPT with STEM extension eligibility. NON-ITAR employers only. E-Verify needed for STEM extension. OPT is existing work authorization, not sponsorship.
- Portfolio: www.msehgal.net | msehgal@umich.edu
TECHNICAL RECORD (real numbers only):
- CFD/experimental fluids, Gas Dynamics Imaging Lab: Bayesian Neural Network 99.6% accuracy; 500+ pressure taps; SBLI/shock-train research; Springer first-author papers; 15 publications total.
- Spacecraft systems/MBSE: SPRL TestBedz; led ICED-T 14-person constellation team to PDR; Northrop Grumman Lunar Positioning System in SysML/MagicDraw; founded MASS 3U CubeSat.
- Propulsion: three-stage launch vehicle, 74 m, 836,146 kg, dV 17.6 km/s, Python/MATLAB sizing tool.
- Internships: DRDO CABS (IL-78MKI refueling pod CFD/structural), ASL (launch vehicle modal analysis).
- Leadership: NASA rover challenge team lead 3 yrs (NASA Safety Award 2021, 1st Runner-Up STEM Engagement 2022); JarWiz founder/CEO 4 yrs, Microsoft-partnered, 3,000+ students, 60+ schools.
- Ventures: AgriSat (satellite-AI precision ag, YC S26 applicant, 2 alpha farms); SE-BRIDGE (AI requirements auditing, built with Prof. Steve Battel).
- Stack: Python (TensorFlow, PyTorch, Flask, NumPy, Pandas), MATLAB, C/C++, SQL, SysML/MagicDraw, ANSYS Fluent, ABAQUS, OpenFOAM, STAR-CCM+, STK, Thermal Desktop, SOLIDWORKS, CATIA V5.
- Tracks: aviation/airline analyst, entry-level consulting, commercial space (non-ITAR), AI/technical, simulation software.
HARD WRITING RULES: no em dashes ever; no hedge language; metrics front-loaded; XYZ/STAR bullets; strong unique action verbs.`;

  // ============ CLAUDE API ============
  function getKey() { return localStorage.getItem(KEY_STORAGE) || ''; }

  async function callClaude(system, user, useSearch) {
    const key = getKey();
    if (!key) throw new Error('No API key set. Paste your Anthropic key at the top of this tab.');
    const body = {
      model: MODEL,
      max_tokens: 2000,
      system: system,
      messages: [{ role: 'user', content: user }]
    };
    if (useSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }];
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error('API ' + res.status + (errText ? ': ' + errText.slice(0, 140) : ''));
    }
    const data = await res.json();
    return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  }

  function parseJSON(text) {
    const clean = text.replace(/```json|```/g, '').trim();
    const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
    if (s === -1 || e === -1) throw new Error('No JSON in response');
    return JSON.parse(clean.slice(s, e + 1));
  }

  // ============ SUPABASE BRIDGES (uses host app globals) ============
  async function saveApplication(row) {
    if (typeof supabase === 'undefined' || !supabase || typeof userToken === 'undefined' || !userToken) {
      notify('Not connected to Supabase. Saved nowhere.'); return false;
    }
    const { error } = await supabase.from('applications').insert({
      owner_token: userToken,
      company: row.company || 'Unknown',
      role: row.role || 'Role TBD',
      location: row.location || null,
      jd_url: row.jd_url || null,
      status: 'not_applied',
      notes: row.notes || null,
      last_action_date: new Date().toISOString().slice(0, 10)
    });
    if (error) { notify('Save failed: ' + error.message); return false; }
    notify('Added to Applications');
    return true;
  }

  async function saveConnection(row) {
    if (typeof supabase === 'undefined' || !supabase || typeof userToken === 'undefined' || !userToken) {
      notify('Not connected to Supabase.'); return false;
    }
    const { error } = await supabase.from('connections').insert({
      owner_token: userToken,
      name: row.name,
      company: row.company || null,
      role: row.role || null,
      status: 'messaged',
      notes: row.notes || null,
      last_contact: new Date().toISOString().slice(0, 10)
    });
    if (error) { notify('Save failed: ' + error.message); return false; }
    notify('Logged in Connections');
    return true;
  }

  // ============ UI HELPERS ============
  function el(tag, attrs, html) {
    const n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(k => n.setAttribute(k, attrs[k]));
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  function setLog(id, lines) {
    const box = document.getElementById(id);
    if (!box) return;
    box.style.display = lines.length ? 'block' : 'none';
    box.innerHTML = lines.map((l, i) =>
      '<div class="ag-logline' + (i === lines.length - 1 ? ' ag-loglast' : '') + '">&gt; ' + esc(l) + '</div>'
    ).join('');
    box.scrollTop = box.scrollHeight;
  }

  function copyBtn(text) {
    return '<button class="ag-copy" data-copy="' + esc(text).replace(/"/g, '&quot;') + '">Copy</button>';
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('.ag-copy');
    if (!b) return;
    navigator.clipboard.writeText(b.dataset.copy.replace(/&quot;/g, '"'));
    b.textContent = 'Copied';
    setTimeout(() => { b.textContent = 'Copy'; }, 1400);
  });

  // ============ AGENT 1: ROLE SCOUT ============
  async function runScout() {
    const track = document.getElementById('ag-track').value;
    const extra = document.getElementById('ag-scout-extra').value.trim();
    const out = document.getElementById('ag-scout-out');
    const log = [];
    const push = m => { log.push(m); setLog('ag-scout-log', log); };
    out.innerHTML = '';
    push('Scout launched: ' + track);
    push('Filters: F-1 OPT viable, non-ITAR, no clearance, entry to 2 yrs');
    push('Live web search running (20 to 40 s)...');
    try {
      const sys = PROFILE + '\nYou are a job-scouting agent. Use web search to find CURRENTLY OPEN, real postings. Exclude anything requiring citizenship, clearance, or ITAR/US-persons status. Respond ONLY with JSON, no fences: {"roles":[{"company":"","title":"","location":"","why_fit":"one sentence tied to his record","opt_note":"authorization signal if any","find_it":"exact search phrase to locate posting"}]} Max 5 roles, fields under 25 words.';
      const user = 'Find up to 5 live openings for: ' + track + '. US-based or remote.' + (extra ? ' Constraints: ' + extra : '');
      const text = await callClaude(sys, user, true);
      push('Parsing results...');
      const roles = (parseJSON(text).roles || []);
      push('Scout complete: ' + roles.length + ' roles');
      out.innerHTML = roles.map((r, i) =>
        '<div class="ag-card">' +
          '<div class="ag-card-head"><div><b>' + esc(r.title) + '</b><div class="ag-sub">' + esc(r.company) + ' · ' + esc(r.location) + '</div></div>' +
          '<button class="ag-add" data-i="' + i + '">+ Track</button></div>' +
          '<div class="ag-body">' + esc(r.why_fit) + '</div>' +
          (r.opt_note ? '<div class="ag-flag">VISA: ' + esc(r.opt_note) + '</div>' : '') +
          '<div class="ag-sub">Find it: "' + esc(r.find_it) + '"</div>' +
        '</div>'
      ).join('') || '<div class="ag-sub">No roles returned. Rerun or loosen constraints.</div>';
      out.querySelectorAll('.ag-add').forEach(b => b.addEventListener('click', () => {
        const r = roles[+b.dataset.i];
        saveApplication({ company: r.company, role: r.title, location: r.location, notes: 'Scout: ' + r.why_fit + ' | Find: ' + r.find_it });
      }));
    } catch (err) { push('ERROR: ' + err.message); }
  }

  // ============ AGENT 2: GAP ANALYZER ============
  async function runGap() {
    const meta = document.getElementById('ag-gap-meta').value.trim();
    const jd = document.getElementById('ag-gap-jd').value.trim();
    const out = document.getElementById('ag-gap-out');
    if (!jd) { notify('Paste a job description first.'); return; }
    const log = []; const push = m => { log.push(m); setLog('ag-gap-log', log); };
    out.innerHTML = '';
    push('Analyzing JD against your record...');
    try {
      const sys = PROFILE + '\nYou are a brutally honest resume-gap analyst. Respond ONLY with JSON, no fences: {"fit_score":0-100,"verdict":"one blunt sentence","matched":["kw"],"missing":["kw"],"gaps":[{"gap":"","mitigation":""}],"bullets":["XYZ bullet, metric first, no em dashes"],"resume_track":"which of his 5 tracks","opt_flag":"authorization/ITAR concern or none"} Max 4 gaps, 4 bullets, 8 keywords per list. Score below 50 if genuinely weak.';
      const text = await callClaude(sys, (meta ? 'Context: ' + meta + '\n\n' : '') + 'JD:\n' + jd.slice(0, 6000), false);
      push('Parsing analysis...');
      const a = parseJSON(text);
      push('Done. Fit: ' + a.fit_score);
      const col = a.fit_score >= 70 ? '#2f9e6e' : a.fit_score >= 50 ? '#c98a1b' : '#c0392b';
      out.innerHTML =
        '<div class="ag-card"><div style="display:flex;gap:14px;align-items:center">' +
          '<span style="font-size:34px;font-weight:800;color:' + col + '">' + a.fit_score + '</span>' +
          '<div><div class="ag-sub">FIT SCORE / 100</div><div>' + esc(a.verdict) + '</div>' +
          (a.opt_flag && a.opt_flag !== 'none' ? '<div class="ag-flag">FLAG: ' + esc(a.opt_flag) + '</div>' : '') +
          '</div></div></div>' +
        '<div class="ag-card"><b>Matched:</b> ' + (a.matched || []).map(esc).join(', ') +
          '<br><b>Missing (work these in):</b> <span style="color:#c0392b">' + (a.missing || []).map(esc).join(', ') + '</span></div>' +
        '<div class="ag-card"><b>Gaps</b>' + (a.gaps || []).map(g => '<div style="margin-top:6px"><b>' + esc(g.gap) + '</b><div class="ag-sub">' + esc(g.mitigation) + '</div></div>').join('') + '</div>' +
        '<div class="ag-card"><b>Tailored bullets</b> <span class="ag-sub">(start from: ' + esc(a.resume_track || '') + ')</span>' +
          (a.bullets || []).map(b => '<div class="ag-bullet">' + esc(b) + ' ' + copyBtn(b) + '</div>').join('') + '</div>' +
        '<button class="ag-add" id="ag-gap-save">+ Track this application</button>';
      document.getElementById('ag-gap-save').addEventListener('click', () => {
        const parts = meta.split(',');
        saveApplication({ company: (parts[0] || 'From JD').trim(), role: (parts[1] || 'Analyzed role').trim(), notes: 'Gap analysis fit ' + a.fit_score + '. Missing: ' + (a.missing || []).join(', ') });
      });
    } catch (err) { push('ERROR: ' + err.message); }
  }

  // ============ AGENT 3: OUTREACH COMPOSER ============
  async function runOutreach() {
    const name = document.getElementById('ag-or-name').value.trim();
    const title = document.getElementById('ag-or-title').value.trim();
    const company = document.getElementById('ag-or-co').value.trim();
    const goal = document.getElementById('ag-or-goal').value;
    const ctx = document.getElementById('ag-or-ctx').value.trim();
    const out = document.getElementById('ag-or-out');
    if (!name || !company) { notify('Name and company are required.'); return; }
    const log = []; const push = m => { log.push(m); setLog('ag-or-log', log); };
    out.innerHTML = '';
    push('Composing three formats for ' + name + ' at ' + company + '...');
    try {
      const sys = PROFILE + '\nYou write cold outreach in first person as Madhav. Every message needs ONE specific hook: a real company/role detail tied to one concrete item from his record. Never generic flattery, never "hope this finds you well". UMich alumni angle if plausible. Respond ONLY with JSON, no fences: {"connection_note":"LinkedIn connect request, HARD LIMIT 280 chars","followup":"post-accept message under 110 words, ends with one low-friction ask","email":{"subject":"under 9 words","body":"under 150 words, 3 short paragraphs, sign: Madhav Sehgal, msehgal.net"}}';
      const user = 'Contact: ' + name + ', ' + title + ' at ' + company + '. Goal: ' + goal + '. ' + (ctx ? 'Context: ' + ctx : 'No context given, infer a plausible specific hook from the company.');
      const text = await callClaude(sys, user, false);
      push('Parsing drafts...');
      const o = parseJSON(text);
      push('Ready.');
      const note = o.connection_note || '';
      out.innerHTML =
        '<div class="ag-card"><b>LinkedIn connection note</b> <span class="ag-sub">' + note.length + '/300</span><div class="ag-msg">' + esc(note) + '</div>' + copyBtn(note) + '</div>' +
        '<div class="ag-card"><b>Follow-up (after accept)</b><div class="ag-msg">' + esc(o.followup || '') + '</div>' + copyBtn(o.followup || '') + '</div>' +
        '<div class="ag-card"><b>Email</b> <span class="ag-sub">Subject: ' + esc(o.email && o.email.subject || '') + '</span><div class="ag-msg">' + esc(o.email && o.email.body || '') + '</div>' + copyBtn((o.email && (o.email.subject + '\n\n' + o.email.body)) || '') + '</div>' +
        '<button class="ag-add" id="ag-or-save">+ Log in Connections</button>';
      document.getElementById('ag-or-save').addEventListener('click', () =>
        saveConnection({ name, company, role: title, notes: 'Outreach sent via agent. Goal: ' + goal }));
    } catch (err) { push('ERROR: ' + err.message); }
  }

  // ============ AGENT 4: DAILY BRIEF ============
  async function runBrief() {
    const out = document.getElementById('ag-brief-out');
    const log = []; const push = m => { log.push(m); setLog('ag-brief-log', log); };
    out.innerHTML = '';
    push('Reading your live pipeline from Supabase...');
    try {
      let apps = [], conns = [];
      if (typeof supabase !== 'undefined' && supabase && typeof userToken !== 'undefined' && userToken) {
        const a = await supabase.from('applications').select('company,role,status,applied_date,last_action_date,referrer').eq('owner_token', userToken).limit(60);
        const c = await supabase.from('connections').select('name,company,status,last_contact,tier').eq('owner_token', userToken).limit(60);
        apps = a.data || []; conns = c.data || [];
      }
      push('Loaded ' + apps.length + ' applications, ' + conns.length + ' connections');
      push('Prioritizing...');
      const sys = PROFILE + '\nYou are a job-search chief of staff. Produce today\'s plan: max 5 actions ordered by expected value. Flag stale items (outreach older than 5 days, applications older than 10 days without follow-up). Plain text, short lines, no markdown, no em dashes, under 180 words.';
      const user = 'Date: ' + new Date().toISOString().slice(0, 10) +
        '\nApplications:\n' + (apps.map(x => '- ' + x.company + ' | ' + x.role + ' | ' + x.status + ' | applied ' + (x.applied_date || 'never') + ' | last action ' + (x.last_action_date || 'none')).join('\n') || 'none') +
        '\nConnections:\n' + (conns.map(x => '- ' + x.name + ' @ ' + (x.company || '?') + ' | ' + x.status + ' | last contact ' + (x.last_contact || 'never')).join('\n') || 'none');
      const text = await callClaude(sys, user, false);
      push('Brief ready.');
      out.innerHTML = '<div class="ag-card"><b>Today\'s flight plan</b><div class="ag-msg">' + esc(text.trim()) + '</div>' + copyBtn(text.trim()) + '</div>';
    } catch (err) { push('ERROR: ' + err.message); }
  }

  // ============ RENDER ============
  function render() {
    const host = document.getElementById('view-agents');
    if (!host || host.dataset.built) { refreshKeyBar(); return; }
    host.dataset.built = '1';
    host.innerHTML =
      '<h2>AI Agents</h2>' +
      '<div class="ag-keybar" id="ag-keybar"></div>' +
      '<div class="ag-grid">' +

      '<section class="ag-panel"><h3>01 · Role Scout</h3><p class="ag-sub">Live web search for open, OPT-viable, non-ITAR roles. Complements your nightly Greenhouse/Lever fetcher with reasoning, not just keywords.</p>' +
      '<select id="ag-track" class="ag-input">' +
        ['Aviation and airline analyst roles', 'Entry-level consulting (strategy, ops, aviation advisory)', 'Commercial space, non-ITAR (EO, smallsat, satellite data)', 'AI / ML technical roles', 'Engineering simulation software (application engineer)'].map(t => '<option>' + t + '</option>').join('') +
      '</select>' +
      '<input id="ag-scout-extra" class="ag-input" placeholder="Optional: location, salary floor, exclusions">' +
      '<button class="ag-run" id="ag-scout-run">Launch scout</button>' +
      '<div class="ag-log" id="ag-scout-log"></div><div id="ag-scout-out"></div></section>' +

      '<section class="ag-panel"><h3>02 · Gap Analyzer</h3><p class="ag-sub">Paste a JD. Get an honest fit score, missing keywords, gaps with mitigations, and tailored XYZ bullets.</p>' +
      '<input id="ag-gap-meta" class="ag-input" placeholder="Company, Role (optional)">' +
      '<textarea id="ag-gap-jd" class="ag-input" rows="7" placeholder="Paste the full job description"></textarea>' +
      '<button class="ag-run" id="ag-gap-run">Run analysis</button>' +
      '<div class="ag-log" id="ag-gap-log"></div><div id="ag-gap-out"></div></section>' +

      '<section class="ag-panel"><h3>03 · Outreach Composer</h3><p class="ag-sub">Connection note (280-char limit), follow-up, and email. One specific hook per message, your voice rules enforced.</p>' +
      '<input id="ag-or-name" class="ag-input" placeholder="Contact name">' +
      '<input id="ag-or-title" class="ag-input" placeholder="Their title">' +
      '<input id="ag-or-co" class="ag-input" placeholder="Company">' +
      '<select id="ag-or-goal" class="ag-input">' +
        ['Informational interview', 'Referral for a specific posting', 'Follow-up after applying', 'Follow-up after interview', 'Reconnect with existing contact'].map(g => '<option>' + g + '</option>').join('') +
      '</select>' +
      '<textarea id="ag-or-ctx" class="ag-input" rows="4" placeholder="Context: paste posting, alumni link, prior interaction (optional but powerful)"></textarea>' +
      '<button class="ag-run" id="ag-or-run">Compose</button>' +
      '<div class="ag-log" id="ag-or-log"></div><div id="ag-or-out"></div></section>' +

      '<section class="ag-panel"><h3>04 · Daily Brief</h3><p class="ag-sub">Reads your real applications and connections from Supabase, returns a max-5-action plan and flags stale items.</p>' +
      '<button class="ag-run" id="ag-brief-run">Generate today\'s brief</button>' +
      '<div class="ag-log" id="ag-brief-log"></div><div id="ag-brief-out"></div></section>' +

      '</div>';

    document.getElementById('ag-scout-run').addEventListener('click', runScout);
    document.getElementById('ag-gap-run').addEventListener('click', runGap);
    document.getElementById('ag-or-run').addEventListener('click', runOutreach);
    document.getElementById('ag-brief-run').addEventListener('click', runBrief);
    refreshKeyBar();
  }

  function refreshKeyBar() {
    const bar = document.getElementById('ag-keybar');
    if (!bar) return;
    if (getKey()) {
      bar.innerHTML = '<span class="ag-ok">● Anthropic key set (stored locally, never synced)</span> <button class="ag-copy" id="ag-key-clear">Remove</button>';
      document.getElementById('ag-key-clear').addEventListener('click', () => { localStorage.removeItem(KEY_STORAGE); refreshKeyBar(); });
    } else {
      bar.innerHTML = '<input id="ag-key-in" class="ag-input" style="max-width:420px;display:inline-block" type="password" placeholder="Paste Anthropic API key (sk-ant-...)"> <button class="ag-run" style="width:auto;display:inline-block;padding:8px 16px" id="ag-key-save">Save key</button><div class="ag-sub" style="margin-top:4px">Stored in this browser\'s localStorage only, exactly like your Supabase owner token. Do not commit it anywhere.</div>';
      document.getElementById('ag-key-save').addEventListener('click', () => {
        const v = document.getElementById('ag-key-in').value.trim();
        if (!v.startsWith('sk-ant')) { notify('That does not look like an Anthropic key.'); return; }
        localStorage.setItem(KEY_STORAGE, v);
        refreshKeyBar();
        notify('Key saved locally.');
      });
    }
  }

  // ============ STYLES (scoped, injected: zero CSS-file changes) ============
  const css = document.createElement('style');
  css.textContent = `
    #view-agents .ag-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;margin-top:12px}
    #view-agents .ag-panel{background:var(--card,#fff);border:1px solid var(--border,#e2e2e2);border-radius:10px;padding:16px}
    #view-agents .ag-panel h3{margin:0 0 4px}
    #view-agents .ag-sub{font-size:12px;opacity:.65;margin:0 0 8px}
    #view-agents .ag-input{width:100%;box-sizing:border-box;margin:0 0 8px;padding:8px 10px;border:1px solid var(--border,#ccc);border-radius:6px;font:inherit;background:var(--bg,#fff);color:inherit}
    #view-agents .ag-run{width:100%;padding:9px;border:none;border-radius:6px;background:#1a56db;color:#fff;font-weight:700;cursor:pointer}
    #view-agents .ag-run:hover{filter:brightness(1.08)}
    #view-agents .ag-log{display:none;margin-top:8px;max-height:90px;overflow-y:auto;background:#0d1117;border-radius:6px;padding:6px 8px;font-family:ui-monospace,monospace;font-size:11px}
    #view-agents .ag-logline{color:#4a5568}
    #view-agents .ag-loglast{color:#53d8fb}
    #view-agents .ag-card{border:1px solid var(--border,#e2e2e2);border-left:3px solid #1a56db;border-radius:6px;padding:10px 12px;margin-top:10px;font-size:13.5px}
    #view-agents .ag-card-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
    #view-agents .ag-body{margin-top:6px}
    #view-agents .ag-flag{color:#c98a1b;font-size:12px;margin-top:4px;font-weight:600}
    #view-agents .ag-msg{white-space:pre-wrap;margin:6px 0;line-height:1.5}
    #view-agents .ag-bullet{margin-top:8px;padding-top:8px;border-top:1px dashed var(--border,#ddd)}
    #view-agents .ag-add{border:1px solid #2f9e6e;color:#2f9e6e;background:none;border-radius:5px;padding:4px 10px;font-size:12px;cursor:pointer;margin-top:8px;white-space:nowrap}
    #view-agents .ag-copy{border:1px solid var(--border,#ccc);background:none;border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;opacity:.8}
    #view-agents .ag-keybar{margin:6px 0 4px}
    #view-agents .ag-ok{color:#2f9e6e;font-size:13px;font-weight:600}
  `;
  document.head.appendChild(css);

  // expose for openView hook
  window.JobAgents = { render };
})();
