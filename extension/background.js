import { defaults, compile, validate, requiredOrigins } from './routing.js';

async function install(entries) {
  const shortcuts = validate(entries);
  const rules = compile(shortcuts);
  for (const rule of rules) {
    const result = await browser.declarativeNetRequest.isRegexSupported({ regex: rule.condition.regexFilter, isCaseSensitive: true, requireCapturing: true });
    if (!result.isSupported) throw new Error(`Safari rejected a routing rule: ${result.reason || 'unsupported expression'}`);
  }
  const previous = await browser.declarativeNetRequest.getDynamicRules();
  await browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds: previous.map(rule => rule.id), addRules: rules });
  await browser.storage.local.set({ shortcuts });
  return shortcuts;
}

let queue = Promise.resolve();
function enqueue(work) {
  const next = queue.then(work);
  queue = next.catch(() => {});
  return next;
}

browser.runtime.onInstalled.addListener(() => {
  enqueue(async () => {
    const { shortcuts } = await browser.storage.local.get('shortcuts');
    await install(shortcuts ?? defaults);
  }).catch(error => console.error('Go Search setup failed:', error.message));
});

browser.runtime.onMessage.addListener((message, sender) => {
  if (!sender.url?.startsWith(browser.runtime.getURL('')) || sender.tab) return;
  if (message.type === 'routing-status') return enqueue(async () => {
    try {
      const { shortcuts = defaults } = await browser.storage.local.get('shortcuts');
      const expected = compile(shortcuts);
      const rules = await browser.declarativeNetRequest.getDynamicRules();
      const permitted = await browser.permissions.contains({ origins: requiredOrigins(shortcuts) });
      const active = rules.length === expected.length && expected.every(rule => rules.some(actual => actual.id === rule.id && actual.condition.regexFilter === rule.condition.regexFilter && actual.action.redirect?.regexSubstitution === rule.action.redirect.regexSubstitution && actual.action.redirect?.url === rule.action.redirect.url));
      return { ready: active && permitted, permitted, count: shortcuts.length };
    } catch (error) { return { error: error.message }; }
  });
  if (message.type !== 'save-shortcuts') return;
  return enqueue(async () => {
    try {
      if (!await browser.permissions.contains({ origins: requiredOrigins(message.shortcuts) })) throw new Error('Allow the source and destination websites before saving.');
      return { shortcuts: await install(message.shortcuts) };
    } catch (error) { return { error: error.message }; }
  });
});
