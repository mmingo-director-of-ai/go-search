import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyLearning, recordVisit, pruneLearning, suggestSites, applyLabels, siteOrigin } from '../extension/suggestions.js';
const day = 86400000;
const now = Date.UTC(2026, 9, 7);
const tab = (url = 'https://dash.cloudflare.com/account?token=secret#fragment') => ({ url, incognito: false, active: true, status: 'complete' });
function frequent(origin = 'https://dash.cloudflare.com') {
  let state = emptyLearning(true);
  for (const time of [now - day, now - day + 3600000, now]) state = recordVisit(state, tab(origin), time);
  return state;
}
test('opt-in and confirmed non-private active visits are required', () => {
  const off = emptyLearning();
  assert.equal(recordVisit(off, tab(), now), off);
  for (const change of [{ incognito: true }, { incognito: undefined }, { active: false }, { status: 'loading' }]) {
    const state = emptyLearning(true);
    assert.equal(recordVisit(state, { ...tab(), ...change }, now), state);
  }
});
test('stores only origins and aggregate counts, deduplicates reloads and ignores search engines', () => {
  const state = recordVisit(emptyLearning(true), tab(), now);
  assert.equal(state.sites[0].origin, 'https://dash.cloudflare.com');
  assert.ok(!JSON.stringify(state).includes('secret'));
  assert.ok(!JSON.stringify(state).includes('/account'));
  assert.equal(recordVisit(state, tab(), now + 1000), state);
  for (const url of ['http://plain.test/', 'file:///tmp/file', 'https://user:password@example.com', 'https://www.google.com/search?q=private', 'not a URL']) assert.equal(siteOrigin(url), null);
});
test('requires repeats across days, suppresses existing sites and dismissed suggestions', () => {
  let state = emptyLearning(true);
  for (const hour of [0, 1, 2]) state = recordVisit(state, tab(), now + hour * 3600000);
  assert.deepEqual(suggestSites(state, [], now + 3 * 3600000), []);
  state = frequent();
  const result = suggestSites(state, [], now);
  assert.equal(result.length, 1);
  assert.equal(result[0].visits, 3);
  assert.equal(result[0].days, 2);
  assert.equal(result[0].template, 'https://dash.cloudflare.com/');
  assert.equal(result[0].kind, 'site');
  assert.deepEqual(suggestSites(state, [{ keyword: 'cf', template: 'https://dash.cloudflare.com/' }], now), []);
  state.dismissed.push('https://dash.cloudflare.com');
  assert.deepEqual(suggestSites(state, [], now), []);
});
test('bounds retention and total origins', () => {
  let state = frequent();
  assert.equal(pruneLearning(state, now + 31 * day).sites.length, 0);
  for (let i = 0; i < 140; i++) state = recordVisit(state, tab(`https://site${i}.test`), now + i);
  assert.equal(state.sites.length, 100);
});
test('AI can label only observed candidates and cannot change the destination or overwrite keywords', () => {
  const candidates = suggestSites(frequent(), [], now);
  const result = applyLabels(candidates, [
    { index: 0, name: 'Cloudflare', keyword: 'cf', template: 'https://evil.test/' },
    { index: 99, name: 'Invented', keyword: 'invented' }
  ], [{ keyword: 'cf' }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].keyword, 'cf2');
  assert.equal(result[0].template, 'https://dash.cloudflare.com/');
  assert.equal(result[0].source, 'on-device');
  for (const label of [{ index: 0, name: '<script>bad</script>', keyword: 'x' }, { index: 0, name: 'Name', keyword: '../invalid' }]) {
    assert.equal(applyLabels(candidates, [label], [])[0].source, 'frequency');
  }
});

test('pruning removes cached origin signatures when a candidate ages out', () => {
  const state = frequent();
  state.cache = { signature: JSON.stringify(['https://dash.cloudflare.com']), labels: [{ index: 0, name: 'Cloudflare', keyword: 'cf' }], until: now + 60 * day };
  const pruned = pruneLearning(state, now + 31 * day);
  assert.equal(pruned.sites.length, 0);
  assert.equal(pruned.cache, undefined);
  assert.ok(state.cache, 'pruning must not mutate the input');
});
