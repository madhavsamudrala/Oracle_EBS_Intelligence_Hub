/* Phase 0 JS test: how ebs-ica-integration.js shows genuine AI failures.
   Run:  node backend/tests/js/test_ica_failure_ui.js
   It loads the REAL ebs-ica-integration.js inside a fake browser (no network, no keys). */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'ebs-ica-integration.js'), 'utf8');

function makeEl(id) {
  return {
    id, className: '', innerHTML: '', style: {}, value: '', children: [], scrollTop: 0, scrollHeight: 0,
    appendChild(c) { this.children.push(c); return c; },
    remove() { this.removed = true; },
  };
}

/* Build a fake browser. `backend` decides what the fake fetch returns for /api/chat. */
function makeBrowser(backend) {
  const els = { chatMessages: makeEl('chatMessages'), chatInput: makeEl('chatInput'), icaStatusBadge: makeEl('icaStatusBadge') };
  const localCalls = [];
  const win = {
    sendChatMessage: function () { localCalls.push('local'); },
    location: {},
  };
  const created = [];
  const document = {
    getElementById(id) { return els[id] || created.find(e => e.id === id) || null; },
    createElement() { const e = makeEl(''); created.push(e); return e; },
    addEventListener() {},
    head: { appendChild() {} },
  };
  /* assigning innerHTML with id="ica-bubble-..." registers the bubble so getElementById finds it */
  const origCreate = document.createElement;
  document.createElement = function () {
    const e = origCreate();
    let html = '';
    Object.defineProperty(e, 'innerHTML', {
      get() { return html; },
      set(v) { html = v; const m = /id="(ica-bubble-\d+)"/.exec(v); if (m) { created.push(Object.assign(makeEl(m[1]), { _owner: e })); } },
    });
    return e;
  };
  const fetch = (url) => {
    if (backend === 'network-down') return Promise.reject(new Error('Failed to fetch'));
    if (String(url).endsWith('/health')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ ica_configured: true }) });
    if (backend === 'http-500') return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(backend) });
  };
  const sandbox = { window: win, document, fetch, console: { info() {}, warn() {}, error() {} },
    setTimeout, setInterval: () => 0, clearTimeout, Date, JSON, Promise, String };
  win.window = win;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  /* `const` at top level of a script is not attached to the context, so expose via a wrapper */
  vm.runInContext(SRC, sandbox);
  return { win, els, created, localCalls };
}

async function run(backend, userText) {
  const b = makeBrowser(backend);
  /* the patch waits for window.sendChatMessage; give it a tick */
  await new Promise(r => setTimeout(r, 400));
  b.win.icaService.online = true;
  b.els.chatInput.value = userText;
  b.win.sendChatMessage();
  await new Promise(r => setTimeout(r, 50));
  return b;
}

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  PASS  ' + name); }
  catch (e) { console.error('  FAIL  ' + name + '\n        ' + e.message); process.exitCode = 1; }
}

(async () => {
  console.log('ebs-ica-integration.js - Phase 0 failure display');

  await test('real answer is shown as an ICA Agent Response', async () => {
    const b = await run({ success: true, message: 'COMP-008 says avoid SELECT *. Tool Trace: hybrid-query - ok', source: 'ica_live' }, 'Why avoid SELECT *?');
    const bubble = b.created.find(e => /^ica-bubble-/.test(e.id));
    assert.ok(bubble, 'bubble exists');
    assert.ok(bubble.innerHTML.includes('ICA Agent Response'), 'labelled as a normal ICA response');
    assert.ok(bubble.innerHTML.includes('COMP-008'), 'shows the answer text');
    assert.ok(!bubble.innerHTML.includes('no answer generated'), 'is not an error bubble');
    assert.strictEqual(b.localCalls.length, 0, 'must not fall back to local');
  });

  await test('genuine AI failure shows a red error bubble and does NOT fall back to local', async () => {
    const b = await run({ success: false, message: 'The ICA agent could not read the knowledge graph because its access token was rejected (Invalid token). No answer was generated.',
      source: 'ica_tool_error', error_kind: 'auth' }, 'Why avoid SELECT *?');
    assert.strictEqual(b.localCalls.length, 0, 'local fallback must not run for a genuine AI failure');
    const bubble = b.created.find(e => /^ica-bubble-/.test(e.id));
    assert.ok(bubble, 'bubble exists');
    assert.ok(bubble.innerHTML.includes('no answer generated'), 'shows "no answer generated"');
    assert.ok(bubble.innerHTML.includes('Invalid token'), 'shows the reason');
    assert.ok(bubble.innerHTML.includes('AI error'), 'labelled as AI error');
    assert.ok(bubble.innerHTML.includes('auth'), 'shows kind');
    assert.strictEqual(bubble.style.border, '1.5px solid #DA1E28', 'red border');
  });

  await test('failure text is HTML-escaped', async () => {
    const b = await run({ success: false, message: '<img src=x onerror=alert(1)>', source: 'ica_tool_error', error_kind: 'auth' }, 'hello there?');
    const bubble = b.created.find(e => /^ica-bubble-/.test(e.id));
    assert.ok(!bubble.innerHTML.includes('<img'), 'raw tag must not appear');
    assert.ok(bubble.innerHTML.includes('&lt;img'), 'escaped tag appears');
  });

  await test('network down still falls back to local (old behaviour kept)', async () => {
    const b = await run('network-down', 'Why avoid SELECT *?');
    await new Promise(r => setTimeout(r, 100));
    assert.strictEqual(b.localCalls.length, 1, 'local answer used when backend is unreachable');
  });

  await test('HTTP 500 from backend still falls back to local (old behaviour kept)', async () => {
    const b = await run('http-500', 'Why avoid SELECT *?');
    await new Promise(r => setTimeout(r, 100));
    assert.strictEqual(b.localCalls.length, 1);
  });

  await test('config_error (ICA not configured) is also shown, not silently replaced', async () => {
    const b = await run({ success: false, message: 'ICA not configured', source: 'config_error' }, 'Why avoid SELECT *?');
    assert.strictEqual(b.localCalls.length, 0);
    const bubble = b.created.find(e => /^ica-bubble-/.test(e.id));
    assert.ok(bubble.innerHTML.includes('ICA not configured'));
  });

  await test('report-intent question still uses the local report path', async () => {
    const b = await run({ success: true, message: 'x', source: 'ica_live' }, 'Show me aged payables for last 30 days');
    assert.strictEqual(b.localCalls.length, 1, 'report intent goes to local generateChatResponse');
  });

  console.log(passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
})();
