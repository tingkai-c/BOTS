// Controlled integration probe. Local by default; --cloud explicitly consumes
// Steel credits using a NEW SDK-owned session without marketplace profiles.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright-core';
import Steel from 'steel-sdk';

const exec = promisify(execFile);
export async function runHarnessProbe({ cloud = false } = {}) {
assert(!cloud || process.env.STEEL_API_KEY, '--cloud needs STEEL_API_KEY.');
assert(process.platform === 'linux', 'This deployment probe currently targets Linux.');
const root = await mkdtemp(join(tmpdir(), 'hf-ab-'));
const binary = join(root, 'agent-browser');
const steel = cloud ? new Steel({ steelAPIKey: process.env.STEEL_API_KEY, maxRetries: 0, timeout: 20_000 }) : null;
const results = [];

async function probe(label) {
  const home = await mkdtemp(join(root, `${label}-`));
  let context;
  let browser;
  let sessionId;
  let endpoint;
  let stage = 'create browser';
  let harnessStarted = false;
  const env = { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home,
    TMPDIR: home, AGENT_BROWSER_SOCKET_DIR: home, AGENT_BROWSER_SESSION: label,
    AGENT_BROWSER_DEFAULT_TIMEOUT: '5000', AGENT_BROWSER_IDLE_TIMEOUT_MS: '30000',
    AGENT_BROWSER_NO_AUTO_DIALOG: '1', DO_NOT_TRACK: '1' };
  const command = async (...args) => {
    const { stdout } = await exec(binary, ['--session', label, '--json', ...args], {
      cwd: home, env, timeout: 15_000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024,
    });
    const value = JSON.parse(stdout);
    assert.equal(value.success, true, `Command failed: ${args[0]}`);
    return value.data;
  };
  const started = Date.now();
  try {
    if (steel) {
      const session = await steel.sessions.create({ timeout: 120_000 });
      sessionId = session.id;
      endpoint = `wss://connect.steel.dev?apiKey=${encodeURIComponent(process.env.STEEL_API_KEY)}&sessionId=${encodeURIComponent(sessionId)}`;
      browser = await chromium.connectOverCDP(endpoint, { timeout: 20_000 });
      context = browser.contexts()[0];
    } else {
      const profile = join(home, 'chrome');
      context = await chromium.launchPersistentContext(profile, {
        headless: true, executablePath: process.env.CHROMIUM_PATH,
        args: ['--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1'],
      });
      const [port, path] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split('\n');
      endpoint = `ws://127.0.0.1:${port}${path}`;
    }
    assert(context, 'No browser context');
    const page = context.pages()[0] ?? await context.newPage();
    await page.setContent(`<main><h1>Controlled ${label}</h1><label>Offer<input></label>
      <button onclick="document.querySelector('output').textContent=document.querySelector('input').value">Apply</button>
      <output>Not applied</output></main>`);
    stage = 'attach and snapshot';
    harnessStarted = true;
    const snapshot = await command('--cdp', endpoint, 'snapshot', '-i');
    assert.equal(typeof snapshot.snapshot, 'string', 'Missing structured snapshot');
    const refFor = (role, name) => {
      const match = Object.entries(snapshot.refs ?? {}).find(([, value]) => value.role === role && value.name === name);
      assert(match, `Missing ${role} reference`);
      return `@${match[0]}`;
    };
    stage = 'reference actions';
    await command('fill', refFor('textbox', 'Offer'), label);
    await command('click', refFor('button', 'Apply'));
    assert.equal(await page.locator('output').textContent(), label);
    stage = 'Playwright to harness handoff';
    await page.locator('input').fill(`${label}-script`);
    const updated = await command('snapshot', '-i');
    assert.match(updated.snapshot, new RegExp(`${label}-script`));
    stage = 'harness disconnect preserves SDK-owned browser';
    await command('close');
    harnessStarted = false;
    assert.equal(await page.locator('input').inputValue(), `${label}-script`);
    // The original controller must still be able to mutate the browser.
    await page.locator('input').fill(`${label}-after-close`);
    results.push({ label, status: 'PASSED', durationMs: Date.now() - started });
  } catch {
    // Never expose raw subprocess/Playwright errors: CDP URLs contain secrets.
    results.push({ label, status: 'FAILED', stage, durationMs: Date.now() - started });
  } finally {
    if (harnessStarted) {
      try { await command('close'); } catch { results.push({ label, cleanup: 'Harness close failed; idle timeout is backstop' }); }
    }
    try {
      if (browser) await browser.close();
      else if (context) await context.close();
    } catch { results.push({ label, cleanup: 'Browser disconnect failed' }); }
    if (sessionId) {
      try { await steel.sessions.release(sessionId); }
      catch { results.push({ label, cleanup: 'Steel release failed; session timeout is backstop' }); }
    }
  }
}

let setupStage = 'resolve native package';
try {
  // Turbopack rewrites require.resolve to a numeric module ID. Match the
  // pinned physical pnpm path explicitly included by next.config.ts instead.
  const packageRoot = join(process.cwd(), 'node_modules', '.pnpm', 'agent-browser@0.37.1', 'node_modules', 'agent-browser');
  // Use the packaged native binary directly: no installer or global state.
  setupStage = 'copy native binary';
  await copyFile(join(packageRoot, 'bin', `agent-browser-linux-${process.arch}`), binary);
  setupStage = 'chmod native binary';
  await chmod(binary, 0o755);
  setupStage = 'execute native version';
  const { stdout } = await exec(binary, ['--version'], { timeout: 5000 });
  assert.equal(stdout.trim(), 'agent-browser 0.37.1');
  setupStage = 'controlled browser probes';
  await Promise.all([probe('first'), probe('second')]);
  return { mode: cloud ? 'steel-cloud' : 'local-cdp', version: stdout.trim(), architecture: process.arch,
    passed: results.length === 2 && results.every(result => result.status === 'PASSED'), results,
    unverified: ['Hard-kill cleanup', 'Marketplace profiles/selectors', 'Seller messaging'] };
} catch (error) {
  const code = ['ENOENT', 'EACCES', 'ENOEXEC', 'ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'].includes(error.code)
    ? error.code : typeof error.code === 'number' ? error.code : 'UNKNOWN';
  // Only version execution has no CDP credentials in its command or output.
  const versionDiagnostic = setupStage === 'execute native version' && typeof error.stderr === 'string'
    ? error.stderr.slice(0, 1000) : undefined;
  return { passed: false, stage: setupStage, architecture: process.arch, code, versionDiagnostic };
} finally {
  await rm(root, { recursive: true, force: true });
}
}
