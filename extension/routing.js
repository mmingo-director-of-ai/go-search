export const defaults = [
  { name: 'Wikipedia', keyword: 'w', template: 'https://en.wikipedia.org/w/index.php?search={search}' },
  { name: 'YouTube', keyword: 'yt', template: 'https://www.youtube.com/results?search_query={search}' }
];

export const sourcePatterns = [
  'https://www.google.com/*', 'https://www.bing.com/*', 'https://duckduckgo.com/*'
];
const sources = [
  'www\\.google\\.com/search',
  'www\\.bing\\.com/search',
  'duckduckgo\\.com/'
];

export function validate(entries) {
  if (!Array.isArray(entries) || entries.length > 100) throw new Error('Use an array of up to 100 shortcuts.');
  const seen = new Set();
  return entries.map(entry => {
    if (!entry || typeof entry.name !== 'string' || !entry.name.trim()) throw new Error('Each shortcut needs a name.');
    if (typeof entry.keyword !== 'string' || !/^[a-z][a-z0-9-]{0,19}$/.test(entry.keyword)) throw new Error('Keywords must use 1–20 lowercase letters, digits, or hyphens, starting with a letter.');
    if (seen.has(entry.keyword)) throw new Error(`Duplicate keyword: ${entry.keyword}`);
    seen.add(entry.keyword);
    if (entry.kind !== undefined && !['search', 'site'].includes(entry.kind)) throw new Error('Choose a search or website shortcut.');
    const site = entry.kind === 'site';
    if (typeof entry.template !== 'string' || (site ? /[{}]/.test(entry.template) : entry.template.split('{search}').length !== 2)) throw new Error(site ? 'Website URLs cannot contain placeholders.' : 'Each search URL needs exactly one {search} placeholder.');
    let url;
    try { url = new URL(entry.template); } catch { throw new Error('Enter a valid HTTPS search URL.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || /[\\\r\n]/.test(entry.template)) throw new Error('Use an HTTPS URL without credentials, fragments, or backslashes.');
    const queryTemplate = [...url.searchParams.values()].includes('{search}') && /[?&][^=&?#]+=\{search\}(?:&|$)/.test(entry.template);
    const pathTemplate = !url.search && url.pathname.endsWith('%7Bsearch%7D') && entry.template.endsWith('/{search}');
    if (!site && !queryTemplate && !pathTemplate) throw new Error('Use {search} as a query value, or end a Go Link URL with /{search}.');
    if (site && /[\\{}]/.test(entry.template)) throw new Error('Enter a plain HTTPS website URL.');
    return { name: entry.name.trim().slice(0, 80), keyword: entry.keyword, template: entry.template, ...(site ? { kind: 'site' } : {}) };
  });
}

export function requiredOrigins(entries) {
  return [...new Set([...sourcePatterns, ...validate(entries).map(e => `${new URL(e.template).origin}/*`)])];
}

export function compile(entries) {
  let id = 1;
  // Safari's content-rule parser does not support alternation or noncapturing groups.
  // Separate separator/parameter-position variants keep the search in capture 1.
  return validate(entries).flatMap(entry => entry.kind === 'site' ? sources.flatMap(source =>
    ['', '[^#]*&'].map(prefix => ({
      id: id++, priority: 1,
      action: { type: 'redirect', redirect: { url: entry.template } },
      condition: { regexFilter: `^https://${source}\\?${prefix}q=${entry.keyword}(&[^#]*)?(#.*)?$`, isUrlFilterCaseSensitive: true, resourceTypes: ['main_frame'] }
    }))
  ) : sources.flatMap(source =>
    ['', '[^#]*&'].flatMap(prefix => ['\\+', '%20'].map(separator => ({
      id: id++, priority: 1,
      action: { type: 'redirect', redirect: { regexSubstitution: entry.template.replace('{search}', '\\1') } },
      condition: {
        regexFilter: `^https://${source}\\?${prefix}q=${entry.keyword}${separator}(${entry.template.endsWith('/{search}') ? '[A-Za-z0-9][A-Za-z0-9._~-]*' : '[^&#]+'})(&[^#]*)?(#.*)?$`,
        isUrlFilterCaseSensitive: true,
        resourceTypes: ['main_frame']
      }
    })))
  ));
}
