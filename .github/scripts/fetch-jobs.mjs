// Daily jobs fetcher — runs in GitHub Actions, writes to Supabase.
// Sources: Greenhouse + Lever per target company, JSearch (RapidAPI) per keyword query.
// Scores: keyword overlap against pasted resume_text in settings.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const OWNER_TOKEN = process.env.OWNER_TOKEN;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OWNER_TOKEN) {
  console.error('Missing required env: SUPABASE_URL / SUPABASE_SERVICE_KEY / OWNER_TOKEN');
  process.exit(1);
}

const STOPWORDS = new Set('a an and are as at be by for from has have i in is it its of on or that the to was were will with you your we our this their they them his her my our we us also can do does into not but if then so than such which who whom what where when how all any some most more many much each every other any one two three years year using used use work works working role roles position experience'.split(' '));

function extractKeywords(text) {
  if (!text) return [];
  const toks = (text + '').toLowerCase().replace(/[^a-z0-9+#./\-\s]/g, ' ').split(/\s+/).filter(Boolean);
  const set = new Set();
  for (const t of toks) {
    const cleaned = t.replace(/^[-./]+|[-./]+$/g, '');
    if (cleaned.length < 3) continue;
    if (STOPWORDS.has(cleaned)) continue;
    set.add(cleaned);
  }
  return Array.from(set);
}

function scoreJob(job, keywords) {
  if (keywords.length === 0) return 0;
  const haystack = ((job.title || '') + ' ' + (job.description || '') + ' ' + (job.location || '')).toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (haystack.includes(kw)) hits++;
  }
  return hits;
}

function slugVariants(name) {
  const base = (name || '').toLowerCase().trim();
  if (!base) return [];
  const noSpace = base.replace(/[^a-z0-9]/g, '');
  const dashed = base.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const underscored = base.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  return Array.from(new Set([noSpace, dashed, underscored].filter(Boolean)));
}

function parseAtsSlugs(text) {
  // Format: "Company Name:slug:platform, ..."  e.g. "OpenAI:openai:greenhouse"
  if (!text) return [];
  return text.split(/[,\n]/).map(s => s.trim()).filter(Boolean).map(line => {
    const parts = line.split(':').map(p => p.trim());
    return { company: parts[0], slug: parts[1] || parts[0], platform: (parts[2] || '').toLowerCase() };
  });
}

const SINCE = Date.now() - 24 * 60 * 60 * 1000; // last 24h

async function fetchGreenhouse(slug, displayCompany) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.jobs) return [];
    return data.jobs.filter(j => new Date(j.updated_at || j.created_at).getTime() >= SINCE).map(j => ({
      title: j.title,
      company: displayCompany,
      location: j.location && j.location.name,
      url: j.absolute_url,
      posted_at: new Date(j.updated_at || j.created_at).toISOString(),
      source: 'greenhouse',
      description: stripHtml(j.content || '').slice(0, 4000)
    }));
  } catch (e) {
    console.warn(`Greenhouse ${slug} failed:`, e.message);
    return [];
  }
}

async function fetchLever(slug, displayCompany) {
  const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.filter(j => new Date(j.createdAt || 0).getTime() >= SINCE).map(j => ({
      title: j.text,
      company: displayCompany,
      location: j.categories && j.categories.location,
      url: j.hostedUrl || j.applyUrl,
      posted_at: new Date(j.createdAt).toISOString(),
      source: 'lever',
      description: ((j.descriptionPlain || '') + ' ' + (j.lists || []).map(l => l.text + ' ' + (l.content || '')).join(' ')).slice(0, 4000)
    }));
  } catch (e) {
    console.warn(`Lever ${slug} failed:`, e.message);
    return [];
  }
}

