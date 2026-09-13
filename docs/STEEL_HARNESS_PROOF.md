# Steel harness compatibility gate

Status: **direct agent-browser local, SDK-owned Steel cloud, and Vercel runtime proofs passed**.
The Steel CLI external-attachment path remains blocked.
Observed 2026-09-13 on branch `feat/steel-harness-proof`, based on `f5f6129`.

## Selected path: SDK-owned sessions + direct agent-browser

The user approved retaining Steel SDK ownership and testing upstream
`agent-browser` directly. Pinned `agent-browser@0.37.1` as a project dependency;
its package includes Linux ARM64/x64 native binaries. Lifecycle scripts are
disabled explicitly; the probe copies the packaged binary into its own temporary
directory and makes that copy executable. No runtime download or global install.

Run the controlled local integration proof:

```bash
CHROMIUM_PATH=/absolute/path/to/chrome pnpm probe:agent-browser
```

On this host, Chrome is available at
`/home/ubuntu/.cache/ms-playwright/chromium-1234/chrome-linux/chrome`. The initial
run without CHROMIUM_PATH failed to create a browser; the explicit executable
passed. Local Chrome is QA-only; cloud mode never launches a local browser.

Two independent local CDP browsers passed concurrently (1217ms and 1223ms):

1. Playwright creates and owns an isolated browser with a controlled form.
2. agent-browser attaches via `--cdp` and returns JSON snapshot/reference data.
3. Fill and click by snapshot refs update only that browser's form.
4. A subsequent Playwright change appears in a fresh harness snapshot.
5. Harness `close` returns successfully, and Playwright can still read and
   modify the original browser. The probe then closes its owned browser.

This demonstrates attachment and successful-path handoff/isolation, not live
marketplace behavior or hard-kill cleanup. The CLI's allowed-domains option is
documented as incompatible with pre-existing CDP sessions; future application
tools must enforce supported navigation themselves rather than enabling that
flag and assuming it works.

Cloud mode also **passed** after selecting only STEEL_API_KEY from the existing
local checkout configuration (no database settings loaded into the probe):

```bash
# Supply STEEL_API_KEY privately through the test environment, not CLI arguments.
pnpm probe:agent-browser --cloud
```

Both concurrent sessions passed in 14813ms and 15264ms, including reference
actions, Playwright handoff, and successful SDK session release. No cleanup
errors were reported. The credential value was never printed.

The probe creates two fresh Steel sessions through the SDK without profiles, injects
only the controlled test form, runs the same assertions, and releases both
sessions in finally. It consumes Steel credits but never visits marketplaces,
contacts sellers, or accesses Convex. Subprocesses do not inherit application
credentials; the authenticated CDP endpoint is supplied only for attachment.
Raw subprocess/Playwright errors are not printed because they may contain that
endpoint. Errors report the stage instead. Browser session timeouts bound cloud
lifetimes if cleanup fails. Vercel packaging and forced-termination recovery
remain separate tests.

## Reproduce without cloud credentials

