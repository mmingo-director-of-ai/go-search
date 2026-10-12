import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile, defaults, validate } from '../extension/routing.js';
function route(url, entries = defaults) {
  for (const rule of compile(entries)) {
    const match = url.match(new RegExp(rule.condition.regexFilter));
    if (match) return rule.action.redirect.regexSubstitution.replace('\\1', match[1]);
  }
  return url;
}
test('routes supported providers and parameter positions', () => {
  for (const source of ['https://www.google.com/search?', 'https://www.bing.com/search?', 'https://duckduckgo.com/?']) {
    for (const prefix of ['', 'client=safari&']) {
      assert.equal(route(`${source}${prefix}q=w+ocean+currents&other=1`), 'https://en.wikipedia.org/w/index.php?search=ocean+currents');
    }
  }
});
test('preserves encoded Unicode, plus, ampersand and question mark', () => {
  const query = '%E6%97%A5%E6%9C%AC%20C%2B%2B%26%3F';
  const result = new URL(route(`https://www.google.com/search?q=w%20${query}`));
  assert.equal(result.searchParams.get('search'), '日本 C++&?');
});
test('does not hijack normal searches, unrelated hosts, paths or empty queries', () => {
  for (const url of [
    'https://www.google.com/search?q=weather',
    'https://www.google.com/search?q=why+w+ocean',
    'https://www.google.com/search?q=w+',
    'https://www.google.com/search?q=W+ocean',
    'https://www.google.com/search?other=w+ocean',
    'https://www.google.com/search?q=wikipedia+ocean',
    'https://www.google.com.evil.test/search?q=w+ocean',
    'https://www.google.com/maps?q=w+ocean'
  ]) assert.equal(route(url), url);
});
test('rejects duplicates and templates that cannot preserve query encoding', () => {
  assert.throws(() => validate([defaults[0], defaults[0]]), /Duplicate/);
  for (const template of ['http://example.com/?q={search}', 'https://example.com/pre{search}', 'https://user:pass@example.com/?q={search}', 'https://example.com/?q={search}#x', 'https://example.com/?q=prefix{search}', 'https://example.com/?q={search}&x={search}']) {
    assert.throws(() => validate([{ ...defaults[0], template }]));
  }
});
test('routes custom Go Links as slugs without query-to-path encoding corruption', () => {
  const links = [{name: 'Go Links', keyword: 'go', template: 'https://links.example.com/{search}'}];
  assert.equal(route('https://www.google.com/search?client=safari&q=go+project&ie=UTF-8', links), 'https://links.example.com/project');
  assert.equal(route('https://www.google.com/search?q=go%20team-docs', links), 'https://links.example.com/team-docs');
  for (const term of ['two+words', '..', '%2Fadmin', 'foo%3Fbar', 'a%2Bb']) {
    const url = `https://www.google.com/search?q=go+${term}`;
    assert.equal(route(url, links), url);
  }
});
test('rule IDs are unique and deletion can produce an empty ruleset', () => {
  const rules = compile(defaults);
  assert.equal(new Set(rules.map(r => r.id)).size, rules.length);
  assert.deepEqual(compile([]), []);
});
test('single-keyword website shortcuts use exact matching and coexist with searches', () => {
  const entries = [...defaults, { name: 'Cloudflare', keyword: 'cf', kind: 'site', template: 'https://dash.cloudflare.com/' }];
  const rules = compile(entries);
  const resolve = input => {
    for (const rule of rules) {
      const match = input.match(new RegExp(rule.condition.regexFilter));
      if (match) return rule.action.redirect.url || rule.action.redirect.regexSubstitution.replace('\\1', match[1]);
    }
    return input;
  };
  for (const prefix of ['', 'client=safari&']) {
    assert.equal(resolve(`https://www.google.com/search?${prefix}q=cf&ie=UTF-8`), 'https://dash.cloudflare.com/');
  }
  for (const query of ['cf+docs', 'cfl', 'CF', 'a+cf', 'cf%20']) {
    const input = `https://www.google.com/search?q=${query}`;
    assert.equal(resolve(input), input);
  }
  assert.equal(resolve('https://www.bing.com/search?q=w+water'), 'https://en.wikipedia.org/w/index.php?search=water');
  assert.equal(validate(entries).at(-1).kind, 'site');
  assert.throws(() => validate([{ ...entries.at(-1), template: 'https://evil.test/{search}' }]));
  assert.throws(() => validate([{ ...entries.at(-1), template: 'https://user:secret@evil.test/' }]));
});
