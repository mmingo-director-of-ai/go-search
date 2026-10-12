import { learningKey, learningOrigins, emptyLearning, pruneLearning, recordVisit, suggestSites, applyLabels, siteOrigin } from './suggestions.js';

// Separate serialization from shortcut installation. Inference never holds either queue.
let learningQueue = Promise.resolve();
function serializeLearning(work) {
  const result = learningQueue.then(work);
  learningQueue = result.catch(() => {});
  return result;
}
async function readLearning() {
  const stored = await browser.storage.local.get(learningKey);
  const previous = stored[learningKey] || emptyLearning();
  const current = pruneLearning(previous);
  // Retention applies to persisted browsing data, even without another visit.
  if (JSON.stringify(previous) !== JSON.stringify(current)) await writeLearning(current);
  return current;
}
async function writeLearning(state) { await browser.storage.local.set({ [learningKey]: state }); }
async function observeTab(tab) {
  return serializeLearning(async () => {
    const state = await readLearning();
    if (!state.enabled || tab?.incognito !== false || !tab.active || tab.status !== 'complete') return;
    const origin = siteOrigin(tab.url);
    if (!origin || !await browser.permissions.contains({ origins: [`${origin}/*`] })) return;
    const next = recordVisit(state, tab);
    if (next !== state) await writeLearning(next);
  });
}
browser.tabs.onUpdated.addListener((_id, change, tab) => {
  if (change.status === 'complete') observeTab(tab).catch(() => {});
});
browser.tabs.onActivated.addListener(({ tabId }) => {
  browser.tabs.get(tabId).then(observeTab).catch(() => {});
});
function nativeRequest(message, milliseconds = 8000) {
  let timer;
  return Promise.race([
    browser.runtime.sendNativeMessage('com.mengohlabs.gosearch', message),
    new Promise(resolve => { timer = setTimeout(() => resolve({ status: 'timeout', labels: [] }), milliseconds); })
  ]).catch(() => ({ status: 'unavailable', labels: [] })).finally(() => clearTimeout(timer));
}
let enrichment;
async function suggestions(enhance) {
  const state = await serializeLearning(readLearning);
  const { shortcuts = defaults } = await browser.storage.local.get('shortcuts');
  const candidates = suggestSites(state, shortcuts);
  if (!state.enabled) return { enabled: false, suggestions: [], model: 'off' };
  if (!enhance) return { enabled: true, suggestions: candidates, model: 'frequency', observedSites: state.sites.length };
  const signature = JSON.stringify(candidates.map(site => site.origin));
  if (state.cache?.signature === signature && state.cache.until > Date.now()) {
    return { enabled: true, suggestions: applyLabels(candidates, state.cache.labels, shortcuts), model: state.cache.status };
  }
  const result = await nativeRequest(candidates.length ? {
    type: 'suggest-shortcuts', sites: candidates.map((site, index) => ({ index, host: new URL(site.origin).hostname, visits: site.visits, days: site.days }))
  } : { type: 'model-status' });
  // Forget/disable while inference is running must not resurrect any data.
  return serializeLearning(async () => {
    const current = await readLearning();
    if (!current.enabled || current.generation !== state.generation) return { enabled: current.enabled, suggestions: [], model: 'off' };
    const { shortcuts: latest = defaults } = await browser.storage.local.get('shortcuts');
    const fresh = suggestSites(current, latest);
    if (JSON.stringify(fresh.map(site => site.origin)) !== signature) return { enabled: true, suggestions: fresh, model: 'frequency' };
    const labels = Array.isArray(result?.labels) ? result.labels : [];
    const model = typeof result?.status === 'string' ? result.status : 'unavailable';
    current.cache = { signature, labels, status: model, until: Date.now() + (model === 'available' ? dayMSForCache : 15 * 60000) };
    await writeLearning(current);
    return { enabled: true, suggestions: applyLabels(fresh, labels, latest), model };
  });
}
const dayMSForCache = 86400000;

browser.runtime.onMessage.addListener((message, sender) => {
  if (!sender.url?.startsWith(browser.runtime.getURL('')) || sender.tab) return;
  if (message.type === 'learning-access') return browser.permissions.contains({ origins: learningOrigins }).then(allSites => ({ allSites }));
  if (message.type === 'suggestions') {
    if (!message.enhance) return suggestions(false);
    if (!enrichment) enrichment = suggestions(true).finally(() => { enrichment = null; });
    return enrichment;
  }
  if (message.type === 'learning-settings') return serializeLearning(async () => {
    const previous = await readLearning();
    // Safari can acknowledge an optional host request before the user grants
    // website access. Learning is opt-in, but each observed origin is checked above.
    const next = message.enabled ? { ...previous, enabled: true } : emptyLearning(false);
    next.generation = previous.generation + 1;
    delete next.cache;
    await writeLearning(next);
    return { enabled: next.enabled };
  });
  if (message.type === 'dismiss-suggestion') return serializeLearning(async () => {
    const state = await readLearning();
    if (typeof message.origin !== 'string' || !state.sites.some(site => site.origin === message.origin)) return { error: 'Suggestion no longer exists.' };
    state.dismissed = [...new Set([...state.dismissed, message.origin])].slice(-100);
    state.sites = state.sites.filter(site => site.origin !== message.origin);
    delete state.cache;
    state.generation++;
    await writeLearning(state);
    return { ok: true };
  });
});
