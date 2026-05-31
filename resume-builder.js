// ============================================================
// JOB COMMAND - Resume Builder
// Static PWA module: stores profile/library/draft/versions in the
// token-protected settings row and exports ATS-friendly Word/PDF.
// ============================================================

(function () {
  'use strict';

  const STOP = new Set('a an and are as at be by can for from has have in into is it its of on or our per that the their this to with we will you your role team teams using use used work working experience experienced strong preferred seek involves ability responsibilities qualifications basic minimum plus across within through under over'.split(' '));

  const DEFAULT_PROFILE = {
    firstName: 'Madhav',
    lastName: 'Sehgal',
    phone: '(734) 368-0084',
    email: 'msehgal@umich.edu',
    linkedin: 'www.linkedin.com/in/sehgalm',
    website: 'www.msehgal.net',
    education: [
      {
        school: 'University of Michigan',
        location: 'Ann Arbor, MI',
        degree: 'Master of Science in Aerospace Engineering (Concentration: Space Systems)',
        dates: 'May 2026',
        details: ['Coursework: Rocket Propulsion, Finite Element Method, CFD.']
      },
      {
        school: 'Amity University',
        location: 'Uttar Pradesh, India',
        degree: 'Bachelor of Technology in Aerospace Engineering (Hons. In Spacecraft Engineering)',
        dates: 'May 2024',
        details: []
      }
    ],
    skills: [
      { category: 'CFD and Aerodynamics', items: ['ANSYS Fluent', 'OpenFOAM', 'STAR-CCM+', 'RANS', 'LES', 'SST k-omega', 'shock-wave boundary-layer interaction', 'supersonic inlet flows', 'mesh refinement', 'convergence studies'] },
      { category: 'Propulsion and Analysis', items: ['Rocket propulsion', 'nozzle and injector sizing', 'NASA CEA', 'compressible flow', 'aerodynamic validation', 'uncertainty quantification'] },
      { category: 'Programming and Data', items: ['Python', 'TensorFlow', 'MATLAB', 'NumPy', 'Pandas', 'SQL', 'Git', 'C/C++'] },
      { category: 'Testing and Design', items: ['Wind tunnel operations', 'pressure measurement integration', 'Pitot-static calibration', 'smoke visualization', 'LabVIEW', 'Arduino', 'CATIA V5', 'SOLIDWORKS', 'HyperMesh'] }
    ]
  };

  const DEFAULT_LIBRARY = {
    experiences: [
      {
        id: 'e_gdi',
        company: 'Gas Dynamics Imaging Laboratory, University of Michigan',
        location: 'Ann Arbor, MI',
        title: 'Graduate Student Researcher',
        dates: 'May 2025 - Aug 2025',
        bullets: [
          { id: 'b_gdi_1', text: 'Reduced wind tunnel pre-screening by developing a <b>Bayesian Neural Network in Python and TensorFlow</b> that predicted shock-train position in supersonic isolators with <b>99.6%</b> accuracy' },
          { id: 'b_gdi_2', text: 'Enabled direct CFD-to-experiment validation by <b>developing a Python pipeline to align 500+ pressure taps with CFD mesh nodes</b>, eliminating a spatial mismatch between test and simulation data' },
          { id: 'b_gdi_3', text: 'Expanded a limited training dataset by generating <b>physics-constrained synthetic flowfields</b> with conserved flow behavior, improving model training under sparse-data conditions' }
        ]
      },
      {
        id: 'e_amity',
        company: 'Aerodynamics & Wind Tunnel Laboratory, Amity University',
        location: 'Noida, India',
        title: 'Undergraduate Student Researcher',
        dates: 'May 2025 - Aug 2025',
        bullets: [
          { id: 'b_amity_1', text: 'Validated published <b>Mach 3 inlet benchmarks within 2%</b> by performing 3D RANS simulations in ANSYS Fluent with 2M-8M cell mesh-independence studies and SST k-omega turbulence modeling' },
          { id: 'b_amity_2', text: 'Doubled pressure recovery by designing passive and active micro-vortex generators across <b>12 supersonic inlet configurations</b> and evaluating their performance through CFD-driven iteration' },
          { id: 'b_amity_3', text: 'Improved wind tunnel flow diagnostics by integrating <b>Pitot-static calibration, smoke visualization, and LabVIEW-Arduino data acquisition</b> for pressure measurement and separation mapping' }
        ]
      },
      {
        id: 'e_drdo',
        company: 'Centre for Airborne Systems, Defence Research & Development Organisation (DRDO)',
        location: 'Bangalore, India',
        title: 'Engineering Research Intern',
        dates: 'May 2023 - June 2023',
        bullets: [
          { id: 'b_drdo_1', text: 'Improved modeled fuel-transfer efficiency by <b>15%</b> by optimizing the geometry of an air-to-air refueling pod for the IL-78MKI tanker aircraft under Mach 0.7 cruise conditions' },
          { id: 'b_drdo_2', text: 'Reduced design risk by evaluating aerodynamic loads and structural response through <b>coupled CFD-structural analysis</b>, confirming the refueling pod could withstand operational vibration loads without resonance risk' },
          { id: 'b_drdo_3', text: 'Achieved <b>97% agreement with analytical predictions</b> by validating CFD results in MATLAB and hand calculations, identifying and correcting a mesh-resolution issue before final release' }
        ]
      }
    ],
    projects: [
      {
        id: 'p_launch',
        name: 'Three-Stage Launch Vehicle Design',
        org: 'University of Michigan',
        subtitle: 'Graduate Level Rocket Propulsion Class Project',
        dates: 'Aug 2024 - Dec 2024',
        bullets: [
          { id: 'b_launch_1', text: 'Designed a <b>74 m, 836,146 kg three-stage launch vehicle</b> to deliver 1,000 kg to low lunar orbit through iterative mass optimization' },
          { id: 'b_launch_2', text: 'Sized RP-1/LOX, CH4/LOX, and LH2/LOX stages to meet the total mission delta V of <b>17.6 km/s</b>, including combustion chambers, nozzles, and injectors to fulfil the critical requirements as per the problem statement' },
          { id: 'b_launch_3', text: 'Validated stage-level design parameters by computing propulsion flow properties in <b>NASA CEA</b> and performing hoop-stress sizing in Python and MATLAB' }
        ]
      }
    ]
  };

  let model = null;
  let drag = null;
  let saveTimer = null;
  let analysis = null;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const uid = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'data') Object.entries(v).forEach(([dk, dv]) => { el.dataset[dk] = dv; });
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach((c) => {
      if (c == null || c === false) return;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
    return el;
  }

  function stripHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    return div.textContent || div.innerText || '';
  }

  function sanitizeRich(html) {
    const template = document.createElement('template');
    template.innerHTML = html || '';
    template.content.querySelectorAll('*').forEach((node) => {
      if (node.tagName !== 'B' && node.tagName !== 'STRONG') node.replaceWith(document.createTextNode(node.textContent || ''));
      else node.replaceWith(h('b', {}, node.textContent || ''));
    });
    return template.innerHTML
      .replace(/<div><br><\/div>/g, '<br>')
      .replace(/<div>/g, '<br>')
      .replace(/<\/div>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
  }

  function ensureModel() {
    if (model) return model;
    const s = state.settings || {};
    const profile = s.resume_profile || clone(DEFAULT_PROFILE);
    const library = s.resume_library || clone(DEFAULT_LIBRARY);
    const draft = s.resume_draft || defaultDraft(library, profile);
    const versions = Array.isArray(s.resume_versions) ? s.resume_versions : [];
    model = { profile, library, draft, versions };
    ensureDraftShape(model.draft);
    return model;
  }

  function defaultDraft(library, profile) {
    return {
      id: null,
      targetCompany: '',
      targetRole: '',
      jobDescription: '',
      includeSummary: false,
      summaryText: '',
      experience: (library.experiences || []).map((e) => ({
        id: uid('re'),
        company: e.company,
        location: e.location,
        title: e.title,
        dates: e.dates,
        bullets: (e.bullets || []).map((b) => ({ id: uid('rb'), sourceId: b.id, text: b.text }))
      })),
      projects: (library.projects || []).map((p) => ({
        id: uid('rp'),
        name: p.name,
        org: p.org,
        subtitle: p.subtitle,
        dates: p.dates,
        bullets: (p.bullets || []).map((b) => ({ id: uid('rb'), sourceId: b.id, text: b.text }))
      })),
      skills: clone(profile.skills || [])
    };
  }

  function ensureDraftShape(d) {
    d.experience = d.experience || [];
    d.projects = d.projects || [];
    d.skills = d.skills || [];
    d.jobDescription = d.jobDescription || '';
  }

  async function saveNow(silent = false) {
    const m = ensureModel();
    state.settings.resume_profile = m.profile;
    state.settings.resume_library = m.library;
    state.settings.resume_draft = m.draft;
    state.settings.resume_versions = m.versions;
    if (!supabase || !userToken) return;
    setSyncState('syncing');
    const payload = {
      owner_token: userToken,
      resume_profile: m.profile,
      resume_library: m.library,
      resume_draft: m.draft,
      resume_versions: m.versions
    };
    const { error } = await supabase.from('settings').upsert(payload, { onConflict: 'owner_token' });
    if (error) {
      setSyncState('error');
      toast('Resume save failed: ' + error.message, 'error');
      return;
    }
    setSyncState('online');
    if (!silent) toast('Resume saved.', 'success');
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveNow(true), 500);
  }

  function editable(value, placeholder, cls, onSave, rich = false) {
    const el = h('span', { class: cls || '', contenteditable: 'true', 'data-placeholder': placeholder || '' });
    if (rich) el.innerHTML = sanitizeRich(value || '');
    else el.textContent = value || '';
    el.addEventListener('blur', () => onSave(rich ? sanitizeRich(el.innerHTML) : el.textContent.trim()));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !rich) { e.preventDefault(); el.blur(); }
    });
    return el;
  }

  function render() {
    const root = $('#resume-builder-root');
    if (!root) return;
    ensureModel();
    root.innerHTML = '';
    root.append(
      h('div', { class: 'rb-shell' },
        h('div', { class: 'rb-center' }, renderCommandBar(), renderTargetPanel(), renderPaper()),
        h('aside', { class: 'rb-library' }, renderLibraryPanel())
      )
    );
    renderVersionList();
    decorateAnalysis();
  }

  function renderCommandBar() {
    const d = model.draft;
    const appOptions = (state.apps || []).map((a) => h('option', { value: a.id }, `${a.company} - ${a.role}`));
    return h('div', { class: 'rb-command' },
      h('div', { class: 'rb-target-grid' },
        h('label', {}, 'Company', h('input', { id: 'rb-company', value: d.targetCompany || '', oninput: (e) => { d.targetCompany = e.target.value; scheduleSave(); renderVersionLabel(); } })),
        h('label', {}, 'Role', h('input', { id: 'rb-role', value: d.targetRole || '', oninput: (e) => { d.targetRole = e.target.value; scheduleSave(); renderVersionLabel(); } })),
        h('label', {}, 'Load from tracked job', h('select', { id: 'rb-app-select', onchange: (e) => loadFromApp(e.target.value) },
          h('option', { value: '' }, 'Choose application...'), appOptions))
      ),
      h('div', { class: 'rb-actions' },
        h('button', { class: 'primary', onclick: saveVersionNew }, '+ Save version'),
        h('button', { onclick: updateCurrentVersion }, 'Update'),
        h('button', { onclick: exportWord }, 'Word'),
        h('button', { onclick: exportPDF }, 'PDF')
      ),
      h('div', { class: 'rb-version-bar' },
        h('div', { id: 'rb-version-label', class: 'rb-version-label' }, versionLabel()),
        h('div', { id: 'rb-version-list', class: 'rb-version-list' })
      )
    );
  }

  function renderTargetPanel() {
    const d = model.draft;
    return h('div', { class: 'rb-target-panel' },
      h('div', { class: 'rb-jd-head' },
        h('div', {}, h('strong', {}, 'Job description'), h('span', {}, ' paste the JD here, then analyze keyword coverage')),
        h('button', { onclick: runAnalysis }, 'Analyze JD')
      ),
      h('textarea', { id: 'rb-jd', placeholder: 'Paste the full job description...', oninput: (e) => { d.jobDescription = e.target.value; scheduleSave(); } }, d.jobDescription || ''),
      h('div', { id: 'rb-analysis', class: 'rb-analysis' })
    );
  }

  function renderPaper() {
    const p = model.profile;
    const d = model.draft;
    return h('div', { class: 'rb-paper-wrap' },
      h('div', { id: 'rb-paper', class: 'rb-paper' },
        h('header', { class: 'rb-resume-head' },
          h('div', { class: 'rb-name' }, `${p.firstName || ''} ${p.lastName || ''}`.trim().toUpperCase() || 'YOUR NAME'),
          h('div', { class: 'rb-contact' }, contactParts(p).map((c, i) => h('span', { class: c.link ? 'rb-linkish' : '' }, (i ? ' • ' : '') + c.text)))
        ),
        renderEducation(),
        d.includeSummary ? renderSummary() : null,
        renderItems('EXPERIENCE', d.experience, 'experience'),
        renderItems('PROJECT', d.projects, 'projects'),
        renderSkills()
      )
    );
  }

  function contactParts(p) {
    return [
      p.phone && { text: p.phone },
      p.email && { text: p.email, link: true },
      p.linkedin && { text: p.linkedin, link: true },
      p.website && { text: p.website, link: true }
    ].filter(Boolean);
  }

  function sectionTitle(title, extra) {
    return h('div', { class: 'rb-section-title' }, title, extra || null);
  }

  function renderEducation() {
    return h('section', { class: 'rb-section' },
      sectionTitle('EDUCATION'),
      ...(model.profile.education || []).map((e) => h('div', { class: 'rb-item' },
        h('div', { class: 'rb-row rb-bold' },
          editable(e.school, 'School', '', (v) => { e.school = v; scheduleSave(); }),
          editable(e.location, 'Location', '', (v) => { e.location = v; scheduleSave(); })
        ),
        h('div', { class: 'rb-row' },
          editable(e.degree, 'Degree', 'rb-degree', (v) => { e.degree = v; scheduleSave(); }),
          editable(e.dates, 'Dates', '', (v) => { e.dates = v; scheduleSave(); })
        ),
        ...(e.details || []).map((x, i) => editable(x, 'Detail', 'rb-detail', (v) => { e.details[i] = v; scheduleSave(); }))
      ))
    );
  }

  function renderSummary() {
    return h('section', { class: 'rb-section' },
      sectionTitle('SUMMARY'),
      editable(model.draft.summaryText || '', 'Optional tailored summary...', 'rb-summary', (v) => { model.draft.summaryText = v; scheduleSave(); })
    );
  }

  function renderItems(title, items, kind) {
    const sec = h('section', { class: 'rb-section' }, sectionTitle(title, h('button', { class: 'rb-mini no-print', onclick: () => addBlankItem(kind) }, '+ add')));
    items.forEach((it, idx) => sec.append(renderResumeItem(it, kind, idx)));
    const drop = h('div', {
      class: 'rb-role-drop no-print',
      ondragover: (e) => { if (drag && drag.type === 'role') e.preventDefault(); },
      ondrop: (e) => { e.preventDefault(); if (drag && drag.type === 'role') { addRoleFromLibrary(drag.role, kind); drag = null; } }
    }, kind === 'projects' ? 'Drop a project here' : 'Drop a role here');
    sec.append(drop);
    return sec;
  }

  function renderResumeItem(it, kind, idx) {
    const isProject = kind === 'projects';
    const ul = h('ul', { class: 'rb-bullets' + ((it.bullets || []).length ? '' : ' rb-empty'), data: { id: it.id, kind } });
    attachBulletDrop(ul);
    if (!(it.bullets || []).length) ul.append(h('li', { class: 'rb-empty-note no-print' }, 'Drag bullets here'));
    (it.bullets || []).forEach((b, bidx) => ul.append(renderResumeBullet(b, it, kind, bidx)));

    return h('div', { class: 'rb-item' },
      h('div', { class: 'rb-item-tools no-print' },
        h('button', { onclick: () => moveItem(kind, idx, -1), disabled: idx === 0 }, 'up'),
        h('button', { onclick: () => moveItem(kind, idx, 1), disabled: idx >= model.draft[kind].length - 1 }, 'down'),
        h('button', { onclick: () => removeItem(kind, it.id) }, 'x')
      ),
      h('div', { class: 'rb-row rb-bold' },
        editable(isProject ? it.name : it.company, isProject ? 'Project' : 'Company', '', (v) => { it[isProject ? 'name' : 'company'] = v; scheduleSave(); }),
        editable(isProject ? it.org : it.location, isProject ? 'Organization' : 'Location', '', (v) => { it[isProject ? 'org' : 'location'] = v; scheduleSave(); })
      ),
      h('div', { class: 'rb-row' },
        editable(isProject ? it.subtitle : it.title, isProject ? 'Project context' : 'Title', '', (v) => { it[isProject ? 'subtitle' : 'title'] = v; scheduleSave(); }),
        editable(it.dates, 'Dates', '', (v) => { it.dates = v; scheduleSave(); })
      ),
      ul
    );
  }

  function renderResumeBullet(b, item, kind, idx) {
    const li = h('li', { class: 'rb-bullet-wrap', draggable: 'true' },
      h('span', { class: 'rb-grip no-print', title: 'Drag to reorder' }, '::'),
      editable(b.text, 'Bullet', 'rb-bullet', (v) => { b.text = v; scheduleSave(); decorateAnalysis(); }, true),
      h('span', { class: 'rb-kw-badge no-print' }),
      h('button', { class: 'rb-mini no-print', title: 'Copy a tailoring prompt for this bullet', onclick: () => copyTailorPrompt(b) }, 'tailor'),
      h('button', { class: 'rb-mini no-print', onclick: () => { item.bullets.splice(idx, 1); scheduleSave(); render(); } }, 'x')
    );
    li.addEventListener('dragstart', () => { drag = { type: 'move', id: b.id }; });
    return li;
  }

  function attachBulletDrop(ul) {
    ul.addEventListener('dragover', (e) => { if (drag && (drag.type === 'bullet' || drag.type === 'move')) e.preventDefault(); });
    ul.addEventListener('drop', (e) => {
      e.preventDefault();
      const item = findItem(ul.dataset.kind, ul.dataset.id);
      if (!item || !drag) return;
      const idx = Math.max(0, Array.from(ul.querySelectorAll('.rb-bullet-wrap')).length);
      if (drag.type === 'bullet') {
        item.bullets = item.bullets || [];
        item.bullets.splice(idx, 0, { id: uid('rb'), sourceId: drag.sourceId, text: drag.text });
      } else if (drag.type === 'move') {
        const loc = findBullet(drag.id);
        if (loc) {
          const [moved] = loc.arr.splice(loc.idx, 1);
          item.bullets = item.bullets || [];
          item.bullets.push(moved);
        }
      }
      drag = null;
      scheduleSave();
      render();
    });
  }

  function renderSkills() {
    return h('section', { class: 'rb-section' },
      sectionTitle('SKILLS', h('button', { class: 'rb-mini no-print', onclick: syncSkillsFromProfile }, 'sync')),
      ...(model.draft.skills || []).map((g, i) => h('div', { class: 'rb-skill-line' },
        editable(g.category, 'Category', 'rb-skill-cat', (v) => { g.category = v; scheduleSave(); }),
        document.createTextNode(': '),
        editable((g.items || []).join(', '), 'Items', 'rb-skill-items', (v) => { g.items = v.split(',').map((x) => x.trim()).filter(Boolean); scheduleSave(); })
      ))
    );
  }

  function renderLibraryPanel() {
    return h('div', {},
      h('div', { class: 'rb-side-head' },
        h('h3', {}, 'Bullet Library'),
        h('input', { id: 'rb-search', placeholder: 'Search bullets...', oninput: render })
      ),
      h('div', { class: 'rb-side-actions' },
        h('button', { onclick: addSourceExperience }, '+ Role'),
        h('button', { onclick: addSourceProject }, '+ Project'),
        h('button', { onclick: resetToDefaultResume }, 'Reset default')
      ),
      h('div', { class: 'rb-lib-list' }, renderLibraryGroups()),
      h('details', { class: 'rb-data-edit' },
        h('summary', {}, 'Edit profile, education, skills'),
        renderProfileEditor()
      )
    );
  }

  function renderLibraryGroups() {
    const q = ($('#rb-search')?.value || '').toLowerCase().trim();
    const used = new Set(allResumeBullets().map((b) => b.sourceId).filter(Boolean));
    const groups = [
      ...(model.library.experiences || []).map((x) => ({ type: 'experience', label: `${x.company || 'Role'} - ${x.title || ''}`, role: x })),
      ...(model.library.projects || []).map((x) => ({ type: 'projects', label: `${x.name || 'Project'} - ${x.subtitle || ''}`, role: x }))
    ];
    const nodes = [];
    groups.forEach((g) => {
      const bullets = (g.role.bullets || []).filter((b) => !q || stripHTML(b.text).toLowerCase().includes(q) || g.label.toLowerCase().includes(q));
      if (!bullets.length && q) return;
      const group = h('div', { class: 'rb-lib-group' },
        h('div', { class: 'rb-lib-title', draggable: 'true' }, g.label || 'Untitled')
      );
      group.querySelector('.rb-lib-title').addEventListener('dragstart', () => { drag = { type: 'role', role: g.role }; });
      bullets.forEach((b) => {
        const node = h('div', { class: 'rb-lib-bullet' + (used.has(b.id) ? ' used' : ''), draggable: 'true' },
          h('span', { class: 'rb-grip' }, '::'),
          h('span', { html: sanitizeRich(b.text) })
        );
        node.addEventListener('dragstart', () => { drag = { type: 'bullet', sourceId: b.id, text: b.text }; });
        group.append(node);
      });
      group.append(renderSourceEditor(g.role, g.type));
      nodes.push(group);
    });
    return nodes.length ? nodes : [h('div', { class: 'empty' }, h('h4', {}, 'No bullets yet'), h('div', {}, 'Add a source role or clear the search.'))];
  }

  function renderSourceEditor(src, kind) {
    return h('details', { class: 'rb-source-edit' },
      h('summary', {}, 'edit source'),
      h('label', {}, kind === 'projects' ? 'Project' : 'Company', h('input', { value: kind === 'projects' ? src.name || '' : src.company || '', oninput: (e) => { src[kind === 'projects' ? 'name' : 'company'] = e.target.value; scheduleSave(); } })),
      h('label', {}, kind === 'projects' ? 'Organization' : 'Location', h('input', { value: kind === 'projects' ? src.org || '' : src.location || '', oninput: (e) => { src[kind === 'projects' ? 'org' : 'location'] = e.target.value; scheduleSave(); } })),
      h('label', {}, kind === 'projects' ? 'Subtitle' : 'Title', h('input', { value: kind === 'projects' ? src.subtitle || '' : src.title || '', oninput: (e) => { src[kind === 'projects' ? 'subtitle' : 'title'] = e.target.value; scheduleSave(); } })),
      h('label', {}, 'Dates', h('input', { value: src.dates || '', oninput: (e) => { src.dates = e.target.value; scheduleSave(); } })),
      ...(src.bullets || []).map((b, i) => h('div', { class: 'rb-source-bullet' },
        editable(b.text, 'Source bullet', 'rb-source-rich', (v) => { b.text = v; scheduleSave(); }, true),
        h('button', { onclick: () => { src.bullets.splice(i, 1); scheduleSave(); render(); } }, 'x')
      )),
      h('button', { onclick: () => { src.bullets = src.bullets || []; src.bullets.push({ id: uid('b'), text: '' }); scheduleSave(); render(); } }, '+ bullet')
    );
  }

  function renderProfileEditor() {
    const p = model.profile;
    return h('div', { class: 'rb-profile-edit' },
      h('div', { class: 'rb-two' },
        h('label', {}, 'First name', h('input', { value: p.firstName || '', oninput: (e) => { p.firstName = e.target.value; scheduleSave(); } })),
        h('label', {}, 'Last name', h('input', { value: p.lastName || '', oninput: (e) => { p.lastName = e.target.value; scheduleSave(); } })),
        h('label', {}, 'Phone', h('input', { value: p.phone || '', oninput: (e) => { p.phone = e.target.value; scheduleSave(); } })),
        h('label', {}, 'Email', h('input', { value: p.email || '', oninput: (e) => { p.email = e.target.value; scheduleSave(); } })),
        h('label', {}, 'LinkedIn', h('input', { value: p.linkedin || '', oninput: (e) => { p.linkedin = e.target.value; scheduleSave(); } })),
        h('label', {}, 'Website', h('input', { value: p.website || '', oninput: (e) => { p.website = e.target.value; scheduleSave(); } }))
      )
    );
  }

  function addBlankItem(kind) {
    const arr = model.draft[kind];
    arr.push(kind === 'projects'
      ? { id: uid('rp'), name: '', org: '', subtitle: '', dates: '', bullets: [] }
      : { id: uid('re'), company: '', location: '', title: '', dates: '', bullets: [] });
    scheduleSave();
    render();
  }

  function addSourceExperience() {
    model.library.experiences.unshift({ id: uid('e'), company: 'New source role', location: '', title: '', dates: '', bullets: [{ id: uid('b'), text: '' }] });
    scheduleSave();
    render();
  }

  function addSourceProject() {
    model.library.projects.unshift({ id: uid('p'), name: 'New project', org: '', subtitle: '', dates: '', bullets: [{ id: uid('b'), text: '' }] });
    scheduleSave();
    render();
  }

  function addRoleFromLibrary(role, kind) {
    const isProject = kind === 'projects' || role.name;
    const item = isProject
      ? { id: uid('rp'), name: role.name || '', org: role.org || '', subtitle: role.subtitle || role.title || '', dates: role.dates || '', bullets: (role.bullets || []).map((b) => ({ id: uid('rb'), sourceId: b.id, text: b.text })) }
      : { id: uid('re'), company: role.company || '', location: role.location || '', title: role.title || '', dates: role.dates || '', bullets: (role.bullets || []).map((b) => ({ id: uid('rb'), sourceId: b.id, text: b.text })) };
    model.draft[isProject ? 'projects' : 'experience'].push(item);
    scheduleSave();
    render();
  }

  function findItem(kind, id) {
    return (model.draft[kind] || []).find((x) => x.id === id);
  }

  function findBullet(id) {
    for (const kind of ['experience', 'projects']) {
      for (const item of model.draft[kind] || []) {
        const idx = (item.bullets || []).findIndex((b) => b.id === id);
        if (idx >= 0) return { item, arr: item.bullets, idx };
      }
    }
    return null;
  }

  function allResumeBullets() {
    return [...(model.draft.experience || []), ...(model.draft.projects || [])].flatMap((x) => x.bullets || []);
  }

  function moveItem(kind, idx, delta) {
    const arr = model.draft[kind];
    const ni = idx + delta;
    if (ni < 0 || ni >= arr.length) return;
    const [it] = arr.splice(idx, 1);
    arr.splice(ni, 0, it);
    scheduleSave();
    render();
  }

  function removeItem(kind, id) {
    model.draft[kind] = (model.draft[kind] || []).filter((x) => x.id !== id);
    scheduleSave();
    render();
  }

  function syncSkillsFromProfile() {
    model.draft.skills = clone(model.profile.skills || []);
    scheduleSave();
    render();
  }

  function resetToDefaultResume() {
    if (!confirm('Reset resume builder data to the default Madhav Sehgal aerospace/CFD resume? Saved versions stay untouched.')) return;
    model.profile = clone(DEFAULT_PROFILE);
    model.library = clone(DEFAULT_LIBRARY);
    model.draft = defaultDraft(model.library, model.profile);
    scheduleSave();
    render();
  }

  function loadFromApp(id) {
    const app = (state.apps || []).find((a) => a.id === id);
    if (!app) return;
    prefillTarget({ company: app.company, role: app.role, jd: app.notes || '' });
  }

  function prefillTarget({ company = '', role = '', jd = '' } = {}) {
    ensureModel();
    if (company) model.draft.targetCompany = company;
    if (role) model.draft.targetRole = role;
    if (jd) model.draft.jobDescription = jd;
    scheduleSave();
    render();
    if (jd) runAnalysis();
  }

  function tokenize(text) {
    return (text || '').toLowerCase().replace(/[^a-z0-9+#.%\s-]/g, ' ').split(/\s+/).map((w) => w.replace(/^[^a-z0-9+#]+|[^a-z0-9+#]+$/g, '')).filter(Boolean);
  }

  function extractKeywords(text) {
    const words = tokenize(text).filter((w) => w.length > 2 && !STOP.has(w));
    const freq = new Map();
    words.forEach((w) => freq.set(w, (freq.get(w) || 0) + 1));
    const bigrams = new Map();
    for (let i = 0; i < words.length - 1; i++) {
      const bg = words[i] + ' ' + words[i + 1];
      if (!STOP.has(words[i]) && !STOP.has(words[i + 1])) bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
    }
    const out = [
      ...Array.from(bigrams.entries()).filter(([, c]) => c > 1).map(([term, weight]) => ({ term, weight: weight + 1 })),
      ...Array.from(freq.entries()).map(([term, weight]) => ({ term, weight }))
    ].sort((a, b) => b.weight - a.weight || b.term.length - a.term.length);
    const seen = new Set();
    return out.filter((x) => {
      if (seen.has(x.term)) return false;
      seen.add(x.term);
      return true;
    }).slice(0, 32);
  }

  function termInText(term, text) {
    const t = term.toLowerCase();
    if (t.includes(' ')) return text.includes(t);
    return new RegExp('(^|[^a-z0-9])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(text);
  }

  function composeResumeText() {
    const parts = [];
    model.draft.experience.forEach((x) => parts.push(x.company, x.title, ...(x.bullets || []).map((b) => stripHTML(b.text))));
    model.draft.projects.forEach((x) => parts.push(x.name, x.subtitle, ...(x.bullets || []).map((b) => stripHTML(b.text))));
    model.draft.skills.forEach((g) => parts.push(g.category, (g.items || []).join(' ')));
    return parts.join(' ').toLowerCase();
  }

  function runAnalysis() {
    const kws = extractKeywords(model.draft.jobDescription || '');
    if (!kws.length) { toast('Paste a JD first.', 'error'); return; }
    const resumeText = composeResumeText();
    const matched = new Set();
    const missing = [];
    kws.forEach((k) => termInText(k.term, resumeText) ? matched.add(k.term) : missing.push(k));
    analysis = { keywords: kws, matched, missing };
    renderAnalysis();
    decorateAnalysis();
  }

  function renderAnalysis() {
    const el = $('#rb-analysis');
    if (!el || !analysis) return;
    const pct = Math.round((analysis.matched.size / Math.max(1, analysis.keywords.length)) * 100);
    el.innerHTML = '';
    el.append(
      h('div', { class: 'rb-score' }, h('strong', {}, pct + '%'), h('span', {}, ' keyword coverage')),
      h('div', { class: 'rb-chip-row' }, h('b', {}, 'Matched'), ...Array.from(analysis.matched).slice(0, 18).map((k) => h('button', { class: 'rb-chip hit', onclick: () => copyText(k) }, k))),
      h('div', { class: 'rb-chip-row' }, h('b', {}, 'Missing'), ...analysis.missing.slice(0, 18).map((k) => h('button', { class: 'rb-chip miss', onclick: () => copyText(k.term) }, k.term)))
    );
  }

  function decorateAnalysis() {
    if (!analysis) return;
    $$('.rb-bullet-wrap').forEach((wrap) => {
      const text = stripHTML(wrap.querySelector('.rb-bullet')?.innerHTML || '').toLowerCase();
      const n = analysis.keywords.filter((k) => termInText(k.term, text)).length;
      const badge = wrap.querySelector('.rb-kw-badge');
      if (badge) {
        badge.textContent = n ? `${n} kw` : '';
        badge.style.display = n ? '' : 'none';
      }
    });
  }

  function copyTailorPrompt(b) {
    const missing = analysis ? analysis.missing.slice(0, 8).map((k) => k.term).join(', ') : 'paste JD keywords here';
    const prompt = `Rewrite this resume bullet for the ${model.draft.targetRole || '[role]'} role at ${model.draft.targetCompany || '[company]'}. Keep it truthful, one bullet, impact-first, and use exact relevant JD keywords if accurate: ${missing}\n\nBullet: ${stripHTML(b.text)}\n\nJD:\n${model.draft.jobDescription || '[paste JD]'}`;
    copyText(prompt);
    toast('Tailoring prompt copied.', 'success');
  }

  function copyText(text) {
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  function saveVersionNew() {
    const name = prompt('Version name', `${model.draft.targetCompany || 'Company'} - ${model.draft.targetRole || 'Role'}`);
    if (!name) return;
    const id = uid('rv');
    model.draft.id = id;
    model.versions.unshift({ id, name, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), draft: clone(model.draft) });
    saveNow();
    render();
  }

  function updateCurrentVersion() {
    if (!model.draft.id) { saveVersionNew(); return; }
    const v = model.versions.find((x) => x.id === model.draft.id);
    if (!v) { saveVersionNew(); return; }
    v.draft = clone(model.draft);
    v.updated_at = new Date().toISOString();
    v.name = `${model.draft.targetCompany || 'Company'} - ${model.draft.targetRole || 'Role'}`;
    saveNow();
    render();
  }

  function renderVersionList() {
    const el = $('#rb-version-list');
    if (!el) return;
    el.innerHTML = '';
    if (!model.versions.length) {
      el.append(h('div', { class: 'rb-version-empty' }, 'No saved resume versions yet.'));
      return;
    }
    model.versions.forEach((v) => {
      el.append(h('div', { class: 'rb-version-row' + (model.draft.id === v.id ? ' active' : '') },
        h('button', { onclick: () => loadVersion(v.id) }, v.name),
        h('span', {}, new Date(v.updated_at || v.created_at).toLocaleDateString()),
        h('button', { onclick: () => deleteVersion(v.id) }, 'x')
      ));
    });
  }

  function loadVersion(id) {
    const v = model.versions.find((x) => x.id === id);
    if (!v) return;
    model.draft = clone(v.draft);
    model.draft.id = id;
    analysis = null;
    saveNow(true);
    render();
  }

  function deleteVersion(id) {
    const v = model.versions.find((x) => x.id === id);
    if (!v || !confirm(`Delete saved resume "${v.name}"?`)) return;
    model.versions = model.versions.filter((x) => x.id !== id);
    if (model.draft.id === id) model.draft.id = null;
    saveNow();
    render();
  }

  function versionLabel() {
    const v = model?.versions?.find((x) => x.id === model.draft.id);
    return v ? `Editing: ${v.name}` : 'Unsaved draft';
  }

  function renderVersionLabel() {
    const el = $('#rb-version-label');
    if (el) el.textContent = versionLabel();
  }

  function buildFilename(ext) {
    const p = model.profile;
    const first = p.firstName || 'FirstName';
    const last = p.lastName || 'LastName';
    const co = (model.draft.targetCompany || 'Company').replace(/[^a-z0-9]+/gi, '');
    const role = (model.draft.targetRole || 'Role').replace(/[^a-z0-9]+/gi, '');
    return `${first}${last}_${co}_${role}_${today()}.${ext}`;
  }

  function exportWord() {
    const html = '<!doctype html><html><head><meta charset="utf-8"><style>' + wordCSS() + '</style></head><body>' + $('#rb-paper').outerHTML + '</body></html>';
    download(new Blob(['\ufeff', html], { type: 'application/msword' }), buildFilename('doc'));
  }

  function exportPDF() {
    document.body.classList.add('rb-printing');
    const title = document.title;
    document.title = buildFilename('pdf').replace(/\.pdf$/, '');
    setTimeout(() => {
      window.print();
      setTimeout(() => { document.body.classList.remove('rb-printing'); document.title = title; }, 500);
    }, 80);
  }

  function wordCSS() {
    return '.rb-paper{font-family:"Times New Roman",serif;color:#000;font-size:10.5pt;line-height:1.08}.rb-resume-head{text-align:center}.rb-name{font-size:19pt;text-transform:uppercase}.rb-contact{font-size:11pt}.rb-linkish{color:#1155cc}.rb-section{margin-top:7pt}.rb-section-title{font-weight:bold;border-bottom:1pt solid #000;text-transform:uppercase}.rb-row{display:flex;justify-content:space-between}.rb-bold{font-weight:bold}.rb-bullets{margin:2pt 0 0 18pt;padding:0}.rb-bullet{display:inline}.rb-item{margin-top:4pt}.rb-skill-cat{font-weight:bold}.no-print,.rb-item-tools,.rb-grip,.rb-mini,.rb-kw-badge,.rb-role-drop{display:none!important}';
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  window.JobResumeBuilder = { render, prefillTarget, saveNow };
})();
