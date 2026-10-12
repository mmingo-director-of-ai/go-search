import { defaults, validate, requiredOrigins } from './routing.js';
const $ = id => document.getElementById(id);
let entries = [], editing = -1;
const status = $('status');
function message(text) { status.textContent = text; }
function render() {
  $('shortcuts').replaceChildren(...entries.map((entry, index) => {
    const button = document.createElement('button'); button.className = 'shortcut';
    const key = document.createElement('span'); key.className = 'key'; key.textContent = entry.keyword;
    const details = document.createElement('span'); details.className = 'details';
    const title = document.createElement('strong'); title.textContent = entry.name;
    const domain = document.createElement('small'); domain.textContent = new URL(entry.template).hostname.replace(/^www\./, '');
    const arrow = document.createElement('span'); arrow.className = 'chevron'; arrow.textContent = '›'; arrow.ariaHidden = 'true';
    details.append(title, domain); button.append(key, details, arrow); button.ariaLabel = `Edit ${entry.name}, keyword ${entry.keyword}`;
    button.addEventListener('click', () => edit(index)); return button;
  }));
}
async function health() {
  try {
    const result = await browser.runtime.sendMessage({ type: 'routing-status' });
    if (!result || result.error) throw new Error(result?.error || 'Could not check Safari routing.');
    $('health').textContent = result.ready ? 'Ready' : 'Needs setup';
    $('setup').hidden = result.ready;
    $('setup-message').textContent = result.permitted ? 'Activate your shortcuts to start routing searches.' : 'Allow your search websites to enable direct routing.';
  } catch (error) { $('health').textContent = 'Needs setup'; $('setup').hidden = false; message(error.message); }
}
function edit(index, suggestion = null) {
  editing = index; const entry = suggestion || entries[index];
  $('form-title').textContent = entry ? 'Edit shortcut' : 'Add shortcut';
  $('name').value = entry?.name || ''; $('keyword').value = entry?.keyword || ''; $('url').value = entry?.template || '';
  $('kind').value = entry?.kind || 'search'; updateKind();
  $('remove').hidden = index < 0; $('confirm-remove').hidden = true;
  $('list-view').hidden = true; $('edit-view').hidden = false; message(''); $('name').focus();
}
function closeEditor() { $('edit-view').hidden = true; $('list-view').hidden = false; render(); }
function updateKind() {
  const site = $('kind').value === 'site';
  $('url-label').textContent = site ? 'Website URL' : 'Search URL';
  $('url').placeholder = site ? 'https://example.com/' : 'https://example.com/search?q={search}';
  $('url-hint').textContent = site ? 'Type just the keyword in Safari to open this website. Review the destination before saving.' : 'Replace the search words with {search}. Go Link URLs can end in /{search} for a single link name.';
}
async function persist(next) {
  // Request permissions directly in the user gesture, before messaging or storage awaits.
  const normalized = validate(next);
  const granted = await browser.permissions.request({ origins: requiredOrigins(normalized) });
  if (!granted) throw new Error('Allow access to the search websites to use this shortcut.');
  const result = await browser.runtime.sendMessage({ type: 'save-shortcuts', shortcuts: normalized });
  if (!result || result.error) throw new Error(result?.error || 'Safari did not respond.');
  entries = result.shortcuts; closeEditor(); await health(); await loadSuggestions(false); message('Shortcuts saved.');
}
let busy = false;
async function action(work) {
  if (busy) return; busy = true;
  document.querySelectorAll('button').forEach(button => button.disabled = true);
  try { await work(); } catch (error) { message(error.message); }
  finally { busy = false; document.querySelectorAll('button').forEach(button => button.disabled = false); }
}
$('add').addEventListener('click', () => edit(-1));
$('kind').addEventListener('change', updateKind);
$('cancel').addEventListener('click', () => { closeEditor(); message(''); });
$('enable').addEventListener('click', () => action(() => persist(entries)));
$('editor').addEventListener('submit', event => {
  event.preventDefault();
  action(() => {
    const entry = { name: $('name').value.trim(), keyword: $('keyword').value.trim(), template: $('url').value.trim(), ...($('kind').value === 'site' ? { kind: 'site' } : {}) };
    const next = [...entries]; if (editing < 0) next.push(entry); else next[editing] = entry;
    return persist(next);
  });
});
$('remove').addEventListener('click', () => { $('confirm-remove').hidden = false; $('remove').hidden = true; });
$('keep').addEventListener('click', () => { $('confirm-remove').hidden = true; $('remove').hidden = false; });
$('delete').addEventListener('click', () => action(() => persist(entries.filter((_, index) => index !== editing))));
const modelMessages = {
  available: 'Apple Intelligence · on this device',
  frequency: 'Based on your visits · on this device',
  deviceNotEligible: 'Visit-based suggestions · this device does not support Apple Intelligence',
  appleIntelligenceNotEnabled: 'Visit-based suggestions · Apple Intelligence is off',
  modelNotReady: 'Visit-based suggestions · the on-device model is not ready',
  unsupportedLanguage: 'Visit-based suggestions · the model does not support your language',
  busy: 'Visit-based suggestions · the local model is busy',
  timeout: 'Visit-based suggestions · the local model took too long',
  generationFailed: 'Visit-based suggestions · AI labels were unavailable'
};
let suggestionRevision = 0;
function renderSuggestions(result) {
  $('learning-off').hidden = result.enabled;
  $('learning-on').hidden = !result.enabled;
  $('model-status').textContent = modelMessages[result.model] || 'Visit-based suggestions · on-device AI is unavailable';
  const suggestions = result.suggestions || [];
  $('learning-empty').hidden = suggestions.length > 0;
  if (Number.isInteger(result.observedSites)) $('learning-empty').textContent = `${result.observedSites ? `Learning from ${result.observedSites} site${result.observedSites === 1 ? '' : 's'}. ` : ''}Suggestions appear after 3 visits across at least 2 days.`;
  $('suggestions').replaceChildren(...suggestions.map(site => {
    const card = document.createElement('article'); card.className = 'suggestion';
    const title = document.createElement('strong'); title.textContent = `Add a shortcut for ${site.name}?`;
    const destination = document.createElement('p'); destination.className = 'hint'; destination.textContent = site.template;
    const reason = document.createElement('p'); reason.className = 'hint'; reason.textContent = `${site.visits} visits across ${site.days} days · ${site.source === 'on-device' ? 'AI-suggested keyword' : 'Suggested keyword'}: ${site.keyword}`;
    const actions = document.createElement('div'); actions.className = 'actions';
    for (const [label, run] of [
      [`Add “${site.keyword}”`, () => action(() => persist([...entries, { name: site.name, keyword: site.keyword, kind: 'site', template: site.template }]))],
      ['Edit', () => edit(-1, site)],
      ['Dismiss', () => action(async () => { await request({ type: 'dismiss-suggestion', origin: site.origin }); await loadSuggestions(false); })]
    ]) { const button = document.createElement('button'); button.textContent = label; button.addEventListener('click', run); actions.append(button); }
    card.append(title, destination, reason, actions); return card;
  }));
}
async function request(message) {
  const result = await browser.runtime.sendMessage(message);
  if (!result || result.error) throw new Error(result?.error || 'Go Search did not respond.');
  return result;
}
async function loadSuggestions(enhance = true) {
  const revision = ++suggestionRevision;
  const result = await request({ type: 'suggestions' });
  if (revision !== suggestionRevision) return;
  renderSuggestions(result);
  if (result.enabled) request({ type: 'learning-access' }).then(access => {
    if (revision === suggestionRevision) $('learning-access').hidden = access.allSites;
  }).catch(() => {});
  // Render immediately; never hold up the popup or its search controls for inference.
  if (result.enabled && enhance && !browser.extension.inIncognitoContext) {
    request({ type: 'suggestions', enhance: true }).then(refined => {
      if (revision === suggestionRevision) {
        renderSuggestions(refined);
        if (busy) document.querySelectorAll('button').forEach(button => button.disabled = true);
      }
    }).catch(() => {});
  }
}
$('learn').addEventListener('click', () => action(async () => {
  if (browser.extension.inIncognitoContext) throw new Error('Enable learning from a regular Safari window. Private visits are never counted.');
  const granted = await browser.permissions.request({ origins: ['https://*/*'] });
  if (!granted) throw new Error('Allow website access to enable local suggestions.');
  await request({ type: 'learning-settings', enabled: true });
  await loadSuggestions();
}));
$('forget').addEventListener('click', () => action(async () => {
  ++suggestionRevision;
  await request({ type: 'learning-settings', enabled: false });
  await loadSuggestions(false); message('Learning is off. Learned sites and AI suggestions were cleared.');
}));
try {
  const stored = await browser.storage.local.get('shortcuts'); entries = validate(stored.shortcuts ?? defaults); render(); await health(); await loadSuggestions();
} catch (error) { message(error.message); }
