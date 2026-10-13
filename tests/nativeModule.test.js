const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

test('NativeModule - Loads Rust binding and enumerates audio devices', () => {
  const nativeModule = require('../native-module');
  assert.ok(nativeModule, 'Native module should export functions');

  assert.strictEqual(typeof nativeModule.getInputDevices, 'function');
  assert.strictEqual(typeof nativeModule.getOutputDevices, 'function');
  assert.strictEqual(typeof nativeModule.SystemAudioCapture, 'function');

  const inputs = nativeModule.getInputDevices();
  assert.ok(Array.isArray(inputs), 'Inputs must be array');
  for (const input of inputs) {
    assert.ok(typeof input.id === 'string', 'Input id must be string');
    assert.ok(typeof input.name === 'string', 'Input name must be string');
  }

  const outputs = nativeModule.getOutputDevices();
  assert.ok(Array.isArray(outputs), 'Outputs must be array');
  for (const output of outputs) {
    assert.ok(typeof output.id === 'string', 'Output id must be string');
    assert.ok(typeof output.name === 'string', 'Output name must be string');
  }

  const capture = new nativeModule.SystemAudioCapture(null);
  assert.strictEqual(capture.getSampleRate(), 16000, 'Sample rate must be 16kHz');
});
