// ============================================================
// JOB COMMAND - Resume Builder
// Static PWA module: stores profile/library/draft/versions in the
// token-protected settings row and exports ATS-friendly Word/PDF.
// ============================================================

(function () {
  'use strict';

  const STOP = new Set('a an and are as at be by can for from has have in into is it its of on or our per that the their this to with we will you your role team teams using use used work working experience experienced strong preferred seek involves ability responsibilities qualifications basic minimum plus across within through under over'.split(' '));

  const DEFAULT_SUMMARY = 'M.S. Aerospace Engineering student (Space Systems) at the University of Michigan with hands-on experience across aerospace system design, integration, analysis, and test. Proven ability to translate requirements into verifiable architecture, execute multidisciplinary trade studies, and support environmental testing campaigns including vibration and thermal vacuum. Strong background in systems engineering, MBSE, structures, CFD, and test-to-analysis traceability through industry-sponsored research. INCOSE ASEP Certified. Seeking a full-time Aerospace or Systems Engineering role starting May 2026.';

  const DEFAULT_PUBLICATIONS = [
    'Sehgal, M., et al. (2026). "Numerical Study of Shock Train Effects on Mixed-Compression Air-Intake Performance." FLAME, Springer.',
    'Trikha, S., Sehgal, M., et al. (2024). "Numerical Study of Shock-Wave/Boundary-Layer Interaction Control Using Variable Pressure and Inlet Size." FLAME, Springer.',
    'Sehgal, M., et al. (2023). "Comparative Study of Natural Frequency of a C-141 Airfoil Wing and Cantilever Beam: Simulation and Experimental Investigation." Modern Research in Aerospace Engineering, Springer.',
    'Sehgal, M. (2023). "Lagrangian Bases for Sustainable Satellite Operations, Refueling Hubs, and Multiplanetary Missions." AIAA Regional Student Conference, Paper 2023-77024.',
    'Sehgal, M. (2019). "Wireless Sensor Network for Dynamic Discovery and Avoidance via Position Verification." Intl. Journal of Inventions in Electrical & Electronics Engineering, Vol. 5.',
    'Sehgal, M. (2018). "RFID Adaptor for Detecting and Handling Data/Events in the Internet of Things." Intl. Journal of Innovations in Applied Sciences & Engineering, Vol. 4.'
  ];

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
        dates: 'May 2026 (Expected)',
        details: [
          'Coursework: Rocket Propulsion, Structural Dynamics, Finite Element Method, Spacecraft Systems Engineering, MBSE',
          'Graduate Student Instructor: AERO/SPACE 582 (Spacecraft Systems Engineering)'
        ]
      },
      {
        school: 'Amity University',
        location: 'Uttar Pradesh, India',
        degree: 'Bachelor of Technology in Aerospace Engineering (Hons. in Spacecraft Engineering)',
        dates: 'May 2024',
        details: ['Relevant Coursework: Aircraft Structures, Composite Structures, Strength of Materials, Finite Element Analysis']
      }
    ],
    skills: [
      { category: 'Systems Engineering', items: ['MBSE (SysML, MagicDraw)', 'requirements traceability', 'V&V', 'trade studies', 'CONOPS', 'WBS', 'FMEA/PFMEA/PFA', 'ICD', 'INCOSE ASEP'] },
      { category: 'Structural Analysis', items: ['FEA', 'modal analysis', 'vibration analysis', 'stress & deformation analysis', 'mesh convergence', 'composite structures', 'ANSYS Workbench/APDL', 'ABAQUS', 'NASTRAN'] },
      { category: 'CFD & Aerodynamics', items: ['ANSYS Fluent', 'OpenFOAM', 'STAR-CCM+', 'RANS/LES', 'SST k-ω turbulence modeling', 'SBLI', 'HyperMesh'] },
      { category: 'Test & Qualification', items: ['thermal-vacuum (TVAC)', 'vibration testing', 'NDT', 'GEVS', 'MIL-STD compliance', 'configuration control', 'LabVIEW', 'Arduino', 'wind tunnel operations'] },
      { category: 'CAD & Design', items: ['SOLIDWORKS', 'CATIA V5', 'Creo', 'Fusion 360', 'AutoCAD'] },
      { category: 'Programming & Data', items: ['Python (TensorFlow, PyTorch, NumPy, Pandas)', 'MATLAB', 'C/C++', 'FORTRAN', 'SQL', 'Flask', 'HTML/CSS/JS', 'Git'] },
      { category: 'Space Tools', items: ['STK', 'Thermal Desktop', 'ORDEM', 'MASTER'] },
      { category: 'Certifications', items: ['INCOSE Associate Systems Engineering Professional (ASEP), Feb 2026', 'ISRO Space Science & Technology Awareness Training (START), Jul 2023'] }
    ],
    publications: DEFAULT_PUBLICATIONS.slice()
  };

  const DEFAULT_LIBRARY = {
    experiences: [
      {
        id: 'e_sprl', company: 'Space Physics Research Lab (SPRL), University of Michigan', location: 'Ann Arbor, MI',
        title: 'Systems Engineering Intern', dates: 'May 2025 – Aug 2025',
        bullets: [
          { id: 'b_sprl_1', text: 'Developed <b>TestBedz</b>, a full-stack Flask/Python platform to manage TVAC, vibration, and NDT test workflows with structured GEVS/MIL-STD compliance checks, reducing test-request errors by <b>40%</b> and now used in active flight-hardware campaigns' },
          { id: 'b_sprl_2', text: 'Created WBS, PFMEA, and PFA templates and automated test-procedure generation, cutting documentation time from <b>4 hours to 90 minutes</b> per campaign while establishing QC frameworks adopted as lab standards' },
          { id: 'b_sprl_3', text: 'Developed system-level CONOPS and a web dashboard with database backend for trade studies, V&V planning, test tracking, and resource allocation, giving real-time visibility across multi-program test schedules' },
          { id: 'b_sprl_4', text: 'Coordinated environmental test campaigns (thermal-vacuum and vibration qualification) including setup, configuration control, and documentation across flight-hardware programs' }
        ]
      },
      {
        id: 'e_gdi', company: 'Gas Dynamics Imaging Laboratory, University of Michigan', location: 'Ann Arbor, MI',
        title: 'Graduate Student Researcher', dates: 'May 2025 – Aug 2025',
        bullets: [
          { id: 'b_gdi_1', text: 'Developed a <b>Bayesian Neural Network</b> in Python/TensorFlow to predict shock-train position in supersonic isolators, achieving <b>99.6%</b> predictive accuracy with quantified uncertainty bounds for pre-test computational screening' },
          { id: 'b_gdi_2', text: 'Created a physics-constrained synthetic data-generation tool so generated supersonic flow fields satisfy conservation equations and match experimental statistics, addressing sparse training data' },
          { id: 'b_gdi_3', text: 'Built a Python synchronization pipeline mapping <b>500+</b> experimental pressure-tap measurements to CFD mesh nodes, resolving spatial discrepancies that previously blocked experimental-numerical comparison' }
        ]
      },
      {
        id: 'e_aero', company: 'Aerodynamics Laboratory, Amity University', location: 'Noida, India',
        title: 'Undergraduate Researcher (CFD & Wind Tunnel)', dates: 'Aug 2023 – May 2024',
        bullets: [
          { id: 'b_aero_1', text: 'Ran 3D RANS simulations in ANSYS Fluent for a <b>Mach 3</b> supersonic inlet with mesh-independence studies from <b>2M–8M cells</b> and SST k-ω modeling, converging within <b>2%</b> of published benchmarks' },
          { id: 'b_aero_2', text: 'Designed passive and active micro-vortex generators that <b>doubled pressure recovery</b> across supersonic inlet configurations through CFD-driven iteration' },
          { id: 'b_aero_3', text: 'Operated low-speed wind tunnels — Pitot-static calibration, smoke flow visualization, and LabVIEW/Arduino data acquisition — combining experimental and computational results into multiple publications' }
        ]
      },
      {
        id: 'e_cabs', company: 'Centre for Airborne Systems, Defence Research & Development Organisation (DRDO)', location: 'Bangalore, India',
        title: 'Engineering Research Intern', dates: 'May 2023 – June 2023',
        bullets: [
          { id: 'b_cabs_1', text: 'Developed a CATIA parametric model of a drogue-and-probe aerial refueling system for the IL-78MKI tanker and ran coupled CFD-structural analysis in ANSYS at <b>Mach 0.7</b> cruise, improving modeled fuel-transfer efficiency <b>15%</b> through geometry optimization' },
          { id: 'b_cabs_2', text: 'Validated CFD predictions with potential-flow theory and empirical drag correlations in MATLAB, achieving <b>97%</b> correlation and catching a mesh-resolution error that would have compromised accuracy' },
          { id: 'b_cabs_3', text: 'Conducted modal and vibration analysis of the refueling-pod structure under aerodynamic forcing, evaluating natural frequencies and mode shapes for resonance avoidance and validating against MIL-STD-810' }
        ]
      },
      {
        id: 'e_asl', company: 'Advanced Systems Laboratory, Defence Research & Development Organisation (DRDO)', location: 'Hyderabad, India',
        title: 'Structural Engineering Intern', dates: 'May 2022 – June 2022',
        bullets: [
          { id: 'b_asl_1', text: 'Built a detailed 3D structural model of a space launch vehicle in SOLIDWORKS as a baseline for static, dynamic, and modal load evaluation under launch conditions' },
          { id: 'b_asl_2', text: 'Performed finite-element structural and modal analyses in ANSYS Workbench and APDL, identifying critical vibration modes and verifying vehicle survivability under launch forces, with a report of design-optimization recommendations' },
          { id: 'b_asl_3', text: 'Validated natural-frequency results with MATLAB analytical models, achieving <b>98%</b> agreement between analytical and numerical methods and improving simulation fidelity <b>15%</b>' }
        ]
      },
      {
        id: 'e_jarwiz', company: 'JarWiz', location: 'New Delhi, India',
        title: 'Founder & CEO', dates: 'Aug 2020 – May 2024',
        bullets: [
          { id: 'b_jw_1', text: 'Founded JarWiz, a Microsoft-partnered pre-seed initiative connecting underprivileged students in India with STEM mentorship, career guidance, and experiential learning to reduce opportunity inequality' },
          { id: 'b_jw_2', text: 'Designed and led structured learning and outreach programs by translating industry skill gaps into practical development opportunities for resource-constrained learners' },
          { id: 'b_jw_3', text: 'Built networks with student organizations and professionals to expand access to workshops, internships, and experiential learning opportunities' }
        ]
      }
    ],
    projects: [
      {
        id: 'p_lps', name: 'Lunar Position System using MBSE (Northrop Grumman)', org: 'University of Michigan',
        subtitle: 'Systems Engineer', dates: 'Aug 2025 – Dec 2025',
        bullets: [
          { id: 'b_lps_1', text: 'Developed a SysML architecture in MagicDraw for a lunar navigation constellation, tracing stakeholder needs through functional allocation to subsystem and hardware definitions with block and internal block diagrams' },
          { id: 'b_lps_2', text: 'Established a requirements verification matrix linking <b>47</b> system requirements to test, analysis, inspection, or demonstration methods' },
          { id: 'b_lps_3', text: 'Conducted trade studies on constellation geometry, inter-satellite ranging, and atomic-clock synchronization, defending feasibility at milestone reviews with faculty and Northrop Grumman sponsors' }
        ]
      },
      {
        id: 'p_iced', name: 'Identification & Characterization Expedition for Debris Tracking (ICED)', org: 'University of Michigan',
        subtitle: 'Systems Engineer (Thermal & Structures Lead)', dates: 'Aug 2024 – Apr 2025',
        bullets: [
          { id: 'b_iced_1', text: 'Led a <b>14-person</b> team developing a constellation architecture for <b>1 mm</b> orbital-debris detection, linking mission requirements to satellite count, altitude, and sensor FOV via STK trade studies, FMEA, and WBS' },
          { id: 'b_iced_2', text: 'Defined the mission debris environment with MASTER and ORDEM to constrain detection requirements and design assumptions' },
          { id: 'b_iced_3', text: 'Ran thermal and structural FEA verifying satellite-bus survivability under launch vibration and on-orbit thermal cycling (Thermal Desktop), integrating results into mass and power budgets for PDR' }
        ]
      },
      {
        id: 'p_cubesat', name: 'Miniature Amity Satellite System (3U CubeSat)', org: 'Amity University',
        subtitle: 'Chief Systems Engineer / Team Lead', dates: 'Dec 2022 – May 2024',
        bullets: [
          { id: 'b_cs_1', text: 'Established a university CubeSat program coordinating <b>18</b> members across structures, payload, communications, and ground systems, with interface-control documentation to prevent design drift' },
          { id: 'b_cs_2', text: 'Designed a cross-Yagi UHF telemetry antenna and ran link-budget analysis showing a <b>3 W</b> transmitter could close a <b>450 km</b> link with the ground station' },
          { id: 'b_cs_3', text: 'Secured facilities, equipment, and funding through technical presentations to university leadership, building lasting CubeSat capability for later cohorts' }
        ]
      },
      {
        id: 'p_satagri', name: 'Satellite Geospatial Intelligence for Agriculture', org: 'University of Michigan',
        subtitle: 'Independent Research (Prof. Steve Battel)', dates: 'Jan 2026 – Present',
        bullets: [
          { id: 'b_sa_1', text: 'Building automated ML pipelines that turn <b>13-band</b> multispectral satellite imagery into crop-health maps and actionable irrigation and fertilizer recommendations for precision agriculture' },
          { id: 'b_sa_2', text: 'Processing satellite telemetry to flag crop-stress indicators before visible symptoms, applying aerospace remote-sensing methods to food-security challenges' }
        ]
      },
      {
        id: 'p_panel', name: 'Composite and Isotropic Panel Stress Analysis', org: 'University of Michigan',
        subtitle: 'Graduate Project', dates: 'Jan 2025 – Apr 2025',
        bullets: [
          { id: 'b_pan_1', text: 'Developed MATLAB FEM solvers for displacement, strain, and stress prediction across isotropic and composite structural panels' },
          { id: 'b_pan_2', text: 'Validated FEA accuracy with mesh-refinement and convergence studies under mechanical and thermal loading' },
          { id: 'b_pan_3', text: 'Studied fiber-orientation effects on stiffness, stress distribution, and deformation in composite structures' }
        ]
      },
      {
        id: 'p_herc', name: 'NASA Human Exploration Rover Challenge (HERC)', org: 'Amity University',
        subtitle: 'Team Lead', dates: 'Sep 2020 – May 2023',
        bullets: [
          { id: 'b_herc_1', text: 'Led a <b>12-person</b> multidisciplinary team across three NASA HERC cycles, coordinating design, fabrication, testing, and post-test failure reviews for a human-powered lunar rover' },
          { id: 'b_herc_2', text: 'Developed FMEA for steering, suspension, and drivetrain, validating designs at <b>2×</b> expected operational loads to prevent repeat failures' },
          { id: 'b_herc_3', text: 'Earned the <b>NASA Safety Award (2021)</b>, a first in the nation, through a test-based hazard-mitigation process' }
        ]
      },
      {
        id: 'p_wing', name: 'Aircraft Wing Modal Analysis & Experimental Validation', org: 'Amity University',
        subtitle: 'Student Researcher (Springer 2023)', dates: 'Jan 2022 – May 2022',
        bullets: [
          { id: 'b_wing_1', text: 'Compared natural frequencies of a C-141-based aircraft wing and a cantilever beam through simulation and experimental modal analysis' },
          { id: 'b_wing_2', text: 'Performed modal analysis in ANSYS Workbench and tested a <b>1:61</b> scaled 3D-printed wing and beam to correlate simulated and measured response' },
          { id: 'b_wing_3', text: 'Assessed mode shapes and resonance risk to inform wing-stabilization concepts such as damping and structural reinforcement' }
        ]
      },
      {
        id: 'p_launch', name: 'Three-Stage Launch Vehicle Design', org: 'University of Michigan',
        subtitle: 'AEROSP 535 — Rocket Propulsion', dates: 'Aug 2024 – Dec 2024',
        bullets: [
          { id: 'b_lv_1', text: 'Designed a <b>74 m, 836,146 kg</b> three-stage launch vehicle to deliver <b>1,000 kg</b> to low lunar orbit through iterative mass optimization' },
          { id: 'b_lv_2', text: 'Sized RP-1/LOX, CH4/LOX, and LH2/LOX stages to meet a total <b>ΔV of 17.6 km/s</b>, including combustion chambers, nozzles, and injectors' },
          { id: 'b_lv_3', text: 'Validated stage design by computing propulsion flow properties in <b>NASA CEA</b> and performing hoop-stress sizing in Python and MATLAB' }
        ]
      }
    ]
  };

  // Focused starter résumés — pick one (chip or search) to load a draft curated
  // for that track. Each references source roles/bullets from the library above.
  const DEFAULT_PRESETS = [
    { id: 'full', short: 'Everything', name: 'Everything (full library)', search: 'everything full all master complete', full: true, summary: DEFAULT_SUMMARY },
    {
      id: 'systems', short: 'Systems', name: 'Systems Engineering / MBSE',
      search: 'systems engineering mbse sysml requirements verification v&v incose',
      summary: 'Aerospace Systems Engineer (M.S., University of Michigan; INCOSE ASEP) focused on MBSE, requirements traceability, and V&V. Experience leading multidisciplinary teams through trade studies, FMEA, and verification planning and supporting flight-hardware qualification campaigns. Seeking a full-time Systems Engineering role starting May 2026.',
      exp: [{ src: 'e_sprl' }, { src: 'e_cabs', bullets: ['b_cabs_1', 'b_cabs_3'] }],
      proj: [{ src: 'p_lps' }, { src: 'p_iced' }, { src: 'p_cubesat' }],
      skills: ['Systems Engineering', 'Test & Qualification', 'Space Tools', 'Programming & Data', 'CAD & Design', 'Certifications']
    },
    {
      id: 'structures', short: 'Structures', name: 'Structures / Structural Analysis',
      search: 'structures structural fea modal vibration mechanical stress',
      summary: 'Aerospace Structural Engineer (M.S., University of Michigan) with hands-on FEA, modal, and vibration analysis across launch-vehicle, satellite, and aircraft structures in ANSYS, ABAQUS, and SOLIDWORKS, plus thermal-vacuum and vibration qualification testing. Seeking a full-time Structural / Mechanical Engineering role starting May 2026.',
      exp: [{ src: 'e_asl' }, { src: 'e_cabs', bullets: ['b_cabs_3', 'b_cabs_2', 'b_cabs_1'] }, { src: 'e_sprl', bullets: ['b_sprl_4', 'b_sprl_2'] }],
      proj: [{ src: 'p_panel' }, { src: 'p_wing' }, { src: 'p_iced', bullets: ['b_iced_3', 'b_iced_1'] }],
      skills: ['Structural Analysis', 'Test & Qualification', 'CAD & Design', 'CFD & Aerodynamics', 'Programming & Data', 'Certifications']
    },
    {
      id: 'cfd', short: 'CFD', name: 'CFD & Aerodynamics',
      search: 'cfd aerodynamics aero fluid dynamics propulsion supersonic',
      summary: 'Aerospace CFD & Aerodynamics Engineer (M.S., University of Michigan) experienced in 3D RANS/LES, SST k-ω turbulence modeling, SBLI flow control, and supersonic inlet design in ANSYS Fluent and OpenFOAM, validated against wind-tunnel experiments and analytical theory. Seeking a full-time Aerodynamics / CFD role starting May 2026.',
      exp: [{ src: 'e_gdi' }, { src: 'e_aero' }, { src: 'e_cabs', bullets: ['b_cabs_1', 'b_cabs_2'] }],
      proj: [{ src: 'p_launch' }, { src: 'p_wing' }],
      skills: ['CFD & Aerodynamics', 'Structural Analysis', 'Programming & Data', 'CAD & Design', 'Test & Qualification']
    },
    {
      id: 'ml', short: 'ML / Software', name: 'ML, Data & Software',
      search: 'ml machine learning data software python full-stack flask developer',
      summary: 'Aerospace engineer (M.S., University of Michigan) building production ML and full-stack software for aerospace data — Bayesian neural networks with uncertainty quantification, satellite remote-sensing pipelines, and a deployed Flask/Python test-management platform. Seeking a role at the intersection of aerospace, data, and software starting May 2026.',
      exp: [{ src: 'e_sprl', bullets: ['b_sprl_1', 'b_sprl_3', 'b_sprl_2'] }, { src: 'e_gdi' }],
      proj: [{ src: 'p_satagri' }, { src: 'p_lps', bullets: ['b_lps_1', 'b_lps_2'] }],
      skills: ['Programming & Data', 'Systems Engineering', 'CFD & Aerodynamics', 'Space Tools', 'Certifications']
    }
  ];

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

  // Keep only bold/italic/underline; preserve nesting; unwrap everything else.
  const RICH_TAGS = { B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u' };
  function escapeText(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function sanitizeRich(html) {
    const src = document.createElement('div');
    src.innerHTML = html || '';
    const walk = (node) => {
      let out = '';
      node.childNodes.forEach((c) => {
        if (c.nodeType === 3) { out += escapeText(c.nodeValue); return; }
        if (c.nodeType !== 1) return;
        if (c.tagName === 'BR') { out += '<br>'; return; }
        const inner = walk(c);
        const tag = RICH_TAGS[c.tagName];
        if (tag) { out += inner ? `<${tag}>${inner}</${tag}>` : ''; }
        else if (c.tagName === 'DIV' || c.tagName === 'P') { out += (out && !out.endsWith('<br>') ? '<br>' : '') + inner; }
        else out += inner;
      });
      return out;
    };
    return walk(src).replace(/&nbsp;/g, ' ').replace(/(<br>){3,}/g, '<br><br>').trim();
  }

  // ---- local-first persistence (works even before the v2.6 SQL migration) ----
  let cloudResumeDisabled = false; // flips true if the resume_* columns are missing
  let migrationNoticeShown = false;
  function lsKey() { return 'jrb_resume_' + (userToken || 'local'); }
  function loadLocal() { try { return JSON.parse(localStorage.getItem(lsKey()) || 'null'); } catch (e) { return null; } }
  function saveLocal(m) {
    try { localStorage.setItem(lsKey(), JSON.stringify({ profile: m.profile, library: m.library, draft: m.draft, versions: m.versions })); } catch (e) {}
  }

  function ensureModel() {
    if (model) return model;
    const s = state.settings || {};
    const local = loadLocal() || {};
    // Cloud (Supabase) wins when the columns exist and hold data; otherwise fall
    // back to this device's localStorage; otherwise the seeded default resume.
    const profile = s.resume_profile || local.profile || clone(DEFAULT_PROFILE);
    const library = s.resume_library || local.library || clone(DEFAULT_LIBRARY);
    const draft = s.resume_draft || local.draft || defaultDraft(library, profile);
    const cloudVersions = Array.isArray(s.resume_versions) && s.resume_versions.length ? s.resume_versions : null;
    const versions = cloudVersions || (Array.isArray(local.versions) ? local.versions : []);
    if (profile.publications == null) profile.publications = clone(DEFAULT_PUBLICATIONS);
    model = { profile, library, draft, versions };
    ensureDraftShape(model.draft);
    return model;
  }

  function buildDraftFromPreset(preset) {
    if (preset.full) { const d = defaultDraft(model.library, model.profile); d.summaryText = preset.summary || DEFAULT_SUMMARY; return d; }
    const exp = model.library.experiences || [], proj = model.library.projects || [], prof = model.profile;
    const pick = (srcBullets, ids) => (ids && ids.length ? ids.map((bid) => (srcBullets || []).find((b) => b.id === bid)).filter(Boolean) : (srcBullets || []));
    const mapExp = (spec) => { const e = exp.find((x) => x.id === spec.src); if (!e) return null; return { id: uid('re'), company: e.company, location: e.location, title: e.title, dates: e.dates, bullets: pick(e.bullets, spec.bullets).map((b) => ({ id: uid('rb'), sourceId: b.id, text: b.text })) }; };
    const mapProj = (spec) => { const p = proj.find((x) => x.id === spec.src); if (!p) return null; return { id: uid('rp'), name: p.name, org: p.org, subtitle: p.subtitle, dates: p.dates, bullets: pick(p.bullets, spec.bullets).map((b) => ({ id: uid('rb'), sourceId: b.id, text: b.text })) }; };
    const skills = (preset.skills && preset.skills.length ? preset.skills.map((c) => (prof.skills || []).find((g) => g.category === c)).filter(Boolean) : (prof.skills || [])).map((g) => clone(g));
    return {
      id: null, targetCompany: '', targetRole: '', jobDescription: '',
      includeSummary: true, summaryText: preset.summary || DEFAULT_SUMMARY,
      includePublications: true, fontPt: 10.5,
      experience: (preset.exp || []).map(mapExp).filter(Boolean),
      projects: (preset.proj || []).map(mapProj).filter(Boolean),
      skills: skills
    };
  }
  function confirmAndLoadPreset(preset) {
    if (!window.confirm('Load the "' + preset.name + '" template? This replaces the resume in the center. Saved versions and your library are not affected.')) return;
    model.draft = buildDraftFromPreset(preset);
    analysis = null;
    saveNow();
    render();
    toast('Loaded the "' + preset.name + '" template.', 'success');
  }
  function tryLoadPreset(value) {
    const v = (value || '').toLowerCase().trim();
    if (!v) return;
    let preset = DEFAULT_PRESETS.find((p) => p.name.toLowerCase() === v || (p.short || '').toLowerCase() === v);
    if (!preset) preset = DEFAULT_PRESETS.find((p) => p.name.toLowerCase().includes(v) || (p.short || '').toLowerCase().includes(v) || (p.search || '').includes(v));
    if (!preset) preset = DEFAULT_PRESETS.find((p) => v.split(/\s+/).some((w) => w.length > 1 && (p.search || '').includes(w)));
    if (!preset) { toast('No template matches "' + value + '". Try: structures, systems, CFD, ML, everything.', 'error'); return; }
    confirmAndLoadPreset(preset);
  }

  function defaultDraft(library, profile) {
    return {
      id: null,
      targetCompany: '',
      targetRole: '',
      jobDescription: '',
      includeSummary: true,
      summaryText: DEFAULT_SUMMARY,
      includePublications: true,
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
    if (typeof d.fontPt !== 'number') d.fontPt = 10.5;
    if (typeof d.includePublications !== 'boolean') d.includePublications = true;
  }

  const MIGRATION_SQL = [
    "alter table settings add column if not exists resume_profile jsonb;",
    "alter table settings add column if not exists resume_library jsonb;",
    "alter table settings add column if not exists resume_draft jsonb;",
    "alter table settings add column if not exists resume_versions jsonb default '[]'::jsonb;",
    "notify pgrst, 'reload schema';"
  ].join('\n');

  function isSchemaError(error) {
    if (!error) return false;
    if (error.code === 'PGRST204' || error.code === '42703') return true;
    return /schema cache|could not find the .* column|column .* does not exist/i.test(error.message || '');
  }

  async function saveNow(silent = false) {
    const m = ensureModel();
    // mirror into in-memory settings + always persist locally (never fails)
    state.settings.resume_profile = m.profile;
    state.settings.resume_library = m.library;
    state.settings.resume_draft = m.draft;
    state.settings.resume_versions = m.versions;
    saveLocal(m);
    if (!supabase || !userToken || cloudResumeDisabled) {
      if (!silent && !cloudResumeDisabled) toast('Resume saved on this device.', 'success');
      return;
    }
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
      if (isSchemaError(error)) {
        // DB hasn't had the v2.6 migration applied — keep working locally.
        cloudResumeDisabled = true;
        setSyncState('online');
        showMigrationNotice();
        return;
      }
      setSyncState('error');
      toast('Resume cloud sync failed: ' + error.message + ' (saved on this device)', 'error');
      return;
    }
    setSyncState('online');
    if (!silent) toast('Resume saved.', 'success');
  }

  function showMigrationNotice() {
    const el = $('#rb-sync-notice');
    if (el) el.classList.remove('hidden');
    if (!migrationNoticeShown) {
      migrationNoticeShown = true;
      toast('Resume saved on this device. Run the SQL in the orange banner to enable cloud sync.', 'success');
    }
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
    // Rich fields also persist on input so toolbar/keyboard formatting is saved
    // immediately (execCommand fires an 'input' event) without waiting for blur.
    if (rich) el.addEventListener('input', () => onSave(sanitizeRich(el.innerHTML)));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !rich) { e.preventDefault(); el.blur(); }
    });
    return el;
  }

  function render() {
    const root = $('#resume-builder-root');
    if (!root) return;
    ensureModel();
    ensureFormatToolbar();
    root.innerHTML = '';
    root.append(
      h('div', { class: 'rb-shell' },
        h('div', { class: 'rb-center' }, renderCommandBar(), renderTargetPanel(), renderPaper()),
        h('aside', { class: 'rb-library' }, renderLibraryPanel())
      )
    );
    renderVersionList();
    decorateAnalysis();
    const paper = $('#rb-paper');
    if (paper) paper.addEventListener('input', debouncedFit);
    fitPaper();
  }

  // --- fit the fixed 8.5in page into whatever width the column gives us ---
  // Uses CSS `zoom` (not transform) so the layout box shrinks too: the column
  // sizes correctly, nothing overlaps the library, and the caret stays accurate.
  let fitInstalled = false;
  const PAGE_W = 816; // 8.5in at the CSS-fixed 96px/in
  function fitPaper() {
    const wrap = $('.rb-paper-wrap');
    const paper = $('#rb-paper');
    if (!wrap || !paper) return;
    // wrap.clientWidth is the (un-zoomed) column width; compare to the fixed page width.
    const scale = Math.min(1, wrap.clientWidth / PAGE_W);
    paper.style.zoom = scale < 0.995 ? String(scale) : '';
    if (!fitInstalled) { fitInstalled = true; window.addEventListener('resize', debouncedFit); }
  }
  let fitTimer = null;
  function debouncedFit() { clearTimeout(fitTimer); fitTimer = setTimeout(fitPaper, 120); }

  // --- text formatting toolbar (bold / italic / underline) ---
  let activeRich = null;
  const RICH_SEL = '.rb-bullet, .rb-summary, .rb-source-rich';
  function ensureFormatToolbar() {
    if (document.getElementById('rb-fmt-bar')) return;
    const mkBtn = (label, cmd, title, cls) => h('button', {
      class: 'rb-fmt-btn ' + (cls || ''), title,
      onmousedown: (e) => { e.preventDefault(); },
      onclick: () => applyFormat(cmd)
    }, label);
    const bar = h('div', { id: 'rb-fmt-bar', class: 'rb-fmt-bar' },
      mkBtn('B', 'bold', 'Bold (⌘/Ctrl+B)', 'rb-fmt-bold'),
      mkBtn('I', 'italic', 'Italic (⌘/Ctrl+I)', 'rb-fmt-ital'),
      mkBtn('U', 'underline', 'Underline (⌘/Ctrl+U)', 'rb-fmt-und'),
      h('span', { class: 'rb-fmt-sep' }),
      mkBtn('⨯', 'removeFormat', 'Clear formatting', 'rb-fmt-clear')
    );
    document.body.append(bar);
    document.addEventListener('focusin', (e) => {
      const t = e.target;
      if (t && t.matches && t.matches(RICH_SEL)) { activeRich = t; positionFmtBar(t); bar.classList.add('show'); }
    });
    document.addEventListener('focusout', () => {
      setTimeout(() => {
        const a = document.activeElement;
        if (!a || !(a.matches && a.matches(RICH_SEL))) { bar.classList.remove('show'); activeRich = null; }
      }, 150);
    });
    document.addEventListener('selectionchange', updateFmtState);
    window.addEventListener('resize', () => { if (activeRich) positionFmtBar(activeRich); });
    window.addEventListener('scroll', () => { if (activeRich) positionFmtBar(activeRich); }, true);
  }
  function applyFormat(cmd) {
    try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
    document.execCommand(cmd, false, null);
    updateFmtState();
    if (activeRich) activeRich.focus(); // input event from execCommand persists the change
  }
  function positionFmtBar(el) {
    const bar = document.getElementById('rb-fmt-bar');
    if (!bar) return;
    const r = el.getBoundingClientRect();
    // hide if the field has scrolled out of view (avoids a detached toolbar)
    if (r.bottom < 4 || r.top > window.innerHeight - 4) { bar.classList.remove('show'); return; }
    const top = r.top - 40 < 8 ? r.bottom + 6 : r.top - 40; // flip below if no room above
    bar.style.top = Math.max(8, top) + 'px';
    bar.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 180)) + 'px';
  }
  function updateFmtState() {
    const bar = document.getElementById('rb-fmt-bar');
    if (!bar || !bar.classList.contains('show')) return;
    const set = (sel, cmd) => { const b = bar.querySelector(sel); if (b) { let on = false; try { on = document.queryCommandState(cmd); } catch (e) {} b.classList.toggle('active', on); } };
    set('.rb-fmt-bold', 'bold'); set('.rb-fmt-ital', 'italic'); set('.rb-fmt-und', 'underline');
  }

  function renderCommandBar() {
    const d = model.draft;
    const appOptions = (state.apps || []).map((a) => h('option', { value: a.id }, `${a.company} - ${a.role}`));
    return h('div', { class: 'rb-command' },
      h('div', { id: 'rb-sync-notice', class: 'rb-sync-notice' + (cloudResumeDisabled ? '' : ' hidden') },
        h('div', {}, h('strong', {}, 'Saved on this device. '), 'To sync resumes across all devices, run this once in Supabase → SQL Editor:'),
        h('button', { class: 'rb-mini', onclick: () => { copyText(MIGRATION_SQL); toast('Migration SQL copied — paste it into the Supabase SQL editor and Run.', 'success'); } }, 'Copy SQL')
      ),
      h('div', { class: 'rb-preset-bar' },
        h('span', { class: 'rb-preset-label' }, 'Template:'),
        ...DEFAULT_PRESETS.map((p) => h('button', { class: 'rb-preset-chip', title: p.name, onclick: () => confirmAndLoadPreset(p) }, p.short)),
        h('input', { id: 'rb-preset-search', class: 'rb-preset-search', list: 'rb-preset-list', placeholder: 'search: structures, systems, CFD, ML…',
          onkeydown: (e) => { if (e.key === 'Enter') { tryLoadPreset(e.target.value); e.target.value = ''; } },
          onchange: (e) => { tryLoadPreset(e.target.value); e.target.value = ''; } }),
        h('datalist', { id: 'rb-preset-list' }, ...DEFAULT_PRESETS.map((p) => h('option', { value: p.name })))
      ),
      h('div', { class: 'rb-target-grid' },
        h('label', {}, 'Company', h('input', { id: 'rb-company', value: d.targetCompany || '', oninput: (e) => { d.targetCompany = e.target.value; scheduleSave(); renderVersionLabel(); } })),
        h('label', {}, 'Role', h('input', { id: 'rb-role', value: d.targetRole || '', oninput: (e) => { d.targetRole = e.target.value; scheduleSave(); renderVersionLabel(); } })),
        h('label', {}, 'Load from tracked job', h('select', { id: 'rb-app-select', onchange: (e) => loadFromApp(e.target.value) },
          h('option', { value: '' }, 'Choose application...'), appOptions))
      ),
      h('div', { class: 'rb-actions' },
        h('button', { class: 'primary', onclick: saveVersionNew }, '+ Save version'),
        h('button', { onclick: updateCurrentVersion }, 'Update'),
        h('div', { class: 'rb-font-step', title: 'Resume font size' },
          h('button', { onclick: () => setFontPt(-0.5) }, 'A−'),
          h('span', { id: 'rb-font-label' }, (d.fontPt || 10.5) + 'pt'),
          h('button', { onclick: () => setFontPt(0.5) }, 'A+')
        ),
        h('button', { class: d.includeSummary ? 'primary' : '', title: 'Show/hide the summary section', onclick: () => { d.includeSummary = !d.includeSummary; scheduleSave(); render(); } }, 'Summary'),
        h('button', { class: d.includePublications ? 'primary' : '', title: 'Show/hide the publications section', onclick: () => { d.includePublications = !d.includePublications; scheduleSave(); render(); } }, 'Pubs'),
        h('button', { onclick: exportWord }, 'Word'),
        h('button', { onclick: exportPDF }, 'PDF')
      ),
      h('div', { class: 'rb-version-bar' },
        h('div', { id: 'rb-version-label', class: 'rb-version-label' }, versionLabel()),
        h('div', { id: 'rb-version-list', class: 'rb-version-list' })
      )
    );
  }

  function setFontPt(delta) {
    const d = model.draft;
    d.fontPt = Math.round(Math.min(14, Math.max(8, (d.fontPt || 10.5) + delta)) * 2) / 2;
    const paper = $('#rb-paper');
    if (paper) paper.style.fontSize = d.fontPt + 'pt';
    const lbl = $('#rb-font-label');
    if (lbl) lbl.textContent = d.fontPt + 'pt';
    scheduleSave();
    fitPaper();
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
      h('div', { id: 'rb-paper', class: 'rb-paper', style: 'font-size:' + (d.fontPt || 10.5) + 'pt' },
        h('header', { class: 'rb-resume-head' },
          h('div', { class: 'rb-name' }, `${p.firstName || ''} ${p.lastName || ''}`.trim().toUpperCase() || 'YOUR NAME'),
          h('div', { class: 'rb-contact' }, contactParts(p).map((c, i) => h('span', { class: c.link ? 'rb-linkish' : '' }, (i ? ' • ' : '') + c.text)))
        ),
        d.includeSummary ? renderSummary() : null,
        renderEducation(),
        renderItems('EXPERIENCE', d.experience, 'experience'),
        renderItems('PROJECT', d.projects, 'projects'),
        renderSkills(),
        (d.includePublications && (p.publications || []).length) ? renderPublications() : null
      )
    );
  }

  function renderPublications() {
    const pubs = model.profile.publications || [];
    return h('section', { class: 'rb-section' },
      sectionTitle('PUBLICATIONS', h('button', { class: 'rb-mini no-print', onclick: () => { model.profile.publications = model.profile.publications || []; model.profile.publications.push(''); scheduleSave(); render(); } }, '+ add')),
      h('ol', { class: 'rb-pubs' }, ...pubs.map((t, i) => h('li', { class: 'rb-pub' },
        editable(t, 'Publication citation', 'rb-pub-text', (v) => { model.profile.publications[i] = v; scheduleSave(); }),
        h('button', { class: 'rb-mini no-print rb-pub-x', title: 'Remove', onclick: () => { model.profile.publications.splice(i, 1); scheduleSave(); render(); } }, 'x')
      )))
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
      editable(model.draft.summaryText || '', 'Optional tailored summary...', 'rb-summary', (v) => { model.draft.summaryText = v; scheduleSave(); }, true)
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

  function dropIndex(ul, clientY) {
    const wraps = Array.from(ul.querySelectorAll('.rb-bullet-wrap'));
    for (let i = 0; i < wraps.length; i++) {
      const r = wraps[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return wraps.length;
  }

  function attachBulletDrop(ul) {
    ul.addEventListener('dragover', (e) => {
      if (drag && (drag.type === 'bullet' || drag.type === 'move')) { e.preventDefault(); ul.classList.add('rb-drop-active'); }
    });
    ul.addEventListener('dragleave', (e) => { if (!ul.contains(e.relatedTarget)) ul.classList.remove('rb-drop-active'); });
    ul.addEventListener('drop', (e) => {
      e.preventDefault();
      ul.classList.remove('rb-drop-active');
      const item = findItem(ul.dataset.kind, ul.dataset.id);
      if (!item || !drag) return;
      item.bullets = item.bullets || [];
      let idx = dropIndex(ul, e.clientY);
      if (drag.type === 'bullet') {
        item.bullets.splice(idx, 0, { id: uid('rb'), sourceId: drag.sourceId, text: drag.text });
      } else if (drag.type === 'move') {
        const loc = findBullet(drag.id);
        if (loc) {
          // adjust target index if moving down within the same list past the removed slot
          if (loc.arr === item.bullets && loc.idx < idx) idx -= 1;
          const [moved] = loc.arr.splice(loc.idx, 1);
          item.bullets.splice(Math.max(0, idx), 0, moved);
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
        h('button', { class: 'primary', onclick: openImportModal }, '⎘ Paste / Import'),
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

  // ============================================================
  // Paste & import: parse pasted resume text into the library/profile
  // ============================================================
  function parseResumeText(raw) {
    const result = { experiences: [], projects: [], education: [], skills: [] };
    if (!raw || !raw.trim()) return result;

    const MONTHS = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
    const YEAR = '(?:19|20)\\d{2}';
    const dateToken = '(?:' + MONTHS + '\\s*,?\\s*)?(?:' + YEAR + ')';
    const rangeRe = new RegExp('(' + dateToken + '|present|current)\\s*(?:[\\-\\u2013\\u2014]|to|until)\\s*(' + dateToken + '|present|current|now)', 'i');
    const singleRe = new RegExp('(?:' + dateToken + '|present|current)', 'i');
    const bulletRe = /^\s*(?:[•▪◦‣·●○⁃∙*]|[-–—]|\d+[.)])\s+(.*)$/;
    const locRe = /([A-Z][A-Za-z.\-' ]+,\s*(?:[A-Z]{2}|[A-Z][a-zA-Z]+))\s*$/;

    const sectionOf = (raw0) => {
      const t = raw0.replace(/[:•\-\s]+$/, '').trim();
      if (t.length > 32) return null;
      if (/^(work\s+|professional\s+|relevant\s+)?(experience|employment|work history)$/i.test(t)) return 'experience';
      if (/^(projects?|personal projects?|academic projects?|selected projects?)$/i.test(t)) return 'projects';
      if (/^(education|academics?)$/i.test(t)) return 'education';
      if (/^(technical\s+|core\s+)?(skills|competencies|technologies|tools|skills?\s*&\s*tools)$/i.test(t)) return 'skills';
      if (/^(summary|objective|profile|about|certifications?|awards?|honou?rs?|publications?|activities|leadership|volunteer(ing)?|interests|references|contact|coursework)$/i.test(t)) return 'other';
      return null;
    };
    const extractDate = (s) => {
      let m = s.match(rangeRe);
      if (m) return { date: m[0].replace(/\s+/g, ' ').trim(), rest: (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).trim() };
      m = s.match(singleRe);
      if (m) return { date: m[0].trim(), rest: (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).trim() };
      return { date: '', rest: s };
    };
    const extractLoc = (s) => {
      const m = s.match(locRe);
      if (m) return { loc: m[1].trim(), rest: s.slice(0, m.index).trim() };
      return { loc: '', rest: s };
    };
    const clean = (s) => (s || '').replace(/^[\s–—\-|,•]+|[\s–—\-|,•]+$/g, '').trim();

    // Bucket lines by section (default to experience until a header appears)
    const buckets = { experience: [], projects: [], education: [], skills: [], other: [] };
    let section = 'experience';
    (raw.replace(/\r/g, '').split('\n')).forEach((line) => {
      const norm = line.replace(/\t/g, '  ');
      const sec = sectionOf(norm.trim());
      if (sec) { section = sec; return; }
      buckets[section].push(norm);
    });

    const headerToFields = (hdr, kind) => {
      let a = '', b = '', loc = '', date = '';
      const cleaned = hdr.map((x) => x.trim()).filter(Boolean).map((l) => {
        let r = l;
        if (!date) { const d = extractDate(r); if (d.date) { date = d.date; r = d.rest; } }
        const lc = extractLoc(r); if (!loc && lc.loc) { loc = lc.loc; r = lc.rest; }
        return clean(r);
      }).filter(Boolean);
      a = cleaned[0] || '';
      b = cleaned[1] || '';
      if (!b && /\s[–—|]\s|\s-\s|,\s/.test(a)) {
        const parts = a.split(/\s+[–—|]\s+|\s-\s|,\s+/).map(clean).filter(Boolean);
        if (parts.length >= 2) { a = parts[0]; b = parts.slice(1).join(', '); }
      }
      return { a, b, loc, date };
    };

    const parseBlocks = (lines, onEntry) => {
      let header = [], entry = null;
      const flush = () => {
        if (entry) onEntry(entry, true);
        else if (header.length) onEntry({ header: header.slice() }, false);
        header = []; entry = null;
      };
      for (const line of lines) {
        if (!line.trim()) { if (entry) flush(); continue; }
        const bm = line.match(bulletRe);
        if (bm) {
          if (!entry) { entry = { header: header.slice(), bullets: [] }; header = []; }
          entry.bullets.push(clean(bm[1]));
        } else {
          if (entry) { flush(); header = [line]; } else header.push(line);
        }
      }
      flush();
    };

    const roles = (lines, kind) => {
      const out = [];
      parseBlocks(lines, (e) => {
        const f = headerToFields(e.header || [], kind);
        const bullets = (e.bullets || []).map((t) => ({ id: uid('b'), text: escapeText(t) }));
        if (kind === 'projects') {
          let name = f.a, org = f.loc;
          if (!org && /\s[–—|]\s/.test(name)) { const parts = name.split(/\s+[–—|]\s+/).map(clean).filter(Boolean); name = parts[0]; org = parts.slice(1).join(' '); }
          out.push({ id: uid('p'), name: name, org: org, subtitle: f.b, dates: f.date, bullets });
        } else out.push({ id: uid('e'), company: f.a, location: f.loc, title: f.b, dates: f.date, bullets });
      });
      return out.filter((r) => (kind === 'projects' ? r.name : r.company) || r.bullets.length);
    };

    result.experiences = roles(buckets.experience, 'experience');
    result.projects = roles(buckets.projects, 'projects');

    // Education is usually header-only with no blank separators, so delimit
    // each entry by its date-bearing line instead of by blank lines.
    {
      let cur = null;
      const blank = () => ({ school: '', degree: '', location: '', dates: '', details: [] });
      const push = () => { if (cur && (cur.school || cur.degree || cur.details.length)) result.education.push(cur); cur = null; };
      for (const line of buckets.education) {
        if (!line.trim()) { push(); continue; }
        const bm = line.match(bulletRe);
        if (bm) { if (!cur) cur = blank(); cur.details.push(escapeText(clean(bm[1]))); continue; }
        if (!cur) cur = blank();
        let r = line.trim(); let hadDate = false;
        const d = extractDate(r); if (d.date) { if (!cur.dates) cur.dates = d.date; r = d.rest; hadDate = true; }
        const lc = extractLoc(r); if (lc.loc) { if (!cur.location) cur.location = lc.loc; r = lc.rest; }
        r = clean(r);
        if (r) { if (!cur.school) cur.school = r; else if (!cur.degree) cur.degree = r; else cur.degree += ' ' + r; }
        if (hadDate) push(); // a date line ends the education entry
      }
      push();
    }

    buckets.skills.forEach((line) => {
      const t = clean(line.replace(/^[•▪◦·\-*]\s*/, ''));
      if (!t) return;
      const ci = t.indexOf(':');
      if (ci > 0 && ci < 42) result.skills.push({ category: t.slice(0, ci).trim(), items: t.slice(ci + 1).split(/[,;|]/).map((x) => x.trim()).filter(Boolean) });
      else { const items = t.split(/[,;|·•]/).map((x) => x.trim()).filter(Boolean); if (items.length) result.skills.push({ category: '', items }); }
    });

    return result;
  }

  function openImportModal() {
    let parsed = null;
    const overlay = h('div', { class: 'rb-modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
    const ta = h('textarea', { class: 'rb-import-ta', placeholder: 'Paste your full resume or experience here.\n\nTip: keep section headers (EXPERIENCE, PROJECTS, EDUCATION, SKILLS) and bullet points (•, -) for the cleanest results. Everything is editable after import.' });
    const summary = h('div', { class: 'rb-import-summary' });
    const doParse = () => {
      parsed = parseResumeText(ta.value);
      summary.innerHTML = '';
      const nb = parsed.experiences.reduce((n, r) => n + r.bullets.length, 0) + parsed.projects.reduce((n, r) => n + r.bullets.length, 0);
      summary.append(h('div', { class: 'rb-import-counts' },
        `Found: ${parsed.experiences.length} role(s), ${nb} bullet(s), ${parsed.projects.length} project(s), ${parsed.education.length} education, ${parsed.skills.length} skill group(s)`));
      const prev = h('div', { class: 'rb-import-preview' });
      parsed.experiences.concat(parsed.projects.map((p) => ({ company: p.name, title: p.subtitle, location: p.org, dates: p.dates, bullets: p.bullets }))).forEach((r) => {
        prev.append(h('div', { class: 'rb-import-item' },
          h('div', {}, h('strong', {}, r.company || '(untitled)'), r.title ? ' — ' + r.title : ''),
          (r.location || r.dates) ? h('div', { class: 'rb-import-meta' }, [r.location, r.dates].filter(Boolean).join('  ·  ')) : null,
          ...r.bullets.slice(0, 3).map((b) => h('div', { class: 'rb-import-bul' }, '• ' + stripHTML(b.text))),
          r.bullets.length > 3 ? h('div', { class: 'rb-import-meta' }, '+' + (r.bullets.length - 3) + ' more') : null
        ));
      });
      summary.append(prev);
    };
    const apply = (replace) => {
      if (!parsed) doParse();
      if (!parsed.experiences.length && !parsed.projects.length && !parsed.education.length && !parsed.skills.length) { toast('Nothing detected — paste some text and click Parse.', 'error'); return; }
      if (replace) { model.library.experiences = []; model.library.projects = []; }
      model.library.experiences = (model.library.experiences || []).concat(parsed.experiences);
      model.library.projects = (model.library.projects || []).concat(parsed.projects);
      if (parsed.education.length) { if (replace) model.profile.education = []; model.profile.education = (model.profile.education || []).concat(parsed.education); }
      if (parsed.skills.length) { if (replace) model.profile.skills = []; model.profile.skills = (model.profile.skills || []).concat(parsed.skills); }
      if (replace) { model.draft = defaultDraft(model.library, model.profile); }
      saveNow();
      overlay.remove();
      render();
      toast(replace ? 'Imported — your resume now shows everything you pasted.' : 'Added to your library. Drag roles/bullets into the resume.', 'success');
    };
    overlay.append(h('div', { class: 'rb-modal' },
      h('div', { class: 'rb-modal-head' }, h('strong', {}, 'Paste & import résumé'), h('button', { class: 'rb-mini', onclick: () => overlay.remove() }, 'Close')),
      ta,
      h('div', { class: 'rb-modal-actions' },
        h('button', { onclick: doParse }, 'Parse preview'),
        h('button', { class: 'primary', onclick: () => apply(false) }, 'Add to library'),
        h('button', { onclick: () => apply(true) }, 'Replace everything')
      ),
      summary
    ));
    document.body.append(overlay);
    setTimeout(() => ta.focus(), 30);
  }

  // Build clean, self-contained resume HTML from the MODEL (not the live DOM),
  // so app classes / contenteditable / flexbox can't leak into the output.
  // `forWord` adds MS-Word page setup; otherwise it's for the print iframe.
  function buildResumeHTML(forWord) {
    const p = model.profile;
    const d = model.draft;
    const fpt = d.fontPt || 10.5;
    const esc = escapeText;
    const row = (left, right, bold) => {
      const bs = bold ? 'font-weight:bold;' : '';
      return '<table style="width:100%;border-collapse:collapse;margin:0;table-layout:fixed"><tr>' +
        '<td style="text-align:left;padding:0;' + bs + '">' + (left || '') + '</td>' +
        '<td style="text-align:right;white-space:nowrap;padding:0;width:34%;' + bs + '">' + (right || '') + '</td></tr></table>';
    };
    const heading = (t) => '<p style="font-weight:bold;text-transform:uppercase;border-bottom:1px solid #000;font-size:' + fpt + 'pt;margin:8pt 0 3pt 0">' + t + '</p>';
    const bullets = (arr) => (arr && arr.length)
      ? '<ul style="margin:2pt 0 0 0.26in;padding:0">' + arr.map((b) => '<li style="margin:0 0 1pt 0;font-size:' + fpt + 'pt">' + (b.text || '') + '</li>').join('') + '</ul>'
      : '';

    let body = '';
    body += '<p style="text-align:center;font-size:19pt;margin:0;text-transform:uppercase">' + esc(((p.firstName || '') + ' ' + (p.lastName || '')).trim()) + '</p>';
    const cps = contactParts(p).map((c) => c.link ? '<span style="color:#1155cc">' + esc(c.text) + '</span>' : esc(c.text)).join(' &bull; ');
    body += '<p style="text-align:center;font-size:11pt;margin:2pt 0 0 0">' + cps + '</p>';

    if ((p.education || []).length) {
      body += heading('Education');
      p.education.forEach((e) => {
        body += row(esc(e.school), esc(e.location), true) + row(esc(e.degree), esc(e.dates), false);
        (e.details || []).forEach((x) => { if (x) body += '<p style="margin:0;font-size:' + fpt + 'pt">' + esc(x) + '</p>'; });
      });
    }
    if (d.includeSummary && d.summaryText) {
      body += heading('Summary') + '<p style="margin:0;font-size:' + fpt + 'pt">' + d.summaryText + '</p>';
    }
    if ((d.experience || []).length) {
      body += heading('Experience');
      d.experience.forEach((it) => { body += row(esc(it.company), esc(it.location), true) + row(esc(it.title), esc(it.dates), false) + bullets(it.bullets); });
    }
    if ((d.projects || []).length) {
      body += heading('Project');
      d.projects.forEach((it) => { body += row(esc(it.name), esc(it.org), true) + row(esc(it.subtitle), esc(it.dates), false) + bullets(it.bullets); });
    }
    if ((d.skills || []).length) {
      body += heading('Skills');
      d.skills.forEach((g) => { body += '<p style="margin:0 0 1pt 0;font-size:' + fpt + 'pt"><b>' + esc(g.category) + ':</b> ' + esc((g.items || []).join(', ')) + '</p>'; });
    }
    const pubs = (d.includePublications !== false ? (p.publications || []) : []).filter((x) => x && x.trim());
    if (pubs.length) {
      body += heading('Publications');
      body += '<ol style="margin:2pt 0 0 0.22in;padding:0">' + pubs.map((t) => '<li style="margin:0 0 1pt 0;font-size:' + fpt + 'pt">' + esc(t) + '</li>').join('') + '</ol>';
    }

    if (forWord) {
      return '<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8">' +
        '<style>@page Section1 { size:8.5in 11.0in; margin:0.5in; } div.Section1 { page:Section1; } ' +
        'body,p,td,li,span,div { font-family:\'Times New Roman\',serif; } p { line-height:1.12; } </style></head>' +
        '<body><div class="Section1" style="font-size:' + fpt + 'pt;color:#000">' + body + '</div></body></html>';
    }
    return '<!doctype html><html><head><meta charset="utf-8">' +
      '<style>@page { size:letter; margin:0.5in; } html,body{margin:0;padding:0;background:#fff;color:#000;font-family:\'Times New Roman\',serif;font-size:' + fpt + 'pt;line-height:1.12} p{margin:0} </style></head>' +
      '<body>' + body + '</body></html>';
  }

  function exportWord() {
    const html = buildResumeHTML(true);
    download(new Blob(['\ufeff', html], { type: 'application/msword' }), buildFilename('doc'));
  }

  // Print a clean white iframe containing ONLY the resume \u2014 no dark app
  // background, no extra blank pages.
  function exportPDF() {
    const html = buildResumeHTML(false).replace('<head>', '<head><title>' + buildFilename('pdf').replace(/\.pdf$/, '') + '</title>');
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(iframe);
    const idoc = iframe.contentWindow.document;
    idoc.open(); idoc.write(html); idoc.close();
    let printed = false;
    const go = () => {
      if (printed) return; printed = true;
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) {}
      setTimeout(() => iframe.remove(), 2000);
    };
    iframe.onload = go;
    setTimeout(go, 400); // fallback if onload doesn't fire for a written doc
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
