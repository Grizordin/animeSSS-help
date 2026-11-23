// Exercise the real import, storage format and episode order with player HTML and mocked requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const source = fs.readFileSync(path.join(__dirname, '..', 'AnimeSSS_help.user.js'), 'utf8');
const section = (from, to) => {
  const start = source.indexOf('        ' + from);
  const end = source.indexOf('        ' + to, start + 1);
  assert.ok(start >= 0 && end > start, from);
  return source.slice(start, end);
};
const code = [
  section('function buildAnimeUniqueKey', 'async function getAnimeDb'),
  section('function parseCurrentPageTranslationId', 'async function isKodikWarmupDoneForCurrentCardDay'),
  section('function getCurrentPageAnimeTitle', 'async function readAutolootProgressInputs'),
  section('async function getAnimeProgress', 'async function syncFinishedArchiveWithDb'),
  section('async function getEpOrder', 'async function buildOrderedPool'),
  section('async function addCurrentAnimeToDb', 'async function openAnimeDbModal')
].join('\n');

(async () => {
  const browser = await chromium.launch({ channel:'msedge', headless:true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.fulfill({ contentType:'text/html',
      body:'<h1>Fixture</h1><div id="kodik_player_ajax" data-news_id="219"></div>' }));
    await page.goto('https://animesss.tv/anime/219-fixture.html');
    const result = await page.evaluate(async code => {
      const option = (number, extra = '') => `<option value="${number}" ${extra}>${number} серия</option>`;
      const list = (first, last) => Array.from({ length:last - first + 1 }, (_, index) => first + index);
      const playlist = (id, title, active = '') => `<li class="b-translator__item ${active}" data-this-link="//kodikplayer.com/serial/${id}/test/720p?only_translations=${id}">${title}</li>`;
      const mark = `<div data-donor-block="videohub"><ul class="b-translators__list"><li data-player-query="provider=videohub">Другой плеер</li></ul></div>
        <div data-donor-block="kodik"><ul class="b-translators__list">${playlist(10, 'Короткая', 'active')}${playlist(10, 'Короткая')}${playlist(20, 'Длинная')}${playlist(30, 'Дополнение')}</ul></div>`;
      const frame = (options, otherSeason = '') => `<div class="serial-seasons-box"><select><option value="1" selected>1</option><option value="2">2</option></select></div>
        <div class="series-options"><div class="season-1"><select>${options}</select></div>${otherSeason}</div>`;
      const frames = {
        10:frame(list(1, 24).map(n => option(n)).join('')),
        20:frame(list(1, 218).filter(n => n !== 17).map(n => option(n)).join('') + option(220, 'data-other-translation="true"'),
          `<div class="season-2"><select>${option(1)}${option(3)}</select></div>`),
        30:frame(option(219))
      };
      const requests = [], notices = [], EP_ORDER_KEY = 'order', SMART_PROGRESSION_KEY = 'progress', RECEIPTS_PER_EP_COMPLETE = 5;
      let failed = false, manual = false, cursorReset = false;
      let db = [{ anime_id:'219', s:1, t_id:'10', t_title:'Короткая', min_ep:1, max_ep:24, addedAt:123 }];
      const clean = text => String(text ?? '').trim();
      const warn = () => {};
      const GM_setValue = async (key, value) => { if (key === SMART_PROGRESSION_KEY && value === null) cursorReset = true; };
      const GM_getValue = async (_key, fallback) => fallback;
      const fetch = async url => {
        const params = new URL(url, location.href).searchParams;
        if (params.get('action') !== 'load_player' || params.get('news_id') !== '219') throw Error('unexpected playlist request');
        requests.push('playlist');
        return new Response(mark);
      };
      const GM_xmlhttpRequest = ({url, onload}) => {
        const id = new URL(url).searchParams.get('only_translations');
        requests.push(id);
        onload({ status:failed && id === '30' ? 503 : 200, responseText:frames[id] });
      };
      const showMessageModal = async (_title, message) => notices.push(message);
      const getAnimeDb = async () => structuredClone(db);
      const setAnimeDb = async value => { db = structuredClone(value); };
      const askMaxEpisodesModal = async () => { manual = true; throw Error('manual input unexpectedly requested'); };
      const removeFinishedAnimeArchiveByKey = async () => {};
      const addFinishedAnimeToArchive = async () => {};
      const copyText = async () => {};
      const buildAutolootProgressSnapshot = async () => ({ watched:new Map(), skippedByAnime:new Map(), receiptCounts:new Map() });
      return await eval(code + `; (async () => {
        if (!await addCurrentAnimeToDb()) throw Error('import did not succeed');
        const entry = normalizeAnimeEntry(db[0]);
        const first = {dbSize:db.length, entry, order:await getEpOrder(entry), progress:await getAnimeProgress(entry), requests:requests.slice()};
        failed = true;
        await addCurrentAnimeToDb();
        const preserved = getAnimeEpisodeNumbers(db[0]);
        failed = false;
        document.querySelector('#kodik_player_ajax').innerHTML = mark;
        const sparse = await getKodikEpisodeAvailability(collectKodikTranslations(document), 2);
        const sparseEntry = normalizeAnimeEntry({...entry, s:2, episode_translations:sparse.groups});
        return { ...first, preserved, manual, cursorReset, notices,
          sparse:await getEpOrder(sparseEntry, {'219_s2':[3,2]}), sparseCount:(await getAnimeProgress(sparseEntry)).totalEpisodes };
      })()`);
    }, code);
    assert.deepEqual(result.requests, ['playlist', '10', '20', '30']);
    assert.equal(result.dbSize, 1);
    assert.equal(result.entry.addedAt, 123);
    assert.equal(result.entry.t_id, '20');
    assert.equal(result.entry.episode_translations.find(group => group.episodes.includes(17)).t_id, '10');
    assert.equal(result.entry.episode_translations.find(group => group.episodes.includes(219)).t_id, '30');
    assert.deepEqual(result.order, Array.from({length:219}, (_, i) => i + 1));
    assert.equal(result.progress.totalEpisodes, 219);
    assert.deepEqual(result.preserved, result.order, 'a failed voice request does not erase already verified episodes');
    assert.match(result.notices[1], /не загрузилась/);
    assert.deepEqual(result.sparse, [3, 1], 'keep custom order and append missing verified episodes only');
    assert.equal(result.sparseCount, 2);
    assert.equal(result.manual, false);
    assert.equal(result.cursorReset, true);
    console.log('AUTOLOOT_EPISODES_OK');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