Download the appropriate native archive and adjacent SHA-256 file from the
[v0.4.4 release](https://github.com/steel-dev/cli/releases/tag/v0.4.4), verify
the checksum, and extract it outside the repository. Do not run the global
installer or its interactive login/skill setup for this experiment.

```bash
STEEL_BINARY=/absolute/path/to/steel pnpm probe:steel
```

The probe uses an isolated temporary home, does not inherit app credentials,
has bounded subprocess execution, and only requests version/help output. Exit
code 2 means the planned external-CDP command contract is unsupported. Exit
code 0 would only pass preflight, not prove browser or Vercel compatibility.

## Evidence

- Native Linux ARM64 v0.4.4 launches successfully on this ARM64 host.
- Both downloaded ARM64 and x86_64 archives passed their published checksums.
- `steel browser --help` supports JSON, snapshots, click/fill and named sessions.
- `steel browser start --help` supports profile names and session timeouts.
- `steel browser --cdp http://127.0.0.1:9222 snapshot --json` fails during argument
  parsing: `error: unexpected argument '--cdp' found`.
- The reproducible offline probe uses `snapshot --help` instead, to ensure a
  future compatible release cannot accidentally start browser work.
- v0.4.4 `src/browser/engine.rs` imports the agent-browser native modules and
  contains an internal CDP connection function. However, the public browser CLI
  uses a daemon that creates/manages sessions; the planned external attach flag
  is not exposed. This is a CLI-contract problem, not proof Steel cannot do CDP.
- Inspection of v0.5.0-preview.6's browser command definition also found no
  external `--cdp` flag. That prerelease was not executed.
- The npm package version is 0.3.1. Its installer downloads the latest native
  release, skips CI by default, and installs under the user's home. Merely
  pinning that npm version would not pin or package the native runtime.

## Implication

Our design assumed the SDK would own Steel profile/session lifecycle and the
CLI would attach for recovery. The documented invocation does not work with
the latest stable native CLI. Do not integrate against that assumed interface
or silently replace it with custom snapshots.

Resolved decision: the user approved pinned upstream agent-browser attached to
SDK-created Steel sessions, as recorded above. Profile reuse, live-view retrieval,
timeout recovery, and daemon cleanup remain integration gates.

## Vercel preview attempt

The user authorized a preview deployment. Added a shared callable probe in
`lib/steel/harness-probe.mjs` and `POST /api/internal/harness-probe`:

- Available only when `VERCEL_ENV=preview`, with a 32+ character bearer token
  and a future `HARNESS_PROBE_EXPIRES_AT` epoch-millisecond timestamp.
- Credentials are supplied per deployment; no project environment settings change.
- No caller-controlled commands, URLs, or marketplace profiles; two fixed test sessions.
- Requests are awaited within a 180-second function; Steel sessions expire after
  120 seconds and are released in `finally`. Forced-termination cleanup is unproven.
- Linux x64 native binary is traced through pnpm's physical package directory.

Local verification after refactoring: two concurrent runs passed (1021ms and
1018ms); typecheck, ESLint, build, and diff whitespace checks passed. The built
route's trace contains the x64 binary and Playwright runtime assets. The new
access-control test passed. Full unit suite: 7 passed, 1 existing failure at
`tests/scoring.test.ts:6` (10 fixtures, assertion expects 8).

Preview upload was accepted, but Vercel reports `BLOCKED` for deployment
`dpl_EZTM23qSWMwaNJSv2ND29Y7JJAt7`:

> The deployment was blocked because the commit author doesn’t have permission to create deployments for this project.

Inspect: https://vercel.com/tingkaic/haggleface/EZTM23qSWMwaNJSv2ND29Y7JJAt7

Allocated URL (not a working, verified preview):
https://haggleface-nkihdjlt0-tingkaic.vercel.app

This initial access blocker cleared after creating the branch commit and PR #7:
the normal Git preview and subsequent CLI previews deployed successfully. No
author metadata was changed to bypass the gate.

### Successful hosted proof

The first authenticated Vercel run exposed a real bundling bug: Turbopack
rewrote `require.resolve('agent-browser/package.json')` into a numeric module ID,
so `dirname` failed before any browser session was created. The compiled artifact
contained `dirname(21266)`. The probe now uses the pinned physical pnpm package
path that `next.config.ts` explicitly traces. Setup failures report their stage
and a restricted error code; only credential-free version execution can report
stderr.

After fixing that path, the deployed probe returned **HTTP 200, passed: true**:

- Preview: https://haggleface-rl551kw6c-tingkaic.vercel.app
- Deployment: `dpl_56SzuSJmQfagUxQ8xzAfMm6duFDT`
- Runtime: Linux x64, `agent-browser 0.37.1`.
- Unauthenticated request: HTTP 401.
- Authenticated request: 5044ms end to end.
- Two concurrent controlled sessions: 2778ms and 3714ms, both PASSED.
- Snapshot/reference actions, isolation, Playwright handoff, browser usability
  after harness disconnect, and SDK release all passed without cleanup errors.
- Probe token was private and deployment-specific, expiring at
  `2026-09-13T04:52:52.610Z`; project environment settings were not modified.

The local probe also passed after the fix (715ms and 729ms), along with typecheck,
ESLint, and Vercel's production build. Hard-kill cleanup, real marketplace
profiles/selectors, and seller messaging remain unverified.

## Remaining proof before product integration

1. Resolve session ownership/attachment with a supported, pinned interface.
2. Run snapshot -> fill by ref -> click by ref -> verify on a controlled page.
3. Prove two sessions cannot share refs or state, and stale refs are refreshed.
4. Verify script/harness handoff and session/daemon cleanup on success/failure.
5. Vercel successful-path runtime proof passed; forced-termination recovery remains.
6. Measure runtime, bundle size, and temporary-file behavior. No local result is
   evidence that Vercel packaging or live marketplace behavior works.

The initial Steel CLI preflight created no cloud sessions. The subsequent direct
agent-browser cloud probe created and released two fresh profile-free sessions
using shared Steel credits. No marketplace navigation, seller messages, database
access, or populated environment-file changes were performed. The subsequent
initial preview deployment attempt was blocked; subsequent previews and the
controlled hosted runtime proof succeeded, creating and releasing two fresh
profile-free Steel sessions.

## Sources

- https://docs.steel.dev/overview/steel-cli
- https://github.com/steel-dev/cli/blob/v0.4.4/src/commands/browser/action.rs
- https://github.com/steel-dev/cli/blob/v0.4.4/src/browser/engine.rs
- https://github.com/steel-dev/cli/blob/v0.5.0-preview.6/src/commands/browser/mod.rs
- https://github.com/steel-dev/cli/blob/main/scripts/postinstall.js
