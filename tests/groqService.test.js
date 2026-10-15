const test = require('node:test');
const assert = require('node:assert');
const { groqService, ACTIVE_GROQ_MODELS } = require('../dist-electron/groqService');

test('GroqService - Models verification', () => {
  assert.ok(Array.isArray(ACTIVE_GROQ_MODELS), 'ACTIVE_GROQ_MODELS should be an array');
  const ids = ACTIVE_GROQ_MODELS.map(m => m.id);
  assert.ok(ids.includes('llama-3.3-70b-versatile'), 'Flagship model must be included');
  assert.ok(ids.includes('llama-3.1-8b-instant'), 'Fast 8B model must be included');
  assert.ok(ids.includes('openai/gpt-oss-120b'), 'OpenAI OSS 120B model must be included');
  assert.ok(ids.includes('openai/gpt-oss-20b'), 'OpenAI OSS 20B model must be included');
});

test('GroqService - Rejects invalid key format on testApiKey', async () => {
  const result = await groqService.testApiKey('invalid_key_without_gsk');
  assert.strictEqual(result.success, false);
  assert.ok(result.error.includes('gsk_'), 'Error message must specify gsk_ requirement');
});

test('GroqService - Rejects empty key on testApiKey', async () => {
  const result = await groqService.testApiKey('');
  assert.strictEqual(result.success, false);
});
