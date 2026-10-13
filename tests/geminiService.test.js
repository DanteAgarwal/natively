const test = require('node:test');
const assert = require('node:assert');
const { geminiService, ACTIVE_GEMINI_MODELS } = require('../dist-electron/geminiService');
const { configService } = require('../dist-electron/storeService');

test('GeminiService - Active models verify flagship Gemini models', () => {
  assert.ok(Array.isArray(ACTIVE_GEMINI_MODELS));
  assert.ok(ACTIVE_GEMINI_MODELS.includes('gemini-3.8-flash'), 'Should include flagship gemini-3.8-flash');
  assert.ok(ACTIVE_GEMINI_MODELS.includes('gemini-3.5-flash-lite'), 'Should include gemini-3.5-flash-lite');
});

test('GeminiService - Missing key throws informative error', async () => {
  configService.setConfig({ geminiApiKey: '' });
  delete process.env.GEMINI_API_KEY;

  await assert.rejects(
    async () => {
      await geminiService.streamGenerate({
        prompt: 'test',
        onChunk: () => {}
      });
    },
    /Gemini API Key/i
  );
});