async function fetchJSearch(query) {
  if (!RAPIDAPI_KEY) {
    console.log('Skipping JSearch (no RAPIDAPI_KEY set)');
    return [];
  }
  const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&date_posted=today&num_pages=1`;
  try {
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
      }
    });
    if (!res.ok) { console.warn(`JSearch ${query} ${res.status}`); return []; }
    const data = await res.json();
    if (!data.data) return [];
    return data.data.map(j => ({
      title: j.job_title,
      company: j.employer_name,
      location: [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', '),
      url: j.job_apply_link || j.job_google_link,
      posted_at: j.job_posted_at_datetime_utc || null,
      source: 'jsearch',
      description: (j.job_description || '').slice(0, 4000)
    })).filter(j => j.url);
  } catch (e) {
    console.warn(`JSearch ${query} failed:`, e.message);
    return [];
  }
}

function stripHtml(s) {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

async function supaFetch(path, opts = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
      ...(opts.headers || {})
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${path} ${res.status}: ${body}`);
  }
  return res.status === 204 ? null : res.json();
}

async function main() {
  console.log('Fetching settings...');
  const settings = await supaFetch(`settings?owner_token=eq.${encodeURIComponent(OWNER_TOKEN)}&select=*`);
  if (!settings || settings.length === 0) {
    console.error('No settings row for owner token; abort.');
    return;
  }
  const s = settings[0];
  const targets = (s.targets || '').split(/[,\n]/).map(x => x.trim()).filter(Boolean);
  const queries = (s.jsearch_queries || '').split(/[,\n]/).map(x => x.trim()).filter(Boolean);
  const slugConfig = parseAtsSlugs(s.ats_slugs || '');
  const keywords = extractKeywords(s.resume_text || s.focus || '');
  console.log(`Targets: ${targets.length}, JSearch queries: ${queries.length}, Resume keywords: ${keywords.length}`);

  const allJobs = [];

  // Greenhouse + Lever for each target
  for (const company of targets) {
    const explicit = slugConfig.filter(c => c.company.toLowerCase() === company.toLowerCase());
    if (explicit.length) {
      for (const ex of explicit) {
        if (ex.platform === 'greenhouse' || !ex.platform) {
          allJobs.push(...await fetchGreenhouse(ex.slug, company));
        }
        if (ex.platform === 'lever' || !ex.platform) {
          allJobs.push(...await fetchLever(ex.slug, company));
        }
      }
    } else {
      // Try slug variants on both ATS
      for (const slug of slugVariants(company)) {
        const gh = await fetchGreenhouse(slug, company);
        if (gh.length) { allJobs.push(...gh); break; }
      }
      for (const slug of slugVariants(company)) {
        const lv = await fetchLever(slug, company);
        if (lv.length) { allJobs.push(...lv); break; }
      }
    }
  }

  // JSearch keyword queries
  for (const q of queries) {
    allJobs.push(...await fetchJSearch(q));
  }

  // Dedup by URL
  const byUrl = new Map();
  for (const j of allJobs) {
    if (!j.url) continue;
    if (!byUrl.has(j.url)) byUrl.set(j.url, j);
  }
  const unique = Array.from(byUrl.values());
  console.log(`Total unique jobs in last 24h: ${unique.length}`);

  // Score and prepare rows
  const rows = unique.map(j => ({
    owner_token: OWNER_TOKEN,
    title: (j.title || '').slice(0, 500),
    company: (j.company || '').slice(0, 200),
    location: (j.location || '').slice(0, 200),
    url: j.url,
    posted_at: j.posted_at,
    source: j.source,
    description: (j.description || '').slice(0, 4000),
    relevance_score: scoreJob(j, keywords)
  }));

  if (rows.length === 0) {
    console.log('No rows to insert.');
    return;
  }

  // Upsert in chunks of 100 (on owner_token+url unique index)
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    await supaFetch('jobs_feed?on_conflict=owner_token,url', {
      method: 'POST',
      body: JSON.stringify(chunk)
    });
  }

  // Trim entries older than 14 days
  await supaFetch(`jobs_feed?owner_token=eq.${encodeURIComponent(OWNER_TOKEN)}&fetched_at=lt.${new Date(Date.now() - 14 * 86400000).toISOString()}`, {
    method: 'DELETE'
  });

  console.log(`Inserted/updated ${rows.length} jobs.`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
