// Only origin-level counts leave the observer. No titles, paths, queries or page content.
export const learningKey = 'learningV1';
export const learningOrigins = ['https://*/*'];
const dayMS = 86400000;
const retentionDays = 30;
const maxSites = 100;
const ignoredHosts = new Set(['www.google.com', 'www.bing.com', 'duckduckgo.com']);

export function emptyLearning(enabled = false) {
  return { enabled, sites: [], dismissed: [], generation: 0 };
}
export function siteOrigin(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || ignoredHosts.has(url.hostname)) return null;
    return url.origin;
  } catch { return null; }
}
export function pruneLearning(state, now = Date.now()) {
  const cutoff = Math.floor(now / dayMS) - retentionDays + 1;
  const pruned = { ...emptyLearning(), ...state,
    sites: (state?.sites || []).filter(site => siteOrigin(site.origin) === site.origin).map(site => ({ ...site,
      days: (site.days || []).filter(day => day.day >= cutoff && day.day <= Math.floor(now / dayMS))
    })).filter(site => site.days.length).sort((a, b) => b.lastVisit - a.lastVisit).slice(0, maxSites),
    dismissed: (state?.dismissed || []).filter(origin => siteOrigin(origin) === origin).slice(-maxSites)
  };
  // A cache can contain host-derived names and its signature contains origins.
  // Remove it when expired or when any referenced origin has aged out.
  if (pruned.cache) {
    let origins;
    try { origins = JSON.parse(pruned.cache.signature); } catch {}
    const retained = new Set(pruned.sites.map(site => site.origin));
    if (!(pruned.cache.until > now) || !Array.isArray(origins) || origins.some(origin => !retained.has(origin))) delete pruned.cache;
  }
  return pruned;
}
export function recordVisit(state, tab, now = Date.now()) {
  if (!state?.enabled || tab?.incognito !== false || !tab.active || tab.status !== 'complete') return state;
  const origin = siteOrigin(tab.url);
  if (!origin || state.dismissed?.includes(origin)) return state;
  const next = structuredClone(pruneLearning(state, now));
  let site = next.sites.find(item => item.origin === origin);
  // Reloads, redirect chains and rapid tab switching count as one visit.
  if (site && now - site.lastVisit < 30 * 60000) return state;
  if (!site) { site = { origin, days: [], lastVisit: now }; next.sites.push(site); }
  const day = Math.floor(now / dayMS);
  const bucket = site.days.find(item => item.day === day);
  if (bucket) bucket.count = Math.min(20, bucket.count + 1);
  else site.days.push({ day, count: 1 });
  site.lastVisit = now;
  return pruneLearning(next, now);
}
export function uniqueKeyword(preferred, used) {
  let base = String(preferred).toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^[^a-z]+/, '').slice(0, 16) || 'site';
  let key = base;
  for (let i = 2; used.has(key); i++) key = `${base}${i}`;
  used.add(key);
  return key;
}
export function suggestSites(state, entries, now = Date.now()) {
  if (!state?.enabled) return [];
  const existing = new Set(entries.map(entry => new URL(entry.template).origin));
  const used = new Set(entries.map(entry => entry.keyword));
  return pruneLearning(state, now).sites.map(site => ({ ...site,
    visits: site.days.reduce((sum, day) => sum + day.count, 0),
    score: site.days.reduce((sum, day) => sum + day.count * Math.pow(0.93, Math.floor(now / dayMS) - day.day), 0)
  })).filter(site => site.visits >= 3 && site.days.length >= 2 && !existing.has(site.origin) && !state.dismissed.includes(site.origin))
    .sort((a, b) => b.score - a.score || a.origin.localeCompare(b.origin)).slice(0, 3).map(site => {
      const host = new URL(site.origin).hostname.replace(/^www\./, '');
      const parts = host.split('.');
      const label = ['dash', 'app', 'console', 'en'].includes(parts[0]) && parts.length > 2 ? parts[1] : parts[0];
      return { origin: site.origin, name: host, keyword: uniqueKeyword(label, used), kind: 'site', template: `${site.origin}/`, visits: site.visits, days: site.days.length, source: 'frequency' };
    });
}
export function applyLabels(candidates, labels, entries) {
  const used = new Set(entries.map(entry => entry.keyword));
  return candidates.map((site, index) => {
    const label = Array.isArray(labels) ? labels.find(item => item.index === index) : null;
    const valid = label && typeof label.name === 'string' && label.name.trim() && /^[\p{L}\p{N} .&'-]{1,60}$/u.test(label.name)
      && typeof label.keyword === 'string' && /^[a-z][a-z0-9-]{0,19}$/.test(label.keyword);
    return { ...site, name: valid ? label.name.trim() : site.name, keyword: uniqueKeyword(valid ? label.keyword : site.keyword, used), source: valid ? 'on-device' : 'frequency' };
  });
}
