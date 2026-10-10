// Offline DOM/storage fixtures. No requests to AnimeSSS or writes to userscript storage.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { chromium } = require('playwright');
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
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.TEST_BROWSER_CHANNEL || 'msedge' });
  let passed = 0;
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<body></body>' }));
    await page.goto('https://fixture.invalid/');
    passed += await page.evaluate(code => {
      let passed = 0;
      const check = (v, label) => { if (!v) throw Error(label); passed++; };
      const ANIME_DB_MODAL_ID = 'aw-anime-db-modal';
      const loads = [];
      const buildAnimeDbListWithProgress = () => new Promise((resolve, reject) => loads.push({ resolve, reject }));
      const warn = () => {}, escapeHtml = String, buildAnimeUniqueKey = item => item.anime_id;
      eval(code);
      return (async () => {
        let loading = openAnimeDbModal();
        let modal = document.getElementById(ANIME_DB_MODAL_ID);
        check(!!modal?.querySelector('[role="status"]'), 'loading dialog exists before storage resolves');
        modal.querySelector('.aw-modal-close').click();
        loads.shift().resolve([]); await loading;
        check(!document.getElementById(ANIME_DB_MODAL_ID), 'completion cannot reopen a closed modal');

        const first = openAnimeDbModal(), second = openAnimeDbModal();
        const old = loads.shift(), newest = loads.shift();
        newest.resolve([{ anime_id: '2', s: 1, t_id: '3', t_title: 'Test', title: 'Newest', progress: { processedEpisodes: 1, totalEpisodes: 2 } }]);
        await second;
        old.resolve([]); await first;
        modal = document.getElementById(ANIME_DB_MODAL_ID);
        check(modal.textContent.includes('Newest') && modal.textContent.includes('1 / 2'), 'late old load cannot overwrite latest list');
        check(document.querySelectorAll('#' + ANIME_DB_MODAL_ID).length === 1, 'only one modal is present');

        loading = openAnimeDbModal(); loads.shift().reject(Error('fixture storage failure')); await loading;
        modal = document.getElementById(ANIME_DB_MODAL_ID);
        check(!!modal.querySelector('[role="alert"]'), 'storage failure displays readable error');
        modal.querySelector('.aw-action-btn').click();
        check(loads.length === 1 && !!document.querySelector('[role="status"]'), 'retry starts fresh load');
        loads.shift().resolve([]); await Promise.resolve(); await Promise.resolve();
        check(document.getElementById(ANIME_DB_MODAL_ID).textContent.includes('пока пуста'), 'retry can finish with empty list');
        return passed;
      })();
    }, ['createSimpleModal', 'removeAnimeDbModal', 'openAnimeDbModal'].map(extract).join('\n'));

    const names = ['createPanel', 'renderPanelCollapsedState', 'applyPanelCollapsedState', 'applyPanelPosition',
      'suiteClampToViewport', 'clampPanelToViewport', 'setPanelText', 'setPanelHidden', 'updateButtonStateNow',
      'updateButtonState', 'handleTabFocus', 'scheduleNext'];
    for (const mobile of [false, true]) for (const collapsed of [false, true]) {
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 });
      passed += await page.evaluate(async ({ code, mobile, collapsed }) => {
        document.head.innerHTML = ''; document.body.innerHTML = '';
        let passed = 0, receiptReads = 0, liveUpdates = 0, schedules = 0;
        const check = (v, label) => { if (!v) throw Error(label); passed++; };
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        const PANEL_COLLAPSED_KEY = 'collapsed', PANEL_POSITION_KEY = 'position';
        const COLLECTION_PAUSED_KEY = 'paused', DAILY_PROGRESS_KEY = 'daily';
        let panelStyleElement, panelPaused = false, panelStateUpdateQueued = false, panelStateUpdatePromise = null;
        const animeDbEmpty = false, RANK_CONFIG = [{ key: 'e', label: 'E', color: '#fff', bg: '#111' }];
        const saved = mobile ? { left: '900px', top: '900px' } : { left: '720px', top: '110px' };
        const GM_getValue = async (key, fallback) => {
          if (key === PANEL_COLLAPSED_KEY || key === PANEL_POSITION_KEY) await sleep(35);
          return ({ collapsed, position: saved, paused: false, daily: { current: 12 } })[key] ?? fallback;
        };
        const GM_setValue = async () => { throw Error('restoration must not rewrite stored position'); };
        const GM_addStyle = css => { const el = document.createElement('style'); el.textContent = css; document.head.appendChild(el); return el; };
        const suiteShouldFreezeForVirtualKeyboard = () => false;
        const suiteGetVisibleViewport = () => ({ left: 0, top: 0, right: innerWidth, bottom: innerHeight, width: innerWidth, height: innerHeight });
        const suiteKeepInViewport = () => {}, suiteResolveFloatingButtonOverlaps = () => {};
        const installPanelDrag = () => {}, toggleWatch = () => {}, openAnimeDbModal = () => {}, openStatsModal = () => {}, togglePanelCollapsed = () => {};
        const updateCardCounter = async () => {}, safePush = () => {}, warn = () => {};
        const renderPanelLiveState = () => { liveUpdates++; };
        const getKnownDailyLimit = async () => 35, suiteGetAuthPause = () => false;
        const escapeHtml = String, cleanCardNameForPanel = String;
        let releaseReceipts;
        const receipts = new Promise(resolve => { releaseReceipts = resolve; });
        const getAllReceipts = () => { receiptReads++; return receipts; };
        let scriptEnabledWatch = true, checkNewCardTimeoutId = 1, nextRunAt = Date.now() + 30000;
        const isLoopRunning = false;
        const RESUME_DELAY_MS = 1000, EMPTY_DB_RECHECK_MS = 60000;
        const claimTabLock = () => true, mainCardCheckLogic = () => {};
        const saveDiagnosticLog = () => { schedules++; }, stopMainCardCheckLogic = () => {};
        eval(code);
        const frames = []; let sampling = true;
        const sample = () => {
          const panel = document.getElementById('aw-active-tab-panel');
          if (panel && getComputedStyle(panel).visibility !== 'hidden') {
            const rect = panel.getBoundingClientRect();
            frames.push({ x: rect.x, y: rect.y, collapsed: panel.classList.contains('aw-is-collapsed') });
          }
          if (sampling) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
        const creating = createPanel();
        await sleep(20);
        check(getComputedStyle(document.getElementById('aw-active-tab-panel')).visibility === 'hidden', 'panel stays hidden while position loads');
        await creating; await sleep(30);
        const panel = document.getElementById('aw-active-tab-panel');
        const before = panel.getBoundingClientRect();
        check(getComputedStyle(panel).visibility !== 'hidden' && receiptReads === 1, 'panel appears before slow receipt history resolves');
        check(frames.length > 0 && frames.every(frame => frame.collapsed === collapsed), 'no expanded flash when saved state is collapsed');
        check(frames.every(frame => Math.abs(frame.x - before.x) < 1 && Math.abs(frame.y - before.y) < 1), 'all visible startup frames have final position');
        if (!mobile) check(before.x === 720 && before.y === 110, 'desktop saved coordinates restored');
        else check(before.left >= 7 && before.right <= innerWidth - 7 && before.top >= 7 && before.bottom <= innerHeight - 7, 'offscreen mobile coordinates clamped before display');
        check(document.getElementById('aw-compact-limit').textContent === '12/35', 'daily state prepared before display');
        releaseReceipts([{ receivedAt: 1, rank: 'e', cardName: 'Fixture card with a very long name '.repeat(8) }]);
        await panelStateUpdatePromise; await sleep(20);
        check(Math.abs(panel.getBoundingClientRect().top - before.top) < 1, 'late last-card row does not move top edge');
        const after = panel.getBoundingClientRect();
        check(Math.abs(after.height - before.height) < 1 && Math.abs(after.width - before.width) < 1, 'long card name cannot resize panel');
        check(after.bottom <= innerHeight - 7 && after.right <= innerWidth - 7, 'late history cannot push panel outside viewport');
        check(document.getElementById('aw-active-tab-last-card').textContent.includes('Fixture card'), 'last card still appears');
        const readsBefore = receiptReads, liveBefore = liveUpdates;
        for (let i = 0; i < 20; i++) handleTabFocus({ type: 'pointerdown' });
        await sleep(10);
        check(receiptReads === readsBefore && liveUpdates === liveBefore + 20, 'ordinary pointer presses do not read history');
        nextRunAt = 0; checkNewCardTimeoutId = 0;
        handleTabFocus({ type: 'pointerdown' }); await sleep(10);
        check(schedules === 1 && receiptReads === readsBefore, 'click can still resume timer without reading history');
        nextRunAt = Date.now() + 30000;
        handleTabFocus({ type: 'focus' }); await panelStateUpdatePromise;
        check(receiptReads === readsBefore + 1, 'actual window focus still refreshes data');
        clearTimeout(checkNewCardTimeoutId);
        sampling = false;
        return passed;
      }, { code: names.map(extract).join('\n'), mobile, collapsed });
    }
    console.log(JSON.stringify({ result: 'AUTOLOOT_UI_REGRESSION_OK', passed, viewports: ['1280x900', '390x844'] }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
