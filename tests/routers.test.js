const test = require('node:test');
const assert = require('node:assert');
const { routerService, ROUTER_PRESETS } = require('../dist-electron/routerService');
const { openrouterService, ACTIVE_OPENROUTER_MODELS } = require('../dist-electron/openrouterService');

test('RouterService - Presets are properly configured', () => {
  assert.ok(Array.isArray(ROUTER_PRESETS), 'ROUTER_PRESETS must be an array');
  const presetIds = ROUTER_PRESETS.map(p => p.id);
  assert.ok(presetIds.includes('pollinations'), 'Pollinations preset must exist');
  assert.ok(presetIds.includes('cerebras'), 'Cerebras preset must exist');
  assert.ok(presetIds.includes('ollama'), 'Ollama preset must exist');
  assert.ok(presetIds.includes('deepinfra'), 'DeepInfra preset must exist');
  assert.ok(presetIds.includes('custom'), 'Custom preset must exist');

  const pollinations = ROUTER_PRESETS.find(p => p.id === 'pollinations');
  assert.strictEqual(pollinations.requiresKey, false, 'Pollinations must not require key');
});

test('OpenRouterService - Active models verify free tier & vision flags', () => {
  assert.ok(Array.isArray(ACTIVE_OPENROUTER_MODELS), 'ACTIVE_OPENROUTER_MODELS must be an array');
  const autoRouter = ACTIVE_OPENROUTER_MODELS.find(m => m.id === 'openrouter/free');
  assert.ok(autoRouter, 'Auto-router model must exist');

  const visionModels = ACTIVE_OPENROUTER_MODELS.filter(m => m.supportsVision);
  assert.ok(visionModels.length > 0, 'Must have models with supportsVision = true');
  assert.ok(visionModels.some(m => m.id === 'google/gemma-4-31b-it:free'), 'Gemma 4 Free vision must be flagged as supporting vision');
});

test('OpenRouterService - Empty key validation on testApiKey', async () => {
  const result = await openrouterService.testApiKey('');
  assert.strictEqual(result.success, false);
});
