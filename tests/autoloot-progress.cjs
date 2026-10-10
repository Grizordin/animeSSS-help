// Real progress functions with local storage mocks; no site/account requests.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '..', 'AnimeSSS_help.user.js'), 'utf8');
new vm.Script(source);
function extract(name) {
  const m = new RegExp('^([ \\t]*)(?:async )?function ' + name + '\\(', 'm').exec(source);
  if (!m) throw Error(name);
  const lines = source.slice(m.index).split(/\r?\n/);
  for (let n = 2; n <= lines.length; n++) {
    if (lines[n - 1] !== m[1] + '}') continue;
    const code = lines.slice(0, n).join('\n');
    try { new vm.Script('(' + code + ')'); return code; } catch {}
  }
  throw Error(name);
}
const names = ['getGmStoreKey', 'getGmStore', 'getAllReceipts', 'normalizeAnimeEntry', 'getAnimeDb',
  'buildOrderedPool', 'getEpOrder', 'readAutolootProgressInputs', 'buildAutolootProgressSnapshot',
  'getAnimeProgress', 'updateSmartTarget'];
let passed = 0;
function check(v, label) { assert.ok(v, label); passed++; }
function fixture() {
  const db = new Map(), reads = new Map(); let day = '2026-10-07', yields = 0, archiveCalls = 0;
  const ctx = vm.createContext({
    ANIME_DB_KEY: 'pool', EP_ORDER_KEY: 'order', SMART_PROGRESSION_KEY: 'state', AW_GM_DB_PREFIX: 'test_',
    AW_GM_STORES: ['anime_history', 'skipped_episodes', 'card_receipts'], RECEIPTS_PER_EP_COMPLETE: 5,
    GM_getValue: async (key, fallback) => { reads.set(key, (reads.get(key) || 0) + 1); return structuredClone(db.has(key) ? db.get(key) : fallback); },
    GM_setValue: async (key, value) => db.set(key, structuredClone(value)), GM_listValues: async () => [...db.keys()],
    getMskDateKey: () => day,
    setTimeout: (fn, ms) => { yields++; return setTimeout(fn, ms); },
    addFinishedAnimeToArchive: async (entry, progress) => { check(progress.isFullyFarmed, 'archive receives known completed progress'); archiveCalls++; }
  });
  vm.runInContext(names.map(extract).join('\n'), ctx);
  return { ctx, db, reads, day: value => { day = value; }, yields: () => yields, archived: () => archiveCalls };
}
const anime = (id = '33', max = 1168) => ({ anime_id: id, s: 1, min_ep: 1, max_ep: max, title: 'Fixture' });
(async () => {
  const f = fixture();
  f.db.set('pool', [anime()]);
  f.db.set('test_skipped_episodes', Array.from({ length: 1168 }, (_, i) => ({ skipKey: `33_s1_e${i + 1}`, animeId: '33', episode: i + 1 })));
  f.db.set('test_card_receipts', Array.from({ length: 3000 }, (_, i) => ({ cardId: i, receivedAt: i, watchedAnimeId: '99', watchedEpisode: i + 1 })));
  let timerFired = false; setTimeout(() => { timerFired = true; }, 0);
  let state = await f.ctx.updateSmartTarget();
  check(state.index === -1, '1168 exhausted episodes produce no target');
  check(f.reads.get('test_anime_history') === 1 && f.reads.get('test_skipped_episodes') === 1, 'history and skipped list each read once, not 1168 times');
  check(f.reads.get('test_card_receipts') === 1, 'legacy receipt array read once');
  check(f.reads.get('order') === 1, 'episode order read once');
  check(timerFired && f.yields() > 1, 'long search gives event loop time to render');
  const initialYields = f.yields(), archived = f.archived();
  await f.ctx.updateSmartTarget();
  check(f.yields() === initialYields && f.archived() === archived, 'unchanged exhausted pool is not scanned or archived again');
  f.db.set('pool', [anime(), anime('208', 399)]);
  state = await f.ctx.updateSmartTarget();
  check(state.index === 1 && state.ep_offset === 0, 'new anime resumes selection without reload');

  // An external tab changing skipped/history/order/receipts must invalidate exhaustion.
  f.db.set('pool', [anime()]); f.db.set('state', { index: -1, ep_offset: 0 });
  await f.ctx.updateSmartTarget();
  f.db.set('test_skipped_episodes', f.db.get('test_skipped_episodes').filter(r => r.episode !== 17));
  state = await f.ctx.updateSmartTarget();
  check(state.index === 0 && state.ep_offset === 16, 'external skip removal invalidates cache');
  f.db.set('test_anime_history', [{ animeId: '33', episodes: [17] }]);
  await f.ctx.updateSmartTarget();
  f.db.set('test_anime_history', []);
  state = await f.ctx.updateSmartTarget();
  check(state.ep_offset === 16 && state.index === 0, 'history removal invalidates cache');
  f.db.set('order', { '33_s1': [1169] }); f.db.set('state', { index: -1, ep_offset: 0 });
  state = await f.ctx.updateSmartTarget();
  check(state.index === 0 && state.ep_offset === 0, 'custom episode order respected');

  const r = fixture(); r.db.set('pool', [anime('1', 1)]);
  for (let i = 0; i < 5; i++) r.db.set(`test_receipt_v2_owner_${i}`, { ownerId: i + 1, watchedAnimeId: '1', watchedEpisode: 1 });
  check((await r.ctx.updateSmartTarget()).index === -1, 'five real copies complete episode');
  const receiptReads = [...r.reads].filter(([k]) => k.includes('receipt_v2')).reduce((n, [, c]) => n + c, 0);
  await r.ctx.updateSmartTarget();
  check([...r.reads].filter(([k]) => k.includes('receipt_v2')).reduce((n, [, c]) => n + c, 0) === receiptReads, 'cached exhaustion does not reread individual receipts');
  r.db.delete('test_receipt_v2_owner_0');
  state = await r.ctx.updateSmartTarget();
  check(state.index === 0 && state.cards_collected === 4, 'receipt deletion invalidates cache without fabricating counts');
  r.db.set('test_card_receipts', [{ receivedAt: 123, cardId: 10, watchedAnimeId: '1', watchedEpisode: 1 }]);
  check((await r.ctx.updateSmartTarget()).index === -1, 'legacy receipt change is observed');
  r.day('2026-10-08'); r.reads.clear();
  await r.ctx.updateSmartTarget();
  check(r.reads.has('test_receipt_v2_owner_1'), 'new day rechecks exhaustion');
  r.db.set('test_card_receipts', []);
  check((await r.ctx.updateSmartTarget()).index === 0, 'legacy clear reopens eligible episode');

  const b = fixture(); b.db.set('pool', [anime('1', 1)]);
  for (let i = 0; i < 130; i++) b.db.set(`test_receipt_v2_owner_${i}`, { ownerId: i + 1, watchedAnimeId: '99', watchedEpisode: i });
  check((await b.ctx.getAllReceipts()).length === 130 && b.yields() === 2, 'journal reads are split into bounded batches');
  const progress = await f.ctx.getAnimeProgress(anime());
  check(progress.totalEpisodes === 1168 && progress.processedEpisodes === 1167, 'progress display retains accurate counts');
  const empty = fixture(); check((await empty.ctx.updateSmartTarget()).index === -1, 'empty pool remains safe');
  // Opening a multi-anime database must share one journal snapshot, including archiving.
  const list = fixture();
  list.db.set('pool', Array.from({ length: 10 }, (_, i) => anime(String(i + 1), 1)));
  list.db.set('test_skipped_episodes', Array.from({ length: 5 }, (_, i) => ({ animeId: String(i + 1), episode: 1, skipKey: `${i + 1}_s1_e1` })));
  for (let i = 0; i < 130; i++) list.db.set(`test_receipt_v2_owner_${i}`, { ownerId: i + 1, watchedAnimeId: '99', watchedEpisode: i });
  let archive = [];
  Object.assign(list.ctx, {
    getFinishedAnimeArchive: async () => structuredClone(archive),
    setFinishedAnimeArchive: async value => { archive = structuredClone(value); },
    buildAnimeUniqueKey: entry => entry.anime_id,
    removeFinishedAnimeArchiveByKey: async () => { throw Error('unexpected archive removal'); }
  });
  vm.runInContext(['addFinishedAnimeToArchive', 'buildAnimeDbListWithProgress'].map(extract).join('\n'), list.ctx);
  const items = await list.ctx.buildAnimeDbListWithProgress();
  check(items.length === 10 && items.filter(item => item.progress.isFullyFarmed).length === 5, 'list progress remains correct');
  check(archive.length === 5, 'completed anime are still archived');
  check(list.reads.get('test_card_receipts') === 1, 'list reads legacy receipts once for all anime');
  check([...list.reads].filter(([key]) => key.includes('receipt_v2')).every(([, n]) => n === 1), 'list reads each journal entry only once');
  await list.ctx.buildAnimeDbListWithProgress();
  check(archive.length === 5, 'reopening does not duplicate archived anime');
  list.db.set('pool', []); list.reads.clear();
  check((await list.ctx.buildAnimeDbListWithProgress()).length === 0 && !list.reads.has('test_card_receipts'), 'empty database does not read receipts');
  console.log(JSON.stringify({ result: 'AUTOLOOT_PROGRESS_OK', passed, exhaustedSeries: 1168, legacyReceipts: 3000 }));
})().catch(error => { console.error(error); process.exitCode = 1; });
