import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../apple/Go Search/Shared (App)/Resources/Script.js', import.meta.url), 'utf8');
function screen(postMessage) {
  const attributes = new Map();
  const button = { disabled: false, textContent: '', setAttribute: (k, v) => attributes.set(k, v), removeAttribute: k => attributes.delete(k), addEventListener: (_type, listener) => { button.click = listener; } };
  const status = { textContent: '' };
  const context = vm.createContext({ document: { querySelector: selector => selector === '#settings-status' ? status : button }, webkit: { messageHandlers: { controller: { postMessage } } } });
  vm.runInContext(source, context);
  return { button, status, attributes, context };
}

test('Safari settings requests are single-flight and native errors permit retry', () => {
  const messages = [];
  const ui = screen(message => messages.push(message));
  ui.button.click();
  ui.button.click();
  assert.deepEqual(messages, ['open-preferences']);
  assert.equal(ui.attributes.get('aria-busy'), 'true');
  vm.runInContext("settingsResult('Safari could not open settings')", ui.context);
  assert.equal(ui.status.textContent, 'Safari could not open settings');
  assert.equal(ui.button.disabled, false);
  assert.equal(ui.attributes.has('aria-busy'), false);
  ui.button.click();
  assert.equal(messages.length, 2);
  assert.equal(ui.status.textContent, '');
});

test('a missing native bridge displays recovery instructions and restores the button', () => {
  const ui = screen(() => { throw new Error('Bridge unavailable'); });
  ui.button.click();
  assert.equal(ui.button.disabled, false);
  assert.match(ui.status.textContent, /Safari → Settings → Extensions/);
  assert.equal(ui.button.textContent, 'Quit & Open Safari Settings');
});
