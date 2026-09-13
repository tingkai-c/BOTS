import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ActivityLogView } from '../components/agent-panel';
import type { AgentEvent } from '../lib/schemas';

function makeEvents(count: number): AgentEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `event-${i + 1}`,
    time: 1700000000000 + i * 1000,
    kind: 'action' as const,
    message: `Record ${i + 1} action log`,
    marketplace: 'facebook',
  }));
}

test('activity log renders empty placeholders when no events exist', () => {
  const html = renderToString(React.createElement(ActivityLogView, { events: [] }));
  assert.ok(html.includes('activity-idle'));
  assert.ok(html.includes('dashed-placeholder'));
});

test('activity log renders all 5 records without top shadow when count is 5', () => {
  const events = makeEvents(5);
  const html = renderToString(React.createElement(ActivityLogView, { events }));
  assert.ok(html.includes('activity-log-container'));
  assert.ok(html.includes('Record 1 action log'));
  assert.ok(html.includes('Record 5 action log'));
  // At 5 records, shadow is not visible initially
  assert.ok(!html.includes('has-top-shadow'));
  assert.ok(!html.includes('activity-log-top-shadow visible'));
});

test('activity log preserves all records after the 6th record so user can scroll to older records', () => {
  const events = makeEvents(7);
  const html = renderToString(React.createElement(ActivityLogView, { events }));
  assert.ok(html.includes('activity-log-container'));
  assert.ok(html.includes('activity-log-top-shadow'));
  assert.ok(html.includes('activity-log-bottom-shadow'));
  assert.ok(html.includes('scrollable'));
  // All 7 records are present in the DOM for scrolling
  for (let i = 1; i <= 7; i++) {
    assert.ok(html.includes(`Record ${i} action log`), `Record ${i} should be present in DOM`);
  }
});
