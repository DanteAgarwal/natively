const test = require('node:test');
const assert = require('node:assert');

// Mock electron app if needed before requiring storeService
const { configService } = require('../dist-electron/storeService');

test('StoreService - Default Configuration', () => {
  const config = configService.getConfig();
  assert.ok(config, 'Config should exist');
  assert.ok(['gemini', 'groq', 'openrouter', 'router'].includes(config.provider), 'Provider should be valid');
  assert.ok(typeof config.temperature === 'number', 'Temperature should be number');
  assert.ok(typeof config.autoFallback === 'boolean', 'autoFallback should be boolean');
  assert.ok(typeof config.model === 'string', 'model should be string');
  assert.ok(typeof config.groqModel === 'string', 'groqModel should be string');
});

test('StoreService - Key Sanitization (strips quotes & whitespace)', () => {
  configService.setConfig({
    geminiApiKey: '  "AIzaSyTestKey123"  ',
    groqApiKey: "  'gsk_testKey456'  ",
    openrouterApiKey: '  sk-or-v1-test789  '
  });
  const updated = configService.getConfig();
  assert.strictEqual(updated.geminiApiKey, 'AIzaSyTestKey123');
  assert.strictEqual(updated.groqApiKey, 'gsk_testKey456');
  assert.strictEqual(updated.openrouterApiKey, 'sk-or-v1-test789');
});

test('StoreService - Obsolete Gemini Model Auto-Migration', () => {
  configService.setConfig({ model: 'gemini-1.5-flash' });
  const updated = configService.getConfig();
  assert.strictEqual(updated.model, 'gemini-3.8-flash', 'Deprecated model should auto-migrate to gemini-3.8-flash');
});

test('StoreService - Router Preset Configuration', () => {
  configService.setConfig({
    provider: 'router',
    routerPreset: 'pollinations',
    routerBaseUrl: 'https://text.pollinations.ai/openai',
    routerModel: 'openai'
  });
  const updated = configService.getConfig();
  assert.strictEqual(updated.provider, 'router');
  assert.strictEqual(updated.routerPreset, 'pollinations');
  assert.strictEqual(updated.routerBaseUrl, 'https://text.pollinations.ai/openai');
  assert.strictEqual(updated.routerModel, 'openai');
});

test('StoreService - Obsolete Groq Model Auto-Migration', () => {
  configService.setConfig({ groqModel: 'openai/gpt-oss-120b' });
  const updated = configService.getConfig();
  assert.strictEqual(updated.groqModel, 'llama-3.3-70b-versatile', 'Decommissioned groq model should auto-migrate to flagship');
});

test('StoreService - Audio Output Device Persistence', () => {
  configService.setConfig({ selectedAudioOutputDevice: '{0.0.0.00000000}.{speakers-device-id}' });
  const updated = configService.getConfig();
  assert.strictEqual(updated.selectedAudioOutputDevice, '{0.0.0.00000000}.{speakers-device-id}');
});

