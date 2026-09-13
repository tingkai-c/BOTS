// Offline capability gate, not a browser integration test. No credentials or
// browser-start commands are passed to the CLI. Install a reviewed binary first.
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute } from 'node:path';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const binary = process.env.STEEL_BINARY;

if (!binary || !isAbsolute(binary)) {
  console.error('Set STEEL_BINARY to an absolute path to a reviewed Steel CLI binary.');
  process.exitCode = 1;
} else {
  const home = await mkdtemp(join(tmpdir(), 'haggleface-steel-probe-'));
  // Never inherit app credentials or the developer's Steel login/configuration.
  const env = {
    PATH: process.env.PATH,
    HOME: home,
    XDG_CONFIG_HOME: home,
    XDG_CACHE_HOME: home,
    TMPDIR: home,
    CI: 'true',
    STEEL_CLI_SKIP_UPDATE_CHECK: 'true',
    DO_NOT_TRACK: '1',
  };
  const run = async (args) => execute(binary, args, {
    env, cwd: home, timeout: 5_000, killSignal: 'SIGKILL', maxBuffer: 128 * 1024,
  });

  try {
    const { stdout: version } = await run(['--version']);
    const { stdout: help } = await run(['browser', '--help']);
    const { stdout: startHelp } = await run(['browser', 'start', '--help']);
    // Help exits before executing an action even on versions accepting --cdp.
    // The loopback URL contains no credential and is never a live Steel URL.
    let cdpFlagAccepted = false;
    let attachmentDiagnostic = '';
    try {
      await run(['browser', '--cdp', 'http://127.0.0.1:9222', 'snapshot', '--help']);
      cdpFlagAccepted = true;
    } catch (error) {
      attachmentDiagnostic = typeof error.stderr === 'string'
        ? error.stderr.trim().slice(0, 1_000)
        : 'CLI probe failed before attachment could be evaluated.';
    }
    const capabilities = {
      json: /--json\b/.test(help),
      namedSessions: /--session\b/.test(help),
      snapshots: /\bsnapshot\b/.test(help),
      referenceActions: /\bclick\b/.test(help) && /\bfill\b/.test(help),
      sessionTimeout: /--session-timeout\b/.test(startHelp),
      externalCdpFlag: cdpFlagAccepted,
    };
    const compatible = Object.values(capabilities).every(Boolean);
    console.log(JSON.stringify({
      status: compatible ? 'PREFLIGHT_PASSED' : 'BLOCKED',
      version: version.trim(), platform: process.platform, architecture: process.arch,
      capabilities, attachmentDiagnostic,
      unverified: ['Actual browser attachment', 'Snapshot/action round trip',
        'Concurrent session isolation', 'Daemon cleanup', 'Vercel deployment'],
    }, null, 2));
    process.exitCode = compatible ? 0 : 2;
  } catch {
    // execFile errors include command arguments; avoid forwarding raw errors.
    console.error('Steel preflight could not execute the binary/help within its limits. Check the binary architecture and executable permissions.');
    process.exitCode = 1;
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}
