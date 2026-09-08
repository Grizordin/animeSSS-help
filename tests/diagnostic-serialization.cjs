// Offline regression: actual diagnostic -> sanitizer -> GM queue -> batch sender.
// No network requests or changes to a real Tampermonkey store.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '..', 'AnimeSSS_help.user.js'), 'utf8');
new vm.Script(source);
function extract(name) {
  const match = new RegExp(`^([ \\t]*)(?:async )?function ${name}\\(`, 'm').exec(source);
  assert.ok(match, `Missing ${name}`);
  const lines = source.slice(match.index).split(/\r?\n/);
  for (let n = 2; n <= lines.length; n++) {
    if (lines[n - 1] !== match[1] + '}') continue;
    const candidate = lines.slice(0, n).join('\n');
    try { new vm.Script('(' + candidate + ')'); return candidate; } catch {}
  }
  throw new Error(`Cannot extract ${name}`);
}
const names = ['suiteTelemetrySanitize', 'suiteTelemetryReadQueue',
  'suiteTelemetryNormalizeRecord', 'suiteTelemetryWriteQueue', 'suiteTelemetryTakeBatch',
  'suiteTelemetryPersistPending', 'suiteSelfDiagnosticTrace', 'suiteSelfDiagnosticIssue',
  'suiteTelemetryLog', 'suiteTelemetryFlush'];
const constantNames = ['SUITE_TELEMETRY_QUEUE_KEY', 'SUITE_TELEMETRY_MAX_EVENT_CHARS',
  'SUITE_TELEMETRY_MAX_QUEUE_CHARS', 'SUITE_TELEMETRY_MAX_BATCH_CHARS',
  'SUITE_TELEMETRY_MAX_EVENTS', 'SUITE_TELEMETRY_BATCH_SIZE', 'SUITE_TELEMETRY_MAX_AGE_MS',
  'SUITE_SELF_DIAGNOSTIC_COOLDOWN_KEY', 'SUITE_SELF_DIAGNOSTIC_COOLDOWN_MS',
  'SUITE_SELF_DIAGNOSTIC_MAX_RECENT'];
