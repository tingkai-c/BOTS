// --cloud explicitly consumes Steel credits; the default uses local Chromium.
import assert from 'node:assert/strict';
import { runHarnessProbe } from '../lib/steel/harness-probe.mjs';

assert(process.argv.slice(2).every(arg => arg === '--cloud'), 'Only --cloud is supported.');
try {
  const result = await runHarnessProbe({ cloud: process.argv.includes('--cloud') });
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
} catch {
  console.error('Probe setup or cleanup failed. Raw errors suppressed to protect credentials.');
  process.exitCode = 1;
}
