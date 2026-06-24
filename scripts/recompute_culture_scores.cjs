const https = require('https');

const SERVICE_KEY = process.argv[2];
const HOST = 'ahbfxirbjjtkschutoin.supabase.co';

function request(path, body, method) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const m = method || (data ? 'POST' : 'GET');
    const opts = {
      hostname: HOST,
      path,
      method: m,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, data: JSON.parse(text) }); }
        catch { resolve({ status: res.statusCode, data: text }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const { data: rows } = await request('/rest/v1/candidates?select=id,competition_results(*),positions_of_responsibility(*)');

  const LEADERSHIP_KW = ['head','lead','core','director','president','secretary','founder','co-founder','chair'];
  const AI_KW = /\b(ai|ml|machine.?learning|deep.?learning|nlp|llm|neural|genai|generative)\b/i;
  const TOP_TIERS = new Set(['winner','runner_up','top_3']);
  const TECH_CATS = new Set(['hardware','software']);
  const LEADERSHIP_CATS = new Set(['founders_office','product_gtm']);

  function computeScore(candidate) {
    let agency = 0;
    const positions = candidate.positions_of_responsibility || [];
    const comps = candidate.competition_results || [];
    const hasLeadership = positions.some((p) =>
      LEADERSHIP_KW.some((kw) => (p.role_title || '').toLowerCase().includes(kw))
    );
    if (hasLeadership) agency += 25;
    const distinctOrgs = new Set(positions.map((p) => p.organisation_name)).size;
    if (distinctOrgs >= 2) agency += 10;
    agency = Math.min(agency, 35);

    let technical = 0;
    const hasTopResult = comps.some((c) => TOP_TIERS.has(c.result_tier));
    const hasTechComp = comps.some((c) => TECH_CATS.has(c.competition_category));
    const hasLeadershipComp = comps.some((c) => LEADERSHIP_CATS.has(c.competition_category));
    if (hasTopResult) technical += 20;
    else if (comps.length > 0) technical += 10;
    if (hasTechComp) technical += 10;
    else if (hasLeadershipComp) technical += 5;
    technical = Math.min(technical, 30);

    let initiative = 0;
    const hasBoth = comps.length > 0 && positions.length > 0;
    const compCatCount = new Set(comps.map((c) => c.competition_category)).size;
    if (hasBoth) initiative += 20;
    else if (hasLeadership && positions.length > 0) initiative += 15;
    else if (comps.length > 0 || positions.length > 0) initiative += 8;
    if (compCatCount >= 2) initiative += 5;
    initiative = Math.min(initiative, 25);

    let aiNative = 0;
    const allText = [
      ...comps.map((c) => c.competition_name),
      ...positions.map((p) => `${p.role_title} ${p.organisation_name}`),
    ].join(' ');
    if (AI_KW.test(allText)) aiNative = 10;

    return agency + technical + initiative + aiNative;
  }

  let updated = 0;
  let errors = 0;
  for (const row of rows) {
    const score = computeScore(row);
    const res = await request(`/rest/v1/candidates?id=eq.${row.id}`, { culture_score: score }, 'PATCH');
    if (res.status >= 400) {
      console.error('update failed for', row.id, res.status, res.data);
      errors++;
    } else {
      updated++;
    }
  }

  console.log(JSON.stringify({ updated, errors, total: rows.length }));
}

main().catch((e) => { console.error(e); process.exit(1); });
