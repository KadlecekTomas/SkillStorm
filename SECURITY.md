# SkillStorm Security Policy

## Supported code

Security fixes are maintained for the current `main` branch and the currently deployed production release. Older development snapshots and superseded releases are not independently supported.

## Reporting a vulnerability

Do **not** open a public issue, discussion, or pull request containing exploit details, credentials, personal data, or a proof of concept for an unpatched vulnerability.

Use GitHub's **private vulnerability reporting** instead:

1. Open the repository's **Security and quality** tab.
2. Open **Advisories**.
3. Choose **Report a vulnerability**.
4. Include the affected component/version, reproduction steps, impact, and any proposed mitigation.

If private vulnerability reporting is temporarily unavailable, contact the repository owner through an existing private channel and avoid publishing technical details until a private disclosure channel is available.

## What to expect

Reports are triaged based on exploitability, affected data, authentication boundary, tenant isolation, privilege level, and availability impact. Confirmed vulnerabilities are fixed in a dedicated security change and verified by the repository's security and regression gates before release.

Please avoid accessing data that does not belong to you, degrading service availability, social engineering, or destructive testing while validating a report.
