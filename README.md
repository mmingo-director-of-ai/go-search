<div align="center">
<img src="assets/mlue-watercolor-logo.png" width="100" alt="Mlue watercolor character">

# Go Search

**Your keywords. Straight to the right search.**

Safari keyword shortcuts for Mac, iPhone and iPad — with optional local suggestions.

[Development](docs/development.md) · [Privacy](docs/privacy.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)
</div>

Type **`w red panda`** to search Wikipedia or **`yt swift tutorial`** to search YouTube. Add your own HTTPS search templates, or assign a keyword to a fixed website. Go Search compiles saved shortcuts into Safari's persistent declarative redirect rules, so navigation does not wait for a background script or AI inference.

**Experimental source release · macOS / iOS / iPadOS 26+ · MIT code.** Build and sign the containing app yourself. This repository does not provide an App Store release or guarantee identical behavior across devices.

## Build and enable

You need **Node.js 22+**, Xcode with OS 26 SDKs or newer, and a Mac for the native app build. There are no npm dependencies.

```sh
git clone https://github.com/mmingo-director-of-ai/go-search.git
cd go-search
npm run check
open "apple/Go Search/Go Search.xcodeproj"
```

Choose **Go Search (macOS)** or **Go Search (iOS)** and configure your own development team. Run the containing app, then enable its Safari extension:

- **Mac:** Safari → Settings → Extensions → Go Search.
- **iPhone/iPad:** Settings → Apps → Safari → Extensions → Go Search.

Allow access to your search provider and shortcut destinations. Open the extension's menu, choose **Enable Go Search**, and confirm **Ready**. On Mac, preserve the Xcode signature and entitlements when copying the app; replacing them can prevent Safari from registering the extension. Personal-team installations expire and require rebuilding.

## Make it yours

| Shortcut | Example | Result |
| --- | --- | --- |
| Search | `w red panda` | Wikipedia search for “red panda” |
| Search | `yt swift tutorial` | YouTube search for “swift tutorial” |
| Your search template | `https://example.com/search?q={search}` | Replaces `{search}` with your query |
| Your website | A fixed HTTPS URL | Opens with its keyword alone |

Keywords use lowercase letters, digits and hyphens, starting with a letter. They are case-sensitive. Search shortcuts need a query; path templates ending in `/{search}` accept one URL-safe alias. Defaults seed new installations without replacing saved shortcuts.

## Optional local suggestions

Enable learning to collect **future visits on permitted sites**. Go Search stores bounded origin-level counts, not page contents, titles or full visited URLs. It does not import Safari history. Private tabs and tabs whose privacy state is unknown are excluded from learning.

Suggestions appear after repeated visits; nothing is added automatically. On supported devices, Apple Foundation Models can refine a suggested name and keyword locally. Frequency-based suggestions work without Apple Intelligence, and the model cannot change destinations. No remote model fallback is implemented.

**Turn off & clear learned sites** removes learning data while keeping saved shortcuts. All-site access is optional; individually permitted sites can contribute. See [Privacy](docs/privacy.md) for storage and network boundaries.

## Know the limits

- Redirects cover Google `www.google.com/search`, Bing `www.bing.com/search`, and DuckDuckGo `duckduckgo.com/`. Regional or alternate hosts are not covered.
- Safari autocomplete can navigate directly instead of submitting a search. Go Search cannot intercept that decision or guarantee that search suggestions/preloading never reach your provider.
- Source and destination website permissions are required. A permission prompt being acknowledged does not necessarily mean Safari granted access.
- Rules and saved shortcuts are local. Cross-device sync, history import and App Intents are not implemented.
- A unit-test or simulator pass does not establish physical-device routing, multi-day learning or measured latency.

See the [development guide](docs/development.md) for checks and device acceptance scenarios.

## Contribute and reuse

Small fixes and reproducible reports are welcome; start with [CONTRIBUTING.md](CONTRIBUTING.md). Report vulnerabilities [privately](SECURITY.md).

Code is [MIT](LICENSE). Original Mlue artwork is [CC BY 4.0 with attribution to Mëngøh Labs](LICENSE-ASSETS.md), allowing reuse and adaptation. Trademark rights remain separate. Go Search is independent of Apple and does not imply its endorsement.
