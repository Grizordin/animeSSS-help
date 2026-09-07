// Run with Node and Playwright available (NODE_PATH may point to the bundled runtime).
// All network traffic is mocked; no rewards or account actions are performed.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');
const source = fs.readFileSync(path.join(__dirname, '..', 'AnimeSSS_help.user.js'), 'utf8');
new vm.Script(source);
function extract(name) {
  const start = new RegExp(`^([ \\t]*)(?:async )?function ${name}\\(`, 'm').exec(source);
  if (!start) throw new Error(`Missing function: ${name}`);
  const indent = start[1];
  const tail = source.slice(start.index);
  const lines = tail.split(/\r?\n/);
  for (let n = 1; n <= lines.length; n++) {
    if (n > 1 && lines[n - 1] !== indent + '}') continue;
    const candidate = lines.slice(0, n).join('\n');
    try { new vm.Script('(' + candidate + ')'); return candidate; } catch {}
  }
  throw new Error(`Cannot extract ${name}`);
}
const names = ['suiteIsAuthenticationError', 'suiteDocumentIsGuest', 'suiteAuthPauseKey',
  'suiteGetAuthPause', 'suitePauseForAuthentication', 'suiteFunctionChainHas',
  'parseNumber', 'parseLastNumber', 'getCurrentExp', 'getGachaBlock', 'getRewardType',
  'getFirstReward', 'isGachaItemClaimed', 'isRewardAlreadyCollected', 'getSnapshotDocument',
  'getGachaResultText', 'isSuccessfulGachaResponse', 'postGachaRewardOnce', 'runDailyCheck',
  'fetchData', 'scheduleNext', 'getPanelCountdown', 'getRewardCycleInfo', 'getMsUntilNextMoscowCheck',
  'suiteRunLightweightHealthCheck'];
