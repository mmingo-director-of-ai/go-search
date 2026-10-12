# Security policy

## Report privately

Use [GitHub private vulnerability reporting](https://github.com/mmingo-director-of-ai/go-search/security/advisories/new). Include the affected commit, prerequisites, impact and a minimal reproduction using synthetic data. Do not post credentials, private destinations or personal browsing information in public issues.

The maintained branch is `main`. There are no supported historical release lines or response-time guarantees yet. This experimental software has not received an independent security audit.

## Application boundaries

Safari enforces extension permissions and declarative redirect rules. Go Search accepts HTTPS destinations, validates templates and checks actual website access. A permitted destination can still be malicious; review URLs before adding shortcuts. Redirects cannot prevent Safari's own autocomplete, suggestions or preload requests from reaching a provider.

Optional learning excludes private or unknown-privacy tabs and retains bounded origin-level statistics. Origins can be sensitive. The native model refines labels and keywords, not destinations; model output is validated before use. See [privacy details](docs/privacy.md).

## Contributions and automation

Repository read access does not grant write access. Submit changes through forks and reviewed pull requests. Branch protection and private reporting must be configured on GitHub; configuration files alone do not enforce them.

Review dependency, workflow and permission changes carefully. Never expose signing credentials or repository secrets to untrusted pull-request code. Keep browser profiles, provisioning material, local app state and private test data outside the repository. Keep Safari and the operating system updated.
