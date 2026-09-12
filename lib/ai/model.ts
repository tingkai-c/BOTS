import { createAnthropic } from '@ai-sdk/anthropic';

export function anthropicApiKey() {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (key) return key;
  // Accept a Claude key pasted into Scout's previous provider field. Never send
  // an actual OpenAI key to Anthropic, and never expose either key to the client.
  const legacy = process.env.OPENAI_API_KEY?.trim();
  return legacy?.startsWith('sk-ant-') ? legacy : undefined;
}

export const hasAI = () => Boolean(anthropicApiKey());
export const model = () => createAnthropic({ apiKey: anthropicApiKey() })(
  process.env.AI_MODEL?.trim() || 'claude-sonnet-5',
);
