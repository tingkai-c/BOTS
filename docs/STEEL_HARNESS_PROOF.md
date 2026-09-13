# Steel harness compatibility evidence

Recorded 2026-09-13. The temporary compatibility endpoints, scripts, and token
configuration have been removed. This document preserves the measured results
and packaging requirements for the product integration.

## Selected integration

- Steel SDK owns sessions, profiles, and release.
- Playwright performs scripted discovery and detail extraction.
- Pinned `agent-browser@0.37.1` attaches to the existing CDP session for snapshots
  and reference-based recovery. Its lifecycle installer is disabled explicitly.
- Use the packaged native binary; no runtime downloads or global installation.
- Playwright and the harness must take turns, with refreshed snapshot refs.
- Application tools enforce supported navigation: the CLI domain allowlist has
  restrictions when attached to an existing CDP session.

## Successful proofs

Two independent controlled forms verified snapshot JSON, reference-based fill and
click, isolation, Playwright mutations visible in subsequent snapshots, and owner
browser usability after harness disconnect. Both SDK sessions were released
without reported cleanup errors.

| Environment | Result |
|---|---|
| Local Linux ARM64 / Chromium | Passed; final run 715ms and 729ms |
| Local process attached to Steel cloud | Passed; 14813ms and 15264ms |
| Actual Vercel preview, Linux x64 | HTTP 200, `passed: true`; 2778ms and 3714ms, 5044ms total |

Hosted deployment: `dpl_56SzuSJmQfagUxQ8xzAfMm6duFDT`.
URL: https://haggleface-rl551kw6c-tingkaic.vercel.app
Unauthenticated requests returned HTTP 401. The deployment-specific private probe
token expires at `2026-09-13T04:52:52.610Z`; project environment settings were not
modified. Tests used fresh profile-free sessions, no marketplace navigation,
seller messages, or Convex writes.

## Runtime packaging lesson

Turbopack rewrites `require.resolve('agent-browser/package.json')` into a numeric
module ID. The first hosted test failed because the compiled code called
`dirname(21266)`. Resolving the explicitly traced physical package path fixed it:

`node_modules/.pnpm/agent-browser@0.37.1/node_modules/agent-browser/bin/agent-browser-linux-x64`

When integrating the real worker, trace the native binary for that route and
copy it into an invocation-specific temporary directory before chmod/execution.
Keep existing Playwright physical-package tracing. Native subprocesses should
receive an isolated environment, home, and socket directory, with bounded
execution and explicit cleanup. Raw CDP/SDK errors can contain credentials.

## Remaining verification

- Timeout and forced-termination recovery; failure-path daemon cleanup.
- Bundle-size measurement.
- Marketplace profile reuse, selectors, conversation identity, manual takeover,
  and delivery verification. Successful controlled forms do not establish these.

## Rejected Steel CLI route

Steel CLI v0.4.4 rejects `steel browser --cdp …` with
`error: unexpected argument '--cdp' found`. The tested ARM64 binary launched and
published checksums for ARM64/x64 archives verified. v0.5.0-preview.6 source also
lacked the external-attachment flag. The user approved direct agent-browser
instead of moving session ownership to the CLI.

Sources: https://docs.steel.dev/overview/steel-cli and
https://github.com/steel-dev/cli/tree/v0.4.4/src/browser.
