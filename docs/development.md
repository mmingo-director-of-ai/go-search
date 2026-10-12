# Development

Go Search uses dependency-free JavaScript for its Safari WebExtension and a Swift containing app/native bridge. The project targets OS 26 or newer. Node.js 22+ runs the source checks; native compilation needs Xcode with the corresponding SDKs.

## Layout

| Path | Purpose |
| --- | --- |
| `extension/routing.js` | Template validation and declarative redirect generation. |
| `extension/background.js` | Rule installation and extension messages. |
| `extension/suggestions.js`, `learning-background.js` | Bounded visit counts, suggestion ranking and native model requests. |
| `extension/options.*` | Shortcut editor, setup and permissions UI. |
| `extension/background.bundle.js` | Generated bundle consumed by Xcode. |
| `apple/Go Search` | Mac/iOS hosts and shared native bridge. |
| `tests` | Node tests using synthetic inputs. |
| `scripts` | Bundle generation and native validation helpers. |
| `assets` | Original Mlue artwork and generation prompts. |

After editing extension sources, run `npm run build` and include the generated bundle in the change. Do not edit that bundle by hand.

```sh
npm run check
# Confirm regeneration did not leave an unexpected bundle change:
git diff -- extension/background.bundle.js
```

`npm run check` verifies that the generated bundle matches its sources, checks JavaScript syntax and runs Node tests. Run `npm run build` to regenerate after source edits. Tests cover routing, encoding, permission/privacy gates, retention, restricted model output, fallback, concurrent clearing and setup retry behavior. They do not launch Safari.

## Native checks

For the combined JavaScript and unsigned native compilation gate:

```sh
bash scripts/check.sh --native
```

This checks Mac and iOS compilation and verifies that the code and artwork license files are present in the bundles. It does not install the extension or test Safari navigation.

Open `apple/Go Search/Go Search.xcodeproj` and select the Mac or iOS scheme. Configure your own development identity; forks intended for distribution should register their own app and extension identifiers. Existing Safari storage and permissions are associated with the installed extension identity and do not automatically migrate to a different identifier.

Preserve the containing app's sandbox entitlements and signature. A compilation-only unsigned build is not an installed Safari extension. Signing, device installation and App Store review are separate steps.

On a supported Mac, this optional check compiles the production native service with a synthetic-input harness:

```sh
python3 scripts/check-local-model.py
```

The harness reports a skip when the model is unavailable. A skip is not a model-generation pass. Apple Intelligence availability, model assets and locale are evaluated at runtime.

`scripts/check-safari-rules.swift` accepts a JSON rules file and validates its regex patterns through WebKit. Pattern acceptance alone does not verify a navigation redirect in Safari.

## Device acceptance

Record the commit, installed version, OS, device, default search provider and permission state. Verify routing on both Mac and physical mobile devices, including:

- Warm/cold Safari, fresh/existing tabs and an inactive extension background.
- Search and fixed-site shortcuts, encoding, Unicode and malformed templates.
- Granted, denied and revoked source/destination permissions.
- Private browsing, unknown privacy state, offline navigation and back/forward behavior.
- Learning across multiple days, retention, dismissing suggestions and clearing while inference is running.
- Apple Intelligence unavailable, unsupported locale, timeout and malformed model output.

Check whether a search-results document loads before the redirect. If measuring latency, compare with direct navigation over repeated runs and report methodology and percentiles; no latency guarantee is implied by the use of declarative rules.

## References

- [Safari WebExtensions](https://developer.apple.com/documentation/safariservices/safari-web-extensions)
- [Safari declarative rules](https://developer.apple.com/documentation/safariservices/blocking-content-with-your-safari-web-extension)
- [Foundation Models](https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel)
- [Safari native messaging](https://developer.apple.com/documentation/safariservices/messaging-between-the-app-and-javascript-in-a-safari-web-extension)