const constants = constantNames.map(name => {
  const match = source.match(new RegExp(`^  const ${name} = .*;$`, 'm'));
  assert.ok(match, name);
  return match[0];
}).join('\n');
const context = vm.createContext({ assert, console, clearTimeout });
const setup = String.raw`
let passed = 0;
const check = (value, label) => { assert.ok(value, label); passed++; };
const storage = new Map(), sent = [];
const gmGet = (key, fallback) => storage.has(key) ? storage.get(key) : fallback;
const gmSet = (key, value) => storage.set(key, value);
const gmDelete = key => storage.delete(key);
const GM_getValue = gmGet, GM_setValue = gmSet;
const window = {}, location = {pathname:'/cards/pack/'};
const document = {visibilityState:'visible'};
const suiteSelfDiagnosticRecent = [];
const suiteTelemetrySessionId = 'test-session', suiteTelemetryInstallId = 'test-install';
let suiteTelemetryPendingRecords = [], suiteTelemetryPersistTimer = null;
let suiteTelemetryPersistPromise = Promise.resolve(), suiteTelemetryFlushPromise = null;
const suiteTelemetryWithQueueLock = async fn => fn();
const suiteTelemetrySchedulePersist = () => {};
let acceptSend = false;
const suiteReportEvent = async (type, payload) => {
  if (!acceptSend) return false;
  sent.push(JSON.parse(JSON.stringify({type,payload})));
  return true;
};
`;
const tests = String.raw`
const details = {
  source:'choice_confirmation', stage:'error',
  snapshot:{packStage:'error', pendingChoice:{packId:'pack-1',cardId:'card-1',startedAt:10},
    buyButton:{present:true,disabled:true},
    recentPackResources:[{path:'/ajax/open_packs/',responseStatus:502,duration:127}],
    visibleLoaders:[{className:'loader'}]},
  expectation:{kind:'pack_close_after_card',before:{cardCount:3},
    initial:{card:{id:'card-1',rank:'D'}}},
  recentActions:[{at:10,action:'pick',details:{card:{id:'card-1'},
    user_hash:'PRIVATE-HASH',token:123456789}}]
};
const before = JSON.stringify(details);
check(suiteSelfDiagnosticIssue('auto_open','pack_did_not_close_after_card_pick',details), 'incident accepted');
await suiteTelemetryFlush('test-offline');
const stored = JSON.parse(storage.get(SUITE_TELEMETRY_QUEUE_KEY));
check(stored.length === 1, 'failed send retains one record in GM storage');
check(!JSON.stringify(stored).includes('[object Object]'), 'nested details not stringified');
const saved = stored[0].data.details;
check(saved.snapshot.pendingChoice.cardId === 'card-1', 'pending choice retained');
check(saved.snapshot.buyButton.disabled === true, 'button state retained');
check(saved.snapshot.recentPackResources[0].responseStatus === 502, 'resource status retained');
check(saved.snapshot.visibleLoaders[0].className === 'loader', 'loaders retained');
check(saved.expectation.initial.card.rank === 'D', 'initial expectation retained');
check(saved.recentActions[0].details.card.id === 'card-1', 'action details retained');
check(saved.recentActions[0].details.user_hash === '[redacted]', 'nested hash redacted');
check(saved.recentActions[0].details.token === '[redacted]', 'numeric token redacted');
check(JSON.stringify(details) === before, 'input not mutated');
check(!suiteSelfDiagnosticIssue('auto_open','pack_did_not_close_after_card_pick',details), 'six-hour repeat suppressed');
acceptSend = true;
await suiteTelemetryFlush('test-reconnect');
check(sent.length === 1, 'one batch on reconnect');
check(sent[0].payload.module === 'suite', 'supported transport channel');
check(sent[0].payload.events[0].module === 'auto_open', 'original component preserved');
check(sent[0].payload.events[0].data.details.snapshot.pendingChoice.packId === 'pack-1', 'details survive actual batching');
check(suiteTelemetryReadQueue().length === 0, 'acknowledged event removed');
// Cooldown expires without introducing a timer or changing its duration.
gmSet(SUITE_SELF_DIAGNOSTIC_COOLDOWN_KEY, {'auto_open:pack_did_not_close_after_card_pick':Date.now()-SUITE_SELF_DIAGNOSTIC_COOLDOWN_MS-1});
check(suiteSelfDiagnosticIssue('auto_open','pack_did_not_close_after_card_pick',details), 'report allowed after cooldown');
await suiteTelemetryFlush('test-expired');
check(sent.length === 2, 'expired cooldown report sent');
const sensitive = suiteTelemetrySanitize({Cookie:'PRIVATE-COOKIE',authorization:'PRIVATE-AUTH',
  password:false,url:'https://example.invalid/?user_hash=PRIVATE-URL&x=1',
  error:new Error('Failed https://example.invalid/?token=PRIVATE-ERROR')});
check(!JSON.stringify(sensitive).includes('PRIVATE-'), 'headers, URL and Error fields redacted');
check(sensitive.password === '[redacted]', 'boolean secret key redacted');
const circular = {}; circular.self = circular;
check(suiteTelemetrySanitize(circular).self === '[circular]', 'cycles safe');
const deep = {a:{b:{c:{d:{e:{f:{token:'PRIVATE-DEEP'}}}}}}};
check(suiteTelemetrySanitize(deep).a.b.c.d.e.f === '[truncated: max depth]', 'explicit depth limit');
check(suiteTelemetrySanitize(Array(300).fill(1)).length === 250, 'array bound retained');
check(Object.keys(suiteTelemetrySanitize(Object.fromEntries(Array.from({length:120},(_,i)=>['k'+i,i])))).length === 100, 'object bound retained');
check(suiteTelemetrySanitize('x'.repeat(40000)).length <= 30002, 'string bound retained');
check(suiteTelemetrySanitize('data:video/mp4;base64,PRIVATE-MEDIA').includes('[payload omitted:'), 'media payload omitted');
suiteTelemetryLog('suite','oversized', {items:Array.from({length:100},()=> 'x'.repeat(30000))}, 'error');
await suiteTelemetryFlush('test-oversize');
const last = sent.at(-1).payload.events[0];
check(last.data.truncated === true, 'oversized event marked');
check(JSON.stringify(last).length <= SUITE_TELEMETRY_MAX_EVENT_CHARS, 'event size limit retained');
console.log('diagnostic-serialization: ' + passed + ' checks passed');
`;
vm.runInContext(`(async () => {\n${constants}\n${setup}\n${names.map(extract).join('\n')}\n${tests}\n})()`, context)
  .catch(error => { console.error(error); process.exitCode = 1; });