const functions = names.map(extract).join('\n');
const setup = String.raw`
let passed = 0;
function check(value, label) { if (!value) throw new Error(label); passed++; }
async function rejects(fn, pattern, label) {
  try { await fn(); } catch(e) { check(pattern.test(e.message), label + ': ' + e.message); return; }
  throw new Error(label + ': did not reject');
}
const doc = html => new DOMParser().parseFromString(html, 'text/html');
const fixture = (inner = '', cls = 'is-wait') => '<div class="club__block"><div class="club__title">Бесконечная гача наград</div><div class="club__rewards" data-enlightenment="3220000"><div class="club__rewards-item ' + cls + '" data-step="223" data-need="3220000"><div class="club__rewards-item-image--Exp"></div><div class="club__rewards-item-exp">' + inner + '</div></div></div></div>';
const checkedHtml = fixture('<span>3220000<i class="fal fa-check-circle"></i></span>');
const guestHtml = '<div class="login--not-logged"><form><input name="login_password"></form></div>';
let suiteAuthDocumentStartedAt = Date.now() - 100000;
const suiteAuthPauses = new Map();
const logs = [];
const suiteTelemetryLog = (...args) => logs.push(args);
const suiteGetCurrentUserName = () => 'Test';
const suiteGetUserHash = () => 'test-placeholder';
let state = { isRunning:false };
window.__suiteGachaAutolootState = state;
const cfg = { modGachaAutoloot:true };
const getClubPath = () => '/clubs/2/';
let activeWindow = true, finished = false, cycle = '2026-09-06', history = [], daily = {}, retries = 0, posts = 0;
const hasMoscowTimeReached = () => activeWindow;
const isTodayFinished = () => finished;
const getTodayKey = () => cycle;
const stopRetrying = () => { retries = 0; };
const startRetrying = () => { retries++; };
const setStatus = () => {};
const scheduleNextCheck = () => {};
const acquireTabLock = () => true;
const releaseTabLock = () => {};
const getCheckThrottleDelay = () => 0;
const reserveCheckSlot = () => {};
const getRewardSettings = () => ({Exp:true});
const saveRewardHistoryEntry = entry => history.push(entry);
const markToday = (status, details = {}) => { daily = {status,dateKey:cycle,...details}; finished = ['looted','looted_external','skipped'].includes(status); };
const getDailyState = () => daily;
const REWARDS = [{id:'Exp',label:'Опыт'}];
let postReply = {status:'ok',reward_type:'Exp',step:223};
let postGachaReward = async () => { posts++; return postReply; };
const normalizeRewardType = v => v;
const extractRewardQuantity = () => 120;
const notify = () => {};
let diagnosticRequestSequence = 0;
const diagnosticSanitizeHeaders = v => v;
const diagnosticSanitizeBody = v => v;
const diagnosticSanitize = v => String(v);
const diagnosticParseResponse = v => v;
const saveDiagnosticLog = (...args) => logs.push(args);
let stopped = 0, checkNewCardTimeoutId = null, nextRunAt = 0, isLoopRunning = false;
const stopMainCardCheckLogic = () => { stopped++; nextRunAt = 0; };
const mainCardCheckLogic = () => {};
const updateButtonState = () => {};
const safePush = () => {};
let panelPaused = false, scriptEnabledWatch = true, animeDbEmpty = false;
const formatMs = v => String(v);
let suiteHealthVisibleSince = Date.now();
const issues = [];
const suiteSelfDiagnosticIssue = (...args) => issues.push(args);
const CHECK_HOUR = 21, CHECK_MINUTE = 6, CHECK_SECOND = 10, WINDOW_END_HOUR = 21;
let moscow = {dateKey:'2026-09-07',hour:21,minute:0,second:0};
const getMoscowParts = () => moscow;
const shiftDateKey = () => '2026-09-06';
`;
const tests = String.raw`
check(!isRewardAlreadyCollected(doc(fixture())), 'unavailable is not collected');
check(isRewardAlreadyCollected(doc(checkedHtml)), 'site checkmark means collected');
check(!isRewardAlreadyCollected(doc(fixture() + '<i class="fa-check-circle"></i>')), 'unrelated checkmark ignored');
check(!isRewardAlreadyCollected(doc(fixture() .replace('</div></div></div>', '</div></div><div class="club__rewards-item"><div class="club__rewards-item-exp"><i class="fa-check-circle"></i></div></div></div>'))), 'later reward must not complete first');
check(getFirstReward(doc(checkedHtml)).step === 223, 'step parsed');
check(getCurrentExp(doc(checkedHtml)) === 3220000, 'enlightenment parsed');
check(suiteDocumentIsGuest(doc(guestHtml)), 'guest form detected');
check(!suiteDocumentIsGuest(doc(guestHtml + '<a href="/index.php?action=logout">Выход</a>')), 'authenticated page with login modal is not guest');
check(!suiteIsAuthenticationError('HTTP 502'), 'temporary server error is not auth failure');
check(suiteIsAuthenticationError('Вы не авторизованы'), 'Russian auth error');
let calls = 0;
let responseHtml = checkedHtml;
fetch = async () => { calls++; return new Response(responseHtml, {status:200}); };
await runDailyCheck('test');
check(daily.status === 'looted_external' && posts === 0, 'external claim stops before POST');
check(history[0].status === 'no_information', 'unknown external amount is not invented');
await runDailyCheck('test');
check(calls === 1, 'completed cycle makes no repeated requests');
finished = false; responseHtml = fixture(); daily = {}; history = [];
document.body.innerHTML = checkedHtml;
await runDailyCheck('test');
check(daily.status === 'waiting' && !finished && posts === 0 && retries > 0, 'waiting reward keeps retry without claiming');
document.body.innerHTML = '';
responseHtml = guestHtml;
await runDailyCheck('test');
const beforePause = calls;
await runDailyCheck('test');
check(calls === beforePause && !!suiteGetAuthPause('gacha'), 'login page pauses future GETs');
check(state.snapshotController === null, 'snapshot controller cleaned');
suiteAuthPauses.clear();
check(!!suiteGetAuthPause('gacha'), 'pause restored from persistent storage');
suiteAuthDocumentStartedAt = Date.now() + 1000;
document.body.innerHTML = guestHtml;
check(!!suiteGetAuthPause('gacha'), 'guest reload does not clear pause');
document.body.innerHTML = '';
check(!suiteGetAuthPause('gacha'), 'new authenticated document resumes');
suiteAuthDocumentStartedAt = Date.now() - 100000;
responseHtml = '<main>changed design</main>';
await rejects(getSnapshotDocument, /unavailable/, 'missing gacha is not auth failure');
check(!suiteGetAuthPause('gacha'), 'unknown markup does not create auth pause');
responseHtml = fixture('<button id="get-gacha-reward"></button>', 'is-available');
await runDailyCheck('test');
check(daily.status === 'looted' && posts === 1, 'available reward is collected');
finished = false;
postGachaReward = async () => { cycle = '2026-09-07'; return postReply; };
await runDailyCheck('test');
check(daily.dateKey === '2026-09-06' && history.at(-1).dateKey === '2026-09-06', 'late POST completion belongs to original cycle');
fetch = async () => new Response(guestHtml, {status:200});
await rejects(() => postGachaRewardOnce('placeholder'), /authentication_required/, 'POST login HTML detected');
check(state.rewardController === null, 'POST controller cleaned after parse failure');
const originalSetTimeout = window.setTimeout;
window.setTimeout = (fn, delay) => originalSetTimeout(fn, delay === 12000 ? 1 : delay);
fetch = async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), {once:true}));
await rejects(getSnapshotDocument, /aborted/, 'snapshot abort timeout');
await rejects(() => postGachaRewardOnce('placeholder'), /aborted/, 'reward abort timeout');
check(state.snapshotController === null && state.rewardController === null, 'timeout controllers cleaned');
window.setTimeout = originalSetTimeout;
fetch = async () => new Response(JSON.stringify({reason:'Вы не авторизованы'}), {status:200});
await rejects(() => fetchData('/ajax/card_for_watch/'), /не авторизованы/, 'card JSON auth error detected');
check(!!suiteGetAuthPause('autowatch') && stopped > 0, 'AutoWatch stores pause and stops');
calls = 0;
fetch = async () => { calls++; return new Response('{}'); };
await rejects(() => fetchData('/ajax/calculate_time_watch/', {}, 'response', false), /authentication_required/, 'follow-up traffic blocked');
check(calls === 0, 'paused AutoWatch does not fetch');
scheduleNext(15000);
check(nextRunAt === 0, 'focus/scheduler cannot restart paused AutoWatch');
check(getPanelCountdown().compact === 'нужен вход', 'pause reason visible in compact panel');
localStorage.removeItem(suiteAuthPauseKey('autowatch')); suiteAuthPauses.clear();
fetch = async () => new Response('', {status:401});
await rejects(() => fetchData('/ajax/calculate_time_watch/', {}, 'response', false), /HTTP 401/, '401 honored even for unchecked response');
localStorage.removeItem(suiteAuthPauseKey('autowatch')); suiteAuthPauses.clear();
fetch = async () => new Response(guestHtml, {status:200});
await rejects(() => fetchData('/ajax/card_for_watch/'), /authentication_required/, 'AutoWatch handles login HTML instead of JSON');
localStorage.removeItem(suiteAuthPauseKey('autowatch')); suiteAuthPauses.clear();
fetch = async () => new Response(JSON.stringify({error:'Вы не авторизованы'}));
await rejects(() => fetchData('/ajax/calculate_series_watch/', {}, 'response', false), /не авторизованы/, 'watch preparation auth JSON detected before next request');
localStorage.removeItem(suiteAuthPauseKey('autowatch')); suiteAuthPauses.clear();
fetch = async () => new Response('temporary failure', {status:502});
await rejects(() => fetchData('/ajax/card_for_watch/'), /502/, 'transient error still throws');
check(!suiteGetAuthPause('autowatch'), '502 must not create permanent auth pause');
const original = function() {}; original.__awVisibleTabHook = true;
const wrapper = function() {}; wrapper.__animeSSSTradeDebugOriginal = original;
check(suiteFunctionChainHas(wrapper, '__awVisibleTabHook'), 'trade debugger wrapper supported');
const cycleWrapper = function() {}; cycleWrapper.__fatigueDebugOriginal = cycleWrapper;
check(!suiteFunctionChainHas(cycleWrapper, '__awVisibleTabHook'), 'wrapper cycle bounded');
cycleWrapper.__animeSSSTradeDebugOriginal = original;
check(suiteFunctionChainHas(cycleWrapper, '__awVisibleTabHook'), 'all known branches traversed');
suiteRunLightweightHealthCheck();
check(issues.length === 0, 'visibility recovery grace prevents false initialization report');
suiteHealthVisibleSince = Date.now() - 60000;
window.__suiteMainInitStartedAt = Date.now() - 90000;
window.__suiteMainInitPhase = 'waiting_for_access_context';
suiteRunLightweightHealthCheck();
check(issues[0][1] === 'access_context_unavailable', 'access wait distinguished from crashed module');
check(!getRewardCycleInfo().active, '21:00 window closed');
moscow = {...moscow,minute:6,second:9};
check(!getRewardCycleInfo().active && getMsUntilNextMoscowCheck() === 1000, 'wait until exact 21:06:10');
moscow.second = 10;
check(getRewardCycleInfo().active && getRewardCycleInfo().cycleKey === '2026-09-07', '21:06:10 starts new cycle');
moscow = {...moscow,hour:20,minute:59,second:59};
check(getRewardCycleInfo().active && getRewardCycleInfo().cycleKey === '2026-09-06', 'next day before 21:00 retains cycle');
return passed;
`;
(async () => {
  const browser = await chromium.launch({headless:true, channel:process.env.TEST_BROWSER_CHANNEL || 'msedge'});
  try {
    const page = await browser.newPage();
    await page.route('https://suite-test.invalid/**', route => route.fulfill({status:200,body:'<!doctype html><html><body></body></html>'}));
    await page.goto('https://suite-test.invalid/');
    const passed = await page.evaluate(async code => await new (Object.getPrototypeOf(async function(){}).constructor)(code)(), setup + '\n' + functions + '\n' + tests);
    console.log('SYNTAX_OK; BROWSER_REGRESSION_OK; assertions=' + passed);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
