import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anthropicApiKey, hasAI, model } from '../lib/ai/model';

test('Claude credentials, safe legacy migration, and default model', () => {
  const old = { anthropic: process.env.ANTHROPIC_API_KEY, openai: process.env.OPENAI_API_KEY, model: process.env.AI_MODEL };
  try {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_MODEL;
    assert.equal(hasAI(), false);
    assert.equal(model().modelId, 'claude-sonnet-5');
    process.env.OPENAI_API_KEY = 'sk-openai-example';
    assert.equal(anthropicApiKey(), undefined);
    process.env.OPENAI_API_KEY = 'sk-ant-test-legacy';
    assert.equal(anthropicApiKey(), 'sk-ant-test-legacy');
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-preferred';
    assert.equal(anthropicApiKey(), 'sk-ant-test-preferred');
    assert.equal(hasAI(), true);
    process.env.AI_MODEL = 'claude-haiku-4-5';
    assert.equal(model().modelId, 'claude-haiku-4-5');
  } finally {
    for (const [key, value] of Object.entries({ ANTHROPIC_API_KEY: old.anthropic, OPENAI_API_KEY: old.openai, AI_MODEL: old.model })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
