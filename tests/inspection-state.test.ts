import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectionSummary, needsDetailInspection } from '../lib/marketplaces/inspection-state';

test('legacy title-only success is shown as incomplete and can be reinspected', () => {
  const listing = { inspectionStatus: 'complete' as const, description: '', inspectedAt: 100, availability: 'unknown' as const };
  assert.match(inspectionSummary(listing)!, /^Incomplete/);
  assert.equal(needsDetailInspection(listing), true);
  assert.match(inspectionSummary({ ...listing, description: ' \n ' })!, /^Incomplete/);
});

test('successful description updates replace the incomplete label', () => {
  const listing = { inspectionStatus: 'complete' as const, description: 'Size B chair. All adjustments work.', inspectedAt: 200 };
  assert.equal(inspectionSummary(listing), 'Description extracted');
  assert.equal(needsDetailInspection(listing), false);
});

test('sold status does not claim a description and failed reads do not loop', () => {
  const listing = { inspectionStatus: 'complete' as const, description: '', inspectedAt: 100, availability: 'sold' as const };
  assert.equal(inspectionSummary(listing), 'Listing sold · description unavailable');
  assert.equal(needsDetailInspection(listing), false);
  const failed = { ...listing, inspectionStatus: 'failed' as const, inspectionError: 'Facebook needs you to sign in.' };
  assert.match(inspectionSummary(failed)!, /Facebook needs you to sign in/);
  assert.equal(needsDetailInspection(failed), false);
});
