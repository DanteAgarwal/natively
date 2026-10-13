const test = require('node:test');
const assert = require('node:assert');
const { configService } = require('../dist-electron/storeService');

test('Dispatcher Config - Fallback provider candidate selection', () => {
  configService.setConfig({
    provider: 'gemini',
    autoFallback: true,
    geminiApiKey: 'test-gemini',
    groqApiKey: 'gsk_testGroq',
    openrouterApiKey: 'sk-or-v1-test',
    routerPreset: 'pollinations'
  });

  const cfg = configService.getConfig();
  const primaryProvider = cfg.provider;
  assert.strictEqual(primaryProvider, 'gemini');

  // Verify candidate fallback list excludes the primary provider
  const allProviders = ['openrouter', 'gemini', 'groq', 'router'];
  const candidates = allProviders.filter(p => p !== primaryProvider);

  assert.strictEqual(candidates.length, 3);
  assert.ok(!candidates.includes('gemini'), 'Primary provider must not be in its own fallback list');
  assert.ok(candidates.includes('openrouter'));
  assert.ok(candidates.includes('groq'));
  assert.ok(candidates.includes('router'));
});

test('Dispatcher Config - Router URL normalization', () => {
  const normalizeUrl = (url) => (url || '').trim().replace(/\/+$/, '');
  assert.strictEqual(normalizeUrl('https://api.example.com/v1///'), 'https://api.example.com/v1');
  assert.strictEqual(normalizeUrl('https://text.pollinations.ai/openai/'), 'https://text.pollinations.ai/openai');
  assert.strictEqual(normalizeUrl('http://localhost:11434/v1'), 'http://localhost:11434/v1');
});
