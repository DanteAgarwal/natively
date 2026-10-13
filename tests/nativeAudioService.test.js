const test = require('node:test');
const assert = require('node:assert');
const { nativeAudioService } = require('../dist-electron/nativeAudioService');

test('NativeAudioService - Rolling Transcript Management', () => {
  nativeAudioService.clearTranscript();
  assert.strictEqual(nativeAudioService.getRollingTranscript().length, 0);

  // Add 60 items
  for (let i = 0; i < 60; i++) {
    nativeAudioService.addTranscriptItem({
      id: `item-${i}`,
      speaker: i % 2 === 0 ? 'user' : 'meeting',
      text: `Transcript line ${i}`,
      timestamp: Date.now() + i
    });
  }

  const history = nativeAudioService.getRollingTranscript();
  // Must be capped at 50 items to prevent unbounded memory growth
  assert.strictEqual(history.length, 50, 'History must cap at 50 items');
  // First item should be item-10 (first 10 shifted out)
  assert.strictEqual(history[0].id, 'item-10');
  assert.strictEqual(history[49].id, 'item-59');

  nativeAudioService.clearTranscript();
  assert.strictEqual(nativeAudioService.getRollingTranscript().length, 0);
});

test('NativeAudioService - Listener Subscriptions & Cleanup', () => {
  let callCount = 0;
  const unsubscribe = nativeAudioService.onTranscript((item) => {
    callCount++;
  });

  nativeAudioService.addTranscriptItem({
    id: 'test-1',
    speaker: 'user',
    text: 'Hello world',
    timestamp: Date.now()
  });

  assert.strictEqual(callCount, 1);

  // Unsubscribe should cleanly remove listener
  unsubscribe();

  nativeAudioService.addTranscriptItem({
    id: 'test-2',
    speaker: 'meeting',
    text: 'Second line',
    timestamp: Date.now()
  });

  assert.strictEqual(callCount, 1, 'Listener should not be called after unsubscribing');
  nativeAudioService.clearTranscript();
});

test('NativeAudioService - Status Listener Subscriptions', () => {
  let lastStatus = null;
  const unsubStatus = nativeAudioService.onStatus((status) => {
    lastStatus = status;
  });

  assert.strictEqual(typeof unsubStatus, 'function');
  unsubStatus();
});
