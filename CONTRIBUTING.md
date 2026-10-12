# Contributing

Start with the [README](README.md), [development guide](docs/development.md) and [security policy](SECURITY.md).

1. Fork the repository and branch from `main`.
2. Keep changes focused and explain the problem and resulting behavior.
3. Run `npm run check`; include the regenerated background bundle when its sources change.
4. Add meaningful tests for routing, privacy, permission or model-output behavior changes.
5. Report native builds and actual Safari/device checks separately. State skipped checks and model availability.
6. Submit a pull request with a minimal reproduction and sanitized screenshots where useful.

Never commit credentials, signing material, browser profiles, personal browsing history or private destination URLs. Use synthetic fixtures. Dependency additions require license/provenance review and retained notices; no npm runtime dependencies are currently required.

Source contributions are accepted under [MIT](LICENSE). Original artwork follows [CC BY 4.0 attribution terms](LICENSE-ASSETS.md). Submit only material you have the right to license, preserve third-party notices and discuss changes respectfully.

Report vulnerabilities privately through SECURITY.md rather than ordinary issues.
