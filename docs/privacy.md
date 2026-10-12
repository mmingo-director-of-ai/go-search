# Privacy and permissions

Go Search redirects supported search-provider navigations to HTTPS destinations you configure. Those websites receive normal browser requests and apply their own policies. Safari may send search suggestions or preload requests before a redirect; Go Search does not guarantee that a keyword query remains hidden from your search provider.

## Saved shortcuts

Shortcuts and rules are stored locally by the extension. Review a destination before saving it. A custom template can include information you enter, so do not embed passwords or tokens. No cross-device shortcut sync or history import is implemented.

Website permissions cover source search providers and selected destinations. Optional all-site permission enables broader learning coverage but is not required for learning on individually permitted sites. Safari permission changes can disable routing or observation until access is granted again.

## Optional learning

Learning is off until enabled and observes future visits only. The observer requires an active, fully loaded tab, a known non-private state and actual website permission. It ignores non-HTTPS sites and the supported search-provider hosts.

The learning store retains at most 100 HTTPS origins, daily visit counts within a 30-day window and a last-visit timestamp. Visits within 30 minutes count once; daily counts are capped. Expired visit buckets and stale hostname-derived caches are pruned when the extension accesses learning data; deletion is not guaranteed at a wall-clock deadline while Safari or the extension is inactive. Dismissed origins and a short-lived suggestion cache are also retained. Page contents, page titles, paths, search queries and fragments are not recorded by this observer.

A suggestion needs at least three visits across two days. Up to three candidates appear, and the user must add one explicitly. Origin names can themselves be sensitive even without full URLs.

When requested, the native bridge receives candidate hostnames and visit/day counts. Apple Foundation Models may propose names and keywords locally; validated output cannot replace the candidate destination. Frequency ranking remains available if the model is unavailable. No remote inference fallback or analytics service is implemented in this source.

**Turn off & clear learned sites** resets learning data and its cache without deleting saved shortcuts. Clearing while inference is in progress is guarded against restoring the old learning state. Disabling the Safari extension alone is not the same as deleting stored data.

## Reports and shared devices

Local storage is not a security boundary against someone with access to your browser profile or account. Before sharing screenshots, logs, exports or bug reports, remove private destinations and personal browsing information. Use synthetic hostnames in test fixtures. Follow [SECURITY.md](../SECURITY.md) for private vulnerability reporting.
