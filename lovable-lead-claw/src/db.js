// Supabase REST store (project ladk). Tables already exist: lovable_leads, lovable_lead_runs, lovable_lead_cursors.
export function createDb({ url, key, fetch: f = globalThis.fetch }) {
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const base = `${url.replace(/\/$/, '')}/rest/v1`;
  const hdr = (extra = {}) => ({ apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...extra });

  async function call(path, { method = 'GET', body, prefer, headers } = {}) {
    const res = await f(`${base}/${path}`, {
      method,
      headers: hdr({ ...(prefer ? { Prefer: prefer } : {}), ...headers }),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`supabase ${method} ${path.split('?')[0]} -> ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res;
  }
  const json = async (res) => (res.status === 204 ? [] : (await res.json().catch(() => [])));
  async function count(query) {
    const res = await call(`lovable_leads?select=id&${query}`, { headers: { Prefer: 'count=exact', Range: '0-0' } });
    return Number((res.headers.get('content-range') || '').split('/')[1]) || 0;
  }

  return {
    async ping() {
      try { await call('lovable_lead_cursors?select=source&limit=1'); }
      catch (e) { throw new Error(`Supabase unreachable, aborting run: ${e.message}`); }
    },
    async insertLeads(rows) {
      const seen = new Set();
      const uniq = rows.filter((r) => { const k = r.email.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
      if (!uniq.length) return [];
      const res = await call('lovable_leads?on_conflict=email', { method: 'POST', body: uniq, prefer: 'resolution=ignore-duplicates,return=representation' });
      return json(res);
    },
    async existingRepos(repos) {
      if (!repos.length) return new Set();
      const list = repos.map((r) => `"${r}"`).join(',');
      const rows = await json(await call(`lovable_leads?select=repo&repo=in.(${encodeURIComponent(list)})`));
      return new Set(rows.map((r) => r.repo));
    },
    // email -> Set of repos it has been seen on (unique email: its row repo + data.repos added by addRepo)
    async emailRepos(emails) {
      const out = new Map();
      if (!emails.length) return out;
      const list = emails.map((e) => `"${e}"`).join(',');
      const rows = await json(await call(`lovable_leads?select=email,repo,data&email=in.(${encodeURIComponent(list)})`));
      for (const r of rows) out.set(r.email.toLowerCase(), new Set([r.repo, ...(r.data?.repos || [])].filter(Boolean)));
      return out;
    },
    async addRepo(email, repo) {
      const q = `email=eq.${encodeURIComponent(email)}`;
      const [row] = await json(await call(`lovable_leads?select=data&${q}`));
      if (!row) return;
      const repos = [...new Set([...(row.data?.repos || []), repo])];
      await call(`lovable_leads?${q}`, { method: 'PATCH', body: { data: { ...(row.data || {}), repos } }, prefer: 'return=minimal' });
    },
    async rejectEmail(email) {
      await call(`lovable_leads?email=eq.${encodeURIComponent(email)}&enrolled_by=is.null&status=eq.new`, { method: 'PATCH', body: { status: 'rejected' }, prefer: 'return=minimal' });
    },
    async getCursor(source) {
      const rows = await json(await call(`lovable_lead_cursors?select=cursor&source=eq.${source}`));
      return rows[0]?.cursor ?? null;
    },
    async setCursor(source, cursor) {
      await call('lovable_lead_cursors?on_conflict=source', { method: 'POST', body: { source, cursor, updated_at: new Date().toISOString() }, prefer: 'resolution=merge-duplicates,return=minimal' });
    },
    // Firecrawl: rows never scraped, oldest id first. firstSeen = only today's new rows; before = only older rows (backfill).
    async leadsNeedingSite({ firstSeen, before, afterId = 0, limit = 200 }) {
      const q = ['select=id,email,source,name,domain,url,repo,company,first_seen,data', 'status=neq.rejected', 'data->site=is.null', `id=gt.${afterId}`, 'order=id.asc', `limit=${limit}`];
      if (firstSeen) q.push(`first_seen=eq.${firstSeen}`);
      if (before) q.push(`first_seen=lt.${before}`);
      return json(await call(`lovable_leads?${q.join('&')}`));
    },
    async setSite(row, site) {
      await call(`lovable_leads?id=eq.${row.id}`, { method: 'PATCH', body: { data: { ...(row.data || {}), site } }, prefer: 'return=minimal' });
    },
    async siteForDomain(domain) {
      const rows = await json(await call(`lovable_leads?select=data&domain=eq.${encodeURIComponent(domain)}&data->site->>status=eq.ok&limit=1`));
      return rows[0]?.data?.site || null;
    },
    async firecrawlPagesSince(iso) {
      const rows = await json(await call(`lovable_lead_runs?select=scanned&source=eq.firecrawl&run_at=gte.${encodeURIComponent(iso)}&limit=1000`));
      return rows.reduce((a, r) => a + Number(r.scanned || 0), 0);
    },
    async logRun(run) {
      await call('lovable_lead_runs', { method: 'POST', body: { run_at: new Date().toISOString(), ...run }, prefer: 'return=minimal' });
    },
    async countsSince(dayIso, monthStartIso) {
      const [github, apify, total, unsent, newGithub, newApify, scraped, unscraped, viaSiteToday] = await Promise.all([
        count('source=eq.github'), count('source=eq.apify_linkedin'), count('id=gt.0'), count('enrolled_by=is.null'),
        count(`source=eq.github&created_at=gte.${dayIso}`), count(`source=eq.apify_linkedin&created_at=gte.${dayIso}`),
        count('data->site=not.is.null'), count('status=neq.rejected&data->site=is.null'), count(`data->>via=eq.site&created_at=gte.${dayIso}`),
      ]);
      const runs = await json(await call(`lovable_lead_runs?select=source,scanned,spend_usd,ok,notes,run_at&run_at=gte.${monthStartIso}&order=run_at.desc&limit=1000`));
      const today = runs.filter((r) => r.run_at >= dayIso);
      const sum = (rs) => Math.round(rs.reduce((a, r) => a + Number(r.spend_usd || 0), 0) * 1e4) / 1e4;
      const allApify = await json(await call('lovable_lead_runs?select=spend_usd&source=eq.apify_linkedin&limit=100000'));
      const allGh = await json(await call('lovable_lead_runs?select=scanned&source=eq.github&limit=100000'));
      return {
        total, unsent, scraped, unscraped, viaSiteToday, pagesToday: today.filter((r) => r.source === 'firecrawl').reduce((a, r) => a + (r.scanned || 0), 0), bySource: { github, apify_linkedin: apify },
        newToday: { github: newGithub, apify_linkedin: newApify },
        spendToday: sum(today), spendMonth: sum(runs), spendTotal: sum(allApify),
        githubScanned: today.filter((r) => r.source === 'github').reduce((a, r) => a + (r.scanned || 0), 0),
        githubScannedTotal: allGh.reduce((a, r) => a + (r.scanned || 0), 0),
        errors: today.filter((r) => r.ok === false).map((r) => `${r.source}: ${r.notes}`),
      };
    },
  };
}
