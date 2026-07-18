// ==UserScript==
// @name         AnimeSSS помощник
// @namespace    http://tampermonkey.net/
// @version      3.55
// @description  Комбайн функций для animesss.tv/com
// @author       BETEP_B_TYMAHE
// @match        https://animesss.tv/*
// @match        https://animesss.com/*
// @updateURL    https://raw.githubusercontent.com/Grizordin/animeSSS-help/main/AnimeSSS_help.user.js
// @downloadURL  https://raw.githubusercontent.com/Grizordin/animeSSS-help/main/AnimeSSS_help.user.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @grant        GM_info
// @connect      raw.githubusercontent.com
// @connect      animesss-report-proxy.inaricyn69.workers.dev
// @connect      kodikplayer.com
// @connect      predlojka-o4s8.onrender.com
// @connect      predlojka.onrender.com
// ==/UserScript==

(function () {
  'use strict';

  // ============================================================
  //  GM ХРАНИЛИЩЕ — утилиты
  // ============================================================

  function gmGet(key, def) {
    try { const v = GM_getValue(key, null); return v !== null ? JSON.parse(v) : def; }
    catch(e) { return def; }
  }
  function gmSet(key, val) {
    try { GM_setValue(key, JSON.stringify(val)); } catch(e) {}
  }
  function gmDelete(key) {
    try { GM_deleteValue(key); } catch(e) {}
  }
  function gmStoreGet(key, def = null) {
    try {
      const missing = '__suite_gm_missing__';
      const v = GM_getValue(key, missing);
      if (v === missing || v === null || typeof v === 'undefined') return def;
      if (typeof v !== 'string') return v;
      try { return JSON.parse(v); } catch(e) { return v; }
    } catch(e) {
      return def;
    }
  }
  function gmStoreSet(key, val) {
    try { GM_setValue(key, val); } catch(e) {}
  }
  function gmStoreDelete(key) {
    try { GM_deleteValue(key); } catch(e) {}
  }

  // ============================================================
  //  НАСТРОЙКИ — единый объект, единая панель
  // ============================================================

  const SETTINGS_KEY = 'suite_settings_v1';
  const PREMIUM_DESIRED_SETTINGS_KEY = 'suite_premium_desired_settings_v1';
  const DEFAULT_SETTINGS = {
    // Модули вкл/выкл
    modCardValue:     true,   // ценность карт
    modHotkeys:       true,   // горячие клавиши
    modStats:         true,   // статистика паков
    modNeon:          true,   // неоновые обводки
    modNeonAnimation: true,   // анимация неоновых обводок
    modMenuBg:        true,   // фон меню
    menuBgDim:        0.42,   // затемнение фона меню
    menuTextClarity:  0.75,   // четкость текста меню
    modProfileBtns:   true,   // кнопки "Открытые S" и "Желаемые"
    modEnlightenment: true,   // просветление
    modVoteCardsToggle:true,  // скрытие голосования
    modSuggestionAuthors:true,// предложка и авторы на голосовании
    modCustomPush:    true,   // кастомные уведомления
    customPushScale:  1,      // масштаб кастомных уведомлений
    modStones:        true,   // камни
    modChatStoneAutoloot:true, // автолут небесного камня из чата
    modGachaAutoloot: true,   // автолут гачи клуба
    modWantCards:     true,   // кнопка добавления в желаемое
    wantButtonsAlways:true,   // кнопки желаемого видны постоянно
    modNoNeedCards:   true,   // кнопка ненужных карт
    noNeedButtonsAlways:true, // кнопки ненужного видны постоянно
    modBrickFill:     true,   // наполнение кирпича
    modRemelt:        true,   // переплавка карт
    modBestCard:      true,   // подсветка лучшей карты
    modGuard:         true,   // защитное окно
    modAutoOpen:      false,  // автооткрытие паков
    modAutoLootCards: true,   // автолут карт с просмотра
    modOnlyPack20:    true,  // только паки за 1600 (скрыть за 100 и 500)
    modGuarantee:     true,   // расчёт гаранта
    modLabyrinthQuiz: true,   // викторина лабиринта
    modLabyrinthEmission: true, // таймер выброса в лабиринте
    modLabyrinthFatigue: true, // статистика ходов после усталости, отката и мимика
    modLabyrinthClubWar:  true, // подсветка клубов в битве клубов

    // Хоткеи
    buyKey:        'Space',
    leftKey:       'KeyA',
    middleKey:     'KeyW',
    rightKey:      'KeyD',
    guardConfirmKey:'KeyQ',
    guardCancelKey: 'KeyE',
    panelCollapsed: false,

    // Позиции панелей (сохраняются при перетаскивании)
    settingsBtnLeft:   null,
    settingsBtnBottom: null,
    settingsPanelLeft: null,
    settingsPanelTop:  null,
    hkPanelLeft:       null,
    hkPanelTop:        null,
    autoPanelLeft:     null,
    autoPanelTop:      null,
    autoOpenEnabled:   false,
    autoOpenTarget:    0,
    autoOpenedCount:   0,
    settingsSections:  { cardValue:true, packs:true, ui:true, visual:true, cards:true, labyrinth:true },

    // Защита
    guardThreshold: 20,       // порог разницы ценности для защитного окна
  };

  let cfg = { ...DEFAULT_SETTINGS, ...gmGet(SETTINGS_KEY, {}) };
  function saveCfg() { gmSet(SETTINGS_KEY, cfg); }

  const PREMIUM_REQUIRED_SETTINGS = [
    'modCardValue',
    'modBestCard',
    'modGuard',
    'modAutoOpen',
    'modBrickFill',
    'modRemelt'
  ];

  function getPageWindow() {
    try {
      if(typeof unsafeWindow !== 'undefined') return unsafeWindow;
    } catch(e) {}
    return window;
  }

  function hasActivePremium() {
    const pageWindow = getPageWindow();
    return Number(pageWindow?.member_active_premium) === 1;
  }

  function isPremiumRequiredSetting(key) {
    return PREMIUM_REQUIRED_SETTINGS.includes(key);
  }

  function isPremiumLockedSetting(key) {
    return isPremiumRequiredSetting(key) && !hasActivePremium();
  }

  function getPremiumDesiredSettings() {
    return gmGet(PREMIUM_DESIRED_SETTINGS_KEY, null);
  }

  function savePremiumDesiredSettings(source = cfg) {
    const desired = {};
    PREMIUM_REQUIRED_SETTINGS.forEach(key=>{
      desired[key] = !!source[key];
    });
    desired.autoOpenEnabled = !!source.autoOpenEnabled;
    gmSet(PREMIUM_DESIRED_SETTINGS_KEY, desired);
  }

  function restorePremiumDesiredSettings() {
    if(!hasActivePremium()) return false;

    const desired = getPremiumDesiredSettings();
    if(!desired || typeof desired !== 'object') return false;

    let changed = false;
    PREMIUM_REQUIRED_SETTINGS.forEach(key=>{
      if(Object.prototype.hasOwnProperty.call(desired, key) && cfg[key] !== !!desired[key]) {
        cfg[key] = !!desired[key];
        changed = true;
      }
    });

    if(Object.prototype.hasOwnProperty.call(desired, 'autoOpenEnabled') && cfg.autoOpenEnabled !== !!desired.autoOpenEnabled) {
      cfg.autoOpenEnabled = !!desired.autoOpenEnabled;
      changed = true;
    }

    if(changed) saveCfg();
    return changed;
  }

  function enforcePremiumSettings() {
    if(hasActivePremium()) return restorePremiumDesiredSettings();

    let changed = false;
    let shouldSaveDesired = false;
    const desiredBeforeLock = {};
    PREMIUM_REQUIRED_SETTINGS.forEach(key=>{
      desiredBeforeLock[key] = !!cfg[key];
    });
    desiredBeforeLock.autoOpenEnabled = !!cfg.autoOpenEnabled;

    PREMIUM_REQUIRED_SETTINGS.forEach(key=>{
      if(cfg[key]) {
        shouldSaveDesired = true;
        cfg[key] = false;
        changed = true;
      }
    });

    if(cfg.autoOpenEnabled) {
      shouldSaveDesired = true;
      cfg.autoOpenEnabled = false;
      changed = true;
    }

    if(shouldSaveDesired && !getPremiumDesiredSettings()) savePremiumDesiredSettings(desiredBeforeLock);
    if(changed) saveCfg();
    return changed;
  }

  enforcePremiumSettings();

  // ============================================================
  //  ДОСТУП И СЛУЖЕБНАЯ ОТПРАВКА
  // ============================================================

  const SUITE_ALLOWED_CLUB_ID = '2';
  const SUITE_ACCESS_VERSION =
  typeof GM_info !== 'undefined' && GM_info?.script?.version
    ? GM_info.script.version
    : 'unknown';
  const SUITE_REMOTE_VERSION_URL = 'https://raw.githubusercontent.com/Grizordin/animeSSS-help/main/version.json';
  const SUITE_SCRIPT_DOWNLOAD_URL = 'https://raw.githubusercontent.com/Grizordin/animeSSS-help/main/AnimeSSS_help.user.js';
  const SUITE_REPORT_ENDPOINT = 'https://animesss-report-proxy.inaricyn69.workers.dev/report';
  const SUITE_VERSION_CHECK_INTERVAL_MS = 60 * 60 * 1000;
  const SUITE_VERSION_CHECK_FORCE_MS = 24 * 60 * 60 * 1000;
  const SUITE_LAST_VERSION_CHECK_KEY = 'suite_last_version_check_v1';
  const SUITE_UPDATE_AVAILABLE_KEY = 'suite_update_available_v1';
  const SUITE_ACCESS_SENT_PREFIX = 'suite_access_sent_v2_';
  const SUITE_ACCESS_LOCK_PREFIX = 'suite_access_sending_v2_';
  const suiteUpdateState = {
    remoteVersion: '',
    hasUpdate: false,
    checked: false,
    checking: false,
    error: false,
    timerId: null,
    listeners: new Set()
  };

  function normalizeSuiteUpdateStorageValue(value) {
    if(value && typeof value === 'object') return value;
    if(typeof value !== 'string' || !value) return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch(e) {
      return null;
    }
  }

  function applySavedSuiteUpdateState(value) {
    const saved = normalizeSuiteUpdateStorageValue(value);
    if(!saved) {
      suiteUpdateState.remoteVersion = '';
      suiteUpdateState.hasUpdate = false;
      return false;
    }

    const remoteVersion = String(saved.remoteVersion || '').trim();
    const hasUpdate = !!remoteVersion &&
      compareSuiteVersions(remoteVersion, SUITE_ACCESS_VERSION) > 0;

    if(!hasUpdate) {
      gmDelete(SUITE_UPDATE_AVAILABLE_KEY);
      suiteUpdateState.remoteVersion = remoteVersion;
      suiteUpdateState.hasUpdate = false;
      return false;
    }

    suiteUpdateState.remoteVersion = remoteVersion;
    suiteUpdateState.hasUpdate = true;
    suiteUpdateState.checked = true;
    suiteUpdateState.error = false;
    return true;
  }

  function loadSavedSuiteUpdateState() {
    applySavedSuiteUpdateState(gmStoreGet(SUITE_UPDATE_AVAILABLE_KEY, null));
  }

  function saveSuiteUpdateState() {
    if(suiteUpdateState.hasUpdate && suiteUpdateState.remoteVersion) {
      gmStoreSet(SUITE_UPDATE_AVAILABLE_KEY, {
        remoteVersion: suiteUpdateState.remoteVersion,
        foundAt: Date.now()
      });
    } else {
      gmDelete(SUITE_UPDATE_AVAILABLE_KEY);
    }
  }

  function parseSuiteVersionText(text) {
    const raw = String(text || '').trim();
    if(!raw) return '';

    try {
      const data = JSON.parse(raw);
      return String(data.version || '').trim();
    } catch(e) {
      return raw.replace(/^v/i, '').trim();
    }
  }

  function compareSuiteVersions(a, b) {
    const left = String(a || '').replace(/^v/i, '').split('.').map(n=>parseInt(n,10)||0);
    const right = String(b || '').replace(/^v/i, '').split('.').map(n=>parseInt(n,10)||0);
    const len = Math.max(left.length, right.length);
    for(let i=0;i<len;i++){
      const diff = (left[i] || 0) - (right[i] || 0);
      if(diff !== 0) return diff > 0 ? 1 : -1;
    }
    return 0;
  }

  loadSavedSuiteUpdateState();

  function syncSuiteUpdateStateFromStorage() {
    applySavedSuiteUpdateState(gmStoreGet(SUITE_UPDATE_AVAILABLE_KEY, null));
    notifySuiteUpdateState();
  }

  if(typeof GM_addValueChangeListener === 'function') {
    GM_addValueChangeListener(SUITE_UPDATE_AVAILABLE_KEY, (_key, _oldValue, newValue, remote) => {
      if(!remote) return;
      applySavedSuiteUpdateState(newValue);
      notifySuiteUpdateState();
    });
  }

  document.addEventListener('visibilitychange', () => {
    if(!document.hidden) syncSuiteUpdateStateFromStorage();
  }, {passive:true});
  window.addEventListener('pageshow', syncSuiteUpdateStateFromStorage, {passive:true});
  window.addEventListener('focus', syncSuiteUpdateStateFromStorage, {passive:true});

  async function fetchSuiteRemoteVersion() {
    const res = await fetch(`${SUITE_REMOTE_VERSION_URL}?t=${Date.now()}`, { cache:'no-store' });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseSuiteVersionText(await res.text());
  }

  function getSuiteUpdateStateSnapshot() {
    return {
      remoteVersion: suiteUpdateState.remoteVersion,
      hasUpdate: suiteUpdateState.hasUpdate,
      checked: suiteUpdateState.checked,
      checking: suiteUpdateState.checking,
      error: suiteUpdateState.error
    };
  }

  function notifySuiteUpdateState() {
    const state = getSuiteUpdateStateSnapshot();
    suiteUpdateState.listeners.forEach(listener=>{
      try { listener(state); } catch(e) {}
    });
  }

  function subscribeSuiteUpdateState(listener) {
    if(typeof listener !== 'function') return ()=>{};
    suiteUpdateState.listeners.add(listener);
    listener(getSuiteUpdateStateSnapshot());
    return ()=>suiteUpdateState.listeners.delete(listener);
  }

  async function checkSuiteRemoteVersion() {
    if(suiteUpdateState.checking) return;
    suiteUpdateState.checking = true;
    notifySuiteUpdateState();

    try {
      const remoteVersion = await fetchSuiteRemoteVersion();
      suiteUpdateState.remoteVersion = remoteVersion;
      suiteUpdateState.hasUpdate = !!remoteVersion &&
        compareSuiteVersions(remoteVersion, SUITE_ACCESS_VERSION) > 0;
      suiteUpdateState.checked = true;
      suiteUpdateState.error = false;
      gmSet(SUITE_LAST_VERSION_CHECK_KEY, Date.now());
      saveSuiteUpdateState();
    } catch(e) {
      suiteUpdateState.checked = true;
      suiteUpdateState.error = true;
    } finally {
      suiteUpdateState.checking = false;
      notifySuiteUpdateState();
    }
  }

  function startSuiteVersionChecker() {
    if(suiteUpdateState.timerId) return;
    const now = Date.now();
    const lastCheck = Number(gmGet(SUITE_LAST_VERSION_CHECK_KEY, 0)) || 0;
    const sinceLastCheck = lastCheck > 0 ? now - lastCheck : Infinity;
    const hourOffset = now % SUITE_VERSION_CHECK_INTERVAL_MS;
    let nextHourDelay = hourOffset < 1000
      ? 0
      : SUITE_VERSION_CHECK_INTERVAL_MS - hourOffset;
    const shouldForceCheck = sinceLastCheck >= SUITE_VERSION_CHECK_FORCE_MS;

    if(shouldForceCheck) {
      checkSuiteRemoteVersion();
      if(nextHourDelay === 0) nextHourDelay = SUITE_VERSION_CHECK_INTERVAL_MS;
    }

    suiteUpdateState.timerId = setTimeout(()=>{
      checkSuiteRemoteVersion();
      suiteUpdateState.timerId = setInterval(
        checkSuiteRemoteVersion,
        SUITE_VERSION_CHECK_INTERVAL_MS
      );
    }, nextHourDelay);
  }

  let suiteAuthenticatedClubId = '';

  function suiteGetMyClubId() {
    if(suiteAuthenticatedClubId) return suiteAuthenticatedClubId;
    const links = [...document.querySelectorAll('a[href*="/clubs/"]')];
    for (const a of links) {
      const text = (a.textContent || '').trim();
      const match = String(a.href || '').match(/\/clubs\/(\d+)\/?/);
      if (text === 'Мой клуб' && match) {
        suiteAuthenticatedClubId = match[1];
        return suiteAuthenticatedClubId;
      }
    }
    return null;
  }

  function suiteGetMyNickname() {
    const link = document.querySelector('.header__group-menu a[href*="/user/"]');
    if (!link) return null;
    const match = String(link.href || '').match(/\/user\/([^/]+)/);
    return match ? match[1] : null;
  }

  function suiteDecodeNickname(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      return decodeURIComponent(raw.replace(/\+/g, '%20')).replace(/\s+/g, ' ').trim();
    } catch(e) {
      return raw.replace(/\+/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  let suiteAuthenticatedNickname = '';

  const SUITE_USER_HASH_CACHE_PREFIX = 'suite_user_hash_v1:';
  const SUITE_USER_HASH_RECHECK_MS = 24 * 60 * 60 * 1000;
  const SUITE_USER_HASH_WRITE_MS = 60 * 60 * 1000;
  let suiteUserHashMemory = { key:'', value:'', checkedAt:0 };

  function suiteUserHashCacheKey() {
    const nick = suiteGetCurrentUserName() || 'unknown';
    return `${SUITE_USER_HASH_CACHE_PREFIX}${location.hostname}:${String(nick).toLowerCase()}`;
  }

  function suiteReadUserHashCache() {
    const key = suiteUserHashCacheKey();
    if(suiteUserHashMemory.key === key && suiteUserHashMemory.value) {
      return { value:suiteUserHashMemory.value, checkedAt:suiteUserHashMemory.checkedAt };
    }
    const cached = gmStoreGet(key, null);
    if(typeof cached === 'string') {
      suiteUserHashMemory = { key, value:cached, checkedAt:0 };
      return { value:cached, checkedAt:0 };
    }
    if(!cached || typeof cached !== 'object') return { value:'', checkedAt:0 };
    suiteUserHashMemory = {
      key,
      value:String(cached.value || ''),
      checkedAt:Number(cached.checkedAt || 0)
    };
    return { value:suiteUserHashMemory.value, checkedAt:suiteUserHashMemory.checkedAt };
  }

  function suiteSaveUserHash(value) {
    const hash = String(value || '').trim();
    if(!hash) return '';
    const key = suiteUserHashCacheKey();
    const now = Date.now();
    const cached = suiteReadUserHashCache();
    if(cached.value === hash && now - cached.checkedAt < SUITE_USER_HASH_WRITE_MS) return hash;
    suiteUserHashMemory = { key, value:hash, checkedAt:now };
    gmStoreSet(key, { value:hash, checkedAt:now });
    return hash;
  }

  function suiteReadUserHashFromPage(source = document, allowScriptScan = false) {
    if(source === document) {
      const pageWindow = getPageWindow();
      const fromWindow = pageWindow?.dle_login_hash || pageWindow?.user_hash ||
        window.dle_login_hash || window.user_hash;
      if(fromWindow) return String(fromWindow);
    }

    const root = source?.querySelector ? source : document;
    const selectors = [
      '[name="user_hash"]',
      '[name="dle_login_hash"]',
      'meta[name="user_hash"]',
      'meta[name="dle_login_hash"]',
      '[data-user-hash]',
      '[data-hash]'
    ];
    for(const selector of selectors) {
      const element = root.querySelector(selector);
      const value = element?.value || element?.content || element?.dataset?.userHash || element?.dataset?.hash;
      if(value) return String(value);
    }

    if(!allowScriptScan) return '';
    for(const script of root.querySelectorAll('script:not([src])')) {
      const match = String(script.textContent || '').match(/(?:dle_login_hash|user_hash)["'\s:=]+([a-zA-Z0-9_-]{8,})/);
      if(match) return match[1];
    }
    return '';
  }

  function suiteGetUserHash(options = {}) {
    const forceScan = !!options.forceScan;
    const source = options.source || document;
    const direct = suiteReadUserHashFromPage(source, false);
    if(direct) return suiteSaveUserHash(direct);

    const cached = suiteReadUserHashCache();
    const cacheIsFresh = cached.value && Date.now() - cached.checkedAt < SUITE_USER_HASH_RECHECK_MS;
    if(cacheIsFresh && !forceScan) return cached.value;

    const scanned = suiteReadUserHashFromPage(source, true);
    if(scanned) return suiteSaveUserHash(scanned);
    return cached.value;
  }

  function suiteInvalidateUserHash() {
    const key = suiteUserHashCacheKey();
    suiteUserHashMemory = { key, value:'', checkedAt:0 };
    gmStoreDelete(key);
  }

  async function suiteRefreshUserHashFromServer() {
    suiteInvalidateUserHash();
    try {
      const response = await fetch(`${location.origin}/`, {
        method:'GET',
        credentials:'same-origin',
        cache:'no-cache',
        headers:{ 'Accept':'text/html,application/xhtml+xml' }
      });
      if(!response.ok) return '';
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const refreshed = suiteReadUserHashFromPage(doc, true);
      if(refreshed) return suiteSaveUserHash(refreshed);
    } catch(e) {}
    return suiteGetUserHash({ forceScan:true });
  }

  function suiteIsUserHashError(value) {
    const text = String(value || '');
    return /(?:HTTP\s*(?:401|403)|user[_\s-]*hash|login[_\s-]*hash|unauthori[sz]ed|forbidden|session|сесси|не\s+авториз|ошибка\s+доступа|доступ\s+запрещ)/i.test(text);
  }

  function suiteGetSafeNickname() {
    if(suiteAuthenticatedNickname) return suiteAuthenticatedNickname;
    try {
      const nick = String(suiteGetMyNickname() || '').trim();
      if (nick) return nick;
    } catch(e) {}

    try {
      const link = document.querySelector('.header__group-menu a[href*="/user/"]');
      if (link) {
        const match = String(link.href || '').match(/\/user\/([^/]+)/);
        const nick = match ? suiteDecodeNickname(match[1]) : '';
        if (nick) return nick;
      }
    } catch(e) {}

    return 'Неизвестно';
  }

  function suiteGetCurrentUserName() {
    if(suiteAuthenticatedNickname) return suiteAuthenticatedNickname;
    try {
      const nick = String(suiteGetMyNickname() || '').trim();
      if (nick) return suiteDecodeNickname(nick);
    } catch(e) {}

    try {
      const safeNick = String(suiteGetSafeNickname() || '').trim();
      if (safeNick && safeNick !== 'Неизвестно') return suiteDecodeNickname(safeNick);
    } catch(e) {}

    return '';
  }

  async function suiteReportEvent(type, payload = {}) {
    if (!SUITE_REPORT_ENDPOINT) return false;
    try {
      const nick = payload.nick || suiteGetCurrentUserName() || '';
      const response = await fetch(SUITE_REPORT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          type,
          payload: {
            ...payload,
            nick,
            host: location.hostname,
            path: location.pathname,
            version: SUITE_ACCESS_VERSION
          }
        })
      });
      return response.ok;
    } catch(e) {
      return false;
    }
  }

  const SUITE_TELEMETRY_LEGACY_QUEUE_PREFIX = 'suite_telemetry_queue_v1_';
  const SUITE_TELEMETRY_QUEUE_KEY = 'suite_telemetry_queue_v2';
  const SUITE_TELEMETRY_QUEUE_LOCK_KEY = 'suite_telemetry_queue_lock_v2';
  const SUITE_STORAGE_CLEANUP_KEY = 'suite_obsolete_local_logs_cleaned_v1';
  const SUITE_TELEMETRY_INSTALL_KEY = 'suite_telemetry_install_id_v1';
  const SUITE_TELEMETRY_ACTIVE_KEY = 'suite_telemetry_active_day_v1';
  const SUITE_TELEMETRY_ACTIVE_LOCK_KEY = 'suite_telemetry_active_lock_v1';
  const SUITE_TELEMETRY_FLUSH_MS = 5 * 60 * 1000;
  const SUITE_TELEMETRY_BATCH_SIZE = 10;
  const SUITE_TELEMETRY_MAX_EVENTS = 200;
  const SUITE_TELEMETRY_MAX_EVENT_CHARS = 200000;
  const SUITE_TELEMETRY_MAX_QUEUE_CHARS = 1000000;
  const SUITE_TELEMETRY_MAX_BATCH_CHARS = 350000;
  const SUITE_TELEMETRY_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;
  const suiteTelemetrySessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const suiteTelemetryInstallId = (() => {
    let value = String(gmGet(SUITE_TELEMETRY_INSTALL_KEY, '') || '').trim();
    if(value) return value;
    value = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
    gmSet(SUITE_TELEMETRY_INSTALL_KEY, value);
    return value;
  })();
  let suiteTelemetryFlushPromise = null;
  let suiteTelemetryPendingRecords = [];
  let suiteTelemetryPersistTimer = null;
  let suiteTelemetryPersistPromise = Promise.resolve();

  const suiteTelemetryDelay = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function suiteTelemetryWithQueueLock(callback, fallback) {
    const owner = `${suiteTelemetrySessionId}-${Math.random().toString(36).slice(2, 10)}`;
    const deadline = Date.now() + 2500;
    while(Date.now() < deadline){
      const now = Date.now();
      const lock = gmGet(SUITE_TELEMETRY_QUEUE_LOCK_KEY, null);
      if(!lock || !lock.owner || Number(lock.expiresAt || 0) <= now || lock.owner === owner){
        gmSet(SUITE_TELEMETRY_QUEUE_LOCK_KEY, { owner, expiresAt:now + 5000 });
        const verified = gmGet(SUITE_TELEMETRY_QUEUE_LOCK_KEY, null);
        if(verified?.owner === owner){
          try { return callback(); }
          finally {
            const latest = gmGet(SUITE_TELEMETRY_QUEUE_LOCK_KEY, null);
            if(latest?.owner === owner) gmDelete(SUITE_TELEMETRY_QUEUE_LOCK_KEY);
          }
        }
      }
      await suiteTelemetryDelay(25 + Math.floor(Math.random() * 50));
    }
    return fallback;
  }

  function suiteTelemetrySanitize(value, key = '', depth = 0, seen = new WeakSet()) {
    if(value == null || typeof value === 'boolean' || typeof value === 'number') return value;
    const lowerKey = String(key).toLowerCase();
    if(/(?:user_?hash|dle_?login_?hash|cookie|authorization|token|password|secret)/i.test(lowerKey)) return '[redacted]';
    if(typeof value === 'string') {
      const text = value
        .replace(/([?&](?:user_hash|dle_login_hash|token|auth|password)=)[^&#\s]*/gi, '$1[redacted]')
        .replace(/("(?:user_hash|dle_login_hash|token|authorization|password)"\s*:\s*")[^"]*/gi, '$1[redacted]');
      if(/^data:/i.test(text)) {
        const commaIndex = text.indexOf(',');
        const descriptor = (commaIndex >= 0 ? text.slice(0, commaIndex) : text.slice(0, 120)).slice(0, 120);
        return `${descriptor},[payload omitted: ${text.length} chars]`;
      }
      return text.length > 30000 ? `${text.slice(0, 29999)}...` : text;
    }
    if(value instanceof Error) {
      return { name:value.name, message:value.message, stack:String(value.stack || '').slice(0, 12000) };
    }
    if(typeof value !== 'object' || depth >= 6) return String(value);
    if(seen.has(value)) return '[circular]';
    seen.add(value);
    if(Array.isArray(value)) return value.slice(0, 250).map(item => suiteTelemetrySanitize(item, '', depth + 1, seen));
    const result = {};
    for(const [childKey, childValue] of Object.entries(value).slice(0, 100)) {
      result[childKey] = suiteTelemetrySanitize(childValue, childKey, depth + 1, seen);
    }
    return result;
  }

  function suiteTelemetryReadQueue() {
    try {
      const raw = GM_getValue(SUITE_TELEMETRY_QUEUE_KEY, null);
      if(raw == null) return [];
      const records = JSON.parse(raw);
      if(Array.isArray(records)) return records;
    } catch(e) {}
    gmDelete(SUITE_TELEMETRY_QUEUE_KEY);
    return [];
  }

  function suiteTelemetryNormalizeRecord(record) {
    if(!record || typeof record !== 'object') return null;
    let chars = 0;
    try { chars = JSON.stringify(record).length; } catch(e) { chars = SUITE_TELEMETRY_MAX_EVENT_CHARS + 1; }
    if(chars <= SUITE_TELEMETRY_MAX_EVENT_CHARS) return record;
    return {
      id:String(record.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`),
      timestamp:Number(record.timestamp || Date.now()),
      time:String(record.time || new Date().toISOString()),
      module:String(record.module || 'suite'),
      event:String(record.event || 'oversized_event'),
      level:String(record.level || 'debug'),
      sessionId:String(record.sessionId || suiteTelemetrySessionId),
      path:String(record.path || ''),
      visibility:String(record.visibility || ''),
      data:{ truncated:true, originalChars:chars, recoveredFromStoredQueue:true }
    };
  }

  function suiteTelemetryWriteQueue(records) {
    const limited = records
      .map(suiteTelemetryNormalizeRecord)
      .filter(Boolean)
      .slice(-SUITE_TELEMETRY_MAX_EVENTS);
    while(limited.length > 0){
      let serialized = '';
      try { serialized = JSON.stringify(limited); } catch(e) { limited.shift(); continue; }
      if(serialized.length <= SUITE_TELEMETRY_MAX_QUEUE_CHARS){
        try { GM_setValue(SUITE_TELEMETRY_QUEUE_KEY, serialized); }
        catch(e) { gmDelete(SUITE_TELEMETRY_QUEUE_KEY); }
        return;
      }
      limited.shift();
    }
    gmDelete(SUITE_TELEMETRY_QUEUE_KEY);
  }

  function suiteTelemetryTakeBatch(records, module) {
    const candidates = records
      .filter(item => (item.module || 'suite') === module)
      .slice(0, SUITE_TELEMETRY_BATCH_SIZE)
      .map(suiteTelemetryNormalizeRecord)
      .filter(Boolean);
    const batch = [];
    for(const event of candidates){
      let chars = 0;
      try { chars = JSON.stringify([...batch, event]).length; }
      catch(e) { continue; }
      if(batch.length && chars > SUITE_TELEMETRY_MAX_BATCH_CHARS) break;
      if(chars <= SUITE_TELEMETRY_MAX_BATCH_CHARS) batch.push(event);
    }
    return batch;
  }

  function suiteTelemetryPersistPending() {
    clearTimeout(suiteTelemetryPersistTimer);
    suiteTelemetryPersistTimer = null;
    if(!suiteTelemetryPendingRecords.length) return suiteTelemetryPersistPromise;
    const pending = suiteTelemetryPendingRecords.splice(0);
    suiteTelemetryPersistPromise = suiteTelemetryPersistPromise.then(async () => {
      const saved = await suiteTelemetryWithQueueLock(() => {
        const now = Date.now();
        const records = suiteTelemetryReadQueue()
          .filter(item => now - Number(item?.timestamp || now) <= SUITE_TELEMETRY_MAX_AGE_MS);
        suiteTelemetryWriteQueue(records.concat(pending));
        return true;
      }, false);
      if(!saved) suiteTelemetryPendingRecords.unshift(...pending);
    }).catch(() => {
      suiteTelemetryPendingRecords.unshift(...pending);
    });
    return suiteTelemetryPersistPromise;
  }

  function suiteTelemetrySchedulePersist() {
    if(suiteTelemetryPersistTimer) return;
    suiteTelemetryPersistTimer = setTimeout(suiteTelemetryPersistPending, 500);
  }

  function suiteTelemetryLog(module, event, data = {}, level = 'debug') {
    try {
      const now = Date.now();
      const record = {
        id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
        timestamp: now,
        time: new Date(now).toISOString(),
        module: String(module || 'suite'),
        event: String(event || 'event'),
        level: String(level || 'debug'),
        sessionId: suiteTelemetrySessionId,
        path: location.pathname,
        visibility: document.visibilityState,
        data: suiteTelemetrySanitize(data)
      };
      let recordChars = 0;
      try { recordChars = JSON.stringify(record).length; } catch(e) { recordChars = SUITE_TELEMETRY_MAX_EVENT_CHARS + 1; }
      if(recordChars > SUITE_TELEMETRY_MAX_EVENT_CHARS){
        record.data = {
          truncated:true,
          originalChars:recordChars,
          summary:suiteTelemetrySanitize(data, '', 4)
        };
        const summaryChars = JSON.stringify(record).length;
        if(summaryChars > SUITE_TELEMETRY_MAX_EVENT_CHARS){
          record.data = { truncated:true, originalChars:recordChars };
        }
      }
      suiteTelemetryPendingRecords.push(record);
      if(level === 'error'){
        suiteTelemetryPersistPending();
        void suiteTelemetryFlush('error');
      } else if(suiteTelemetryPendingRecords.filter(item => item.module === module).length >= SUITE_TELEMETRY_BATCH_SIZE){
        suiteTelemetryPersistPending();
        void suiteTelemetryFlush('size');
      } else {
        suiteTelemetrySchedulePersist();
      }
    } catch(e) {}
  }

  function suiteTelemetryLogActiveOnce(nick, clubId) {
    const day = new Date().toISOString().slice(0, 10);
    const marker = `${day}:${SUITE_ACCESS_VERSION}:${nick}:${clubId}`;
    if(gmGet(SUITE_TELEMETRY_ACTIVE_KEY, '') === marker) return;
    const now = Date.now();
    const activeLock = Number(gmGet(SUITE_TELEMETRY_ACTIVE_LOCK_KEY, 0) || 0);
    if(activeLock && now - activeLock < 15000) return;
    gmSet(SUITE_TELEMETRY_ACTIVE_LOCK_KEY, now);
    const time = new Date(now).toISOString();
    const event = {
      id:`${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      timestamp:now,
      time,
      module:'suite',
      event:'script_initialized',
      level:'debug',
      sessionId:suiteTelemetrySessionId,
      path:location.pathname,
      visibility:document.visibilityState,
      data:{ nick, clubId }
    };
    void (async () => {
      const ok = await suiteReportEvent('telemetry_batch', {
        batchId:`${suiteTelemetrySessionId}-suite-${event.id}`,
        installId:suiteTelemetryInstallId,
        sessionId:suiteTelemetrySessionId,
        module:'suite',
        reason:'script_initialized',
        startedAt:time,
        finishedAt:time,
        eventCount:1,
        events:[event],
        nick
      });
      try {
        if(ok){
          gmSet(SUITE_TELEMETRY_ACTIVE_KEY, marker);
          return;
        }
        suiteTelemetryPendingRecords.push(event);
        suiteTelemetryPersistPending();
      } finally {
        gmDelete(SUITE_TELEMETRY_ACTIVE_LOCK_KEY);
      }
    })();
  }

  async function suiteCleanupObsoleteLocalLogs() {
    const now = Date.now();
    const lastCleanup = Number(gmGet(SUITE_STORAGE_CLEANUP_KEY, 0) || 0);
    if(lastCleanup && now - lastCleanup < 60 * 60 * 1000) return;
    try {
      const keys = GM_listValues().filter(key => {
        const name = String(key);
        return name.startsWith(SUITE_TELEMETRY_LEGACY_QUEUE_PREFIX)
          || name.includes('_diagnostic_log_')
          || name.endsWith('_request_log');
      });
      for(let index = 0; index < keys.length; index += 25){
        for(const key of keys.slice(index, index + 25)) gmDelete(key);
        await suiteTelemetryDelay(20);
      }
      gmSet(SUITE_STORAGE_CLEANUP_KEY, now);
    }
    catch(e) {}
  }

  async function suiteTelemetryFlush(reason = 'timer') {
    await suiteTelemetryPersistPending();
    if(suiteTelemetryFlushPromise) return suiteTelemetryFlushPromise;
    suiteTelemetryFlushPromise = (async () => {
      while(true) {
        const events = await suiteTelemetryWithQueueLock(() => {
          const current = suiteTelemetryReadQueue();
          if(!current.length) return [];
          return suiteTelemetryTakeBatch(current, current[0].module || 'suite');
        }, []);
        if(!events.length) break;
        const module = events[0].module || 'suite';
        const ids = new Set(events.map(item => item.id));
        const eventSessionId = events[0].sessionId || suiteTelemetrySessionId;
        const ok = await suiteReportEvent('telemetry_batch', {
          batchId: `${eventSessionId}-${module}-${events[0].id}`,
          installId: suiteTelemetryInstallId,
          sessionId: eventSessionId,
          module,
          reason,
          startedAt: events[0].time,
          finishedAt: events[events.length - 1].time,
          eventCount: events.length,
          events
        });
        if(!ok) return false;
        await suiteTelemetryWithQueueLock(() => {
          const latest = suiteTelemetryReadQueue();
          suiteTelemetryWriteQueue(latest.filter(item => !ids.has(item.id)));
        });
      }
      return true;
    })().finally(() => { suiteTelemetryFlushPromise = null; });
    return suiteTelemetryFlushPromise;
  }

  setTimeout(() => { void suiteCleanupObsoleteLocalLogs(); }, 0);
  setTimeout(() => { void suiteTelemetryFlush('startup'); }, 3000);
  setInterval(() => { void suiteTelemetryFlush('timer'); }, SUITE_TELEMETRY_FLUSH_MS);
  window.addEventListener('pagehide', () => { void suiteTelemetryFlush('pagehide'); });

  function installSuiteGlobalDiagnostics() {
    if(window.__suiteGlobalDiagnosticsInstalled) return;
    window.__suiteGlobalDiagnosticsInstalled = true;
    const recent = new Map();
    let lastIgnoredPlaceholderMediaAt = 0;

    const report = (event, data, level = 'error', dedupeMs = 5000) => {
      try {
        const safe = suiteTelemetrySanitize(data);
        const fingerprint = `${event}:${JSON.stringify(safe).slice(0, 1200)}`;
        const now = Date.now();
        const previous = Number(recent.get(fingerprint) || 0);
        if(now - previous < dedupeMs) return;
        recent.set(fingerprint, now);
        if(recent.size > 200){
          for(const [key, timestamp] of recent){
            if(now - timestamp > 60000) recent.delete(key);
          }
        }
        suiteTelemetryLog('suite', event, safe, level);
      } catch(e) {}
    };

    window.addEventListener('error', event => {
      const target = event.target;
      if(target && target !== window){
        if(target instanceof HTMLMediaElement){
          const rawSource = target.currentSrc || target.src || target.querySelector?.('source[src]')?.src || '';
          if(/^data:video\/(?:mp4|webm);base64,/i.test(rawSource) && String(rawSource).length <= 256){
            lastIgnoredPlaceholderMediaAt = Date.now();
            return;
          }
          const source = (() => {
            const raw = String(rawSource || '');
            if(/^data:/i.test(raw)){
              const commaIndex = raw.indexOf(',');
              return (commaIndex >= 0 ? raw.slice(0, commaIndex) : raw.slice(0, 120)).slice(0, 120);
            }
            if(/^blob:/i.test(raw)) return 'blob:media';
            try {
              const url = new URL(raw, location.href);
              return `${url.origin}${url.pathname}`;
            } catch(e) {
              return raw.split(/[?#]/, 1)[0].slice(0, 500);
            }
          })();
          report('media_resource_error', {
            tag:String(target.tagName || '').toLowerCase(),
            source,
            mediaErrorCode:target.error?.code || 0,
            mediaErrorMessage:target.error?.message || '',
            networkState:target.networkState,
            readyState:target.readyState
          }, 'warn', 60 * 60 * 1000);
        }
        return;
      }
      if(!event.message && !event.error && !event.filename && !event.lineno && !event.colno) return;
      report('global_error', {
        message:event.message || event.error?.message || 'unknown error',
        filename:event.filename || '',
        line:event.lineno || 0,
        column:event.colno || 0,
        error:event.error || null
      });
    }, true);

    window.addEventListener('unhandledrejection', event => {
      const reasonText = String(event.reason?.message || event.reason || '');
      if(/Failed to load because no supported source was found/i.test(reasonText)){
        if(Date.now() - lastIgnoredPlaceholderMediaAt < 5000) return;
        report('media_playback_rejection', { message:reasonText }, 'warn', 60 * 60 * 1000);
        return;
      }
      report('unhandled_rejection', { reason:event.reason || 'unknown rejection' });
    });

    const originalFetch = window.fetch;
    if(typeof originalFetch === 'function' && !originalFetch.__suiteGlobalDiagnosticsHook){
      const diagnosticFetch = function(resource, init){
        const rawUrl = typeof resource === 'string' ? resource : (resource?.url || '');
        const url = (() => { try { return new URL(rawUrl, location.href).href; } catch(e) { return String(rawUrl); } })();
        const isTelemetryRequest = url === SUITE_REPORT_ENDPOINT || url.startsWith(`${SUITE_REPORT_ENDPOINT}?`);
        const startedAt = performance.now();
        let request;
        try {
          request = originalFetch.apply(this, arguments);
        } catch(error) {
          if(!isTelemetryRequest) report('fetch_threw', { url, method:init?.method || 'GET', error });
          throw error;
        }
        return Promise.resolve(request).then(response => {
          if(!isTelemetryRequest && !response.ok){
            report('fetch_http_error', {
              url,
              method:init?.method || resource?.method || 'GET',
              status:response.status,
              statusText:response.statusText,
              durationMs:Math.round(performance.now() - startedAt)
            });
          }
          return response;
        }, error => {
          if(!isTelemetryRequest){
            report('fetch_rejected', {
              url,
              method:init?.method || resource?.method || 'GET',
              durationMs:Math.round(performance.now() - startedAt),
              error
            });
          }
          throw error;
        });
      };
      diagnosticFetch.__suiteGlobalDiagnosticsHook = true;
      diagnosticFetch.__suiteGlobalDiagnosticsOriginal = originalFetch;
      try { window.fetch = diagnosticFetch; } catch(e) {}
    }

    ['error', 'warn'].forEach(method => {
      const original = console[method];
      if(typeof original !== 'function' || original.__suiteGlobalDiagnosticsHook) return;
      const wrapped = function(...args){
        try {
          const joined = args.map(value => value instanceof Error ? `${value.name}: ${value.message}` : String(value)).join(' ');
          const tagged = /\[(?:Suite|Auto|AutoWatch|QuizHL|CardValue|Neon|Stone)/i.test(joined);
          if(tagged){
            const compactArgs = args.slice(0, 10).map(value => {
              if(value instanceof Error) return { name:value.name, message:value.message, stack:String(value.stack || '').slice(0, 12000) };
              if(typeof value === 'string') return value.slice(0, 5000);
              if(value == null || typeof value === 'number' || typeof value === 'boolean') return value;
              return {
                type:value?.constructor?.name || typeof value,
                message:String(value?.message || '').slice(0, 5000),
                keys:Object.keys(value || {}).slice(0, 30)
              };
            });
            report(`console_${method}`, { arguments:compactArgs }, method === 'error' ? 'error' : 'warning');
          }
        } catch(e) {}
        return original.apply(this, args);
      };
      wrapped.__suiteGlobalDiagnosticsHook = true;
      wrapped.__suiteGlobalDiagnosticsOriginal = original;
      try { console[method] = wrapped; } catch(e) {}
    });
  }

  try {
    installSuiteGlobalDiagnostics();
  } catch(error) {
    suiteTelemetryLog('suite', 'diagnostics_install_failed', { error }, 'error');
  }

  async function suiteSendAccessInfo(status, nick, clubId) {
    return suiteReportEvent('access_check', { status, nick, clubId });
  }

  function suiteSendAccessInfoOnce(status, nick, clubId) {
    void (async () => {
      const safeNick = String(nick || suiteGetSafeNickname()).trim() || 'Неизвестно';
      const safeClub = String(clubId || suiteGetMyClubId() || 'unknown');
      const keyBase = `${status || 'unknown'}_${safeNick}_${safeClub}`;
      const sentKey = SUITE_ACCESS_SENT_PREFIX + `${SUITE_ACCESS_VERSION}_${keyBase}`;
      const lockKey = SUITE_ACCESS_LOCK_PREFIX + `${SUITE_ACCESS_VERSION}_${keyBase}`;
      const now = Date.now();

      if (localStorage.getItem(sentKey) === 'true') return;

      const existingLock = parseInt(localStorage.getItem(lockKey), 10) || 0;
      if (existingLock && (now - existingLock) < 15000) return;

      localStorage.setItem(lockKey, String(now));
      try {
        const ok = await suiteSendAccessInfo(status, safeNick, safeClub);
        if (ok) localStorage.setItem(sentKey, 'true');
      } finally {
        localStorage.removeItem(lockKey);
      }
    })();
  }

  function suiteSleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

  async function suiteAccessGate() {
    let clubId = suiteGetMyClubId();
    while(!clubId){
      await suiteSleep(500);
      clubId = suiteGetMyClubId();
    }
    suiteAuthenticatedClubId = clubId;

    const nick = suiteDecodeNickname(suiteGetSafeNickname());
    if(nick && nick !== 'Неизвестно') suiteAuthenticatedNickname = nick;

    if (clubId !== SUITE_ALLOWED_CLUB_ID) {
      suiteSendAccessInfoOnce('Заблокирован', nick, clubId || 'unknown');
      console.warn('[Suite access denied]', { nick, clubId });
      alert('Этот скрипт доступен только для участников нужного клуба.');
      throw new Error('Unauthorized usage');
    }

    suiteTelemetryLogActiveOnce(nick, clubId);
    suiteSendAccessInfoOnce('Разрешён', nick, clubId);
    return true;
  }

  // ============================================================
  //  ГЛОБАЛЬНЫЙ CSS
  // ============================================================

  const globalStyle = document.createElement('style');
  globalStyle.textContent = `
    #suite-settings-btn.suite-update-available {
      border-color:#38bdf8 !important;
      background:#082f49 !important;
      color:#e0f2fe !important;
      box-shadow:
        0 0 0 1px rgba(56,189,248,.46),
        0 0 18px rgba(56,189,248,.5),
        0 0 34px rgba(14,165,233,.28) !important;
      animation:suite-update-pulse 1.4s ease-in-out infinite;
    }
    @keyframes suite-update-pulse {
      0%,100% {
        transform:scale(1);
        filter:brightness(1);
      }
      50% {
        transform:scale(1.08);
        filter:brightness(1.18);
      }
    }
    /* Бейдж лучшей карты — внизу карты */
    .cv-best-badge {
      position:absolute;bottom:42px;left:50%;transform:translateX(-50%);z-index:999;
      background:#15803d;color:#bbf7d0;font-size:11px;font-weight:800;
      padding:3px 10px;border-radius:6px;pointer-events:none;letter-spacing:.3px;
      box-shadow:0 0 8px 2px rgba(74,222,128,.7);white-space:nowrap;
    }
    .cv-best-card .card-value {
      color:#4ade80 !important;font-weight:700 !important;
      text-shadow:0 0 8px rgba(74,222,128,.8);
    }
    .suite-vote-toggle-wrapper {
      display:inline-flex;align-items:center;gap:9px;margin-left:12px;vertical-align:middle;
      font-family:inherit;
    }
    .suite-vote-toggle-btn {
      height:28px;padding:0 12px;border-radius:8px;border:1px solid #2563eb;
      background:linear-gradient(180deg,#0f274f,#0b1730);color:#dbeafe;
      font-size:12px;font-weight:800;letter-spacing:.2px;cursor:pointer;
      box-shadow:0 0 0 1px rgba(59,130,246,.22),0 0 14px rgba(37,99,235,.24);
      transition:transform .14s ease,border-color .14s ease,box-shadow .14s ease,background .14s ease;
    }
    .suite-vote-toggle-btn:hover {
      transform:translateY(-1px);border-color:#60a5fa;color:#eff6ff;
      box-shadow:0 0 0 1px rgba(96,165,250,.36),0 0 18px rgba(37,99,235,.38);
    }
    .suite-vote-toggle-btn:active { transform:translateY(0); }
    .suite-vote-toggle-btn:focus { outline:none; }
    .suite-vote-toggle-counter {
      display:inline-flex;align-items:center;min-height:22px;padding:2px 8px;border-radius:7px;
      border:1px solid #1e293b;background:rgba(15,23,42,.72);color:#bfdbfe;
      font-size:12px;font-weight:800;white-space:nowrap;
    }
    .suite-vote-new-label {
      display:inline-flex;align-items:center;justify-content:center;min-height:20px;padding:1px 7px;
      border-radius:999px;border:1px solid rgba(251,146,60,.7);
      background:linear-gradient(180deg,rgba(249,115,22,.95),rgba(154,52,18,.92));
      color:#fff7ed;font-size:10px;font-weight:900;letter-spacing:.55px;line-height:1;
      box-shadow:0 0 0 1px rgba(251,146,60,.18),0 0 14px rgba(249,115,22,.34);
    }
    #suite-emission-timer {
      position:absolute;
      top:12px;
      right:12px;
      z-index:20;
      min-width:172px;padding:10px 12px;border-radius:12px;
      border:1px solid rgba(56,189,248,.22);
      background:linear-gradient(180deg,rgba(10,15,26,.96),rgba(9,14,24,.92));
      color:#e2e8f0;font-family:'Segoe UI',Arial,sans-serif;
      box-shadow:0 10px 28px rgba(0,0,0,.38),0 0 0 1px rgba(30,41,59,.22);
      user-select:none;pointer-events:none;backdrop-filter:blur(6px);
      box-sizing:border-box;max-width:calc(100% - 24px);
    }
    #suite-emission-timer .suite-emission-head {
      display:flex;align-items:center;gap:8px;margin-bottom:5px;
      font-size:11px;font-weight:800;letter-spacing:.45px;text-transform:uppercase;color:#93c5fd;
    }
    #suite-emission-timer .suite-emission-icon {
      display:inline-flex;align-items:center;justify-content:center;
      width:20px;height:20px;border-radius:999px;
      background:rgba(59,130,246,.18);color:#7dd3fc;font-size:12px;
      box-shadow:0 0 0 1px rgba(59,130,246,.18);
    }
    #suite-emission-timer .suite-emission-value {
      display:block;font-size:18px;font-weight:900;line-height:1.15;color:#f8fafc;
      text-shadow:0 0 14px rgba(59,130,246,.16);
    }
    #suite-emission-timer .suite-emission-sub {
      display:block;margin-top:4px;font-size:11px;font-weight:700;color:#94a3b8;
    }
    #suite-emission-timer.is-active {
      border-color:rgba(74,222,128,.32);
      box-shadow:0 10px 28px rgba(0,0,0,.38),0 0 0 1px rgba(34,197,94,.18),0 0 24px rgba(34,197,94,.18);
    }
    #suite-emission-timer.is-active .suite-emission-head { color:#86efac; }
    #suite-emission-timer.is-active .suite-emission-icon {
      background:rgba(34,197,94,.18);color:#86efac;box-shadow:0 0 0 1px rgba(34,197,94,.18);
    }
    #suite-emission-timer.is-soon {
      border-color:rgba(251,191,36,.28);
      box-shadow:0 10px 28px rgba(0,0,0,.38),0 0 0 1px rgba(245,158,11,.18),0 0 24px rgba(245,158,11,.14);
    }
    #suite-emission-timer.is-soon .suite-emission-head { color:#fcd34d; }
    #suite-emission-timer.is-soon .suite-emission-icon {
      background:rgba(245,158,11,.18);color:#fde68a;box-shadow:0 0 0 1px rgba(245,158,11,.18);
    }
    #suite-lab-fatigue-counter {
      position:absolute;top:12px;right:12px;z-index:20;
      min-width:210px;padding:10px 12px;border-radius:12px;
      border:1px solid rgba(56,189,248,.34);
      background:linear-gradient(180deg,rgba(8,20,38,.97),rgba(7,16,30,.93));
      color:#e0f2fe;font-family:'Segoe UI',Arial,sans-serif;
      box-shadow:0 10px 28px rgba(0,0,0,.38),0 0 0 1px rgba(14,165,233,.18),0 0 24px rgba(14,165,233,.12);
      user-select:none;pointer-events:auto;backdrop-filter:blur(6px);box-sizing:border-box;
    }
    #suite-lab-fatigue-counter .suite-lab-fatigue-head {
      display:flex;align-items:center;gap:8px;margin-bottom:5px;
      font-size:11px;font-weight:900;letter-spacing:.45px;text-transform:uppercase;color:#7dd3fc;
    }
    #suite-lab-fatigue-counter .suite-lab-fatigue-icon {
      display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:999px;
      background:rgba(14,165,233,.18);color:#bae6fd;font-size:12px;box-shadow:0 0 0 1px rgba(14,165,233,.22);
    }
    #suite-lab-fatigue-counter .suite-lab-fatigue-value {
      display:block;font-size:18px;font-weight:900;line-height:1.15;color:#f8fafc;text-shadow:0 0 14px rgba(14,165,233,.2);
    }
    #suite-lab-fatigue-counter .suite-lab-fatigue-sub {
      display:block;margin-top:4px;font-size:11px;font-weight:700;color:#93c5fd;
    }
    #suite-lab-fatigue-counter .suite-lab-fatigue-btn {
      position:absolute;right:8px;top:8px;width:28px;height:28px;border-radius:8px;
      border:1px solid rgba(125,211,252,.26);background:rgba(15,23,42,.68);
      color:#dbeafe;cursor:pointer;font-weight:900;line-height:1;
    }
    #suite-lab-fatigue-counter .suite-lab-fatigue-btn:hover{background:rgba(30,41,59,.95);color:#fff;}
    #suite-lab-fatigue-modal {
      position:fixed;inset:0;z-index:9999999;display:none;align-items:center;justify-content:center;
      background:rgba(2,6,23,.66);color:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;padding:14px;
    }
    #suite-lab-fatigue-modal.is-open{display:flex;}
    #suite-lab-fatigue-modal .suite-lab-fatigue-modal-box{
      width:min(520px,100%);max-height:min(680px,88vh);overflow:hidden;
      border-radius:12px;background:#071629;border:1px solid rgba(56,189,248,.28);
      box-shadow:0 22px 80px rgba(0,0,0,.55),0 0 26px rgba(14,165,233,.12);display:flex;flex-direction:column;
    }
    #suite-lab-fatigue-modal .suite-lab-fatigue-modal-head{
      display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(56,189,248,.18);
    }
    #suite-lab-fatigue-modal .suite-lab-fatigue-modal-title{font-size:14px;font-weight:900;}
    #suite-lab-fatigue-modal .suite-lab-fatigue-close{
      width:34px;height:34px;border-radius:8px;border:0;background:#0f2b46;color:#bae6fd;font-size:20px;cursor:pointer;
    }
    #suite-lab-fatigue-modal .suite-lab-fatigue-body{padding:12px 14px;overflow:auto;}
    #suite-lab-fatigue-modal .suite-lab-fatigue-empty{
      min-height:260px;display:flex;align-items:center;justify-content:center;
      border-radius:10px;background:rgba(14,165,233,.06);color:rgba(224,242,254,.65);font-size:13px;font-weight:750;
    }
    #suite-lab-fatigue-modal .suite-lab-fatigue-timeline{display:flex;flex-direction:column;align-items:center;gap:0;padding:8px 0 4px;}
    #suite-lab-fatigue-modal .suite-lab-fatigue-event{
      width:min(320px,100%);padding:12px 14px;border-radius:10px;text-align:center;
      background:rgba(14,165,233,.08);border:1px solid rgba(56,189,248,.18);box-sizing:border-box;
    }
    #suite-lab-fatigue-modal .suite-lab-fatigue-event-name{font-size:20px;line-height:1.1;font-weight:950;text-transform:uppercase;}
    #suite-lab-fatigue-modal .suite-lab-fatigue-event-time{margin-top:5px;font-size:11px;color:rgba(224,242,254,.58);}
    #suite-lab-fatigue-modal .suite-lab-fatigue-gap{
      min-height:58px;display:flex;align-items:center;justify-content:center;gap:12px;color:rgba(224,242,254,.9);font-size:15px;font-weight:850;
    }
    #suite-lab-fatigue-modal .suite-lab-fatigue-gap.is-live{min-height:52px;color:#f8fafc;}
    #suite-lab-fatigue-modal .suite-lab-fatigue-arrow{font-size:34px;line-height:1;color:#38bdf8;}
    #suite-lab-fatigue-modal .suite-lab-fatigue-pages{
      display:flex;align-items:center;justify-content:center;gap:8px;padding-top:10px;margin-top:8px;border-top:1px solid rgba(56,189,248,.18);
    }
    #suite-lab-fatigue-modal .suite-lab-fatigue-page-btn,
    #suite-lab-fatigue-modal .suite-lab-fatigue-reset-btn{
      min-width:36px;height:32px;border-radius:8px;border:1px solid rgba(56,189,248,.28);
      background:rgba(15,23,42,.82);color:#e0f2fe;cursor:pointer;font-weight:900;
    }
    #suite-lab-fatigue-modal .suite-lab-fatigue-page-btn:disabled{opacity:.35;cursor:not-allowed;}
    #suite-lab-fatigue-modal .suite-lab-fatigue-page-state{
      min-width:92px;display:flex;align-items:center;justify-content:center;gap:5px;font-size:12px;color:rgba(224,242,254,.7);font-weight:800;
    }
    #suite-lab-fatigue-modal .suite-lab-fatigue-page-input{
      width:44px;height:32px;border-radius:8px;border:1px solid rgba(56,189,248,.28);
      background:rgba(15,23,42,.82);color:#f8fafc;text-align:center;font-weight:900;box-sizing:border-box;
    }
    #suite-lab-fatigue-modal .suite-lab-fatigue-reset-btn{min-width:58px;border-color:rgba(248,113,113,.35);color:#fecaca;}
    @media(max-width:760px){
      #suite-lab-fatigue-counter{top:104px;right:12px;min-width:172px;width:calc(100% - 24px);max-width:220px;}
      #suite-lab-fatigue-modal .suite-lab-fatigue-pages{flex-wrap:wrap;}
      #suite-lab-fatigue-modal .suite-lab-fatigue-page-state{order:3;flex:1 0 100%;}
    }
    /* Неоновые обводки */
    .neon-outline-wrapper {
      position:absolute;top:-3px;left:-3px;
      width:calc(100% + 6px);height:calc(100% + 6px);
      z-index:1;pointer-events:none !important;
      overflow:visible;
    }
    .neon-outline-svg { width:100%;height:100%; }
    .neon-path-solid {
      fill:none;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;
      opacity:1;filter:drop-shadow(0 0 4px currentColor);
    }
    .neon-path-glow {
      fill:none;stroke-width:5;stroke-linecap:round;stroke-linejoin:round;
      opacity:.72;filter:drop-shadow(0 0 10px currentColor);
    }
    .neon-green-solid  { color:#00cc00; stroke:url(#neon-green-gradient); }
    .neon-green-glow   { color:#00ff00; stroke:url(#neon-green-glow-gradient); }
    .neon-orange-solid { color:#ff3300; stroke:url(#neon-orange-gradient); }
    .neon-orange-glow  { color:#ff6600; stroke:url(#neon-orange-glow-gradient); }
    .neon-violet-solid { color:#9900e6; stroke:url(#neon-violet-gradient); }
    .neon-violet-glow  { color:#cc33ff; stroke:url(#neon-violet-glow-gradient); }
    .neon-red-solid    { color:#cc0000; stroke:url(#neon-red-gradient); }
    .neon-red-glow     { color:#ff3333; stroke:url(#neon-red-glow-gradient); }
    .neon-blue-solid   { color:#0066cc; stroke:url(#neon-blue-gradient); }
    .neon-blue-glow    { color:#3399ff; stroke:url(#neon-blue-glow-gradient); }
    .cv-neon-outline {
      position:relative !important;
      border-radius:12px !important;
      border-width:2px !important;
      overflow:visible !important;
      --cv-neon-main: #4cff7a;
      --cv-neon-bg: #0db42959;
      --cv-neon-border: #05801a;
    }
    .cv-neon-outline::before {
      content:'';
      position:absolute;
      inset:-4px;
      border-radius:15px;
      padding:4px;
      background:conic-gradient(from var(--cv-neon-angle),var(--cv-neon-main) 0deg,#fff 42deg,var(--cv-neon-main) 86deg,var(--cv-neon-main) 178deg,#fff 222deg,var(--cv-neon-main) 270deg,var(--cv-neon-main) 360deg);
      pointer-events:none;
      z-index:3;
      animation:cv-neon-flow 4s linear infinite;
      -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
      -webkit-mask-composite:xor;
      mask-composite:exclude;
    }
    body.suite-neon-animation-off .cv-neon-outline::before {
      animation:none !important;
      background:var(--cv-neon-main) !important;
    }
    .trade__main-item.cv-neon-outline {
      overflow:visible !important;
      border-width:1px !important;
      background-color:var(--bg) !important;
    }
    .trade__main-item.cv-neon-outline::before {
      inset:-1px;
      border-radius:9px;
      padding:3px;
    }
    .cv-neon-green {
      border-color:#05801a !important;
      background-color:#0db42959 !important;
      box-shadow:0 0 18px rgba(76,255,122,.62),0 0 30px rgba(76,255,122,.34) !important;
      --cv-neon-main:#4cff7a;
    }
    .cv-neon-orange {
      border-color:#d96a13 !important;
      background-color:#f9731659 !important;
      box-shadow:0 0 18px rgba(255,155,70,.62),0 0 30px rgba(255,155,70,.34) !important;
      --cv-neon-main:#ff9b46;
    }
    .cv-neon-violet {
      border-color:#7c3aed !important;
      background-color:#8b5cf659 !important;
      box-shadow:0 0 18px rgba(196,140,255,.62),0 0 30px rgba(196,140,255,.34) !important;
      --cv-neon-main:#c48cff;
    }
    .cv-neon-red {
      border-color:#dc2626 !important;
      background-color:#ef444459 !important;
      box-shadow:0 0 18px rgba(255,95,95,.62),0 0 30px rgba(255,95,95,.34) !important;
      --cv-neon-main:#ff5f5f;
    }
    .cv-neon-blue {
      border-color:#2563eb !important;
      background-color:#3b82f659 !important;
      box-shadow:0 0 18px rgba(96,165,250,.62),0 0 30px rgba(96,165,250,.34) !important;
      --cv-neon-main:#60a5fa;
    }
    @property --cv-neon-angle {
      syntax:'<angle>';
      inherits:false;
      initial-value:0deg;
    }
    @keyframes cv-neon-flow {
      from { --cv-neon-angle:0deg; }
      to { --cv-neon-angle:360deg; }
    }
    /* Фон меню */
    .lgn__inner.tm-fullbg-ready {
      position: relative !important;
      overflow: hidden !important;
      --suite-menu-bg-dim: .42;
      --suite-menu-text-clarity: .75;
      --suite-menu-text-weight: 650;
      --suite-menu-text-shadow-alpha: .65;
      --suite-menu-text-alpha: .95;
      --suite-menu-hover-bg-alpha: .05;
      --suite-menu-hover-border-alpha: .22;
      --suite-menu-hover-glow-alpha: .22;
    }
    .lgn__inner.tm-fullbg-ready > video.tm-menu-profilebg {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      min-width: 100% !important;
      min-height: 100% !important;
      object-fit: cover !important;
      object-position: center center !important;
      display: block !important;
      z-index: 0 !important;
      pointer-events: none !important;
      background: transparent !important;
    }
    .lgn__inner.tm-fullbg-ready > *:not(video.tm-menu-profilebg) {
      position: relative !important;
      z-index: 3 !important;
    }
    .lgn__inner.tm-fullbg-ready::before,
    .lgn__inner.tm-fullbg-ready::after {
      content: '' !important;
      position: absolute !important;
      inset: 0 !important;
      pointer-events: none !important;
    }
    .lgn__inner.tm-fullbg-ready::before {
      z-index: 1 !important;
      background: rgba(0,0,0,var(--suite-menu-bg-dim)) !important;
    }
    .lgn__inner.tm-fullbg-ready::after {
      z-index: 2 !important;
      background:
        linear-gradient(
          90deg,
          rgba(0,0,0,calc(var(--suite-menu-bg-dim) * .25)) 0%,
          rgba(0,0,0,calc(var(--suite-menu-bg-dim) * .85)) 100%
        ) !important;
    }
    .lgn__inner.tm-fullbg-ready .lgn__ava-holder,
    .lgn__inner.tm-fullbg-ready .lgn__menus {
      background: transparent !important;
    }
    .lgn__inner.tm-fullbg-ready .lgn__ava-holder::before,
    .lgn__inner.tm-fullbg-ready .lgn__ava-holder::after,
    .lgn__inner.tm-fullbg-ready .lgn__menus::before,
    .lgn__inner.tm-fullbg-ready .lgn__menus::after {
      display: none !important;
      content: none !important;
    }
    .lgn__inner.tm-fullbg-ready .lgn__menus a,
    .lgn__inner.tm-fullbg-ready .lgn__menus .lgn__menu-item,
    .lgn__inner.tm-fullbg-ready .lgn__user-name,
    .lgn__inner.tm-fullbg-ready .lgn__name span,
    .lgn__inner.tm-fullbg-ready .lgn__caption,
    .lgn__inner.tm-fullbg-ready .lgn__ava-holder a,
    .lgn__inner.tm-fullbg-ready .lgn__ava-holder button,
    .lgn__inner.tm-fullbg-ready .lgn__ava-holder .btn {
      color: rgba(255,255,255,var(--suite-menu-text-alpha)) !important;
      font-weight: var(--suite-menu-text-weight) !important;
      text-shadow:
        0 1px calc(1px + 2px * var(--suite-menu-text-clarity)) rgba(0,0,0,var(--suite-menu-text-shadow-alpha)),
        0 0 calc(2px + 10px * var(--suite-menu-text-clarity)) rgba(0,0,0,var(--suite-menu-text-shadow-alpha)) !important;
    }
    .lgn__inner.tm-fullbg-ready .lgn__caption::after {
      opacity: calc(.35 + var(--suite-menu-text-clarity) * .55) !important;
    }
    .lgn__inner.tm-fullbg-ready .lgn__menus a:hover,
    .lgn__inner.tm-fullbg-ready .lgn__menu-list li:hover,
    .lgn__inner.tm-fullbg-ready .lgn__menu li a:hover {
      color: #fff !important;
      background: rgba(0,0,0,var(--suite-menu-hover-bg-alpha)) !important;
      box-shadow:
        inset 0 0 0 1px rgba(255,255,255,var(--suite-menu-hover-border-alpha)),
        0 0 calc(8px + 12px * var(--suite-menu-text-clarity)) rgba(255,255,255,var(--suite-menu-hover-glow-alpha)) !important;
      text-shadow:
        0 1px 2px rgba(0,0,0,.95),
        0 0 calc(8px + 12px * var(--suite-menu-text-clarity)) rgba(255,255,255,calc(var(--suite-menu-text-clarity) * .28)) !important;
    }
    .lgn.tm-fullbg-host,
    .lgn.tm-fullbg-host .lgn__inner {
      background: transparent !important;
    }
    /* Панель настроек */
    #suite-settings-panel * { box-sizing:border-box; }
    #suite-settings-panel .neon-outline-wrapper { display:none !important; }
    #suite-settings-panel input[type=range] {
      width:330px;
      max-width:100%;
      accent-color:#0ea5e9;
    }
    #suite-menu-tooltip {
      position: fixed;
      z-index: 2147483647;
      max-width: 270px;
      padding: 10px 12px;
      border-radius: 6px;
      color: #fef3c7;
      background: rgba(28,25,23,.98);
      border-left: 3px solid var(--suite-tip-accent,#f59e0b);
      box-shadow: 0 12px 30px rgba(0,0,0,.42);
      font: 12px/1.35 "Segoe UI", Arial, sans-serif;
      pointer-events: none;
      opacity: 0;
      transform: translateY(-50%) translateX(-4px);
      transition: opacity .12s ease, transform .12s ease;
      white-space: normal;
    }
    #suite-menu-tooltip.show {
      opacity: 1;
      transform: translateY(-50%) translateX(0);
    }
    #suite-menu-tooltip.is-touch {
      max-width:calc(100vw - 16px);
      transform:none;
    }
    #suite-menu-tooltip.is-touch.show {
      transform:none;
    }
    #suite-menu-tooltip .suite-menu-tooltip-premium {
      display:block;
      margin-top:8px;
      padding-top:7px;
      border-top:1px solid rgba(245,158,11,.35);
      color:#fde68a;
      font-weight:800;
      text-shadow:0 0 10px rgba(245,158,11,.28);
    }
    #cv-stats-panel,
    #stone-brick-panel,
    #remelt-panel,
    #cv-auto-open-panel,
    #missing-panel,
    #aw-active-tab-panel {
      box-sizing:border-box;
      max-width:calc(100vw - 16px) !important;
      max-height:calc(100dvh - 16px) !important;
    }
    #cv-stats-content,
    #stone-brick-body,
    #remelt-panel-body,
    #missing-panel-body {
      max-height:calc(100dvh - 120px) !important;
      overflow-y:auto !important;
      overscroll-behavior:contain;
    }
    #cv-confirm-overlay,
    #cv-pack-confirm-overlay {
      box-sizing:border-box;
      padding:8px;
    }
    #cv-confirm-overlay > div,
    #cv-pack-confirm-overlay > div {
      box-sizing:border-box;
      max-width:calc(100vw - 16px) !important;
      max-height:calc(100dvh - 16px);
      overflow:auto;
      overscroll-behavior:contain;
    }
    #__cpt-root {
      max-width:calc(100vw - 16px);
      max-height:calc(100dvh - 16px);
      overflow:hidden;
    }
    @media(max-width:520px){
      #cv-confirm-overlay > div,
      #cv-pack-confirm-overlay > div { padding:20px 16px 16px !important; }
      #cv-confirm-overlay > div > div:last-child,
      #cv-pack-confirm-overlay > div > div:last-child { flex-wrap:wrap; }
      .cpt-toast { width:min(230px,calc(100vw - 16px)) !important; }
    }
    .suite-toggle {
      position:relative;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:50px;
      height:26px;
      flex:0 0 50px;
      vertical-align:middle;
      line-height:0;
    }
    .suite-toggle input { opacity:0;width:0;height:0; }
    .suite-slider {
      position:relative;
      display:grid;
      align-items:center;
      box-sizing:border-box;
      width:50px;
      height:26px;
      padding:2px;
      cursor:pointer;
      border-radius:999px;
      background:linear-gradient(145deg,#121821,#05080d);
      border:1px solid rgba(148,163,184,.18);
      box-shadow:
        inset 4px 4px 8px rgba(0,0,0,.70),
        inset -3px -3px 7px rgba(148,163,184,.08),
        0 0 8px rgba(0,0,0,.50);
      transition:border-color .22s ease, box-shadow .22s ease, background .22s ease;
    }
    .suite-slider:before {
      content:'';
      position:relative;
      box-sizing:border-box;
      grid-area:1 / 1;
      align-self:center;
      justify-self:start;
      width:20px;
      height:20px;
      left:0;
      top:0;
      transform:translateX(0);
      border-radius:50%;
      background:linear-gradient(145deg,#303743,#171c25);
      border:1px solid rgba(226,232,240,.34);
      box-shadow:
        0 0 8px rgba(0,0,0,.72),
        inset 2px 2px 4px rgba(255,255,255,.08),
        inset -3px -3px 5px rgba(0,0,0,.45);
      transition:transform .24s cubic-bezier(.2,.8,.2,1), border-color .22s ease, box-shadow .22s ease;
      will-change:transform;
      z-index:2;
    }
    .suite-slider:after {
      content:'';
      position:absolute;
      box-sizing:border-box;
      width:7px;
      height:7px;
      left:-9px;
      top:2px;
      border-radius:50%;
      background:#ef4444;
      box-shadow:0 0 9px rgba(239,68,68,.85);
      transition:background .22s ease, box-shadow .22s ease;
    }
    .suite-toggle input:checked + .suite-slider {
      border-color:rgba(94,234,212,.95);
      background:linear-gradient(145deg,#101720,#05080d);
      box-shadow:
        inset 4px 4px 8px rgba(0,0,0,.70),
        inset -3px -3px 7px rgba(94,234,212,.10),
        0 0 0 1px rgba(74,222,128,.72),
        0 0 16px rgba(74,222,128,.55),
        0 0 22px rgba(45,212,191,.42);
    }
    .suite-toggle input:checked + .suite-slider:before {
      transform:translateX(24px);
      border-color:rgba(226,232,240,.58);
      box-shadow:
        0 0 8px rgba(0,0,0,.76),
        0 0 10px rgba(45,212,191,.26),
        inset 2px 2px 4px rgba(255,255,255,.10),
        inset -3px -3px 5px rgba(0,0,0,.48);
    }
    .suite-toggle input:checked + .suite-slider:after {
      background:#4ade80;
      box-shadow:0 0 10px rgba(74,222,128,.9),0 0 16px rgba(45,212,191,.55);
    }
    .suite-toggle input:focus-visible + .suite-slider {
      outline:2px solid rgba(125,211,252,.8);
      outline-offset:3px;
    }
    .suite-section-nav {
      display:flex;
      align-items:center;
      gap:8px;
      width:var(--suite-menu-plate-width, max-content);
      max-width:100%;
      margin:0 0 12px;
      padding:8px;
      border-radius:999px;
      background:linear-gradient(135deg,#0b5063,#0f172a);
      border:1px solid rgba(103,232,249,.24);
      box-shadow:0 0 0 1px rgba(34,211,238,.10), inset 0 1px 0 rgba(255,255,255,.08);
      overflow:visible;
      transition:width .36s cubic-bezier(.22,1,.36,1);
    }
    #suite-settings-panel {
      scrollbar-color: rgba(103,232,249,.45) transparent;
      background:transparent !important;
      box-shadow:none !important;
      opacity:1 !important;
      filter:none !important;
      backdrop-filter:none !important;
    }
    .suite-settings-header,
    .suite-section-panel {
      width:var(--suite-menu-plate-width, max-content);
      max-width:100%;
      transition:width .36s cubic-bezier(.22,1,.36,1);
      background:linear-gradient(135deg,#0b5063,#0f172a) !important;
      opacity:1 !important;
      filter:none !important;
      backdrop-filter:none !important;
      isolation:isolate;
      background-clip:padding-box;
    }
    .suite-section-tab {
      position:relative;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:8px;
      flex:0 0 44px;
      width:44px;
      min-width:44px;
      max-width:none;
      height:44px;
      padding:0 13px;
      border:0;
      border-radius:999px;
      color:#67e8f9;
      background:transparent;
      cursor:pointer;
      overflow:hidden;
      font:700 13px/1 "Segoe UI",Arial,sans-serif;
      transition:width .36s cubic-bezier(.22,1,.36,1),background .2s ease,box-shadow .2s ease,color .2s ease;
    }
    .suite-section-tab.is-hovered,
    .suite-section-tab.is-active {
      flex-basis:var(--suite-section-tab-open-width, 240px);
      width:var(--suite-section-tab-open-width, 240px);
      justify-content:flex-start;
      background:rgba(255,255,255,.12);
      color:#f8fafc;
      box-shadow:0 0 24px rgba(34,211,238,.20), inset 0 1px 0 rgba(255,255,255,.10);
    }
    .suite-section-tab.is-active {
      background:rgba(240,249,255,.94);
      color:#0f172a;
    }
    .suite-section-tab-icon {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-width:18px;
      font-size:17px;
      line-height:1;
    }
    .suite-section-tab-label {
      opacity:0;
      max-width:0;
      transform:translateX(-7px);
      white-space:nowrap;
      overflow:hidden;
      transition:opacity .2s ease,max-width .36s ease,transform .36s ease;
    }
    .suite-section-tab.is-hovered .suite-section-tab-label,
    .suite-section-tab.is-active .suite-section-tab-label {
      opacity:1;
      max-width:200px;
      transform:translateX(0);
    }
    .suite-section-panel {
      display:none;
      padding:10px 12px 12px;
      border-radius:20px;
      background:linear-gradient(135deg,#0b5063,#0f172a);
      border:1px solid rgba(103,232,249,.24);
      box-shadow:0 0 0 1px rgba(34,211,238,.10), inset 0 1px 0 rgba(255,255,255,.08);
    }
    .suite-section-panel.is-active {
      display:block;
      animation:suiteSectionIn .16s ease-out;
    }
    @keyframes suiteSectionIn {
      from { opacity:0; transform:translateY(5px); }
      to { opacity:1; transform:translateY(0); }
    }
    @media (max-width: 620px) {
      .suite-section-nav {
        align-items:stretch;
        flex-direction:column;
        width:100%;
        max-width:none;
        border-radius:16px;
        padding:7px;
      }
      .suite-section-tab,
      .suite-section-tab.is-hovered,
      .suite-section-tab.is-active {
        flex:0 0 auto;
        width:100%;
        max-width:none;
        justify-content:flex-start;
      }
      .suite-section-tab-label {
        opacity:1;
        max-width:none;
        transform:none;
      }
      #suite-settings-panel input[type=range] {
        width:100%;
      }
      .suite-section-panel.is-active {
        max-height:calc(100vh - 180px);
        overflow-y:auto;
      }
    }
    /* Ценность карт — перенос на новую строку на узких экранах */
    @media (max-width: 600px) {
      .card-stats {
        flex-wrap: wrap !important;
      }
      .card-value {
        display: block !important;
        width: 100% !important;
        margin-top: 2px !important;
        text-align: center !important;
      }
    }
  `;
  document.head.appendChild(globalStyle);

  // ============================================================
  //  РАНГИ И ПАРАМЕТРЫ ЦЕННОСТИ
  // ============================================================

  const rankMap = {
    ASS:90, S_PLUS:65, S:65, A_PLUS:65, A:45, B_PLUS:65, B:27,
    C_PLUS:65, C:0, D_PLUS:65, D:0, E_PLUS:65, E:0
  };
  const RANK_ORDER  = ['ASS','S_PLUS','S','A_PLUS','A','B_PLUS','B','C_PLUS','C','D_PLUS','D','E_PLUS','E'];
  const RANK_LABELS = { ASS:'ASS',S_PLUS:'S+',S:'S',A_PLUS:'A+',A:'A',B_PLUS:'B+',B:'B',C_PLUS:'C+',C:'C',D_PLUS:'D+',D:'D',E_PLUS:'E+',E:'E' };
  const RANK_COLORS = {
    ASS:'#6b21a8',S_PLUS:'#a855f7',S:'#c084fc',A_PLUS:'#dc2626',A:'#f87171',
    B_PLUS:'#1d4ed8',B:'#60a5fa',C_PLUS:'#16a34a',C:'#4ade80',
    D_PLUS:'#475569',D:'#94a3b8',E_PLUS:'#78350f',E:'#b45309'
  };

  const WANT_BONUS=15,RARE_FACTOR_BASE=50,DEMAND_MULTIPLIER=10,DEMAND_MAX=30;
  const DEMAND_BOOST_THRESHOLD=100,DEMAND_BOOST_MULTIPLIER=2,DUPLICATE_MAX=30;
  const THRESHOLD_1=150,THRESHOLD_2=1000,RARE_PART1=.4,RARE_PART2=.4,RARE_PART3=.2;
  const BAD_BASE_MAX=12.5,BAD_BASE_MIN=1,BAD_MAX_TOTAL=5000;
  const MAX_DUPLICATES=5;

  const todayKey = new Date().toISOString().split('T')[0];

  // ============================================================
  //  ХРАНИЛИЩЕ СТАТИСТИКИ И ЛОГОВ
  // ============================================================

  const STATS_KEY      = 'cardStats_v4';
  const LOGS_KEY       = 'cardLogs_all';
  const SEEN_PACKS_KEY = 'seenPackIds';
  const MAX_SEEN_PACKS = 1000;

  let stats       = gmGet(STATS_KEY,      { allCards:{}, pickedCards:{} });

  // Счётчики паков с последней карты нужного ранга
  const LAST_RANK_KEY = 'lastRankCounters_v1';
    let lastRank = gmGet(LAST_RANK_KEY, {
        S:0,
        PLUS:0,
        ASS:0,

        currentS:0,
        currentPlus:0,
        currentASS:0
    });
  function saveLastRank() { gmSet(LAST_RANK_KEY, lastRank); }
  let savedLogs   = gmGet(LOGS_KEY,       []);
  let seenPackIds = new Set(gmGet(SEEN_PACKS_KEY, []));
  let seenPickIds = new Set(gmGet('seenPickIds',  []));
  const loggedIds = new Set(savedLogs.map(l => l.id));

  function saveStats()  { gmSet(STATS_KEY, stats); }
  function saveLogs()   { gmSet(LOGS_KEY,  savedLogs); }
  function saveSeenPacks() {
    let arr = [...seenPackIds];
    if (arr.length > MAX_SEEN_PACKS) { arr = arr.slice(arr.length - MAX_SEEN_PACKS); seenPackIds = new Set(arr); }
    gmSet(SEEN_PACKS_KEY, arr);
  }
  function saveSeenPicks() { gmSet('seenPickIds', [...seenPickIds]); }

  function recordCard(bucket, rank, value) {
    if (!rank) return;
    const key = rank.toUpperCase();
    if (!stats[bucket][key]) stats[bucket][key] = { count:0, totalValue:0, minValue:Infinity, maxValue:-Infinity, byDate:{} };
    const s = stats[bucket][key];
    s.count++; s.totalValue = Math.round((s.totalValue + value)*100)/100;
    if (value < s.minValue) s.minValue = value;
    if (value > s.maxValue) s.maxValue = value;
    s.byDate[todayKey] = (s.byDate[todayKey]||0)+1;
    saveStats();
  }

  // ============================================================
  //  ФОРМУЛЫ ЦЕННОСТИ
  // ============================================================

  function getRareFactor(n) {
    if (n<=THRESHOLD_1) return RARE_FACTOR_BASE*(RARE_PART2+RARE_PART3)+RARE_FACTOR_BASE*RARE_PART1*(1-n/THRESHOLD_1);
    if (n<=THRESHOLD_2) { const p=(n-THRESHOLD_1)/(THRESHOLD_2-THRESHOLD_1); return RARE_FACTOR_BASE*RARE_PART3+RARE_FACTOR_BASE*RARE_PART2*(1-p); }
    return RARE_FACTOR_BASE*RARE_PART3*(1-Math.min((n-THRESHOLD_2)/(3000-THRESHOLD_2),1));
  }
  function stretchToOne(v) { return v>=10?v:1+9*(1-Math.exp(-(v-1)/2)); }

  function calcCardValue(total, want, trade, dup, rank, wantBonus) {
    let D=(want/(trade+1))*DEMAND_MULTIPLIER; if(want>DEMAND_BOOST_THRESHOLD)D*=DEMAND_BOOST_MULTIPLIER; D=Math.min(D,DEMAND_MAX);
    const ru=rank?rank.toUpperCase():null;
    const dupScale=ru==='A'?0.5:ru==='B'?0.667:1.0;
    const dupP=wantBonus?0:Math.min(dup*5-Math.min(dup,2)*2.5,DUPLICATE_MAX)*dupScale;
    const R=rank?(rankMap[rank.toUpperCase()]||0):0;
    const badRanks=['C','C_PLUS','D','D_PLUS','E','E_PLUS'];
    const low=(badRanks.includes(rank)&&total<200)?2:0;
    let v=getRareFactor(total)+D+R+(wantBonus?WANT_BONUS:0)+low-dupP;
    return Math.round(stretchToOne(Math.min(Math.max(v,1),100))*100)/100;
  }
  function calcTradeSValue(total, want, trade, dup, wantBonus) {
    const RF=Math.max(0,(1-total/100))*50;
    let D=(want/(trade+1))*DEMAND_MULTIPLIER; if(want>DEMAND_BOOST_THRESHOLD)D*=DEMAND_BOOST_MULTIPLIER; D=Math.min(D,DEMAND_MAX);
    let TB=15-trade*3; if(TB<-10)TB=-10;
    const dupP=wantBonus?0:Math.min(dup*5-Math.min(dup,2)*2.5,DUPLICATE_MAX);
    let v=RF+D+(wantBonus?WANT_BONUS:0)+TB-dupP;
    return Math.round(stretchToOne(Math.min(Math.max(v,1),100))*100)/100;
  }
  function calcBadCardValue(total, want, trade, dup) {
    const rarityScore=Math.max(0,1-total/BAD_MAX_TOTAL);
    const demandRaw=(want/(trade+1))*(want>100?2:1);
    const demandScore=Math.min(demandRaw/15,1);
    const score=rarityScore*0.6+demandScore*0.4;
    const v=BAD_BASE_MIN+(BAD_BASE_MAX-BAD_BASE_MIN)*score;
    const dupPen=Math.min(dup,MAX_DUPLICATES)*(BAD_BASE_MAX-BAD_BASE_MIN)*0.05;
    return Math.round(Math.max(v-dupPen,BAD_BASE_MIN)*100)/100;
  }

  // ============================================================
  //  ПАРСИНГ КАРТОЧЕК
  // ============================================================

  function parseStat(span) { return parseInt(span.textContent.replace(/\D/g,''))||0; }
  function getCardRank(card) {
    const el=card.matches('[data-rank]')?card:card.querySelector('[data-rank]');
    if(el) return el.getAttribute('data-rank').toUpperCase();
    return null;
  }
  function isGoldSCard(card) {
    const el=card.matches('[data-gold="1"]')?card:card.querySelector('[data-gold="1"]');
    return !!el && (el.getAttribute('data-rank') || '').toUpperCase() === 'S';
  }
  function getCardId(card) { return card.getAttribute('data-id')||null; }

  function computeCardValue(card) {
    const spans=card.querySelectorAll('.card-stats span'); if(spans.length<4)return null;
    const total=parseStat(spans[0]),want=parseStat(spans[1]),trade=parseStat(spans[2]),dup=parseStat(spans[3]);
    const wb=card.classList.contains('anime-cards__owned-by-user-want');
    const rank=getCardRank(card);
    const isTradeCard=!!card.closest('.trade__main');
    const ru=rank?rank.toUpperCase():null;
    const isHigh=ru==='S'||ru==='S_PLUS'||ru==='ASS';
    const isGold=isGoldSCard(card);
    if(isGold) {
      return { value:666, total, want, trade, dup, rank, rankUpper:ru, isTradeCard, isHighRank:isHigh, isGold };
    }
    let value=isTradeCard&&isHigh?calcTradeSValue(total,want,trade,dup,wb):calcCardValue(total,want,trade,dup,rank,wb);
    if(value<BAD_BASE_MAX)value=calcBadCardValue(total,want,trade,dup);
    return { value, total, want, trade, dup, rank, rankUpper:ru, isTradeCard, isHighRank:isHigh, isGold };
  }

  // ============================================================
  //  ОТСЛЕЖИВАНИЕ ПАКОВ
  // ============================================================

  function getActiveRow() {
    const rows=[...document.querySelectorAll('.lootbox__row[data-pack-id]')];
    for(let i=rows.length-1;i>=0;i--){ const s=window.getComputedStyle(rows[i]); if(s.display!=='none'&&s.visibility!=='hidden')return rows[i]; }
    return null;
  }

  function tryRecordAllCards(row) {
    if(!row||!cfg.modStats)return;
    const packId=row.getAttribute('data-pack-id');
    if(!packId||seenPackIds.has(packId))return;
    const cards=[...row.querySelectorAll('.lootbox__card')];
    if(!cards.length||!cards.every(c=>computeCardValue(c)))return;
    seenPackIds.add(packId); saveSeenPacks();
    cards.forEach(c=>{ const r=computeCardValue(c); if(r)recordCard('allCards',r.rank,r.value); });
    // Обновляем расстояние до последних S/+/ASS
    lastRank.currentS++;
    lastRank.currentPlus++;
    lastRank.currentASS++;

    let gotS=false, gotPlus=false, gotASS=false;

    cards.forEach(c=>{
        const r=computeCardValue(c);
        if(!r) return;

        const rk=r.rank ? r.rank.toUpperCase() : '';

        if(rk==='ASS') gotASS=true;
        if(rk==='S'||rk==='S_PLUS'||rk==='ASS') gotS=true;
        if(rk.endsWith('_PLUS')||rk==='ASS') gotPlus=true;
    });

    if(gotASS){
        lastRank.ASS = lastRank.currentASS;
        lastRank.currentASS = 0;
    }

    if(gotS){
        lastRank.S = lastRank.currentS;
        lastRank.currentS = 0;
    }

    if(gotPlus){
        lastRank.PLUS = lastRank.currentPlus;
        lastRank.currentPlus = 0;
    }

    saveLastRank();
    renderStatsTab();
  }

  // Отслеживаем гарантированную S (счётчик прыгнул с малого числа обратно к 1800)
  let prevGuaranteeCount = null;
  function checkGuaranteeS() {
    if(!cfg.modStats) return;
    const span = document.querySelector('.lootbox__counter__s');
    if(!span) return;
    const cur = parseInt(span.textContent.replace(/\D/g,'')) || 0;
    if(prevGuaranteeCount !== null && prevGuaranteeCount <= 20 && cur > 1700) {
      // Гарант сработал — добавляем S в статистику но НЕ сбрасываем totalSinceS
      recordCard('allCards', 'S', 0);
      recordCard('pickedCards', 'S', 0);
      // totalSinceS и счётчик последней S НЕ трогаем — это не выпавшая карта
      renderStatsTab();
    }
    prevGuaranteeCount = cur;
  }

  function onCardPicked(card) {
    if(!cfg.modStats)return;
    const row=card.closest('.lootbox__row[data-pack-id]'); if(!row)return;
    const packId=row.getAttribute('data-pack-id');
    if(!packId||seenPickIds.has(packId))return;
    seenPickIds.add(packId); saveSeenPicks();
    const r=computeCardValue(card); if(r)recordCard('pickedCards',r.rank,r.value);
    renderStatsTab();
  }

  // ============================================================
  //  ЗАЩИТНОЕ ОКНО
  // ============================================================

  let confirmedCard=null, confirmDialog=null;
  let autoOpenSuppressGuard=false;
  function confirmGuardSelection(){
    if(!confirmDialog || confirmDialog.style.display !== 'flex') return false;
    confirmDialog.style.display='none';
    if(confirmedCard){
      const c=confirmedCard;
      c.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
      if(confirmedCard===c) confirmedCard=null;
    }
    return true;
  }
  function cancelGuardSelection(){
    if(!confirmDialog || confirmDialog.style.display !== 'flex') return false;
    confirmDialog.style.display='none';
    confirmedCard=null;
    return true;
  }

  function createConfirmDialog() {
    const overlay=document.createElement('div');
    overlay.id='cv-confirm-overlay';
    overlay.style.cssText='display:none;position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.65);backdrop-filter:blur(3px);align-items:center;justify-content:center;';
    const box=document.createElement('div');
    box.style.cssText='background:#0a0f1a;border:1px solid #1e293b;border-radius:16px;padding:28px 28px 22px;max-width:360px;width:90%;box-shadow:0 24px 64px rgba(0,0,0,.9);font-family:\'Segoe UI\',sans-serif;color:#e2e8f0;text-align:center;';
    const icon=document.createElement('div'); icon.textContent='⚠️'; icon.style.cssText='font-size:36px;margin-bottom:12px';
    const title=document.createElement('div'); title.textContent='Карта значительно хуже'; title.style.cssText='font-size:16px;font-weight:700;margin-bottom:10px;color:#f87171';
    const msg=document.createElement('div'); msg.id='cv-confirm-msg'; msg.style.cssText='font-size:13px;color:#94a3b8;line-height:1.6;margin-bottom:20px';
    const btns=document.createElement('div'); btns.style.cssText='display:flex;gap:10px;justify-content:center';
    const btnOk=document.createElement('button'); btnOk.id='cv-confirm-ok'; btnOk.textContent='Да, выбрать';
    btnOk.style.cssText='padding:9px 22px;border:none;border-radius:9px;cursor:pointer;background:#7f1d1d;color:#fca5a5;font-weight:600;font-size:13px;';
    btnOk.onmouseover=()=>btnOk.style.background='#991b1b'; btnOk.onmouseout=()=>btnOk.style.background='#7f1d1d';
    const btnCancel=document.createElement('button'); btnCancel.id='cv-confirm-cancel'; btnCancel.textContent='Отмена';
    btnCancel.style.cssText='padding:9px 22px;border:none;border-radius:9px;cursor:pointer;background:#1e293b;color:#94a3b8;font-weight:600;font-size:13px;';
    btnCancel.onmouseover=()=>btnCancel.style.background='#334155'; btnCancel.onmouseout=()=>btnCancel.style.background='#1e293b';
    btns.append(btnOk,btnCancel); box.append(icon,title,msg,btns); overlay.appendChild(box); document.body.appendChild(overlay);
    btnOk.addEventListener('click',confirmGuardSelection);
    btnCancel.addEventListener('click',cancelGuardSelection);
    overlay.addEventListener('click',e=>{ if(e.target===overlay)cancelGuardSelection(); });
    return overlay;
  }

  function showConfirmDialog(card,cv,bv) {
    if(!confirmDialog)confirmDialog=createConfirmDialog();
    confirmedCard=card;
    const diff=(bv-cv).toFixed(2);
    document.getElementById('cv-confirm-msg').innerHTML=
      `Ценность выбранной карты: <b style="color:#f87171">${cv}</b><br>Лучшая карта в паке: <b style="color:#4ade80">${bv}</b><br>Разница: <b style="color:#fb923c">−${diff}</b><br><br>Всё равно выбрать эту карту?`;
    confirmDialog.style.display='flex';
  }

  function isConfirmDialogOpen() {
    return !!(confirmDialog && confirmDialog.style.display === 'flex');
  }

  // Клики по картам
  document.addEventListener('click',function(e){
    const card=e.target.closest('.lootbox__card'); if(!card)return;
    const row=card.closest('.lootbox__row[data-pack-id]'); if(!row)return;
    // Если диалог открыт и это не подтверждённая карта — блокируем любой клик по карте
    if(isConfirmDialogOpen() && confirmedCard !== card){
      e.preventDefault(); e.stopImmediatePropagation(); return;
    }
    if(confirmedCard===card){ confirmedCard=null; setTimeout(()=>onCardPicked(card),80); return; }
    if(cfg.modGuard && !autoOpenSuppressGuard){
      const vals=[...row.querySelectorAll('.lootbox__card')].map(c=>{ const r=computeCardValue(c); return r?r.value:0; });
      const bv=Math.max(...vals);
      const cr=computeCardValue(card); const cv=cr?cr.value:0;
      if(bv-cv>=cfg.guardThreshold){ e.preventDefault(); e.stopImmediatePropagation(); showConfirmDialog(card,cv,bv); return; }
    }
    setTimeout(()=>onCardPicked(card),80);
    handleAutoManualPick(card);
  },true);

  // ============================================================
  //  ОТОБРАЖЕНИЕ ЦЕННОСТИ
  // ============================================================

  function addCardValue() {
    document.querySelectorAll('.lootbox__card, .trade__main-item').forEach(card=>{
      if(!card.isConnected)return;
      if(card.classList.contains('lootbox__card')){
        if(cfg.modNeon) applyNeonToCard(card);
        else clearNeonFromCard(card);
      }
      const res=computeCardValue(card); if(!res)return;
      const {value,total,want,trade,dup,rank,isTradeCard,isHighRank}=res;
      if(cfg.modCardValue){
        const ex=card.querySelector('.card-value');
        if(!ex){
          const span=document.createElement('span'); span.className='card-value'; span.title='Ценность карточки';
          span.innerHTML=`<i class="fas fa-star"></i> ${value}`;
          const spans=card.querySelectorAll('.card-stats span'); spans[spans.length-1].after(span);
        } else { ex.innerHTML=`<i class="fas fa-star"></i> ${value}`; }
      } else {
        card.querySelector('.card-value')?.remove();
      }
      if(isTradeCard&&isHighRank){
        const cardId=getCardId(card);
        if(cardId&&!loggedIds.has(cardId)){
          savedLogs.push({id:cardId,rank,total,want,trade,duplicates:dup,value,date:todayKey});
          loggedIds.add(cardId); saveLogs();
        }
      }
    });
    tryRecordAllCards(getActiveRow());
    if(cfg.modCardValue&&cfg.modBestCard) highlightBestCard();
    else {
      document.querySelectorAll('.cv-best-badge').forEach(b=>b.remove());
      document.querySelectorAll('.cv-best-card').forEach(c=>c.classList.remove('cv-best-card'));
    }
  }

  function highlightBestCard() {
    const row=getActiveRow();
    document.querySelectorAll('.cv-best-badge').forEach(b=>b.remove());
    document.querySelectorAll('.cv-best-card').forEach(c=>{ c.classList.remove('cv-best-card'); const s=c.querySelector('.card-value'); if(s)s.title='Ценность карточки'; });
    if(!row)return;
    const cards=[...row.querySelectorAll('.lootbox__card')]; if(!cards.length)return;
    const entries=cards.map(c=>{
      const r=computeCardValue(c);
      const dupSpan=c.querySelector('span[title="Дубли на руках"]');
      const dup=dupSpan?parseInt(dupSpan.textContent.replace(/\D/g,''))||0:99;
      const allSpans=c.querySelectorAll('.card-stats span');
      const want=allSpans.length>=2?parseInt(allSpans[1].textContent.replace(/\D/g,''))||0:0;
      const rank=r?r.rankUpper:null;
      return {card:c, value:r?r.value:0, dup, rank, want};
    });

    // Ранги, которые перебивают A (исключения из правила A-приоритета)
    const ABOVE_A=['ASS','S_PLUS','S','A_PLUS','B_PLUS','C_PLUS','D_PLUS','E_PLUS'];
    const hasAboveA=entries.some(e=>ABOVE_A.includes(e.rank));
    const aEntries=entries.filter(e=>e.rank==='A');
    const hasA=aEntries.length>0;
    const maxVal=Math.max(...entries.map(e=>e.value));

    let bestEntries;
    if(!hasAboveA && hasA){
      // Есть A-карты и нет ASS/S+/S/A+ — A-карта(ы) имеют безусловный приоритет
      if(aEntries.length===1){
        bestEntries=aEntries;
      } else {
        // Несколько A-карт: берём с максимальной ценностью,
        // но если у более дешёвой A-карты на 40+ желающих больше — она лучшая
        const maxAVal=Math.max(...aEntries.map(e=>e.value));
        const topA=aEntries.filter(e=>e.value===maxAVal);
        let demandWinner=null;
        for(const cheaper of aEntries){
          if(cheaper.value>=maxAVal)continue;
          // cheaper должна иметь на 40+ желающих больше, чем КАЖДАЯ topA-карта
          const qualifies=topA.every(top=>cheaper.want-top.want>=40);
          if(qualifies){
            if(!demandWinner||cheaper.want>demandWinner.want)demandWinner=cheaper;
          }
        }
        bestEntries=demandWinner?[demandWinner]:topA;
      }
    } else if(maxVal<10){
      // Нет A-приоритета, все карты плохие — приоритет картам с 0 дублей
      const noDup=entries.filter(e=>e.dup===0);
      if(noDup.length>0){
        const bestNoDupVal=Math.max(...noDup.map(e=>e.value));
        bestEntries=noDup.filter(e=>e.value===bestNoDupVal);
      } else {
        bestEntries=entries.filter(e=>e.value===maxVal);
      }
    } else {
      // Обычная логика — по ценности
      bestEntries=entries.filter(e=>e.value===maxVal);
    }

    bestEntries.forEach(({card})=>{
      card.classList.add('cv-best-card');
      const badge=document.createElement('div'); badge.className='cv-best-badge'; badge.textContent='★ ЛУЧШАЯ';
      card.style.position='relative'; card.insertBefore(badge,card.firstChild);
      const s=card.querySelector('.card-value'); if(s)s.title='⭐ Лучшая карта в паке';
    });
  }

  // ============================================================
  //  MUTATION OBSERVER
  // ============================================================


  // ============================================================
  //  DRAG — универсальное перетаскивание панелей
  // ============================================================

  const suiteViewportItems = new Map();
  let suiteViewportListenersInstalled = false;
  let suiteViewportFrame = 0;

  function suiteGetVisibleViewport() {
    const vv = window.visualViewport;
    const left = Number.isFinite(vv?.offsetLeft) ? vv.offsetLeft : 0;
    const top = Number.isFinite(vv?.offsetTop) ? vv.offsetTop : 0;
    const width = Math.max(1, Number.isFinite(vv?.width) ? vv.width : window.innerWidth);
    const height = Math.max(1, Number.isFinite(vv?.height) ? vv.height : window.innerHeight);
    return { left, top, right:left + width, bottom:top + height, width, height };
  }

  function suiteClampToViewport(element, options = {}) {
    if(!element?.isConnected || getComputedStyle(element).display === 'none') return;
    const margin = Number.isFinite(options.margin) ? options.margin : 8;
    const viewport = suiteGetVisibleViewport();

    if(options.constrainSize !== false){
      element.style.boxSizing = 'border-box';
      element.style.maxWidth = `${Math.max(80, viewport.width - margin * 2)}px`;
      element.style.maxHeight = `${Math.max(80, viewport.height - margin * 2)}px`;
    }

    let rect = element.getBoundingClientRect();
    let left = rect.left;
    let top = rect.top;
    if(rect.right > viewport.right - margin) left -= rect.right - (viewport.right - margin);
    if(rect.bottom > viewport.bottom - margin) top -= rect.bottom - (viewport.bottom - margin);
    left = Math.max(viewport.left + margin, left);
    top = Math.max(viewport.top + margin, top);

    if(Math.abs(left - rect.left) > .5 || Math.abs(top - rect.top) > .5){
      element.style.transform = 'none';
      element.style.left = `${Math.round(left)}px`;
      element.style.top = `${Math.round(top)}px`;
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    }
  }

  function suiteRefreshViewportItems() {
    suiteViewportFrame = 0;
    for(const [element, options] of suiteViewportItems){
      if(!element?.isConnected){ suiteViewportItems.delete(element); continue; }
      suiteClampToViewport(element, options);
    }
    suiteResolveFloatingButtonOverlaps();
    if(typeof cptApplyScale === 'function') cptApplyScale();
  }

  function suiteResolveFloatingButtonOverlaps(preferredElement = null) {
    const viewport = suiteGetVisibleViewport();
    const gap = 8;
    const selector = [
      '#aw-active-tab-panel',
      '#suite-settings-panel',
      '#suite-settings-btn',
      '#suite-suggestion-authors-button',
      '.cv-stones-floating-btn',
      '.circle-btn'
    ].join(',');
    const controls = [...new Set([
      ...suiteViewportItems.keys(),
      ...document.querySelectorAll(selector)
    ])].filter(control => {
      if(!control?.isConnected) return false;
      const style = getComputedStyle(control);
      const rect = control.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
    if(!controls.length) return;

    const preferred = preferredElement && controls.includes(preferredElement) ? preferredElement : null;
    const priority = control => {
      if(control.matches('#suite-settings-btn')) return 0;
      if(control.matches('#suite-settings-panel')) return 1;
      if(control.matches('#aw-active-tab-panel')) return 2;
      if(control.matches('#suite-suggestion-authors-button')) return 3;
      return 10;
    };
    const ordered = controls.sort((a,b) => {
      const priorityDiff = priority(a) - priority(b);
      if(priorityDiff) return priorityDiff;
      if(a === preferred) return -1;
      if(b === preferred) return 1;
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      return (bRect.width * bRect.height) - (aRect.width * aRect.height);
    });
    const occupied = [];
    const overlaps = (a,b) => a.left < b.right + gap && a.right + gap > b.left && a.top < b.bottom + gap && a.bottom + gap > b.top;

    ordered.forEach(control => {
      let rect = control.getBoundingClientRect();
      if(occupied.some(other => overlaps(rect,other))){
        const candidates = [];
        const addCandidate = (left,top) => candidates.push({left,top});
        occupied.forEach(other => {
          addCandidate(rect.left, other.top - rect.height - gap);
          addCandidate(rect.left, other.bottom + gap);
          addCandidate(other.left - rect.width - gap, rect.top);
          addCandidate(other.right + gap, rect.top);
          addCandidate(other.left, other.top - rect.height - gap);
          addCandidate(other.left, other.bottom + gap);
          addCandidate(other.left - rect.width - gap, other.top);
          addCandidate(other.right + gap, other.top);
        });
        addCandidate(viewport.left + gap, viewport.top + gap);
        addCandidate(viewport.right - gap - rect.width, viewport.top + gap);
        addCandidate(viewport.left + gap, viewport.bottom - gap - rect.height);
        addCandidate(viewport.right - gap - rect.width, viewport.bottom - gap - rect.height);

        const xEdges = [viewport.left + gap, viewport.right - gap - rect.width];
        const yEdges = [viewport.top + gap, viewport.bottom - gap - rect.height];
        occupied.forEach(other => {
          xEdges.push(other.left - rect.width - gap, other.right + gap);
          yEdges.push(other.top - rect.height - gap, other.bottom + gap);
        });
        xEdges.forEach(left => yEdges.forEach(top => addCandidate(left,top)));

        const valid = candidates.filter(pos => {
          const candidateRect = {
            left:pos.left,
            top:pos.top,
            right:pos.left + rect.width,
            bottom:pos.top + rect.height
          };
          return candidateRect.left >= viewport.left + gap && candidateRect.right <= viewport.right - gap &&
            candidateRect.top >= viewport.top + gap && candidateRect.bottom <= viewport.bottom - gap &&
            occupied.every(item => !overlaps(candidateRect,item));
        });
        valid.sort((a,b) =>
          ((a.left - rect.left) ** 2 + (a.top - rect.top) ** 2) -
          ((b.left - rect.left) ** 2 + (b.top - rect.top) ** 2)
        );
        const candidate = valid[0];
        if(candidate){
          control.style.transform = 'none';
          control.style.left = `${Math.round(candidate.left)}px`;
          control.style.top = `${Math.round(candidate.top)}px`;
          control.style.right = 'auto';
          control.style.bottom = 'auto';
          rect = control.getBoundingClientRect();
          try{ control._suitePersistFloatingPosition?.(); }catch(e){}
        }
      }
      occupied.push(rect);
    });
  }

  function suiteScheduleViewportRefresh() {
    if(suiteViewportFrame) cancelAnimationFrame(suiteViewportFrame);
    suiteViewportFrame = requestAnimationFrame(suiteRefreshViewportItems);
  }

  function suiteKeepInViewport(element, options = {}) {
    if(!element) return;
    suiteViewportItems.set(element, options);
    if(!suiteViewportListenersInstalled){
      suiteViewportListenersInstalled = true;
      window.addEventListener('resize', suiteScheduleViewportRefresh, {passive:true});
      window.addEventListener('orientationchange', suiteScheduleViewportRefresh, {passive:true});
      window.visualViewport?.addEventListener('resize', suiteScheduleViewportRefresh, {passive:true});
      window.visualViewport?.addEventListener('scroll', suiteScheduleViewportRefresh, {passive:true});
    }
    suiteScheduleViewportRefresh();
  }

  const suiteCollapsedPanelAnchors = new WeakMap();
  function suiteApplyCollapsibleState(panel, collapsed, renderState) {
    if(!panel) return;
    if(!collapsed){
      const rect = panel.getBoundingClientRect();
      suiteCollapsedPanelAnchors.set(panel, {left:rect.left, top:rect.top});
    }
    renderState();
    requestAnimationFrame(() => {
      if(collapsed){
        const anchor = suiteCollapsedPanelAnchors.get(panel);
        if(anchor){
          panel.style.transform = 'none';
          panel.style.left = `${Math.round(anchor.left)}px`;
          panel.style.top = `${Math.round(anchor.top)}px`;
          panel.style.right = 'auto';
          panel.style.bottom = 'auto';
        }
      }
      suiteClampToViewport(panel, {margin:8, constrainSize:true});
      suiteResolveFloatingButtonOverlaps(panel);
    });
  }

  function makeDraggable(panel, handleSelectorOrEl, onDrop) {
    const handle = handleSelectorOrEl
      ? (typeof handleSelectorOrEl === 'string' ? panel.querySelector(handleSelectorOrEl) : handleSelectorOrEl)
      : panel;
    if (!handle) return;
    panel._suitePersistFloatingPosition = () => {
      if(!onDrop) return;
      const rect = panel.getBoundingClientRect();
      onDrop(rect.left, rect.top);
    };
    suiteKeepInViewport(panel, {margin:8, constrainSize:true});
    handle.style.cursor = 'grab';
    handle.style.touchAction = 'none';

    let startX, startY, startLeft, startTop, isDragging = false;
    const getPoint = (e) => e.touches?.[0] || e.changedTouches?.[0] || e;

    handle.addEventListener('mousedown', function(e) {
      // Не перехватываем клики по кнопкам внутри хедера
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
      e.preventDefault();
      isDragging = true;

      // Если панель позиционирована через transform (centered), переводим в абсолютные координаты
      const rect = panel.getBoundingClientRect();
      panel.style.transform = 'none';
      panel.style.top  = rect.top  + 'px';
      panel.style.left = rect.left + 'px';
      panel.style.right  = 'auto';
      panel.style.bottom = 'auto';

      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop  = rect.top;

      handle.style.cursor = 'grabbing';
    });

    handle.addEventListener('touchstart', function(e) {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
      e.preventDefault();
      const point = getPoint(e);
      isDragging = true;

      const rect = panel.getBoundingClientRect();
      panel.style.transform = 'none';
      panel.style.top  = rect.top  + 'px';
      panel.style.left = rect.left + 'px';
      panel.style.right  = 'auto';
      panel.style.bottom = 'auto';

      startX = point.clientX;
      startY = point.clientY;
      startLeft = rect.left;
      startTop  = rect.top;

      handle.style.cursor = 'grabbing';
    }, { passive:false });

    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const viewport = suiteGetVisibleViewport();
      const maxLeft = Math.max(viewport.left, viewport.right - panel.offsetWidth);
      const maxTop = Math.max(viewport.top, viewport.bottom - panel.offsetHeight);
      const newLeft = Math.max(viewport.left, Math.min(maxLeft, startLeft + dx));
      const newTop  = Math.max(viewport.top, Math.min(maxTop, startTop + dy));
      panel.style.left = newLeft + 'px';
      panel.style.top  = newTop  + 'px';
    });

    document.addEventListener('touchmove', function(e) {
      if (!isDragging) return;
      e.preventDefault();
      const point = getPoint(e);
      const dx = point.clientX - startX;
      const dy = point.clientY - startY;
      const viewport = suiteGetVisibleViewport();
      const maxLeft = Math.max(viewport.left, viewport.right - panel.offsetWidth);
      const maxTop = Math.max(viewport.top, viewport.bottom - panel.offsetHeight);
      const newLeft = Math.max(viewport.left, Math.min(maxLeft, startLeft + dx));
      const newTop  = Math.max(viewport.top, Math.min(maxTop, startTop + dy));
      panel.style.left = newLeft + 'px';
      panel.style.top  = newTop  + 'px';
    }, { passive:false });

    document.addEventListener('mouseup', function() {
      if (!isDragging) return;
      isDragging = false;
      handle.style.cursor = 'grab';
      suiteClampToViewport(panel, {margin:8, constrainSize:true});
      suiteResolveFloatingButtonOverlaps(panel);
      // Вызываем callback с финальными координатами (если передан)
      panel._suitePersistFloatingPosition();
    });
    document.addEventListener('touchend', function() {
      if (!isDragging) return;
      isDragging = false;
      handle.style.cursor = 'grab';
      suiteClampToViewport(panel, {margin:8, constrainSize:true});
      suiteResolveFloatingButtonOverlaps(panel);
      panel._suitePersistFloatingPosition();
    });
    document.addEventListener('touchcancel', function() {
      if (!isDragging) return;
      isDragging = false;
      handle.style.cursor = 'grab';
      suiteClampToViewport(panel, {margin:8, constrainSize:true});
      suiteResolveFloatingButtonOverlaps(panel);
      panel._suitePersistFloatingPosition();
    });
  }

  const observedContainers=new WeakMap();
  function observeContainer(c){
    if(!c||observedContainers.has(c))return;
    debouncedAddCardValue();
    const mo=new MutationObserver(debouncedAddCardValue);
    mo.observe(c,{childList:true,subtree:true,attributes:true});
    observedContainers.set(c,mo);
  }
  let debounceTimer;
  function debouncedAddCardValue(){ clearTimeout(debounceTimer); debounceTimer=setTimeout(()=>requestAnimationFrame(addCardValue),500); }
  let globalUiTimer;
  function scheduleGlobalUiRefresh(){
    clearTimeout(globalUiTimer);
    globalUiTimer=setTimeout(()=>{
      insertStatsButton();
      if(cfg.modMenuBg)applyMenuBackground();
      if(cfg.modProfileBtns)addProfileButtons();
      if(cfg.modEnlightenment)applyEnlightenment();
      if(cfg.modCustomPush)installCustomPush();
    },250);
  }

  function initObservers(){
    document.querySelectorAll('.lootbox__list,.trade__main,#trade-card-modal,.ui-dialog').forEach(observeContainer);
    const gMO=new MutationObserver(mutations=>{
      let need=false;
      for(const m of mutations){
        if(m.type==='attributes'&&m.attributeName==='data-pack-id'){need=true;continue;}
        for(const node of m.addedNodes){
          if(!(node instanceof Element))continue;
          if(node.matches('.ui-dialog')||node.matches('#trade-card-modal')||node.matches('.trade__main')){
            if(node.matches('.ui-dialog')){ const inn=node.querySelector('#trade-card-modal')||node.querySelector('.trade__main'); if(inn)observeContainer(inn); observeContainer(node); }
            else observeContainer(node);
            need=true; continue;
          }
          ['#trade-card-modal','.trade__main','.lootbox__list'].forEach(sel=>{ const f=node.querySelector&&node.querySelector(sel); if(f){observeContainer(f);need=true;} });
        }
      }
      if(need)debouncedAddCardValue();
      scheduleGlobalUiRefresh();
    });
    gMO.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-pack-id']});
  }

  // ============================================================
  //  СТАТИСТИКА UI
  // ============================================================

  let statsPanel=null, statsFilter='all', activeTab='all';

  function getCountForFilter(rd){ return statsFilter==='today'?(rd.byDate&&rd.byDate[todayKey]||0):rd.count; }

  function buildStatsHTML(bucket){
    const data=stats[bucket];
    const total=RANK_ORDER.reduce((s,r)=>s+(data[r]?getCountForFilter(data[r]):0),0);
    const rows=RANK_ORDER.map(r=>{
      const s=data[r]||null;
      const cnt=s?getCountForFilter(s):0;
      const pct=total>0&&cnt>0?((cnt/total)*100).toFixed(1):'0.0';
      const avg=s&&s.count>0?(s.totalValue/s.count).toFixed(2):'—';
      const color=RANK_COLORS[r]||'#ccc';
      const dimmed=cnt===0?';opacity:.35':'';
      return `<tr style="transition:opacity .15s${dimmed}">
        <td style="padding:5px 8px"><span style="color:${color};font-weight:700;font-size:14px">${RANK_LABELS[r]}</span></td>
        <td style="padding:5px 8px;text-align:center;color:${cnt>0?'#e2e8f0':'#475569'}">${cnt}</td>
        <td style="padding:5px 8px;text-align:center">
          <span style="color:${cnt>0?color:'#334155'};font-weight:600">${pct}%</span>
          <div style="width:80px;height:4px;background:#1e293b;border-radius:2px;margin:3px auto 0">
            <div style="width:${Math.min(parseFloat(pct),100)}%;height:100%;background:${cnt>0?color:'#1e293b'};border-radius:2px"></div>
          </div>
        </td>
        <td style="padding:5px 8px;text-align:center;color:${cnt>0?'#94a3b8':'#334155'}">${avg}</td>
        <td style="padding:5px 8px;text-align:center;color:#475569;font-size:11px">${s&&s.minValue!==Infinity?s.minValue:'—'} / ${s&&s.maxValue!==-Infinity?s.maxValue:'—'}</td>
      </tr>`;
    }).join('');
    return`<div style="font-size:11px;color:#475569;margin-bottom:8px;text-align:right">Всего карт: <b style="color:#64748b">${total}</b></div>
      <div style="font-size:11px;margin-bottom:8px;display:flex;gap:12px;justify-content:flex-end;flex-wrap:wrap">
        <span>
          Посл. <b style="color:#c084fc">S</b>:
          <b style="color:#64748b">${lastRank.currentS} пак.</b>
          <span style="color:#475569">(${lastRank.S})</span>
        </span>

        <span>
          Посл. <b style="color:#a855f7">+</b>:
          <b style="color:#64748b">${lastRank.currentPlus} пак.</b>
          <span style="color:#475569">(${lastRank.PLUS})</span>
        </span>

        <span>
          Посл. <b style="color:#6b21a8">ASS</b>:
          <b style="color:#64748b">${lastRank.currentASS} пак.</b>
          <span style="color:#475569">(${lastRank.ASS})</span>
        </span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="color:#475569;border-bottom:1px solid #1e293b">
          <th style="text-align:left;padding:4px 8px">Ранг</th><th style="padding:4px 8px">Кол-во</th>
          <th style="padding:4px 8px">% выпадения</th><th style="padding:4px 8px">Ср. ценность</th><th style="padding:4px 8px">Мин/Макс</th>
        </tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderStatsTab(){
    if(!statsPanel)return;
    const bucket=activeTab==='all'?'allCards':'pickedCards';
    statsPanel.querySelector('#cv-stats-content').innerHTML=buildStatsHTML(bucket);
    statsPanel.querySelectorAll('.cv-tab-btn').forEach(b=>{ const on=b.dataset.tab===activeTab; b.style.background=on?'#0ea5e9':'transparent'; b.style.color=on?'#fff':'#64748b'; });
    statsPanel.querySelectorAll('.cv-filter-btn').forEach(b=>{ const on=b.dataset.filter===statsFilter; b.style.background=on?'#334155':'transparent'; b.style.color=on?'#e2e8f0':'#475569'; });
  }

  function createStatsPanel(){
    const panel=document.createElement('div'); panel.id='cv-stats-panel';
    panel.style.cssText='display:none;position:fixed;bottom:70px;right:10px;width:440px;max-width:calc(100vw - 20px);box-sizing:border-box;background:#0a0f1a;border:1px solid #1e293b;border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,.8);z-index:999;font-family:\'Segoe UI\',sans-serif;color:#e2e8f0;overflow:hidden;';
    panel.innerHTML=`
      <div style="background:#0f172a;padding:11px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #1e293b">
        <span style="font-weight:700;font-size:14px">📊 Статистика карт</span>
        <div style="display:flex;gap:8px;align-items:center">
          <button id="cv-stats-reset" style="background:#7f1d1d;border:none;color:#fca5a5;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:11px;font-weight:600">Сброс</button>
          <button id="cv-stats-close" style="background:none;border:none;color:#334155;cursor:pointer;font-size:22px;line-height:1;padding:0 2px">×</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #0f172a;background:#0d1422">
        <div style="display:flex;gap:2px">
          <button class="cv-tab-btn" data-tab="all" style="padding:6px 14px;background:#0ea5e9;border:none;color:#fff;font-weight:600;cursor:pointer;font-size:12px;border-radius:7px 0 0 7px">Все выпавшие</button>
          <button class="cv-tab-btn" data-tab="picked" style="padding:6px 14px;background:transparent;border:none;color:#64748b;font-weight:600;cursor:pointer;font-size:12px;border-radius:0 7px 7px 0">Выбранные</button>
        </div>
        <div style="display:flex;gap:2px;margin-left:10px">
          <button class="cv-filter-btn" data-filter="all" style="padding:5px 10px;background:#334155;border:none;color:#e2e8f0;cursor:pointer;font-size:11px;border-radius:7px 0 0 7px;font-weight:600">Всё время</button>
          <button class="cv-filter-btn" data-filter="today" style="padding:5px 10px;background:transparent;border:none;color:#475569;cursor:pointer;font-size:11px;border-radius:0 7px 7px 0;font-weight:600">Сегодня</button>
        </div>
      </div>
      <div id="cv-stats-content" style="padding:12px 14px;max-height:520px;overflow-y:auto"></div>`;
    document.body.appendChild(panel); statsPanel=panel;
    makeDraggable(panel, '#cv-stats-panel > div:first-child');
    panel.querySelectorAll('.cv-tab-btn').forEach(b=>b.addEventListener('click',()=>{ activeTab=b.dataset.tab; renderStatsTab(); }));
    panel.querySelectorAll('.cv-filter-btn').forEach(b=>b.addEventListener('click',()=>{ statsFilter=b.dataset.filter; renderStatsTab(); }));
    panel.querySelector('#cv-stats-close').addEventListener('click',()=>panel.style.display='none');
    panel.querySelector('#cv-stats-reset').addEventListener('click',()=>{
      if(!confirm('Сбросить ВСЮ статистику (за всё время)?'))return;
      stats={allCards:{},pickedCards:{}}; seenPackIds.clear(); seenPickIds.clear();
      lastRank={S:0,PLUS:0,ASS:0,totalSinceS:0,totalSincePlus:0,totalSinceASS:0}; saveLastRank();
      saveStats(); saveSeenPacks(); saveSeenPicks(); renderStatsTab();
    });
    renderStatsTab();
  }

  function insertStatsButton(){
    if(!cfg.modStats)return;
    const lbl=document.querySelector('label.checkbox input#packs_demand')?.closest('label.checkbox');
    if(!lbl||document.getElementById('cv-stats-btn'))return;
    const btn=document.createElement('button'); btn.id='cv-stats-btn'; btn.type='button'; btn.textContent='📊 Статистика карт';
    btn.style.cssText='display:block;margin:10px auto 0;padding:7px 20px;background:linear-gradient(135deg,#0ea5e9,#6366f1);border:none;border-radius:8px;color:#fff;font-weight:600;font-size:13px;cursor:pointer;';
    btn.onmouseover=()=>btn.style.opacity='.8'; btn.onmouseout=()=>btn.style.opacity='1';
    lbl.insertAdjacentElement('afterend',btn);
    createStatsPanel();
    btn.addEventListener('click',()=>{
      const p=document.getElementById('cv-stats-panel');
      if(p.style.display==='none'){
        p.style.display='block'; renderStatsTab();
        requestAnimationFrame(()=>suiteClampToViewport(p,{margin:8,constrainSize:true}));
      } else p.style.display='none';
    });
  }

  function cleanupStatsUi(){
    document.getElementById('cv-stats-btn')?.remove();
    document.getElementById('cv-stats-panel')?.remove();
    statsPanel = null;
  }

  // ============================================================
  //  НЕОНОВЫЕ ОБВОДКИ
  // ============================================================

  function insertNeonGradients(){
    if(document.getElementById('neon-svg-defs'))return;
    const ns='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(ns,'svg');
    svg.id='neon-svg-defs';
    svg.setAttribute('style','position:absolute;width:1px;height:1px;pointer-events:none;opacity:0;z-index:-1;');
    svg.setAttribute('aria-hidden','true');
    const defs=document.createElementNS(ns,'defs');
    const neonColors={green:['#00cc00','#00ff00'],orange:['#ff3300','#ff6600'],violet:['#9900e6','#cc33ff'],red:['#cc0000','#ff3333'],blue:['#0066cc','#3399ff']};
    for(const [type,[main,glow]] of Object.entries(neonColors)){
      const g=document.createElementNS(ns,'linearGradient'); g.setAttribute('id',`neon-${type}-gradient`); g.setAttribute('x1','0%'); g.setAttribute('y1','0%'); g.setAttribute('x2','100%'); g.setAttribute('y2','0%');
      [main,'#ffffff',main].forEach((c,i,a)=>{ const s=document.createElementNS(ns,'stop'); s.setAttribute('offset',`${i/(a.length-1)*100}%`); s.setAttribute('stop-color',c); g.appendChild(s); });
      defs.appendChild(g);
      const gg=document.createElementNS(ns,'linearGradient'); gg.setAttribute('id',`neon-${type}-glow-gradient`); gg.setAttribute('x1','0%'); gg.setAttribute('y1','0%'); gg.setAttribute('x2','100%'); gg.setAttribute('y2','0%');
      [glow,'#ffffff',glow].forEach((c,i,a)=>{ const s=document.createElementNS(ns,'stop'); s.setAttribute('offset',`${i/(a.length-1)*100}%`); s.setAttribute('stop-color',c); gg.appendChild(s); });
      [['x1','0%;100%;100%;0%;0%'],['y1','0%;0%;100%;100%;0%'],['x2','100%;100%;0%;0%;100%'],['y2','0%;100%;100%;0%;0%']].forEach(([attr,val])=>{
        const a=document.createElementNS(ns,'animate'); a.setAttribute('attributeName',attr); a.setAttribute('values',val); a.setAttribute('dur','4s'); a.setAttribute('repeatCount','indefinite'); gg.appendChild(a);
      });
      defs.appendChild(gg);
    }
    svg.appendChild(defs); document.body.appendChild(svg);
  }

  function addNeonToCard(card,type){
    const ex=card.querySelector('.neon-outline-wrapper');
    if(ex)ex.remove();
    card.classList.remove(
      'cv-neon-outline',
      'cv-neon-green',
      'cv-neon-orange',
      'cv-neon-violet',
      'cv-neon-red',
      'cv-neon-blue'
    );
    card.style.position='relative';
    if(card.classList.contains('trade__main-item'))card.style.overflow='visible';
    card.classList.add('cv-neon-outline',`cv-neon-${type}`);
    // Скрываем иконки trophy/lock:
    // их заменяет анимированная обводка
    card.querySelectorAll('.lock-trade-btn').forEach(btn => btn.style.display='none');
  }

  function applyNeonAnimationSetting() {
    document.body?.classList.toggle('suite-neon-animation-off', !cfg.modNeonAnimation);
  }

  function clearNeonFromCard(card){
    card.querySelector('.neon-outline-wrapper')?.remove();
    card.classList.remove(
      'cv-neon-outline',
      'cv-neon-green',
      'cv-neon-orange',
      'cv-neon-violet',
      'cv-neon-red',
      'cv-neon-blue'
    );
    if(card.style.position === 'relative') card.style.removeProperty('position');
    if(card.classList.contains('trade__main-item')) card.style.removeProperty('overflow');
    card.querySelectorAll('.lock-trade-btn').forEach(btn => btn.style.removeProperty('display'));
  }

  function getNeonCardType(card){
    if(card.querySelector('i.fal.fa-trophy-alt'))return 'violet';
    if(card.querySelector('i.fal.fa-lock'))return 'red';
    if(card.querySelector('i.fal.fa-exchange, i.fal.fa-arrow-right-arrow-left'))return 'blue';
    if(card.classList.contains('anime-cards__owned-by-user-want'))return 'green';
    if(card.classList.contains('anime-cards__owned-by-user'))return 'orange';
    return '';
  }

  let neonObserver, neonMutationObserver;
  let neonObservedSet=new WeakSet();
  let neonStateMap=new WeakMap();

  function isPackCard(card){
    return card?.classList?.contains('lootbox__card')
      || !!card?.closest?.('.lootbox__list,.lootbox__row');
  }

  function applyNeonToCard(card){
    const type = getNeonCardType(card);
    const hasExpectedClass = type
      ? card.classList.contains('cv-neon-' + type)
      : !card.classList.contains('cv-neon-outline');

    if(neonStateMap.get(card) === type && hasExpectedClass) return;

    clearNeonFromCard(card);
    neonStateMap.set(card, type);
    if(type) addNeonToCard(card,type);
  }

  function handleNeonEntry(entry){
    if(!cfg.modNeon||!entry.isIntersecting)return;
    applyNeonToCard(entry.target);
  }

  function setupNeonObservers(){
    if(!cfg.modNeon)return;
    if(neonObserver)neonObserver.disconnect();
    if(neonMutationObserver)neonMutationObserver.disconnect();
    neonObserver=new IntersectionObserver(
      entries=>entries.forEach(handleNeonEntry),
      {threshold:0.1}
    );

    const isExcluded=card=>isPackCard(card) || card.closest(
      '#suite-settings-panel,#cv-stats-panel,#cv-guarantee-block,'
      + '.__pe-panel,.__ps-panel,.__pc-panel,#__cpt-root,#__aw-cpt-root,#__sb-root'
    );

    const scan=()=>{
      document.querySelectorAll('.anime-cards__item,.trade__main-item').forEach(card=>{
        if(neonObservedSet.has(card)||isExcluded(card)) return;
        neonObserver.observe(card);
        neonObservedSet.add(card);
      });
    };

    neonMutationObserver=new MutationObserver(mutations=>{
      scan();
      mutations.forEach(mutation=>{
        if(mutation.type !== 'attributes' || mutation.attributeName !== 'class') return;
        const card = mutation.target.closest?.('.anime-cards__item,.trade__main-item');
        if(card && !isExcluded(card)) applyNeonToCard(card);
      });
    });
    neonMutationObserver.observe(document.body,{
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class']
    });
    scan();
  }

  function cleanupNeonUi(){
    if(neonObserver) neonObserver.disconnect();
    if(neonMutationObserver) neonMutationObserver.disconnect();
    neonObserver = null;
    neonMutationObserver = null;
    neonObservedSet = new WeakSet();
    neonStateMap = new WeakMap();
    document.querySelectorAll('.neon-outline-wrapper').forEach(el=>el.remove());
    document.querySelectorAll(
      '.cv-neon-outline,.cv-neon-green,.cv-neon-orange,'
      + '.cv-neon-violet,.cv-neon-red,.cv-neon-blue'
    ).forEach(card=>{
      card.classList.remove(
        'cv-neon-outline',
        'cv-neon-green',
        'cv-neon-orange',
        'cv-neon-violet',
        'cv-neon-red',
        'cv-neon-blue'
      );
      if(card.style.position === 'relative') card.style.removeProperty('position');
      if(card.classList.contains('trade__main-item')) card.style.removeProperty('overflow');
      card.querySelectorAll('.lock-trade-btn').forEach(btn => btn.style.removeProperty('display'));
    });
  }

  // ============================================================
  //  ФОН МЕНЮ
  // ============================================================

  function applyMenuBgTuning(wrapper) {
    if(!wrapper) return;
    const dim = Math.min(0.6, Math.max(0, Number(cfg.menuBgDim ?? DEFAULT_SETTINGS.menuBgDim)));
    const clarity = Math.min(1, Math.max(0, Number(cfg.menuTextClarity ?? DEFAULT_SETTINGS.menuTextClarity)));
    wrapper.style.setProperty('--suite-menu-bg-dim', dim.toFixed(2));
    wrapper.style.setProperty('--suite-menu-text-clarity', clarity.toFixed(2));
    wrapper.style.setProperty('--suite-menu-text-weight', String(Math.round(420 + clarity * 480)));
    wrapper.style.setProperty('--suite-menu-text-shadow-alpha', (0.08 + clarity * 0.9).toFixed(2));
    wrapper.style.setProperty('--suite-menu-text-alpha', (0.58 + clarity * 0.42).toFixed(2));
    wrapper.style.setProperty('--suite-menu-hover-bg-alpha', (0.02 + clarity * 0.045).toFixed(3));
    wrapper.style.setProperty('--suite-menu-hover-border-alpha', (0.08 + clarity * 0.28).toFixed(2));
    wrapper.style.setProperty('--suite-menu-hover-glow-alpha', (0.04 + clarity * 0.22).toFixed(2));
  }

  function applyMenuBackground(){
    if(!cfg.modMenuBg)return;
    const modal=document.querySelector('.lgn.is-active, .lgn.done, .lgn'); if(!modal)return;
    const wrapper=modal.querySelector('.lgn__inner'); if(!wrapper)return;
    const menuVideo=modal.querySelector('.lgn__ava-holder > video#profilebg'); if(!menuVideo)return;
    applyMenuBgTuning(wrapper);
    if(menuVideo.classList.contains('tm-menu-profilebg')&&wrapper.classList.contains('tm-fullbg-ready'))return;
    if(menuVideo.parentElement!==wrapper)wrapper.prepend(menuVideo);
    menuVideo.classList.add('tm-menu-profilebg'); modal.classList.add('tm-fullbg-host'); wrapper.classList.add('tm-fullbg-ready');
    const mediaSource = menuVideo.currentSrc
      || menuVideo.getAttribute('src')
      || menuVideo.querySelector('source[src]')?.getAttribute('src')
      || '';
    const isPlaceholder = /^data:video\/(?:mp4|webm);base64,/i.test(mediaSource)
      && String(mediaSource).length <= 256;
    if((mediaSource || menuVideo.srcObject) && !isPlaceholder){
      try{ menuVideo.muted=true; menuVideo.autoplay=true; menuVideo.loop=true; const p=menuVideo.play(); if(p&&p.catch)p.catch(()=>{}); }catch(e){}
    }
  }

  function cleanupMenuBackground(){
    const modal=document.querySelector('.lgn.is-active, .lgn.done, .lgn'); if(!modal)return;
    const wrapper=modal.querySelector('.lgn__inner');
    const holder=modal.querySelector('.lgn__ava-holder');
    const menuVideo=modal.querySelector('video#profilebg');
    if(menuVideo){
      menuVideo.classList.remove('tm-menu-profilebg');
      if(holder && menuVideo.parentElement!==holder) holder.prepend(menuVideo);
    }
    modal.classList.remove('tm-fullbg-host');
    if(wrapper) wrapper.classList.remove('tm-fullbg-ready');
  }

  // ============================================================
  //  КНОПКИ ПРОФИЛЯ
  // ============================================================

  function addProfileButtons(){
    if(!cfg.modProfileBtns)return;
    const header=document.querySelector('.usn-sect__header.d-flex.ai-center.c-gap-10.r-gap-10'); if(!header)return;
    if(header.querySelector('.open-s-button')||header.querySelector('.wish-button')||header.querySelector('.created-button')||header.querySelector('.replacements-button'))return;
    const link=header.querySelector('a.usn-sect__title[href*="/user/cards/?name="]'); if(!link)return;
    const url=new URL(link.href,location.origin); const username=url.searchParams.get('name'); if(!username)return;
    const encodedUsername=encodeURIComponent(username);
    const sBtn=document.createElement('a'); sBtn.href=`/user/cards/?name=${encodedUsername}&rank=s&locked=0`; sBtn.className='usn-sect__title open-s-button'; sBtn.style.marginLeft='40px';
    const sIcon=document.createElement('span'); sIcon.className='fal fa-yin-yang'; sBtn.appendChild(sIcon); sBtn.append(' Открытые S');
    const wBtn=document.createElement('a'); wBtn.href=`/user/cards/?name=${encodedUsername}&locked=0&in_list=1`; wBtn.className='usn-sect__title wish-button'; wBtn.style.marginLeft='55px';
    const wIcon=document.createElement('span'); wIcon.className='fal fa-yin-yang'; wBtn.appendChild(wIcon); wBtn.append(' Желаемое');
    const cBtn=document.createElement('a'); cBtn.href=`https://${location.hostname}/user/${encodeURIComponent(username)}/cards_created/?moderation=1`; cBtn.className='usn-sect__title created-button'; cBtn.style.marginLeft='55px';
    const cIcon=document.createElement('span'); cIcon.className='fal fa-yin-yang'; cBtn.appendChild(cIcon); cBtn.append(' На модерации');
    const rBtn=document.createElement('a'); rBtn.href=`https://${location.hostname}/user/${encodeURIComponent(username)}/cards_replacements/`; rBtn.className='usn-sect__title replacements-button'; rBtn.style.marginLeft='55px';
    const rIcon=document.createElement('span'); rIcon.className='fal fa-yin-yang'; rBtn.appendChild(rIcon); rBtn.append(' Замены');
    link.insertAdjacentElement('afterend',rBtn); link.insertAdjacentElement('afterend',cBtn); link.insertAdjacentElement('afterend',wBtn); link.insertAdjacentElement('afterend',sBtn);
  }

  function cleanupProfileButtons(){
    document.querySelectorAll('.open-s-button,.wish-button,.created-button,.replacements-button').forEach(el=>el.remove());
  }

  // ============================================================
  //  ПРОСВЕТЛЕНИЕ
  // ============================================================

    function applyEnlightenment(){
        if(!cfg.modEnlightenment)return;
        const container=document.querySelector('.nclub__top-carou.nclub__sect');
        if(!container)return;
        container.querySelectorAll('.club-top-list__count > div').forEach(div=>{
            if(!div.dataset.enlightenmentOriginalText) div.dataset.enlightenmentOriginalText = div.textContent;
            const m=div.textContent.trim().match(/^Просветление\s+(\d+)\s*\(([^)]+)\)/);
            if(!m)return;
            const additions=m[2].match(/\d+/g);
            if(!additions)return;
            const total=parseInt(m[1])+additions.reduce((s,n)=>s+parseInt(n),0);
            div.textContent=`Просветление ${total}`;
        });
    }

  function cleanupEnlightenment(){
    document.querySelectorAll('.club-top-list__count > div[data-enlightenment-original-text]').forEach(div=>{
      div.textContent = div.dataset.enlightenmentOriginalText || div.textContent;
      delete div.dataset.enlightenmentOriginalText;
    });
  }

  // ============================================================
  //  КАСТОМНЫЕ УВЕДОМЛЕНИЯ
  // ============================================================

  const CPT_ICO = {
    check:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`,
    info:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M12 16v-4m0-4h.01"/></svg>`,
    card:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>`,
    clear:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M15 9l-6 6M9 9l6 6"/></svg>`,
    bag:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>`,
    coin:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M12 6v2m0 8v2m-3-5h4a1.5 1.5 0 000-3H9"/></svg>`,
    bolt:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    trade:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><path stroke-linecap="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>`,
    copy:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`,
    clock:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M12 6v6l4 2"/></svg>`,
    err:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M15 9l-6 6M9 9l6 6"/></svg>`,
    lock:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
    save:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>`,
    star:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    warn:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><path stroke-linecap="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`,
    refresh:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><path stroke-linecap="round" d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>`,
    fire:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><path stroke-linecap="round" d="M12 2s-5 5-5 10a5 5 0 0010 0C17 7 12 2 12 2z"/></svg>`,
    plus:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M12 8v8M8 12h8"/></svg>`,
    shield:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    bell:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>`,
    mute:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><path d="M13.73 21a2 2 0 01-3.46 0M18.63 13A17.89 17.89 0 0118 8M6.26 6.26A5.86 5.86 0 006 8c0 7-3 9-3 9h14"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
    mod:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path stroke-linecap="round" d="M9 12l2 2 4-4"/></svg>`,
    user:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    lvl:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><path stroke-linecap="round" d="M18 20V10M12 20V4M6 20v-6"/></svg>`,
    link:`<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>`,
  };

  const CPT_CLS = {
    'neon-green':'cpt-neon-green','neon-blue':'cpt-neon-blue','neon-pink':'cpt-neon-pink',
    'neon-amber':'cpt-neon-amber','indigo':'cpt-indigo','emerald':'cpt-emerald',
    'rose':'cpt-rose','ocean':'cpt-ocean','volcano':'cpt-volcano',
  };

  const CPT_MAP = [
    {s:'Вы купили товар',                                        icon:'bag',    title:'Покупка',     theme:'neon-green'},
    {s:'Вы вернули товар',                                       icon:'coin',   title:'Возврат',     theme:'neon-pink' },
    {s:'Вы применили товар',                                     icon:'bolt',   title:'Применено',   theme:'neon-blue' },
    {s:'Успешное применение',                                    icon:'refresh',title:'Готово',      theme:'neon-blue' },
    {s:'Обмен произведён',                                       icon:'trade',  title:'Обмен',       theme:'neon-green'},
    {s:'Обмен отменён',                                          icon:'trade',  title:'Отмена',      theme:'rose'      },
    {s:'Данный обмен не действительный',                         icon:'warn',   title:'Обмен',       theme:'rose'      },
    {s:'Вы можете обмениваться с одним и тем же пользователем не более 3 раз в сутки', icon:'clock', title:'Обмен', theme:'rose'},
    {s:'ID карточки скопировано',                                icon:'copy',   title:'Скопировано', theme:'indigo'    },
    {s:'Ссылка на текущую страницу скопирована',                 icon:'link',   title:'Скопировано', theme:'indigo'    },
    {s:'Ссылки на все домены',                                   icon:'link',   title:'Скопировано', theme:'indigo'    },
    {s:'Витрина карточек сохранена',                             icon:'save',   title:'Сохранено',   theme:'emerald'   },
    {s:'Витрина достижений сохранена',                           icon:'star',   title:'Сохранено',   theme:'emerald'   },
    {s:'Витрина',                                                icon:'save',   title:'Сохранено',   theme:'emerald'   },
    {s:'В витрину можно выставить максимум три звёздные карты',   icon:'star',   title:'Витрина',     theme:'neon-amber'},
    {s:'Загруженная вами карточка была отправлена на модерацию', icon:'mod',    title:'Модерация',   theme:'neon-pink' },
    {s:'Карточка отправлена на модерацию',                       icon:'mod',    title:'Модерация',   theme:'neon-pink' },
    {s:'Для вступления изменений',                               icon:'refresh',title:'Обновление',  theme:'neon-pink' },
    {s:'Автоплавка отключена',                                   icon:'fire',   title:'Внимание',    theme:'rose'      },
    {s:'К переплавке доступны только карты одного ранга',        icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'добавить на переплавку больше',                          icon:'plus',   title:'Внимание',    theme:'neon-amber'},
    {s:'В колоде может быть не больше',                          icon:'warn',   title:'Внимание',    theme:'rose'      },
    {s:'Введите название вашей колоды',                          icon:'save',   title:'Внимание',    theme:'ocean'     },
    {s:'зафиксирована в колоде и не может быть заблокирована',   icon:'lock',   title:'Внимание',    theme:'rose'      },
    {s:'Данная карта зафиксирована в колоде и не может быть выбрана', icon:'lock', title:'Колода', theme:'rose'},
    {s:'заблокирована вами и не подлежит обмену',                icon:'lock',   title:'Внимание',    theme:'rose'      },
    {s:'заблокирована вами и не может быть переплавлена',        icon:'fire',   title:'Внимание',    theme:'rose'      },
    {s:'в очереди на обмен и не может быть переплавлена',        icon:'fire',   title:'Внимание',    theme:'rose'      },
    {s:'в очереди на обмен и не может быть заблокирована',        icon:'lock',   title:'Внимание',    theme:'rose'      },
    {s:'Одна из карт которую вы превращаете в энергию находится в очереди на обмен', icon:'fire', title:'Внимание', theme:'rose'},
    {s:'Вы удалены из списка',                                    icon:'user',   title:'Список',      theme:'neon-pink' },
    {s:'Вы добавлены в список',                                   icon:'user',   title:'Список',      theme:'neon-green'},
    {s:'Пользователь удалён из игнора',                           icon:'user',   title:'Игнор',       theme:'emerald'   },
    {s:'Пользователь добавлен в игнор',                            icon:'user',   title:'Игнор',       theme:'neon-green'},
    {s:'Вы не можете добавить в игнор команду сайта',              icon:'shield', title:'Игнор',       theme:'neon-amber'},
    {r:/Пользователь .+ успешно добавлен в друзья/i,              icon:'user',   title:'Друзья',      theme:'neon-green'},
    {r:/Вы отменили заявку на дружбу с .+!?/i,                    icon:'user',   title:'Друзья',      theme:'rose'},
    {s:'Комментарий удалён',                                      icon:'check',  title:'Готово',      theme:'emerald'   },
    {s:'Выберите сообщения для удаления',                         icon:'warn',   title:'Сообщения',   theme:'neon-amber'},
    {s:'Сообщение содержит запрещённые слова',                    icon:'warn',   title:'Сообщение',   theme:'rose'      },
    {s:'История очищена',                                         icon:'check',  title:'Сообщения',   theme:'emerald'   },
    {s:'Сообщение не найдено',                                    icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'Ваш голос учтён',                                         icon:'check',  title:'Голос',       theme:'emerald'   },
    {s:'Вы не можете голосовать за карту, которую сами добавили на сайт', icon:'warn', title:'Голос', theme:'neon-amber'},
    {s:'Карта уже опубликована, вы не можете голосовать за неё',  icon:'warn',   title:'Голос',       theme:'neon-amber'},
    {s:'Вы уже голосовали за эту карточку, изменить голос или проголосовать повторно нельзя', icon:'clock', title:'Голос', theme:'rose'},
    {s:'Вы уже ставили дизлайк сегодня, его можно ставить 1 раз в сутки', icon:'clock', title:'Лимит', theme:'rose'},
    {
      s:'Вы уже поставили 3 лайка на карты, которые сейчас на модерации. Дождитесь следующей партии карт и сможете ставить новые',
      icon:'clock',
      title:'Лимит',
      theme:'rose'
    },
    {s:'Вы не можете оставить данную реакцию на комментарий',     icon:'warn',   title:'Реакция',     theme:'neon-amber'},
    {s:'Все карты на странице заблокированы',                     icon:'lock',   title:'Готово',      theme:'emerald'   },
    {s:'Все карты на странице разблокированы',                    icon:'lock',   title:'Готово',      theme:'emerald'   },
    {s:'Карта разблокирована',                                    icon:'lock',   title:'Готово',      theme:'emerald'   },
    {s:'Данную карту нельзя блокировать',                         icon:'lock',   title:'Блокировка',  theme:'rose'},
    {s:'Вы не можете обменять данную карту, так как пользователь заблокировал её', icon:'lock', title:'Обмен', theme:'rose'},
    {s:'У пользователя больше нет карты, которую вы хотите обменять', icon:'trade', title:'Обмен', theme:'neon-amber'},
    {r:/Одна карта из предложенных вами вам больше не пр[еи]надлежит/i, icon:'trade', title:'Обмен', theme:'rose'},
    {s:'Все карты на странице добавлены в ненужные',              icon:'check',  title:'Готово',      theme:'emerald'   },
    {s:'На странице нет доступных карт для добавления в ненужные', icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'На странице нет доступных карт для удаления с ненужных',  icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'На странице нет доступных карт для блокировки',            icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'На странице нет доступных карт для разблокировки',         icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'У вас список не нужных карт пустой',                       icon:'warn',   title:'Список',      theme:'neon-amber'},
    {
      r:/Управление списками отключено с \d{1,2}:\d{2} до \d{1,2}:\d{2}/i,
      icon:'clock',
      title:'Обслуживание',
      theme:'neon-amber'
    },
    {
      r:/Возможность массового добавления или удаления карт со списка ненужных отключена с \d{1,2}:\d{2} до \d{1,2}:\d{2}/i,
      icon:'clock',
      title:'Обслуживание',
      theme:'neon-amber'
    },
    {
      s:'Ваш лимит добавления карт S в список - 10 шт. Получите больше карточек S для увеличения лимита',
      icon:'clock',
      title:'Лимит',
      theme:'rose'
    },
    {s:'уже находится в очереди на обмен',                       icon:'trade',  title:'Внимание',    theme:'neon-amber'},
    {s:'Слишком большая разница в спросе',                       icon:'warn',   title:'Обмен',       theme:'neon-amber'},
    {s:'уже добавлена в обмен',                                  icon:'trade',  title:'Внимание',    theme:'neon-amber'},
    {s:'больше трёх карт',                                       icon:'shield', title:'Внимание',    theme:'neon-amber'},
    {s:'больше двух карт ранга A',                               icon:'shield', title:'Внимание',    theme:'neon-amber'},
    {s:'больше одной карты ранга S',                             icon:'shield', title:'Внимание',    theme:'neon-amber'},
    {s:'добавить в поле больше 50',                              icon:'plus',   title:'Внимание',    theme:'neon-amber'},
    {s:'от одной до трёх ваших карт на обмен',                   icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'от одной до 50 ваших карт для поиска',                   icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'уже добавлена в поиск',                                  icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'Нет карт для блокировки',                                icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'Нет карт для добавления',                                icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'Нет карт для удаления',                                  icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'минимум три буквы для поиска',                           icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'Ставить лайк могут только',                              icon:'user',   title:'Внимание',    theme:'indigo'    },
    {s:'Вы не авторизованы',                                      icon:'lock',   title:'Авторизация', theme:'rose'      },
    {s:'Ваша пользовательская сессия истекла, перезагрузите страницу в браузере и при необходимости войдите на сайт повторно.', icon:'lock', title:'Сессия', theme:'rose'},
    {s:'Доступно только авторизованным',                         icon:'lock',   title:'Внимание',    theme:'indigo'    },
    {s:'Коллекция доступна только',                              icon:'user',   title:'Внимание',    theme:'indigo'    },
    {s:'Уведомления доступны только',                            icon:'bell',   title:'Внимание',    theme:'indigo'    },
    {s:'Управление уведомлениями отключено',                     icon:'mute',   title:'Внимание',    theme:'neon-pink' },
    {s:'Уведомление успешно отправлено',                         icon:'bell',   title:'Уведомления', theme:'neon-green'},
    {s:'Нет уведомлений для отметки',                            icon:'bell',   title:'Внимание',    theme:'neon-amber'},
    {s:'Слишком часто',                                          icon:'clock',  title:'Стоп',        theme:'rose'      },
    {s:'не доступна к улучшению',                                icon:'star',   title:'Внимание',    theme:'rose'      },
    {s:'Сперва введите название персонажа',                      icon:'warn',   title:'Внимание',    theme:'rose'      },
    {s:'Сперва загрузите картинку',                              icon:'warn',   title:'Внимание',    theme:'rose'      },
    {s:'Сперва выберите ранг',                                   icon:'warn',   title:'Внимание',    theme:'rose'      },
    {s:'Сперва выберите цвет',                                   icon:'warn',   title:'Внимание',    theme:'rose'      },
    {s:'Сперва выберите изображение',                            icon:'warn',   title:'Внимание',    theme:'rose'      },
    {s:'Предложение обмена могут оставлять',                     icon:'lvl',    title:'Внимание',    theme:'rose'      },
    {s:'рекомендуете ли это аниме',                              icon:'warn',   title:'Ошибка',      theme:'neon-pink' },
    {s:'Не хватает камней духа',                                 icon:'coin',   title:'Ошибка',      theme:'rose'      },
    {s:'Недостаточный уровень',                                  icon:'lvl',    title:'Ошибка',      theme:'rose'      },
    {s:'Возникла ошибка',                                        icon:'refresh',title:'Ошибка',      theme:'neon-amber'},
    {s:'Ошибка сети',                                            icon:'err',    title:'Ошибка',      theme:'neon-amber'},
    {s:'Ошибка доступа',                                         icon:'lock',   title:'Ошибка',      theme:'rose'      },
    {s:'Неизвестный ответ сервера',                              icon:'err',    title:'Ошибка',      theme:'neon-amber'},
    {s:'Ошибка при копировании',                                  icon:'err',    title:'Ошибка',      theme:'neon-amber'},
    {s:'Не корректный промо-код',                                 icon:'warn',   title:'Промокод',    theme:'rose'},
    {s:'Вы уже активировали этот промо-код',                      icon:'clock',  title:'Промокод',    theme:'rose'},
    {s:'Данный промо-код предназначен для участников клуба, вы не состоите в нём', icon:'lock', title:'Промокод', theme:'rose'},
    {
      s:'Вы уже вводили этот промо-код или он был использован на вашем IP но на другом аккаунте',
      icon:'clock',
      title:'Промокод',
      theme:'rose'
    },
    // ── Новые из коллектора ───────────────────────────────
    {s:'Все карты на странице убраны с ненужных',                 icon:'check',  title:'Готово',      theme:'emerald'   },
    {s:'Вы подписались, теперь вы будете получать лс',            icon:'bell',   title:'Подписка',    theme:'neon-blue' },
    {s:'Подписка удалена',                                        icon:'bell',   title:'Подписка',    theme:'neon-pink' },
    {r:/Вы добавили \d+ карт.* в список желаемых/i,             icon:'star',   title:'Список',      theme:'emerald'   },
    {s:'Все карты из данного аниме убраны из списка пожеланий',   icon:'star',   title:'Список',      theme:'rose'      },
    {r:/Вам было начислено \d+ камней/i,                         icon:'coin',   title:'Награда',     theme:'neon-green'},
    {r:/За сбор полной колоды карточек вам было начислено \d+ камней/i, icon:'star', title:'Коллекция', theme:'neon-green'},
    {s:'Ты нашёл древний артефакт',                               icon:'star',   title:'Находка',     theme:'neon-green'},
    {r:/Куплено \+\d+ опыта/i,                                    icon:'coin',   title:'Покупка',     theme:'neon-green'},
    {s:'Пропуск оплачен',                                         icon:'check',  title:'Оплата',      theme:'emerald'   },
    {s:'данный камень больше не активный',                        icon:'clock',  title:'Внимание',    theme:'neon-amber'},
    {
      r:/Возможность заряжать камень отключена с \d{1,2}:\d{2} до \d{1,2}:\d{2}/i,
      icon:'clock',
      title:'Обслуживание',
      theme:'neon-amber'
    },
    {s:'Вы приобрели премиум',                                    icon:'star',   title:'Премиум',     theme:'neon-green'},
    {s:'Блок последних вышедших серий скрыт',                     icon:'save',   title:'Настройки',   theme:'indigo'    },
    {s:'Страж уволен',                                            icon:'shield', title:'Комната',     theme:'rose'      },
    {s:'У тебя нет свободной нужной карты для удара',             icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'Сначала выбери клуб для атаки',                           icon:'shield', title:'Клуб',        theme:'neon-amber'},
    // ── Порция 2 ─────────────────────────────────────────
    {s:'Награда в виде',                                          icon:'coin',   title:'Награда',     theme:'neon-green'},
    {s:'Успешное повышение звёздности карты',                     icon:'star',   title:'Улучшение',   theme:'neon-green'},
    {
      s:'Данная карта не доступна к повышению уровня звёздности, но модераторы получили вашу заявку ' +
        'и после рассмотрения вы сможете улучшать данную карту',
      icon:'star',
      title:'Улучшение',
      theme:'neon-amber'
    },
    {r:/У вас нет \d+ дублей карт необходимых для повышения/i,   icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'Вы можете улучшать звёзды на картах ранга S не более 3 раз в день', icon:'clock', title:'Лимит', theme:'rose'},
    {s:'Вы не выбрали карты ранга S или +',                       icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'Для пробуждения карты нужно зарядить небесный кирпич на 1000 энергии', icon:'bolt', title:'Пробуждение', theme:'neon-amber'},
    {s:'Вы подзарядили кирпич',                                   icon:'bolt',   title:'Заряд',       theme:'neon-blue' },
    {s:'запретили пользователю отправлять вам обмены',            icon:'lock',   title:'Блокировка',  theme:'rose'      },
    {s:'отменили запрет пользователю отправлять',                 icon:'lock',   title:'Разблокировка', theme:'emerald' },
    {s:'успешно удалён из друзей',                                icon:'user',   title:'Друзья',      theme:'rose'      },
    {s:'Заявка в друзья успешно отправлена',                      icon:'user',   title:'Друзья',      theme:'neon-green'},
    {s:'Вы заблокировали пользователя',                           icon:'shield', title:'Блокировка',  theme:'rose'      },
    {s:'Вы уже блокировали данного пользователя ранее',            icon:'shield', title:'Блокировка',  theme:'neon-amber'},
    {s:'сняли блокировку с пользователя',                         icon:'shield', title:'Разблокировка','theme':'emerald'},
    // ── Порция 3 ─────────────────────────────────────────
    {s:'Сначала победи сундук-мимик',                             icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'Ты сбежал от мимика',                                     icon:'warn',   title:'Сундук',      theme:'neon-amber'},
    {s:'Активный сундук-мимик не найден',                         icon:'warn',   title:'Сундук',      theme:'neon-amber'},
    {s:'Вы отклонили заявку',                                     icon:'user',   title:'Заявка',      theme:'rose'      },
    {s:'Заявка на замену арта не найдена',                        icon:'warn',   title:'Заявка',      theme:'neon-amber'},
    {s:'Заявка на замену арта отправлена на модерацию',            icon:'mod',    title:'Заявка',      theme:'neon-pink'},
    {s:'Опишите причину замены арта (минимум 10 символов)',        icon:'warn',   title:'Заявка',      theme:'neon-amber'},
    // ── Порция 4 ─────────────────────────────────────────
    {s:'Сундук-мимик побеждён',                                   icon:'star',   title:'Победа',      theme:'neon-green'},
    {s:'Сложный босс побеждён',                                   icon:'star',   title:'Победа',      theme:'neon-green'},
    {s:'Ты сбежал от сложного босса',                              icon:'warn',   title:'Побег',       theme:'rose'},
    {s:'Подарок оставлен',                                        icon:'check',  title:'Готово',      theme:'emerald'   },
    {s:'В этой комнате нельзя оставить подарок',                   icon:'warn',   title:'Комната',     theme:'neon-amber'},
    {s:'Правильный ответ',                                        icon:'check',  title:'Верно',       theme:'neon-green'},
    {s:'У тебя нет нужной карты для удара',                       icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'Сначала победи сложного босса',                           icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'Сначала победи мини-босса',                               icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'Мини-босс побеждён',                                      icon:'star',   title:'Победа',      theme:'neon-green'},
    {s:'Гарантированная награда активирована',                    icon:'star',   title:'Награда',     theme:'neon-green'},
    {s:'Нет награды для получения',                                icon:'warn',   title:'Награда',     theme:'neon-amber'},
    {s:'Территория захвачена',                                    icon:'shield', title:'Захват',      theme:'neon-green'},
    {r:/Вы получили .+ за бесконечную гачу/i,                    icon:'coin',   title:'Получено',    theme:'neon-green'},
    {
      r:/Получение награды с бесконечной гачи отключено с \d{1,2}:\d{2} до \d{1,2}:\d{2}/i,
      icon:'clock',
      title:'Обслуживание',
      theme:'neon-amber'
    },
    {s:'Духовная энергия получена',                               icon:'bolt',   title:'Энергия',     theme:'neon-blue' },
    {
      s:'Духовный телепорт перенёс твоё астральное тело во владения другого игрока. ' +
        'Сначала заплати дань или захвати комнату более сильным SSS-стражем.',
      icon:'shield',
      title:'Телепорт',
      theme:'neon-amber'
    },
    {r:/Вы нашли небесный камень духа.*ваша награда \d+ камней/i, icon:'coin',  title:'Находка',     theme:'neon-green'},
    {s:'Тут уже пусто, приятного просмотра',                      icon:'check',  title:'Готово',      theme:'emerald'   },
    {s:'Сундук не открылся',                                      icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'Ты забрал добычу из персональной шахты',                  icon:'coin',   title:'Добыча',      theme:'neon-green'},
    {s:'Комната захвачена',                                       icon:'shield', title:'Захват',      theme:'neon-green'},
    {s:'Ты находишься в зале чужого клуба. Сначала заплати дань или перезахвати комнату для своего клуба.', icon:'shield', title:'Клуб', theme:'neon-amber'},
    {s:'Предложение отклонено',                                   icon:'warn',   title:'Отклонено',   theme:'rose'      },
    {s:'Ходы на сегодня закончились',                             icon:'clock',  title:'Лимит',       theme:'rose'      },
    {s:'Вы можете ставить реакцию на комментарии не более 5 раз в день', icon:'clock', title:'Лимит', theme:'rose'},
    {s:'Для выставления оценки вы должны были посмотреть это аниме', icon:'warn', title:'Внимание', theme:'neon-amber'},
    // ── Порция 5 ─────────────────────────────────────────
    {s:'Риск не оправдался',                                       icon:'warn',   title:'Неудача',     theme:'rose'      },
    {s:'Ловушка активирована',                                     icon:'warn',   title:'Ловушка',     theme:'rose'      },
    {s:'Ловушка установлена',                                      icon:'warn',   title:'Ловушка',     theme:'neon-blue' },
    {s:'Ловушка снята',                                            icon:'check',  title:'Ловушка',     theme:'emerald'   },
    {s:'Ты выбрался из ловушки',                                   icon:'check',  title:'Ловушка',     theme:'emerald'   },
    {s:'Сначала выберись из ловушки',                              icon:'warn',   title:'Ловушка',     theme:'neon-amber'},
    {s:'Сбежать пока нельзя',                                      icon:'clock',  title:'Ловушка',     theme:'neon-amber'},
    {s:'Сначала выполни условие коллекции',                        icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'Путь закрыт. Сначала собери нужное количество одинаковых карт.', icon:'lock', title:'Путь закрыт', theme:'neon-amber'},
    {s:'Вы уже выставили свою оценку для данной статьи',           icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'Вы не можете выставлять оценку для своего собственного комментария', icon:'warn', title:'Внимание', theme:'neon-amber'},
    {s:'зафиксирована в колоде и не может быть разблокирована',    icon:'lock',   title:'Внимание',    theme:'rose'      },
    {s:'Сначала сделай выбор в Комнате отголосков',                icon:'warn',   title:'Отголосок',   theme:'neon-amber'},
    {s:'Сначала выбери судьбу комнаты',                            icon:'warn',   title:'Комната',     theme:'neon-amber'},
    {s:'Сначала сделай выбор у Алтаря удачи',                      icon:'warn',   title:'Алтарь',      theme:'neon-amber'},
    {r:/Лабиринт временно недоступен с \d{1,2}:\d{2} до \d{1,2}:\d{2}/i, icon:'clock', title:'Лабиринт', theme:'neon-amber'},
    {s:'Лабиринт откликнулся на твой путь',                        icon:'bolt',   title:'Лабиринт',    theme:'neon-blue' },
    {s:'Резонанс вызван',                                          icon:'bolt',   title:'Резонанс',    theme:'neon-blue' },
    {s:'Комната с такими координатами ещё не открыта',              icon:'lock',   title:'Резонанс',    theme:'neon-amber'},
    {s:'Эти координаты уже отзывались в резонансе. Выбери другую комнату.', icon:'warn', title:'Резонанс', theme:'neon-amber'},
    {s:'Ты уже бывал в этой комнате. Резонанс требует незнакомые координаты.', icon:'warn', title:'Резонанс', theme:'neon-amber'},
    {s:'Резонанс не смог зацепиться за эту комнату',                icon:'warn',   title:'Резонанс',    theme:'rose'      },
    {s:'В этой комнате сейчас никого нет. Резонанс может зацепиться только за комнату, где находится другой игрок.', icon:'warn', title:'Резонанс', theme:'neon-amber'},
    {s:'Время вышло',                                              icon:'clock',  title:'Время',       theme:'rose'      },
    {s:'Следующий шаг ещё недоступен',                             icon:'clock',  title:'Лабиринт',    theme:'neon-amber'},
    {s:'Купить ход можно только когда доступных ходов не осталось', icon:'coin',   title:'Лабиринт',    theme:'neon-amber'},
    {s:'На сегодня попытки закончились',                           icon:'clock',  title:'Лабиринт',    theme:'rose'      },
    {s:'Щит активирован',                                          icon:'shield', title:'Щит',         theme:'neon-blue' },
    {s:'Алтарь наградил тебя',                                     icon:'star',   title:'Награда',     theme:'neon-green'},
    {s:'Сундук открыт',                                            icon:'star',   title:'Сундук',      theme:'neon-green'},
    {s:'Сначала открой сундук или откажись',                       icon:'warn',   title:'Сундук',      theme:'neon-amber'},
    {s:'Погоня за кобольдом началась',                             icon:'bolt',   title:'Погоня',      theme:'neon-blue' },
    {s:'Карта-задание изменена',                                   icon:'save',   title:'Задание',     theme:'indigo'    },
    {s:'Участник принят в клуб',                                   icon:'user',   title:'Клуб',        theme:'emerald'   },
    {s:'Участник исключён из клуба',                               icon:'user',   title:'Клуб',        theme:'rose'      },
    {s:'Статус изменён',                                           icon:'save',   title:'Статус',      theme:'indigo'    },
    {s:'Подписка на уведомления обновлена',                        icon:'bell',   title:'Уведомления', theme:'neon-blue' },
    {s:'Чат временно закрыт на ежедневное обслуживание',           icon:'clock',  title:'Обслуживание',theme:'neon-amber'},
    {r:/Возможность создания карточек отключена с \d{1,2}:\d{2} до \d{1,2}:\d{2}/i, icon:'clock', title:'Обслуживание', theme:'neon-amber'},
    {r:/Обмены между пользователями отключены с \d{1,2}:\d{2} до \d{1,2}:\d{2}/i, icon:'clock', title:'Обслуживание', theme:'neon-amber'},
    {r:/Куплен \+\d+ ход/i,                                       icon:'coin',   title:'Покупка',     theme:'neon-green'},
    {r:/У вас уже есть активная ставка на \d{1,2}:\d{2}\. Новую можно сделать только после того, как это время пройдёт/i, icon:'clock', title:'Ставка', theme:'neon-amber'},
    {r:/Время \d{1,2}:\d{2} уже занято пользователем .+\. Выберите другое/i, icon:'clock', title:'Ставка', theme:'neon-amber'},
    {r:/Можно выбрать только время с \d{1,2}:\d{2} до \d{1,2}:\d{2}/i, icon:'clock', title:'Ставка', theme:'neon-amber'},
    {s:'Жалоба отправлена',                                        icon:'warn',   title:'Жалоба',      theme:'indigo'    },
    {s:'Вы уже выставили свою оценку для данного комментария',     icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    // ── Порция 6 ─────────────────────────────────────────
    {s:'данная карта добавлена в список ненужных, нельзя добавлять карты в оба списка', icon:'warn', title:'Внимание', theme:'neon-amber'},
    {s:'У вас данная карта добавлена в список хочу получить, нельзя добавлять карты в оба списка', icon:'warn', title:'Список', theme:'neon-amber'},
    {s:'Отголосок сорвался',                                       icon:'warn',   title:'Неудача',     theme:'rose'      },
    {s:'Кирпич полностью заряжен',                                 icon:'bolt',   title:'Кирпич',      theme:'neon-green'},
    {s:'Неудача. Ты не пройдешь',                                  icon:'warn',   title:'Неудача',     theme:'rose'      },
    {s:'Открытие паков карточек отключено',                        icon:'clock',  title:'Внимание',    theme:'neon-amber'},
    {s:'Карты не существует',                                      icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'Данной карты не сущетсвует',                               icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'У вас нет такой карты',                                    icon:'card',   title:'Карта',        theme:'rose'      },
    // ── Порция 7 ─────────────────────────────────────────
    {s:'Данная карта уже добавлена',                               icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {r:/Вы должны выбрать от одной до \d+ карт/i,                 icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'Ошибка запроса',                                           icon:'err',    title:'Ошибка',      theme:'neon-amber'},
    {s:'Произошла ошибка при отправке карточки',                   icon:'err',    title:'Карточка',     theme:'rose'      },
    // ── Порция 8 ─────────────────────────────────────────
    {s:'Режим берсерка активирован',                               icon:'bolt',   title:'Берсерк',     theme:'neon-pink' },
    {r:/Куплено \+\d+ небесного кирпича/i,                        icon:'bolt',   title:'Покупка',     theme:'neon-green'},
    {s:'Карта успешно куплена',                                    icon:'bag',    title:'Покупка',     theme:'neon-green'},
    {s:'Карта куплена',                                           icon:'bag',    title:'Покупка',     theme:'neon-green'},
    {s:'Недостаточно AСС',                                         icon:'coin',   title:'Ошибка',      theme:'rose'      },
    {s:'Недостаточно ходов для установки ловушки',                  icon:'clock',  title:'Ловушка',     theme:'rose'      },
    {s:'Сначала купи карту у торговца или откажись',                icon:'bag',    title:'Торговец',    theme:'neon-amber'},
    {s:'Возможность пробуждения карт приостановлена',               icon:'lock',   title:'Пробуждение', theme:'neon-amber'},
    {
      s:'Карта пока не доступна к пробуждению, модераторы уже получили вашу заявку ' +
        'на разблокировку пробуждения карты, дождитесь уведомления',
      icon:'lock',
      title:'Пробуждение',
      theme:'neon-amber'
    },
    {
      s:'Данная карта временно не доступна к пробуждению, но модераторы получили вашу заявку ' +
        'и после рассмотрения вы сможете пробуждать данную карту',
      icon:'lock',
      title:'Пробуждение',
      theme:'neon-amber'
    },
    {s:'Максимальный вес оригинальной картинки',                   icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'Изображение загружено в предпросмотр',                     icon:'check',  title:'Загружено',   theme:'emerald'   },
    {s:'Успешное пробуждение',                                     icon:'star',   title:'Пробуждение', theme:'neon-green'},
    {s:'Сперва выберите карту для пробуждения',                    icon:'warn',   title:'Пробуждение', theme:'neon-amber'},
    {s:'Судьба комнаты выбрана',                                   icon:'check',  title:'Готово',      theme:'emerald'   },
    {s:'За выбор судьбы комнаты ты получаешь',                     icon:'coin',   title:'Награда',     theme:'neon-green'},
    {s:'Дань уплачена',                                            icon:'coin',   title:'Оплата',      theme:'emerald'   },
    {s:'Этого стража ещё нельзя перезахватить. Сначала он должен получить хотя бы одну дань.', icon:'shield', title:'Страж', theme:'neon-amber'},
    {s:'Шахта пока ничего не накопила',                            icon:'warn',   title:'Шахта',       theme:'neon-amber'},
    {s:'Шахта ограблена',                                          icon:'warn',   title:'Шахта',       theme:'rose'      },
    {r:/Шахта: собрано \d+ AСС(?: \+ \d+ карт)?/i,                 icon:'coin',   title:'Шахта',       theme:'neon-green'},
    {
      r:/Ты улучшил персональную шахту до \d+ уровня.*Получено AСС: \+\d+(?:.*Получено карт: \d+)?/i,
      icon:'coin',
      title:'Шахта',
      theme:'neon-green'
    },
    {s:'Ты помог со сбором шахты',                                 icon:'coin',   title:'Шахта',       theme:'neon-green'},
    {s:'Сначала заверши испытание Дао',                            icon:'warn',   title:'Дао',         theme:'neon-amber'},
    {s:'Отголосок повторён',                                       icon:'check',  title:'Готово',      theme:'emerald'   },
    {s:'Ты отказался от отголоска',                                icon:'warn',   title:'Отголосок',   theme:'rose'      },
    {s:'Всевидящее око показало соседние комнаты',                 icon:'bolt',   title:'Лабиринт',    theme:'neon-blue' },
    {s:'Нельзя использовать Всевидящее око: следующий ход ещё недоступен', icon:'clock', title:'Лабиринт', theme:'neon-amber'},
    {s:'Нельзя использовать Всевидящее око: на сегодня ходы закончились', icon:'clock', title:'Лимит ходов', theme:'rose'},
    {s:'Ты открыл золотые врата и обрёл карту ранга S!',           icon:'star',   title:'Награда',     theme:'neon-green'},
    {s:'Штурм провален',                                           icon:'warn',   title:'Штурм',       theme:'rose'      },
    {s:'Ты прошёл по уже открытому пути. Лабиринт не засчитал этот шаг в общий прогресс.', icon:'warn', title:'Лабиринт', theme:'neon-amber'},
    {s:'Вы не выбрали карту',                                      icon:'warn',   title:'Внимание',    theme:'neon-amber'},
    {s:'Нельзя одновременно выбирать карты ранга S и +',           icon:'warn',   title:'Выбор карт',   theme:'neon-amber'},
    {s:'Уже выбран дубль этой карты. С ним нельзя добавлять другие карты.', icon:'warn', title:'Выбор карт', theme:'neon-amber'},
    {s:'Максимум 70 карточек',                                     icon:'warn',   title:'Лимит',       theme:'rose'      },
    {s:'Награда получена',                                         icon:'coin',   title:'Награда',     theme:'neon-green'},
    {s:'Сегодня вы уже ставили реакцию на комментарий данного пользователя', icon:'clock', title:'Лимит', theme:'rose'},
    {s:'Сообщения удалены',                                        icon:'check',  title:'Готово',      theme:'emerald'   },
    {s:'Вы уже поставили 3 дизлайка на карты, которые сейчас на модерации. Дождитесь следующей партии карт и сможете ставить новые', icon:'clock', title:'Лимит', theme:'rose'},
    {s:'Ошибка сервера',                                          icon:'err',    title:'Ошибка',      theme:'neon-amber'},
    {s:'Недостаточно камней духа', icon:'coin', title:'Ошибка', theme:'rose'},
    {s:'Автофарм остановлен.', icon:'clock', title:'Автофарм', theme:'rose'},
    {
      s:'У вас нет свободных карт ранга A с улучшением +5',
      icon:'warn',
      title:'Внимание',
      theme:'neon-amber'
    },
    {
      s:'Статистика доступна только обладателям возвышения',
      icon:'lock',
      title:'Статистика',
      theme:'neon-amber'
    },
    {s:'Ты уже захватывал комнату для клуба', icon:'shield', title:'Клуб', theme:'neon-amber'},
    {s:'Вы уже получали карту с этого пака', icon:'warn', title:'Пак', theme:'neon-amber'},
    {s:'Публикация успешно убрана из ваших закладок на сайте', icon:'save', title:'Закладки', theme:'emerald'},
    {s:'Публикация успешно добавлена в ваши закладки на сайте', icon:'save', title:'Закладки', theme:'emerald'},
    {
      r:/(?:с момента вашего отсутствия на сайте вам было прислано|у вас(?: сейчас)?)\s+\d+\s+(?:(?:нов(?:ое|ых)|непрочитанн(?:ое|ых))\s+)*сообщени(?:е|я|й)/i,
      icon:'bell',
      title:'Сообщения',
      theme:'neon-blue'
    },
  ];

  function cptResolve(text){
    const t=String(text||'');
    for(const row of CPT_MAP){
      if(row.r){
        if(row.r.test(t)) return row;
      } else {
        if(t.toLowerCase().includes(row.s.toLowerCase())) return row;
      }
    }
    return null;
  }

  function cptSendUnknown(text){
    suiteReportEvent('unknown_push', { text });
  }

  let cptRoot=null, cptStyleInjected=false;
  const cptMap=new Map();
  const CPT_LIFE=3000;

  function cptInjectStyles(){
    if(cptStyleInjected) return;
    cptStyleInjected=true;
    const s=document.createElement('style');
    s.id='__cpt-styles';
    s.textContent=`
      #__cpt-root{position:fixed;top:18px;right:18px;z-index:999;display:flex;flex-direction:column;gap:8px;pointer-events:none;font-family:'Segoe UI',Arial,sans-serif;transform-origin:top right;}
      .cpt-toast{position:relative;width:230px;padding:8px 12px 10px;border-radius:12px;overflow:hidden;pointer-events:auto;transition:opacity .18s ease,transform .18s ease;animation:cpt-in .35s cubic-bezier(.34,1.56,.64,1);}
      .cpt-toast.hide{opacity:0;transform:translateX(18px);}
      @keyframes cpt-in{0%{opacity:0;transform:scale(.35)}60%{transform:scale(1.08)}80%{transform:scale(.97)}100%{opacity:1;transform:scale(1)}}
      .cpt-head{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;line-height:1.2;position:relative;z-index:2;}
      .cpt-sub{margin-top:3px;font-size:11px;line-height:1.35;opacity:.82;position:relative;z-index:2;padding-left:19px;}
      .cpt-bar{position:absolute;left:0;bottom:0;width:100%;height:2px;background:rgba(255,255,255,.28);transform-origin:left;z-index:2;}
      .cpt-neon-green{background:#05070d;border:1px solid #22c55e;color:#4ade80;box-shadow:0 0 10px rgba(34,197,94,.6),0 0 26px rgba(34,197,94,.22),0 10px 28px rgba(0,0,0,.3);}
      .cpt-neon-blue{background:#05070d;border:1px solid #3b82f6;color:#60a5fa;box-shadow:0 0 10px rgba(59,130,246,.6),0 0 26px rgba(59,130,246,.22),0 10px 28px rgba(0,0,0,.3);}
      .cpt-neon-pink{background:#05070d;border:1px solid #d946ef;color:#f0abfc;box-shadow:0 0 10px rgba(217,70,239,.6),0 0 26px rgba(217,70,239,.22),0 10px 28px rgba(0,0,0,.3);}
      .cpt-neon-amber{background:#05070d;border:1px solid #f59e0b;color:#fbbf24;box-shadow:0 0 10px rgba(245,158,11,.6),0 0 26px rgba(245,158,11,.22),0 10px 28px rgba(0,0,0,.3);}
      .cpt-indigo{background:#1e1b4b;border:1px solid #4338ca;color:#e0e7ff;box-shadow:0 4px 16px rgba(67,56,202,.3);}
      .cpt-emerald{background:#052e16;border:1px solid #166534;color:#bbf7d0;box-shadow:0 4px 16px rgba(22,101,52,.3);}
      .cpt-rose{background:#4c0519;border:1px solid #9f1239;color:#fecdd3;box-shadow:0 4px 16px rgba(159,18,57,.3);}
      .cpt-ocean{background:#0c1445;border:1px solid #1d4ed8;color:#bfdbfe;box-shadow:0 4px 16px rgba(29,78,216,.3);}
      .cpt-volcano{background:#1c0a00;border:1px solid #c2410c;color:#fed7aa;box-shadow:0 4px 16px rgba(194,65,12,.3);}
      .cpt-neon-green::before,.cpt-neon-blue::before,.cpt-neon-pink::before,.cpt-neon-amber::before{content:"";position:absolute;inset:0;transform:translateX(-140%);animation:cpt-shine 2.2s linear infinite;z-index:1;}
      .cpt-neon-green::before{background:linear-gradient(90deg,transparent,rgba(74,222,128,.08),transparent);}
      .cpt-neon-blue::before{background:linear-gradient(90deg,transparent,rgba(96,165,250,.08),transparent);}
      .cpt-neon-pink::before{background:linear-gradient(90deg,transparent,rgba(240,171,252,.08),transparent);}
      .cpt-neon-amber::before{background:linear-gradient(90deg,transparent,rgba(251,191,36,.08),transparent);}
      @keyframes cpt-shine{to{transform:translateX(220%);}}
    `;
    document.head.appendChild(s);
  }

  function cptEnsureRoot(){
    cptInjectStyles();
    if(!cptRoot||!document.contains(cptRoot)){
      cptRoot=document.createElement('div');
      cptRoot.id='__cpt-root';
      document.body.appendChild(cptRoot);
    }
    cptApplyScale();
  }

  function cptGetScale(){
    const n=Number(cfg.customPushScale);
    if(!Number.isFinite(n)) return 1;
    return Math.min(1.4,Math.max(0.8,n));
  }

  function cptApplyScale(){
    if(!cptRoot||!document.contains(cptRoot)) return;
    const viewport=suiteGetVisibleViewport();
    const maxWidthScale=Math.max(.45,(viewport.width-36)/230);
    const scale=Math.min(cptGetScale(),maxWidthScale);
    cptRoot.style.maxHeight=`${Math.max(80,(viewport.height-36)/scale)}px`;
    cptRoot.style.transform=`scale(${scale})`;
  }

  function cptAnimBar(bar){
    bar.style.transition='none'; bar.style.transform='scaleX(1)';
    void bar.offsetWidth;
    bar.style.transition=`transform ${CPT_LIFE}ms linear`; bar.style.transform='scaleX(0)';
  }

  function cptRemove(key){
    const item=cptMap.get(key); if(!item) return;
    clearTimeout(item.timer);
    item.el.classList.add('hide');
    setTimeout(()=>{ if(item.el.parentNode) item.el.remove(); },180);
    cptMap.delete(key);
  }

  function cptShow(key,icon,title,sub,themeCls){
    cptEnsureRoot();
    const ex=cptMap.get(key);
    if(ex){
      ex.titleEl.textContent=title;
      ex.subEl.textContent=sub;
      clearTimeout(ex.timer);
      cptAnimBar(ex.bar);
      ex.timer=setTimeout(()=>cptRemove(key),CPT_LIFE);
      return;
    }
    const el=document.createElement('div');
    el.className=`cpt-toast ${themeCls}`;
    const head=document.createElement('div');
    head.className='cpt-head';
    head.innerHTML=(CPT_ICO[icon]||CPT_ICO.warn);
    const titleEl=document.createElement('span');
    titleEl.textContent=title;
    head.appendChild(titleEl);
    const subEl=document.createElement('div');
    subEl.className='cpt-sub';
    subEl.textContent=sub;
    const bar=document.createElement('div');
    bar.className='cpt-bar';
    el.appendChild(head);
    el.appendChild(subEl);
    el.appendChild(bar);
    cptRoot.appendChild(el);
    cptAnimBar(bar);
    cptMap.set(key,{
      el,
      titleEl,
      subEl,
      bar,
      timer:setTimeout(()=>cptRemove(key),CPT_LIFE)
    });
  }

  function isCardStatsDemandEnabled(inputId) {
    return !!document.getElementById(inputId)?.checked;
  }

  function warnCardStatsDemandRequired(inputId) {
    if (isCardStatsDemandEnabled(inputId)) return false;
    const message = 'Для работы нужно включить статистику карт '
      + 'и перезагрузить страницу';
    cptShow(
      'card-stats-demand-required:' + inputId,
      'warn',
      'Статистика карт',
      message,
      CPT_CLS['neon-amber']
    );
    return true;
  }

  function warnPremiumRequired() {
    cptShow(
      'premium-required',
      'lock',
      'Возвышение',
      'Эта функция доступна только с возвышением',
      CPT_CLS['neon-amber']
    );
    return true;
  }

  function cptHandleDlePushNode(node){
    if(!cfg.modCustomPush) return;
    if(!(node instanceof HTMLElement)) return;
    const items = node.matches?.('.DLEPush-notification')
      ? [node]
      : [...node.querySelectorAll?.('.DLEPush-notification') || []];

    items.forEach(item=>{
      if(item.dataset.cptHandled === '1') return;
      const messageEl = item.querySelector('.DLEPush-message') || item;
      const text = (messageEl.textContent || '').replace(/\s+/g, ' ').trim();
      if(!text) return;

      const match = cptResolve(text);
      if(!match) return;

      item.dataset.cptHandled = '1';
      cptShow(text, match.icon, match.title, text, CPT_CLS[match.theme]);
      item.remove();
    });
  }

  function cptInstallDomObserver(){
    if(window.__cptDomObserverInstalled) return;
    if(!document.body) return;
    window.__cptDomObserverInstalled = true;

    const scanExisting = () => {
      document.querySelectorAll('.DLEPush-notification').forEach(cptHandleDlePushNode);
    };

    scanExisting();
    const observer = new MutationObserver(mutations=>{
      mutations.forEach(mutation=>{
        mutation.addedNodes.forEach(cptHandleDlePushNode);
      });
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  // Страницы где приоритет уведомлений отдаётся кликеру
  function isClickerPage(){
    const p=location.pathname+location.search;
    return /\/boss_invansion\/?/.test(p) || /\/clubs\/boost\//.test(p);
  }

  function installCustomPush(){
    if(!cfg.modCustomPush) {
      const dlePushEl=document.getElementById('DLEPush');
      if(dlePushEl) dlePushEl.style.display='';
      return;
    }
    if(window.__cptHookInstalled) {
      const dlePushEl=document.getElementById('DLEPush');
      if(dlePushEl) dlePushEl.style.display='';
      cptInstallDomObserver();
      return;
    }
    if(isClickerPage()) return;
    cptInstallDomObserver();
    const dp = window.DLEPush || (typeof DLEPush!=='undefined' ? DLEPush : null);
    if(!dp) return;
    window.__cptHookInstalled=true;
    const dlePushEl=document.getElementById('DLEPush');
    if(dlePushEl) dlePushEl.style.display='';
    cptInstallDomObserver();
    ['info','warning','error','success'].forEach(method=>{
      if(typeof dp[method]!=='function') return;
      const orig=dp[method].bind(dp);
      dp[method]=function(...args){
        if(!cfg.modCustomPush) {
          const dlePushEl=document.getElementById('DLEPush');
          if(dlePushEl) dlePushEl.style.display='';
          return orig(...args);
        }
        const text=args.find(v=>typeof v==='string'&&v.trim())||'';
        const match=cptResolve(text);
        if(match){ cptShow(text,match.icon,match.title,text,CPT_CLS[match.theme]); return null; }
        // Неизвестное уведомление — отправляем в дискорд для пополнения базы
        if(text) cptSendUnknown(text);
        return orig(...args);
      };
    });
  }

  // ============================================================
  //  СКРЫТИЕ ГОЛОСОВАНИЯ ЗА КАРТЫ
  // ============================================================

  const VOTE_CARDS_IDS_KEY = 'vote_cards_ids';
  const VOTE_CARDS_NEW_KEY = 'vote_cards_new';
  const VOTE_CARDS_OPEN_KEY = 'vote_cards_opened';
  const VOTE_REPLACE_IDS_KEY = 'vote_replace_ids';
  const VOTE_REPLACE_NEW_KEY = 'vote_replace_new';
  const VOTE_REPLACE_OPEN_KEY = 'vote_replace_opened';
  let voteCardsObserver = null;
  let voteCardsTimer = null;
  let voteCardsIgnoreUntil = 0;

  const VOTE_TOGGLE_CONFIGS = [
    {
      kind:'publish',
      idsKey:VOTE_CARDS_IDS_KEY,
      newKey:VOTE_CARDS_NEW_KEY,
      openKey:VOTE_CARDS_OPEN_KEY,
      titlePattern:/Голосование\s+за\s+публикацию\s+карт/i,
      titleAttr:'data-suite-vote-title',
      blockAttr:'data-suite-vote-block',
      countLabel:'На голосовании',
      itemSelector:'.anime-cards__item',
      getItems:block => [...block.querySelectorAll('.anime-cards__item')],
      getItemKey:item => item?.dataset?.id || ''
    },
    {
      kind:'replace',
      idsKey:VOTE_REPLACE_IDS_KEY,
      newKey:VOTE_REPLACE_NEW_KEY,
      openKey:VOTE_REPLACE_OPEN_KEY,
      titlePattern:/Голосование\s+за\s+замену\s+артов/i,
      titleAttr:'data-suite-vote-replace-title',
      blockAttr:'data-suite-vote-replace-block',
      countLabel:'На замене',
      itemSelector:'.card-replace-vote',
      getItems:block => [...block.querySelectorAll('.card-replace-vote')],
      getItemKey:item => {
        const cards=[...item.querySelectorAll('.anime-cards__item')];
        const oldCard=cards[0], newCard=cards[1];
        return [
          item.querySelector('.card-replace-vote__title')?.textContent?.trim() || '',
          oldCard?.dataset?.id || '',
          oldCard?.dataset?.image || '',
          newCard?.dataset?.image || ''
        ].join('|');
      }
    }
  ];

  function cleanupVoteCardsToggle(){
    clearTimeout(voteCardsTimer);
    voteCardsTimer = null;
    if(voteCardsObserver){
      voteCardsObserver.disconnect();
      voteCardsObserver = null;
    }
    window.__suiteVoteCardsToggleInstalled = false;
    document.querySelectorAll('.suite-vote-toggle-wrapper').forEach(el=>el.remove());
    VOTE_TOGGLE_CONFIGS.forEach(cfgItem=>{
      const block = document.querySelector(`[${cfgItem.blockAttr}="1"]`);
      if(block){
        block.style.removeProperty('display');
        block.removeAttribute(cfgItem.blockAttr);
      }
      const title = document.querySelector(`[${cfgItem.titleAttr}="1"]`);
      if(title){
        title.style.removeProperty('display');
        title.removeAttribute(cfgItem.titleAttr);
      }
    });
  }

  function scheduleVoteCardsToggle(delay=120){
    clearTimeout(voteCardsTimer);
    voteCardsTimer = setTimeout(applyVoteCardsToggle, delay);
  }

  function findVoteCardsTitle(pattern){
    return [...document.querySelectorAll('.ncard__main-title.as-center.bolder,.ncard__main-title')]
      .find(el => pattern.test(el.textContent || ''));
  }

  function findVoteCardsBlock(title){
    if(!title) return null;
    const sections = [...document.querySelectorAll('.anime-cards-center.anime-cards--full-page')];
    if(!sections.length) return null;

    const titleTop = title.getBoundingClientRect().top + window.scrollY;
    const afterTitle = sections
      .map(block => ({ block, top: block.getBoundingClientRect().top + window.scrollY }))
      .filter(x => x.top >= titleTop - 8)
      .sort((a,b) => a.top - b.top);

    return (afterTitle[0]?.block || sections[0] || null);
  }

  function findVoteReplaceBlock(title){
    if(!title) return null;
    let node=title.nextElementSibling;
    while(node){
      if(node.matches?.('.cards-replace-vote-list')) return node;
      if(node.matches?.('.ncard__main-title.as-center.bolder,.ncard__main-title')) break;
      node=node.nextElementSibling;
    }
    return document.querySelector('.cards-replace-vote-list');
  }

  function readVoteBlockIds(cfgItem, block){
    return cfgItem.getItems(block)
      .map(item => cfgItem.getItemKey(item))
      .filter(Boolean);
  }

  function getVoteBlockOpened(cfgItem){
    return gmStoreGet(cfgItem.openKey, false) === true;
  }

  function setVoteBlockOpened(cfgItem, opened){
    gmStoreSet(cfgItem.openKey, !!opened);
  }

  function applySingleVoteToggle(cfgItem){
    const title = findVoteCardsTitle(cfgItem.titlePattern);
    const block = cfgItem.kind==='replace' ? findVoteReplaceBlock(title) : findVoteCardsBlock(title);
    if(!title || !block) return;

    title.setAttribute(cfgItem.titleAttr,'1');
    block.setAttribute(cfgItem.blockAttr,'1');

    const ids = readVoteBlockIds(cfgItem, block);
    title.querySelectorAll(`.suite-vote-toggle-wrapper[data-vote-kind="${cfgItem.kind}"]`).forEach(el=>el.remove());

    if(!ids.length){
      title.style.setProperty('display','none','important');
      return;
    }

    title.style.removeProperty('display');

    let oldIds = [];
    try { oldIds = gmStoreGet(cfgItem.idsKey, []); }
    catch(e) { oldIds = []; }

    if(ids.some(id => !oldIds.includes(id))){
      gmStoreSet(cfgItem.newKey, true);
    }
    gmStoreSet(cfgItem.idsKey, ids);

    const wrapper = document.createElement('span');
    wrapper.className = 'suite-vote-toggle-wrapper';
    wrapper.dataset.voteKind = cfgItem.kind;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'suite-vote-toggle-btn';

    const counter = document.createElement('span');
    counter.className = 'suite-vote-toggle-counter';

    const newLabel = document.createElement('span');
    newLabel.className = 'suite-vote-new-label';
    newLabel.textContent = 'NEW';

    let opened = getVoteBlockOpened(cfgItem);

    function render(){
      button.textContent = opened ? 'Свернуть' : 'Развернуть';
      counter.textContent = `${cfgItem.countLabel}: ${ids.length}`;
      newLabel.style.display = (!opened && gmStoreGet(cfgItem.newKey, false) === true) ? 'inline-flex' : 'none';
      if(opened) block.style.removeProperty('display');
      else block.style.setProperty('display','none','important');
    }

    button.addEventListener('click', () => {
      opened = !opened;
      setVoteBlockOpened(cfgItem, opened);
      if(opened) gmStoreDelete(cfgItem.newKey);
      render();
    });

    wrapper.append(button,counter,newLabel);
    title.appendChild(wrapper);
    render();
  }

  function applySingleVoteToggleStable(cfgItem){
    const title = findVoteCardsTitle(cfgItem.titlePattern);
    const block = cfgItem.kind==='replace' ? findVoteReplaceBlock(title) : findVoteCardsBlock(title);
    if(!title || !block) return;

    title.setAttribute(cfgItem.titleAttr,'1');
    block.setAttribute(cfgItem.blockAttr,'1');

    const ids = readVoteBlockIds(cfgItem, block);
    const wrappers = [...title.querySelectorAll(`.suite-vote-toggle-wrapper[data-vote-kind="${cfgItem.kind}"]`)];
    let wrapper = wrappers[0] || null;
    wrappers.slice(1).forEach(el=>el.remove());

    if(!ids.length){
      if(wrapper) wrapper.remove();
      title.style.setProperty('display','none','important');
      return;
    }

    title.style.removeProperty('display');

    let oldIds = [];
    try { oldIds = gmStoreGet(cfgItem.idsKey, []); }
    catch(e) { oldIds = []; }

    if(ids.some(id => !oldIds.includes(id))){
      gmStoreSet(cfgItem.newKey, true);
    }
    gmStoreSet(cfgItem.idsKey, ids);

    if(!wrapper){
      wrapper = document.createElement('span');
      wrapper.className = 'suite-vote-toggle-wrapper';
      wrapper.dataset.voteKind = cfgItem.kind;
      wrapper.innerHTML = '<button type="button" class="suite-vote-toggle-btn"></button><span class="suite-vote-toggle-counter"></span><span class="suite-vote-new-label">NEW</span>';
      title.appendChild(wrapper);
    }

    const button = wrapper.querySelector('.suite-vote-toggle-btn');
    const counter = wrapper.querySelector('.suite-vote-toggle-counter');
    const newLabel = wrapper.querySelector('.suite-vote-new-label');

    function render(){
      const opened = getVoteBlockOpened(cfgItem);
      button.textContent = opened ? 'Свернуть' : 'Развернуть';
      counter.textContent = `${cfgItem.countLabel}: ${ids.length}`;
      newLabel.style.display = (!opened && gmStoreGet(cfgItem.newKey, false) === true) ? 'inline-flex' : 'none';
      if(opened) block.style.removeProperty('display');
      else block.style.setProperty('display','none','important');
    }

    if(button.dataset.voteBound !== cfgItem.kind){
      button.dataset.voteBound = cfgItem.kind;
      button.addEventListener('click', () => {
        const nextOpened = !getVoteBlockOpened(cfgItem);
        setVoteBlockOpened(cfgItem, nextOpened);
        if(nextOpened) gmStoreDelete(cfgItem.newKey);
        render();
      });
    }

    render();
  }

  function applyVoteCardsToggle(){
    if(!cfg.modVoteCardsToggle) {
      cleanupVoteCardsToggle();
      return;
    }
    voteCardsIgnoreUntil = Date.now() + 300;
    VOTE_TOGGLE_CONFIGS.forEach(applySingleVoteToggleStable);
  }

  function initVoteCardsToggle(){
    if(!cfg.modVoteCardsToggle) return;
    if(window.__suiteVoteCardsToggleInstalled){
      scheduleVoteCardsToggle();
      return;
    }
    window.__suiteVoteCardsToggleInstalled = true;
    scheduleVoteCardsToggle(0);
    voteCardsObserver = new MutationObserver((mutations) => {
      if(Date.now() < voteCardsIgnoreUntil) return;
      if(Array.isArray(mutations) && mutations.length){
        const onlyInternal = mutations.every(mutation => {
          const target = mutation.target?.nodeType === 1 ? mutation.target : mutation.target?.parentElement;
          return target?.closest?.('.suite-vote-toggle-wrapper');
        });
        if(onlyInternal) return;
      }
      scheduleVoteCardsToggle();
    });
    voteCardsObserver.observe(document.body,{childList:true,subtree:true});
  }

  // ============================================================
  //  ПРЕДЛОЖКА И АВТОРЫ
  // ============================================================

  function cleanupSuggestionAuthors(){
    const state = window.__suiteSuggestionAuthorsState;
    if(state){
      try{ clearTimeout(state.cardsAuthorPollTimer); }catch(e){}
      try{ clearTimeout(state.cardsAuthorObserveTimer); }catch(e){}
      (state.intervals || []).forEach(timer => { try{ clearInterval(timer); }catch(e){} });
      try{ state.cardsAuthorObserver?.disconnect(); }catch(e){}
      (state.listeners || []).forEach(item => {
        try{ item.target.removeEventListener(item.type, item.handler, item.options); }catch(e){}
      });
    }
    document.getElementById('suite-suggestion-authors-style')?.remove();
    document.getElementById('suite-suggestion-authors-button')?.remove();
    document.getElementById('suite-suggestion-authors-modal')?.remove();
    document.querySelectorAll('.suite-author-badge.suite-server-author').forEach(el=>el.remove());
    window.__suiteSuggestionAuthorsState = null;
    window.__suiteSuggestionAuthorsInstalled = false;
  }

  function initSuggestionAuthors(){
    if(!cfg.modSuggestionAuthors) return;
    if(window.__suiteSuggestionAuthorsInstalled) return;
    window.__suiteSuggestionAuthorsInstalled = true;

    const API_BASES = [
      'https://predlojka-o4s8.onrender.com',
      'https://predlojka.onrender.com'
    ];
    let activeApiBase = API_BASES[0];
    const CACHE_KEY = 'suite_suggestion_authors_cache_v1';
    const HOUR_MS = 60 * 60 * 1000;
    const MANUAL_REFRESH_COOLDOWN_MS = 30 * 1000;
    const CARDS_AUTHOR_POLL_MS = 5 * 1000;
    const DEFAULT_RANK = '';
    const RANKS = ['', 's', 'a', 'b', 'c', 'd', 'e'];
    const state = {
      cardsAuthorPollTimer:null,
      cardsAuthorObserver:null,
      cardsAuthorObserveTimer:null,
      cardsAuthorRefreshRunning:false,
      intervals:[],
      listeners:[]
    };
    window.__suiteSuggestionAuthorsState = state;

    const now = () => Date.now();
    const on = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      state.listeners.push({ target, type, handler, options });
    };
    function currentHourKey(){
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0') + '-' + String(d.getHours()).padStart(2, '0');
    }
    function loadCache(){
      const value = gmStoreGet(CACHE_KEY, {});
      return value && typeof value === 'object' ? value : {};
    }
    function saveCache(cache){ gmStoreSet(CACHE_KEY, cache); }
    function apiGetFrom(baseUrl,path){
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method:'GET',
          url:baseUrl + path,
          timeout:30000,
          onload:response => {
            if(response.status < 200 || response.status >= 300){
              reject(new Error(`${baseUrl}: HTTP ${response.status || 0}`));
              return;
            }
            try{ resolve(JSON.parse(response.responseText || '{}')); }
            catch(error){ reject(new Error(`${baseUrl}: invalid JSON`)); }
          },
          onerror:() => reject(new Error(`${baseUrl}: network error`)),
          ontimeout:() => reject(new Error(`${baseUrl}: timeout`))
        });
      });
    }
    async function apiGet(path){
      const candidates=[activeApiBase,...API_BASES.filter(base=>base!==activeApiBase)];
      let lastError=null;
      for(const baseUrl of candidates){
        try{
          const result=await apiGetFrom(baseUrl,path);
          activeApiBase=baseUrl;
          return result;
        }catch(error){
          lastError=error;
        }
      }
      throw lastError || new Error('suggestion API unavailable');
    }
    function escapeHtml(value){
      return String(value ?? '').replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
    }
    function abs(url){
      try{ return new URL(url, location.origin).toString(); }
      catch(e){ return String(url || ''); }
    }
    function cardImage(card){
      const img = card.querySelector('img');
      const value = card.dataset.image || img?.dataset?.src || img?.getAttribute('data-src') || img?.getAttribute('src') || '';
      try{ return new URL(value, location.origin).pathname; }
      catch(e){ return value.split('?')[0]; }
    }
    function replacementKey(item){
      const cards = [...item.querySelectorAll('.anime-cards__item[data-id]')];
      const oldCard = cards[0];
      const newCard = cards[1] || oldCard;
      if(!oldCard || !newCard) return '';
      return oldCard.dataset.id + '|' + cardImage(newCard);
    }
    function isCardsPage(){ return /^\/cards\/?$/.test(location.pathname); }
    function getCreatedCards(){
      return [...document.querySelectorAll('.anime-cards__item-wrapper-gl,.anime-cards__item-wrapper')]
        .filter(wrapper => {
          if(wrapper.closest('.cards-replace-vote-list,.card-replace-vote')) return false;
          if(!wrapper.querySelector('.card-votes')) return false;
          if(wrapper.querySelector('.card-votes__btn[data-kind="1"],.card-votes button[data-kind="1"]')) return false;
          if(!wrapper.querySelector('.card-votes__btn[data-kind="0"],.card-votes button[data-kind="0"]')) return false;
          return true;
        })
        .map(wrapper => wrapper.querySelector('.anime-cards__item[data-id]'))
        .filter(Boolean);
    }
    function collectCardsPageKeys(){
      const keys = [];
      getCreatedCards().forEach(card => keys.push(card.dataset.id));
      document.querySelectorAll('.card-replace-vote').forEach(item => {
        const key = replacementKey(item);
        if(key) keys.push(key);
      });
      return [...new Set(keys)];
    }
    function getCachedAuthorResult(key){
      const cache = loadCache();
      const results = cache.authorResults || {};
      const row = results[key];
      return row && typeof row === 'object' ? row : null;
    }
    function saveAuthorResults(rows){
      if(!rows?.length) return;
      const cache = loadCache();
      const results = cache.authorResults && typeof cache.authorResults === 'object' ? cache.authorResults : {};
      for(const row of rows){
        if(!row?.task_key) continue;
        if(!row.author && row.status !== 'not_found') continue;
        results[row.task_key] = {
          task_key:row.task_key,
          author:row.author || '',
          status:row.status || '',
          updated_at:row.updated_at || now()
        };
      }
      cache.authorResults = results;
      saveCache(cache);
    }

    function injectStyle(){
      if(document.getElementById('suite-suggestion-authors-style')) return;
      const style = document.createElement('style');
      style.id = 'suite-suggestion-authors-style';
      style.textContent = `
        .suite-suggestion-button{
          position:fixed;right:18px;bottom:18px;z-index:99999;
          display:inline-flex;align-items:center;gap:8px;min-height:38px;padding:8px 12px;
          border-radius:12px;border:1px solid rgba(56,189,248,.38);
          background:linear-gradient(135deg,rgba(8,47,73,.96),rgba(15,23,42,.96));
          color:#e0f2fe;font:900 13px/1 "Segoe UI",Arial,sans-serif;cursor:pointer;user-select:none;
          box-shadow:0 10px 30px rgba(0,0,0,.48),0 0 0 1px rgba(14,165,233,.15),0 0 22px rgba(14,165,233,.18);
        }
        .suite-suggestion-button:hover{filter:brightness(1.08);border-color:rgba(125,211,252,.58);}
        .suite-suggestion-button:active{cursor:grabbing;transform:translateY(1px);}
        .suite-suggestion-modal{
          position:fixed;inset:4vh 3vw;z-index:100000;display:none;flex-direction:column;
          background:linear-gradient(180deg,rgba(8,20,38,.98),rgba(7,16,30,.97));
          border:1px solid rgba(56,189,248,.34);border-radius:14px;
          box-shadow:0 24px 90px rgba(0,0,0,.72),0 0 28px rgba(14,165,233,.14);
          color:#e0f2fe;overflow:hidden;overscroll-behavior:contain;font-family:"Segoe UI",Arial,sans-serif;
        }
        @media(max-width:640px){
          .suite-suggestion-modal{inset:8px;border-radius:12px;}
          .suite-suggestion-topbar{grid-template-columns:minmax(0,1fr);gap:8px;padding:10px;}
          .suite-suggestion-actions{display:flex;gap:6px;flex-wrap:wrap;}
          .suite-suggestion-actions button{flex:1 1 auto;min-height:36px;}
          .suite-suggestion-button{max-width:calc(100vw - 16px);}
        }
        .suite-suggestion-modal.is-open{display:flex}
        .suite-suggestion-topbar{
          display:grid;grid-template-columns:1fr auto;align-items:center;gap:12px;
          padding:13px 15px;background:linear-gradient(135deg,rgba(14,116,144,.42),rgba(15,23,42,.92));
          border-bottom:1px solid rgba(56,189,248,.24);
        }
        .suite-suggestion-title{font-size:16px;font-weight:950;color:#f8fafc;text-shadow:0 0 14px rgba(14,165,233,.18);}
        .suite-suggestion-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px}
        .suite-suggestion-tab,.suite-suggestion-refresh,.suite-suggestion-close{
          border:1px solid rgba(56,189,248,.28);background:rgba(15,23,42,.82);color:#dbeafe;
          border-radius:9px;min-height:31px;padding:6px 10px;font:850 12px/1 "Segoe UI",Arial,sans-serif;
          cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.04);
        }
        .suite-suggestion-refresh:hover,.suite-suggestion-close:hover,.suite-suggestion-tab:hover{background:rgba(30,64,175,.38);border-color:rgba(125,211,252,.46);}
        .suite-suggestion-rankbar{display:flex;align-items:center;justify-content:center;padding:9px 14px;background:rgba(8,20,38,.72);border-bottom:1px solid rgba(56,189,248,.18);}
        .suite-suggestion-tabs{display:flex;justify-content:center;gap:7px;flex-wrap:wrap}
        .suite-suggestion-tab{min-width:42px}
        .suite-suggestion-tab.is-active{
          background:linear-gradient(180deg,#0891b2,#0e7490);color:#ecfeff;border-color:#22d3ee;
          box-shadow:0 0 0 1px rgba(34,211,238,.18),0 0 16px rgba(8,145,178,.34);
        }
        .suite-suggestion-meta{padding:8px 15px;border-bottom:1px solid rgba(56,189,248,.14);background:rgba(7,16,30,.9);font-size:12px;color:#93c5fd}
        .suite-suggestion-grid{padding:15px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,160px);justify-content:center;align-content:start;gap:15px 14px;overscroll-behavior:contain}
        .suite-suggestion-card{min-width:0;width:160px}
        .suite-suggestion-img{display:block;width:100%;border-radius:9px;border:1px solid rgba(56,189,248,.22);background:#071629;box-shadow:0 8px 22px rgba(0,0,0,.38)}
        .suite-suggestion-author,
        .suite-author-badge{
          display:flex;align-items:center;justify-content:center;box-sizing:border-box;margin-top:7px;padding:4px 8px;
          min-height:25px;border-radius:8px;border:1px solid rgba(56,189,248,.26);
          background:linear-gradient(180deg,rgba(8,47,73,.92),rgba(15,23,42,.94));
          color:#e0f2fe;font:850 12px/1.25 "Segoe UI",Arial,sans-serif;text-align:center;white-space:nowrap;overflow:hidden;
          box-shadow:0 0 0 1px rgba(14,165,233,.14),0 0 14px rgba(14,165,233,.16);
        }
        .suite-suggestion-author a,.suite-author-badge a{color:#eff6ff;text-decoration:none;border-bottom:1px solid rgba(239,246,255,.58);overflow:hidden;text-overflow:ellipsis}
        .suite-suggestion-empty{grid-column:1/-1;margin:auto;padding:36px 16px;color:#93c5fd;font:850 14px "Segoe UI",Arial,sans-serif;text-align:center}
        .suite-author-badge.suite-pending{border-color:rgba(148,163,184,.26);background:linear-gradient(180deg,rgba(30,41,59,.92),rgba(15,23,42,.94));color:#e5e7eb}
        .suite-author-badge.suite-not-found{border-color:rgba(248,113,113,.52);background:linear-gradient(180deg,rgba(127,29,29,.92),rgba(69,10,10,.94));color:#fee2e2}
        .suite-author-badge.suite-created-badge{width:100%;max-width:190px;margin-left:auto;margin-right:auto}
        .suite-author-badge.suite-replace-badge{width:100%;max-width:none;margin-left:0;margin-right:0;flex:0 0 100%;grid-column:1/-1}
        .suite-author-badge__label{flex:0 0 auto;min-width:max-content;white-space:nowrap}
        .suite-author-badge__name{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      `;
      document.head.appendChild(style);
    }

    function setupDraggableSuggestionButton(button){
      const cache = loadCache();
      const saved = cache.suggestionButtonPosition;
      if(saved && Number.isFinite(saved.x)){
        const rect = button.getBoundingClientRect();
        const left = Math.max(0, Math.min(saved.x, window.innerWidth - rect.width));
        const bottom = Number.isFinite(saved.bottom)
          ? Math.max(0, Math.min(saved.bottom, window.innerHeight - rect.height))
          : 18;
        button.style.left = left + 'px';
        button.style.bottom = bottom + 'px';
        button.style.right = 'auto';
        button.style.top = 'auto';
      }
      suiteKeepInViewport(button, {margin:8, constrainSize:false});
      button._suitePersistFloatingPosition = () => {
        const rect = button.getBoundingClientRect();
        const nextCache = loadCache();
        nextCache.suggestionButtonPosition = {
          x:rect.left,
          bottom:Math.max(0, window.innerHeight - rect.bottom)
        };
        saveCache(nextCache);
      };

      let dragging = false;
      let moved = false;
      let suppressClickUntil = 0;
      let startX = 0;
      let startY = 0;
      let startLeft = 0;
      let startTop = 0;
      const startDrag = (event, point) => {
        const rect = button.getBoundingClientRect();
        dragging = true;
        moved = false;
        startX = point.clientX;
        startY = point.clientY;
        startLeft = rect.left;
        startTop = rect.top;
        button.style.left = startLeft + 'px';
        button.style.top = startTop + 'px';
        button.style.right = 'auto';
        button.style.bottom = 'auto';
        button.style.transition = 'none';
        event.preventDefault();
      };
      const moveDrag = (event, point) => {
        if(!dragging) return;
        const dx = point.clientX - startX;
        const dy = point.clientY - startY;
        if(Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
        const viewport = suiteGetVisibleViewport();
        const newLeft = Math.max(viewport.left, Math.min(viewport.right - button.offsetWidth, startLeft + dx));
        const newTop = Math.max(viewport.top, Math.min(viewport.bottom - button.offsetHeight, startTop + dy));
        button.style.left = newLeft + 'px';
        button.style.top = newTop + 'px';
        event.preventDefault();
      };
      const finishDrag = (activate = false) => {
        if(!dragging) return;
        dragging = false;
        button.style.transition = '';
        suiteClampToViewport(button, {margin:8, constrainSize:false});
        suiteResolveFloatingButtonOverlaps(button);
        button._suitePersistFloatingPosition();
        if(activate && !moved){
          suppressClickUntil = Date.now() + 700;
          openModal();
        }
      };
      on(button, 'mousedown', event => {
        if(event.button !== 0) return;
        startDrag(event,event);
      });
      on(document, 'mousemove', event => {
        moveDrag(event,event);
      });
      on(document, 'mouseup', finishDrag);
      on(button, 'touchstart', event => startDrag(event,event.touches[0]), {passive:false});
      on(document, 'touchmove', event => {
        if(dragging) moveDrag(event,event.touches[0]);
      }, {passive:false});
      on(document, 'touchend', () => finishDrag(true));
      on(document, 'touchcancel', () => finishDrag(false));
      on(button, 'click', event => {
        if(Date.now() < suppressClickUntil){
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if(moved){
          moved = false;
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        openModal();
      });
    }

    function lockModalScroll(modal){
      on(modal, 'wheel', event => {
        const grid = event.target.closest?.('.suite-suggestion-grid');
        if(!grid || !modal.contains(grid)){
          event.preventDefault();
          return;
        }
        const maxScroll = grid.scrollHeight - grid.clientHeight;
        if(maxScroll <= 0){
          event.preventDefault();
          return;
        }
        const atTop = grid.scrollTop <= 0;
        const atBottom = grid.scrollTop >= maxScroll - 1;
        if((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) event.preventDefault();
      }, { passive:false });
    }

    function ensureUi(){
      if(document.getElementById('suite-suggestion-authors-button')) return;
      const button = document.createElement('button');
      button.id = 'suite-suggestion-authors-button';
      button.className = 'suite-suggestion-button';
      button.textContent = '📬 Предложка';
      document.body.appendChild(button);
      setupDraggableSuggestionButton(button);

      const modal = document.createElement('div');
      modal.id = 'suite-suggestion-authors-modal';
      modal.className = 'suite-suggestion-modal';
      modal.innerHTML = `
        <div class="suite-suggestion-topbar">
          <div class="suite-suggestion-title">Предложка</div>
          <div class="suite-suggestion-actions">
            <button class="suite-suggestion-refresh" type="button">Обновить</button>
            <button class="suite-suggestion-close" type="button">Закрыть</button>
          </div>
        </div>
        <div class="suite-suggestion-rankbar">
          <div class="suite-suggestion-tabs">${RANKS.map(rank => `<button class="suite-suggestion-tab" type="button" data-rank="${rank}">${rank ? rank.toUpperCase() : 'Все'}</button>`).join('')}</div>
        </div>
        <div class="suite-suggestion-meta"></div>
        <div class="suite-suggestion-grid"></div>
      `;
      on(modal.querySelector('.suite-suggestion-close'), 'click', () => modal.classList.remove('is-open'));
      on(modal.querySelector('.suite-suggestion-refresh'), 'click', () => refreshSuggestions(true));
      modal.querySelectorAll('.suite-suggestion-tab').forEach(tab => {
        on(tab, 'click', () => {
          const cache = loadCache();
          cache.rank = tab.dataset.rank || '';
          saveCache(cache);
          renderSuggestions();
        });
      });
      lockModalScroll(modal);
      document.body.appendChild(modal);
    }

    function openModal(){
      document.getElementById('suite-suggestion-authors-modal')?.classList.add('is-open');
      renderSuggestions();
      maybeRefreshSuggestions();
    }
    async function maybeRefreshSuggestions(){
      const cache = loadCache();
      if(cache.lastHourKey !== currentHourKey()) await refreshSuggestions(false);
    }
    function setMeta(text){
      const meta = document.querySelector('.suite-suggestion-meta');
      if(meta) meta.textContent = text;
    }
    async function refreshSuggestions(manual){
      const cache = loadCache();
      if(manual && cache.lastManualRefreshAt && now() - cache.lastManualRefreshAt < MANUAL_REFRESH_COOLDOWN_MS){
        const left = Math.ceil((MANUAL_REFRESH_COOLDOWN_MS - (now() - cache.lastManualRefreshAt)) / 1000);
        setMeta('Ручное обновление будет доступно через ' + left + ' сек.');
        return;
      }
      setMeta('Обновляю...');
      try{
        const json = await apiGet('/api/suggestions?limit=200');
        const oldIds = new Set((cache.cards || []).map(card => String(card.card_id || card.cardId)));
        const cards = (json.cards || []).sort((a, b) => Number(b.card_id) - Number(a.card_id));
        const unread = cards.filter(card => !oldIds.has(String(card.card_id))).map(card => String(card.card_id));
        cache.cards = cards;
        cache.unreadIds = [...new Set([...(cache.unreadIds || []), ...unread])];
        cache.lastFetchedAt = now();
        cache.lastHourKey = currentHourKey();
        if(manual) cache.lastManualRefreshAt = now();
        saveCache(cache);
        renderSuggestions();
      }catch(error){
        setMeta('Сервер недоступен, показан кэш: ' + error.message);
      }
    }

    function renderSuggestions(){
      const cache = loadCache();
      const savedRank = String(cache.rank || '').toLowerCase();
      const rank = RANKS.includes(savedRank) ? savedRank : DEFAULT_RANK;
      const modal = document.getElementById('suite-suggestion-authors-modal');
      if(!modal) return;
      modal.querySelectorAll('.suite-suggestion-tab').forEach(tab => tab.classList.toggle('is-active', tab.dataset.rank === rank));
      const cards = (cache.cards || [])
        .filter(card => !rank || String(card.rank || '').toLowerCase() === rank)
        .sort((a, b) => Number(b.card_id) - Number(a.card_id));
      const grid = modal.querySelector('.suite-suggestion-grid');
      grid.innerHTML = cards.length ? cards.map(card => {
        const author = card.author || '';
        return `
          <div class="suite-suggestion-card" data-card-id="${escapeHtml(card.card_id)}">
            <img class="suite-suggestion-img" decoding="async" src="${escapeHtml(abs(card.image || card.image_url))}" alt="${escapeHtml(card.name || '')}">
            <div class="suite-suggestion-author">Автор:&nbsp;<a href="${escapeHtml(abs('/user/' + encodeURIComponent(author) + '/'))}" target="_blank" rel="noopener noreferrer">${escapeHtml(author)}</a></div>
          </div>`;
      }).join('') : '<div class="suite-suggestion-empty">' + (rank ? 'Карт этого ранга пока нет' : 'Карт пока нет') + '</div>';
      const date = cache.lastFetchedAt ? new Date(cache.lastFetchedAt).toLocaleString() : 'нет данных';
      setMeta(`Карт: ${cards.length}. Обновлено: ${date}`);
      document.getElementById('suite-suggestion-authors-button')?.removeAttribute('data-new');
    }

    function renderBadge(badge, { label, author, status }){
      badge.classList.toggle('suite-pending', !author && status !== 'not_found');
      badge.classList.toggle('suite-not-found', status === 'not_found');
      if(author){
        badge.innerHTML = '<span class="suite-author-badge__label">' + escapeHtml(label) + ':&nbsp;</span><a class="suite-author-badge__name" href="' + escapeHtml(abs('/user/' + encodeURIComponent(author) + '/')) + '" title="' + escapeHtml(author) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(author) + '</a>';
      }else if(status === 'not_found'){
        badge.textContent = label + ': не найдено';
      }else{
        badge.textContent = label + ': ищу';
      }
    }
    function ensureCreatedBadge(card, options = {}){
      const host = card?.closest('.anime-cards__item-wrapper,.anime-cards__item-wrapper-gl') || card?.parentElement;
      if(!host) return null;
      const cached = getCachedAuthorResult(card.dataset.id);
      const label = options.label || 'Автор';
      const author = options.author ?? cached?.author ?? '';
      const status = options.status ?? cached?.status ?? '';
      let badge = host.querySelector(':scope > .suite-author-badge.suite-server-author.suite-created-badge');
      if(!badge){
        badge = document.createElement('div');
        badge.className = 'suite-author-badge suite-server-author suite-created-badge';
        if(card.parentElement === host) card.insertAdjacentElement('afterend', badge);
        else host.insertBefore(badge, host.querySelector('.card-votes') || null);
      }else if(badge.previousElementSibling !== card && card.parentElement === host){
        card.insertAdjacentElement('afterend', badge);
      }
      renderBadge(badge, { label, author, status });
      return badge;
    }
    function ensureBadgeAfter(parent, afterNode, options){
      if(!parent) return null;
      const label = options?.label || 'Автор';
      const author = options?.author || '';
      const status = options?.status || '';
      const className = options?.className || 'suite-replace-badge';
      let badge = parent.querySelector(':scope > .suite-author-badge.suite-server-author.' + className);
      if(!badge){
        badge = document.createElement('div');
        badge.className = 'suite-author-badge suite-server-author ' + className;
        if(afterNode && afterNode.parentElement === parent) afterNode.insertAdjacentElement('afterend', badge);
        else parent.appendChild(badge);
      }
      renderBadge(badge, { label, author, status });
      return badge;
    }

    async function refreshCardsAuthors(){
      if(!isCardsPage()) return false;
      const keys = collectCardsPageKeys();
      if(!keys.length) return true;
      getCreatedCards().forEach(card => ensureCreatedBadge(card));
      document.querySelectorAll('.card-replace-vote').forEach(item => {
        const compare = item.querySelector('.card-replace-vote__compare,.card-replace-vote__cards');
        const cached = getCachedAuthorResult(replacementKey(item));
        ensureBadgeAfter(item, compare, { label:'Замена', author:cached?.author, status:cached?.status, className:'suite-replace-badge' });
      });
      try{
        const json = await apiGet('/api/results?keys=' + encodeURIComponent(keys.join(',')));
        saveAuthorResults(json.results || []);
        const byKey = new Map((json.results || []).map(row => [row.task_key, row]));
        let hasPending = false;
        getCreatedCards().forEach(card => {
          const result = byKey.get(card.dataset.id) || getCachedAuthorResult(card.dataset.id);
          if(!result || (!result.author && result.status !== 'not_found')) hasPending = true;
          ensureCreatedBadge(card, { label:'Автор', author:result?.author, status:result?.status });
        });
        document.querySelectorAll('.card-replace-vote').forEach(item => {
          const key = replacementKey(item);
          const result = byKey.get(key) || getCachedAuthorResult(key);
          if(!result || (!result.author && result.status !== 'not_found')) hasPending = true;
          const compare = item.querySelector('.card-replace-vote__compare,.card-replace-vote__cards');
          ensureBadgeAfter(item, compare, { label:'Замена', author:result?.author, status:result?.status, className:'suite-replace-badge' });
        });
        return hasPending;
      }catch(e){
        return true;
      }
    }

    function startCardsAuthorsPolling(){
      if(!isCardsPage() || state.cardsAuthorPollTimer || state.cardsAuthorRefreshRunning) return;
      const run = async () => {
        state.cardsAuthorRefreshRunning = true;
        try{
          const shouldContinue = await refreshCardsAuthors();
          state.cardsAuthorPollTimer = null;
          if(shouldContinue && isCardsPage()){
            state.cardsAuthorPollTimer = setTimeout(run, CARDS_AUTHOR_POLL_MS);
          }
        }finally{
          state.cardsAuthorRefreshRunning = false;
        }
      };
      run();
    }
    function scheduleCardsAuthorsRefresh(delay = 250){
      if(!isCardsPage()) return;
      clearTimeout(state.cardsAuthorObserveTimer);
      state.cardsAuthorObserveTimer = setTimeout(() => {
        if(!state.cardsAuthorPollTimer) startCardsAuthorsPolling();
      }, delay);
    }
    function startCardsAuthorsObserver(){
      if(!isCardsPage() || state.cardsAuthorObserver || !document.body) return;
      state.cardsAuthorObserver = new MutationObserver(() => scheduleCardsAuthorsRefresh(250));
      state.cardsAuthorObserver.observe(document.body, { childList:true, subtree:true });
    }

    injectStyle();
    ensureUi();
    renderSuggestions();
    maybeRefreshSuggestions();
    startCardsAuthorsPolling();
    startCardsAuthorsObserver();
    state.intervals.push(setInterval(maybeRefreshSuggestions, HOUR_MS));
  }

  // ============================================================
  //  АВТОЛУТ ГАЧИ КЛУБА
  // ============================================================

  function cleanupGachaAutoloot(){
    const state = window.__suiteGachaAutolootState;
    if(state || window.__suiteGachaAutolootInstalled) suiteTelemetryLog('gacha', 'module_cleanup', { hadState:!!state });
    if(state){
      try{ clearInterval(state.retryTimer); }catch(e){}
      try{ clearTimeout(state.scheduleTimer); }catch(e){}
      try{ clearInterval(state.lockRenewTimer); }catch(e){}
      (state.intervals || []).forEach(timer => { try{ clearInterval(timer); }catch(e){} });
      (state.listeners || []).forEach(item => {
        try{ item.target.removeEventListener(item.type, item.handler, item.options); }catch(e){}
      });
      try{ state.releaseTabLock?.(); }catch(e){}
      try{ state.gachaFrame?.remove(); }catch(e){}
    }
    document.getElementById('suite-gacha-autoloot-style')?.remove();
    document.querySelectorAll('.suite-gacha-title-tools,.suite-gacha-modal').forEach(el=>el.remove());
    window.__suiteGachaAutolootState = null;
    window.__suiteGachaAutolootInstalled = false;
  }

  function initGachaAutoloot(){
    if(!cfg.modGachaAutoloot) return;
    if(window.__suiteGachaAutolootInstalled) return;
    if(window.top && window.top !== window) return;
    window.__suiteGachaAutolootInstalled = true;

    const STORAGE_PREFIX = 'suite_gacha_autoloot_v1_';
    const MOSCOW_TZ = 'Europe/Moscow';
    const CHECK_HOUR = 21;
    const CHECK_MINUTE = 6;
    const RETRY_DELAY_MS = 5000;
    const AFTER_POST_DELAY_MS = 2200;
    const DEFAULT_CLUB_PATH = '/clubs/2/';
    const LOCK_TTL_MS = 15000;
    const LOCK_RENEW_MS = 5000;
    const TAB_ID_KEY = 'suite_gacha_autoloot_tab_id';
    const REWARDS = [
      { id:'Card_a', label:'Карта A' },
      { id:'Card_b', label:'Карта B' },
      { id:'Card_c', label:'Карта C' },
      { id:'Card_d', label:'Карта D' },
      { id:'Card_e', label:'Карта E' },
      { id:'Coins', label:'Монеты' },
      { id:'Exp', label:'Опыт' },
      { id:'Stars', label:'Звезды' },
      { id:'Stone', label:'Камень' },
    ];
    const state = {
      retryTimer:null,
      scheduleTimer:null,
      isRunning:false,
      gachaFrame:null,
      gachaFrameLoadPromise:null,
      lockRenewTimer:null,
      intervals:[],
      listeners:[],
      releaseTabLock:null
    };
    window.__suiteGachaAutolootState = state;

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const storageKey = name => `${STORAGE_PREFIX}${name}`;
    const on = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      state.listeners.push({ target, type, handler, options });
    };
    const TAB_ID = (() => {
      const saved = sessionStorage.getItem(TAB_ID_KEY);
      if(saved) return saved;
      const next = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(TAB_ID_KEY, next);
      return next;
    })();

    function getStoredJson(name, fallback){
      try{
        const raw = GM_getValue(storageKey(name), null);
        return raw ? JSON.parse(raw) : fallback;
      }catch(error){
        console.warn('[Suite Gacha] Не удалось прочитать настройки:', error);
        return fallback;
      }
    }
    function setStoredJson(name, value){ GM_setValue(storageKey(name), JSON.stringify(value)); }
    function getRewardSettings(){
      const saved = getStoredJson('reward_settings', {});
      const settings = {};
      for(const reward of REWARDS) settings[reward.id] = saved[reward.id] !== false;
      return settings;
    }
    function saveRewardSettings(settings){ setStoredJson('reward_settings', settings); }

    function getMoscowParts(date = new Date()){
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone:MOSCOW_TZ,
        year:'numeric',
        month:'2-digit',
        day:'2-digit',
        hour:'2-digit',
        minute:'2-digit',
        second:'2-digit',
        hour12:false
      }).formatToParts(date);
      const data = Object.fromEntries(parts.map(part => [part.type, part.value]));
      return {
        dateKey:`${data.year}-${data.month}-${data.day}`,
        hour:Number(data.hour),
        minute:Number(data.minute),
        second:Number(data.second)
      };
    }
    function hasMoscowTimeReached(){
      const now = getMoscowParts();
      return now.hour > CHECK_HOUR || (now.hour === CHECK_HOUR && now.minute >= CHECK_MINUTE);
    }
    function getMsUntilNextMoscowCheck(){
      const now = getMoscowParts();
      const nowSeconds = now.hour * 3600 + now.minute * 60 + now.second;
      const targetSeconds = CHECK_HOUR * 3600 + CHECK_MINUTE * 60;
      const secondsUntil = targetSeconds > nowSeconds ? targetSeconds - nowSeconds : 24 * 3600 - nowSeconds + targetSeconds;
      return secondsUntil * 1000;
    }
    function getTodayKey(){ return getMoscowParts().dateKey; }
    function getDailyState(){ return getStoredJson('daily_state', {}); }
    function setDailyState(value){ setStoredJson('daily_state', value); }
    function getTabLock(){ return getStoredJson('tab_lock', null); }
    function setTabLock(value){ setStoredJson('tab_lock', value); }
    function setStatus(text){
      console.log(`[Suite Gacha] ${text}`);
      suiteTelemetryLog('gacha', 'status', { text });
    }
    function notify(type, message){
      try{
        const push = getPageWindow().DLEPush;
        if(push && typeof push[type] === 'function') push[type](message);
        else if(typeof push === 'function') push(type, message);
      }catch(e){}
    }

    function startLockRenewal(){
      if(state.lockRenewTimer) return;
      state.lockRenewTimer = setInterval(() => {
        if(document.hidden){
          releaseTabLock();
          return;
        }
        const lock = getTabLock();
        if(lock?.owner === TAB_ID){
          setTabLock({ ...lock, expiresAt:Date.now() + LOCK_TTL_MS, updatedAt:new Date().toISOString(), url:location.href });
        }
      }, LOCK_RENEW_MS);
    }
    function acquireTabLock(){
      if(document.hidden){
        setStatus('Эта вкладка не активна, автолут здесь не запускаю.');
        return false;
      }
      const now = Date.now();
      const lock = getTabLock();
      if(lock && lock.owner !== TAB_ID && Number(lock.expiresAt) > now){
        setStatus('Автолут уже активен в другой вкладке AnimeSSS.');
        return false;
      }
      setTabLock({ owner:TAB_ID, expiresAt:now + LOCK_TTL_MS, updatedAt:new Date().toISOString(), url:location.href });
      const acquired = getTabLock()?.owner === TAB_ID;
      if(acquired) startLockRenewal();
      return acquired;
    }
    function releaseTabLock(){
      const lock = getTabLock();
      if(lock?.owner === TAB_ID){
        setTabLock({ owner:null, expiresAt:0, updatedAt:new Date().toISOString() });
      }
      if(state.lockRenewTimer){
        clearInterval(state.lockRenewTimer);
        state.lockRenewTimer = null;
      }
    }
    state.releaseTabLock = releaseTabLock;

    function isTodayFinished(){
      const daily = getDailyState();
      return daily.dateKey === getTodayKey() && ['looted', 'skipped'].includes(daily.status);
    }
    function markToday(status, details = {}){
      setDailyState({ dateKey:getTodayKey(), status, savedAt:new Date().toISOString(), ...details });
    }
    function parseNumber(text){
      const match = String(text || '').replace(/\s+/g, '').match(/\d+/);
      return match ? Number(match[0]) : null;
    }
    function parseLastNumber(text){
      const matches = String(text || '').replace(/\s+/g, '').match(/\d+/g);
      return matches?.length ? Number(matches[matches.length - 1]) : null;
    }
    function getUserHash(){ return suiteGetUserHash(); }
    function getGachaResultText(data){
      if(!data) return 'empty_response';
      return data.status || data.message || data.text || data.error || JSON.stringify(data);
    }
    function isSuccessfulGachaResponse(data){
      if(!data || typeof data !== 'object' || data.error) return false;
      const status = String(data.status || '').toLowerCase();
      if(['no_reward', 'no', 'error', 'fail', 'failed', 'parse_error'].includes(status)) return false;
      return status === 'ok' || status === 'success' || Boolean(data.reward_type) ||
        (data.step != null && Number.isFinite(Number(data.step)));
    }
    async function postGachaRewardOnce(userHash){
      const response = await fetch(`${location.origin}/gacha_reward/`, {
        method:'POST',
        credentials:'include',
        headers:{
          'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With':'XMLHttpRequest',
          'Accept':'application/json, text/javascript, */*; q=0.01'
        },
        body:new URLSearchParams({ user_hash:userHash }).toString()
      });
      const text = await response.text();
      let data;
      try{ data = JSON.parse(text); }
      catch(error){ data = { status:'parse_error', text:text || error.message }; }
      if(!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${getGachaResultText(data)}`);
        error.status = response.status;
        throw error;
      }
      return data;
    }
    async function postGachaReward(){
      let userHash = getUserHash();
      if(!userHash) throw new Error('user_hash not found');
      try {
        const data = await postGachaRewardOnce(userHash);
        if(!suiteIsUserHashError(JSON.stringify(data))) return data;
      } catch(error) {
        if(!suiteIsUserHashError(error?.message)) throw error;
      }
      const refreshedHash = await suiteRefreshUserHashFromServer();
      if(!refreshedHash || refreshedHash === userHash) throw new Error('Не удалось обновить user_hash');
      return postGachaRewardOnce(refreshedHash);
    }

    function getClubPath(){
      return DEFAULT_CLUB_PATH;
    }
    function isDefaultClubPage(){
      return location.pathname === DEFAULT_CLUB_PATH || location.pathname === DEFAULT_CLUB_PATH.slice(0, -1);
    }
    function getCurrentExp(doc = document){
      const levelInfoNodes = [...doc.querySelectorAll('.nclub-enter__lvl-info')];
      for(const node of levelInfoNodes){
        const text = node.textContent || '';
        if(text.includes('/') && /опыта/i.test(text)){
          const value = parseLastNumber(text.split('/')[0]);
          if(Number.isFinite(value)) return value;
        }
      }
      const rewards = doc.querySelector('.club__rewards');
      const fromDataset = parseNumber(rewards?.dataset?.enlightenment);
      return Number.isFinite(fromDataset) ? fromDataset : null;
    }
    function getGachaBlock(doc = document){
      return [...doc.querySelectorAll('.club__block')].find(block => {
        const title = block.querySelector('.club__title');
        return /Бесконечная\s+гача\s+наград/i.test(title?.textContent || '');
      });
    }
    function getRewardType(item){
      const image = item?.querySelector('[class*="club__rewards-item-image--"]');
      const match = String(image?.className || '').match(/club__rewards-item-image--([A-Za-z_]+)/);
      return match ? match[1] : null;
    }
    function getFirstReward(doc = document){
      const block = getGachaBlock(doc);
      const first = block?.querySelector('.club__rewards-item');
      if(!first) return null;
      return {
        item:first,
        type:getRewardType(first),
        step:parseNumber(first.dataset.step),
        need:parseNumber(first.dataset.need),
        isAvailable:first.classList.contains('is-available'),
        button:first.querySelector('#get-gacha-reward, [onclick*="GetGachaReward"]')
      };
    }
    function stopRetrying(){
      if(state.retryTimer){
        clearInterval(state.retryTimer);
        state.retryTimer = null;
      }
    }
    function startRetrying(){
      if(state.retryTimer || isTodayFinished()) return;
      setStatus('Опыта пока не хватает, проверяю каждые 5 секунд.');
      state.retryTimer = setInterval(() => runDailyCheck('retry'), RETRY_DELAY_MS);
    }
    function getFrameDocument(){
      try{ return state.gachaFrame?.contentDocument || null; }
      catch(error){
        console.warn('[Suite Gacha] Нет доступа к фоновой странице клуба:', error);
        return null;
      }
    }
    function createHiddenGachaFrame(){
      if(state.gachaFrame) return;
      state.gachaFrame = document.createElement('iframe');
      state.gachaFrame.id = 'suite-gacha-hidden-club-frame';
      state.gachaFrame.title = 'AnimeSSS gacha background frame';
      state.gachaFrame.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;opacity:0;pointer-events:none;border:0;';
      document.documentElement.append(state.gachaFrame);
    }
    function loadGachaFrame(){
      createHiddenGachaFrame();
      const targetUrl = `${location.origin}${getClubPath()}`;
      const currentFrameDocument = getFrameDocument();
      if(state.gachaFrame.src === targetUrl && currentFrameDocument && getGachaBlock(currentFrameDocument)) {
        return Promise.resolve(currentFrameDocument);
      }
      if(state.gachaFrameLoadPromise) return state.gachaFrameLoadPromise;
      state.gachaFrameLoadPromise = new Promise(resolve => {
        const finish = () => {
          state.gachaFrameLoadPromise = null;
          resolve(getFrameDocument());
        };
        state.gachaFrame.addEventListener('load', finish, { once:true });
        state.gachaFrame.src = targetUrl;
        setTimeout(finish, 12000);
      });
      return state.gachaFrameLoadPromise;
    }
    async function fetchClubDocument(){
      const response = await fetch(`${location.origin}${getClubPath()}`, { credentials:'include', cache:'no-store' });
      if(!response.ok) throw new Error(`Club page HTTP ${response.status}`);
      const html = await response.text();
      if(/<form[^>]+(?:login|auth)|name=["']login["']/i.test(html)) throw new Error('Club page returned login form');
      return new DOMParser().parseFromString(html, 'text/html');
    }
    async function getSnapshotDocument(){
      if(isDefaultClubPage() && getGachaBlock(document)) return document;
      try{ return await fetchClubDocument(); }
      catch(error){
        console.warn('[Suite Gacha] Не удалось тихо прочитать страницу клуба, пробую iframe:', error);
        const frameDoc = await loadGachaFrame();
        if(frameDoc && getGachaBlock(frameDoc)) return frameDoc;
        if(isDefaultClubPage() && getGachaBlock(document)) return document;
        throw new Error('Default club gacha page is unavailable');
      }
    }

    async function runDailyCheck(reason = 'schedule'){
      if(state.isRunning || isTodayFinished() || !cfg.modGachaAutoloot) return;
      if(reason === 'schedule' && !hasMoscowTimeReached()) return;
      if(!acquireTabLock()) return;
      state.isRunning = true;
      suiteTelemetryLog('gacha', 'check_started', { reason, today:getTodayKey(), page:location.pathname });
      try{
        const settings = getRewardSettings();
        const snapshotDoc = await getSnapshotDocument();
        const currentExp = getCurrentExp(snapshotDoc);
        const reward = getFirstReward(snapshotDoc);
        suiteTelemetryLog('gacha', 'snapshot_parsed', {
          reason,
          source:snapshotDoc === document ? 'current_page' : 'background',
          currentExp,
          reward:reward ? { type:reward.type, step:reward.step, need:reward.need, isAvailable:reward.isAvailable } : null,
          settings
        });
        if(!reward){
          startRetrying();
          setStatus('Первая гача не найдена. Подожду обновления страницы.');
          return;
        }
        if(!Number.isFinite(currentExp) || !Number.isFinite(reward.need)){
          setStatus('Не смог прочитать опыт или требование первой награды.');
          return;
        }
        const rewardLabel = REWARDS.find(item => item.id === reward.type)?.label || reward.type || 'неизвестная награда';
        if(currentExp < reward.need){
          markToday('waiting', { currentExp, need:reward.need, step:reward.step, rewardType:reward.type });
          startRetrying();
          return;
        }
        if(!reward.type || settings[reward.type] === false){
          stopRetrying();
          markToday('skipped', { currentExp, need:reward.need, step:reward.step, rewardType:reward.type });
          setStatus(`Сегодня пропуск: ${rewardLabel} выключена в выборе наград.`);
          return;
        }
        if(!reward.isAvailable){
          setStatus('Опыт хватает, но первая награда еще не стала доступной.');
          startRetrying();
          return;
        }
        setStatus(`Лутаю первую награду: ${rewardLabel}, шаг ${reward.step}.`);
        const response = await postGachaReward();
        const responseText = getGachaResultText(response);
        suiteTelemetryLog('gacha', 'reward_response', {
          requested:{ type:reward.type, step:reward.step, need:reward.need, currentExp },
          response,
          responseText,
          successful:isSuccessfulGachaResponse(response)
        });
        await sleep(AFTER_POST_DELAY_MS);
        if(!isSuccessfulGachaResponse(response)){
          markToday('waiting', { currentExp, need:reward.need, step:reward.step, rewardType:reward.type, serverResponse:responseText });
          setStatus(`Сервер не выдал гачу: ${responseText}. Продолжаю проверять.`);
          startRetrying();
          return;
        }
        stopRetrying();
        markToday('looted', {
          lootedCount:1,
          currentExp,
          need:reward.need,
          step:reward.step,
          rewardType:reward.type,
          serverRewardType:response.reward_type || null,
          serverStep:response.step || null,
          serverResponse:responseText
        });
        notify('success', responseText);
      }catch(error){
        const message = error?.message || String(error);
        suiteTelemetryLog('gacha', 'check_failed', { reason, error:message }, 'error');
        markToday('waiting', { error:message });
        setStatus(`Ошибка автолута гачи: ${message}. Продолжаю проверять.`);
        startRetrying();
      }finally{
        suiteTelemetryLog('gacha', 'check_finished', { reason, dailyState:getDailyState() });
        state.isRunning = false;
        releaseTabLock();
      }
    }
    function scheduleNextCheck(){
      if(state.scheduleTimer) clearTimeout(state.scheduleTimer);
      const delay = getMsUntilNextMoscowCheck();
      state.scheduleTimer = setTimeout(() => {
        runDailyCheck('schedule');
        scheduleNextCheck();
      }, Math.max(1000, delay));
    }

    function injectStyles(){
      if(document.getElementById('suite-gacha-autoloot-style')) return;
      const style = document.createElement('style');
      style.id = 'suite-gacha-autoloot-style';
      style.textContent = `
        .club__title:has(.suite-gacha-title-tools){display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;box-sizing:border-box;}
        .suite-gacha-title-tools{display:inline-flex;align-items:center;gap:10px;margin-left:auto;vertical-align:middle;}
        .suite-gacha-settings-btn{
          border:1px solid rgba(56,189,248,.36);border-radius:10px;padding:7px 11px;
          color:#e0f2fe;background:linear-gradient(135deg,rgba(8,47,73,.92),rgba(15,23,42,.92));
          cursor:pointer;font:850 12px/1 "Segoe UI",Arial,sans-serif;
          box-shadow:0 0 0 1px rgba(14,165,233,.12),0 0 16px rgba(14,165,233,.14);
        }
        .suite-gacha-settings-btn:hover{filter:brightness(1.08);border-color:rgba(125,211,252,.55);}
        .suite-gacha-modal{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(2,6,23,.66);font-family:"Segoe UI",Arial,sans-serif;}
        .suite-gacha-dialog{
          width:min(380px,100%);max-height:calc(100dvh - 40px);border:1px solid rgba(56,189,248,.34);border-radius:14px;padding:0;overflow:hidden;
          color:#e0f2fe;background:linear-gradient(180deg,rgba(8,20,38,.98),rgba(7,16,30,.96));
          box-shadow:0 24px 80px rgba(0,0,0,.58),0 0 28px rgba(14,165,233,.14);
          display:flex;flex-direction:column;
        }
        .suite-gacha-dialog__head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 15px;background:linear-gradient(135deg,rgba(14,116,144,.42),rgba(15,23,42,.92));border-bottom:1px solid rgba(56,189,248,.22);}
        .suite-gacha-dialog__title{font-size:16px;font-weight:950;color:#f8fafc;}
        .suite-gacha-close{width:32px;height:32px;border-radius:9px;border:1px solid rgba(56,189,248,.24);color:#dbeafe;background:rgba(15,23,42,.72);cursor:pointer;font-size:20px;line-height:1;}
        .suite-gacha-close:hover{background:rgba(30,64,175,.38);border-color:rgba(125,211,252,.46);}
        .suite-gacha-reward-list{display:grid;gap:7px;padding:13px 15px 15px;overflow-y:auto;overscroll-behavior:contain;}
        .suite-gacha-reward-row{
          display:flex;align-items:center;justify-content:space-between;gap:12px;border-radius:10px;padding:9px 10px;
          border:1px solid rgba(56,189,248,.13);background:rgba(8,47,73,.28);cursor:pointer;color:#dbeafe;font-size:13px;font-weight:750;
        }
        .suite-gacha-reward-row:hover{background:rgba(14,116,144,.24);border-color:rgba(56,189,248,.26);}
      `;
      document.head.append(style);
    }

    function createRewardPanel(){
      const existing = document.querySelector('.suite-gacha-modal');
      if(existing){
        existing.remove();
        return;
      }
      const settings = getRewardSettings();
      const backdrop = document.createElement('div');
      backdrop.className = 'suite-gacha-modal';
      backdrop.innerHTML = `
        <div class="suite-gacha-dialog" role="dialog" aria-modal="true">
          <div class="suite-gacha-dialog__head">
            <div class="suite-gacha-dialog__title">Выбор награды</div>
            <button type="button" class="suite-gacha-close" aria-label="Закрыть">×</button>
          </div>
          <div class="suite-gacha-reward-list"></div>
        </div>
      `;
      const list = backdrop.querySelector('.suite-gacha-reward-list');
      for(const reward of REWARDS){
        const row = document.createElement('label');
        row.className = 'suite-gacha-reward-row';
        row.innerHTML = `
          <span>${reward.label}</span>
          <label class="suite-toggle">
            <input type="checkbox" data-reward="${reward.id}" ${settings[reward.id] ? 'checked' : ''}>
            <span class="suite-slider"></span>
          </label>
        `;
        list.append(row);
      }
      on(backdrop, 'click', event => {
        if(event.target === backdrop || event.target.closest('.suite-gacha-close')) backdrop.remove();
      });
      on(backdrop, 'change', event => {
        const checkbox = event.target.closest('input[data-reward]');
        if(!checkbox) return;
        const nextSettings = getRewardSettings();
        nextSettings[checkbox.dataset.reward] = checkbox.checked;
        saveRewardSettings(nextSettings);
        setStatus('Выбор наград сохранен.');
      });
      document.body.append(backdrop);
    }

    function removeControls(){
      document.querySelectorAll('.suite-gacha-title-tools,.suite-gacha-modal').forEach(el => el.remove());
    }

    function injectControls(){
      if(!isDefaultClubPage()){
        removeControls();
        return false;
      }
      const block = getGachaBlock(document);
      const title = block?.querySelector('.club__title');
      if(!title || title.querySelector('.suite-gacha-title-tools')) return false;
      injectStyles();
      title.style.display = 'flex';
      title.style.alignItems = 'center';
      title.style.justifyContent = 'space-between';
      title.style.gap = '12px';
      title.style.width = '100%';
      title.style.boxSizing = 'border-box';
      const tools = document.createElement('span');
      tools.className = 'suite-gacha-title-tools';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'suite-gacha-settings-btn';
      button.textContent = 'Выбор награды';
      on(button, 'click', createRewardPanel);
      tools.append(button);
      title.append(tools);
      return true;
    }

    injectStyles();
    injectControls();
    scheduleNextCheck();
    if(hasMoscowTimeReached() && !isTodayFinished()) runDailyCheck('schedule');
    if(isDefaultClubPage()) state.intervals.push(setInterval(injectControls, 2000));
    on(document, 'visibilitychange', () => {
      if(document.hidden){
        releaseTabLock();
        return;
      }
      if(hasMoscowTimeReached() && !isTodayFinished()) runDailyCheck('visible-tab');
    });
  }

  // ============================================================
  //  НАПОЛНЕНИЕ КИРПИЧА
  // ============================================================


  // ============================================================
  //  КАМНИ
  // ============================================================

  function initStones(){
    if(!cfg.modStones) return;
    if(window.__suiteStonesInstalled) return;
    window.__suiteStonesInstalled=true;
    injectStonesStyle();
  if (!location.pathname.startsWith('/shop')) return;

  /*** Ключи ***/
  const CACHE_KEY = `animestars_transactions_cache`;
  const DATE_KEY = `animestars_transactions_lastDate`;
  const LAST_UPDATE_KEY = `animestars_transactions_lastUpdate`;
  const EXTRA_KEY = 'nonPackSpentStones';
  const STONES_EXTRA_POS_KEY = 'suite_stones_extra_panel_pos_v1';

  function injectStonesStyle(){
    if(document.getElementById('cv-stones-style')) return;
    const s=document.createElement('style');
    s.id='cv-stones-style';
    s.textContent=`
      .cv-stones-panel{
        position:fixed;top:calc(50% + 80px);right:20px;width:180px;
        background:rgba(12,12,22,.98);color:#e2e8f0;border-radius:12px;
        z-index:999;font-family:'Segoe UI',Arial,sans-serif;font-size:13px;
        text-align:center;border:1px solid rgba(255,255,255,.09);
        box-shadow:0 8px 40px rgba(0,0,0,.7);overflow:hidden;user-select:none;
        display:flex;flex-direction:column;gap:8px;padding-bottom:10px;
      }
      .cv-stones-panel__header{
        padding:9px 12px;background:linear-gradient(90deg,#164e63,#0891b2);
        color:#fff;font-weight:700;font-size:13px;cursor:move;text-align:left;
      }
      .cv-stones-panel__body{padding:10px 12px;display:flex;flex-direction:column;gap:8px;}
      .cv-stones-panel__total{display:flex;justify-content:center;align-items:center;gap:8px;}
      .cv-stones-panel__value{font-size:18px;font-weight:800;color:#67e8f9;}
      .cv-stones-input{
        width:calc(100% - 24px);margin:0 12px;box-sizing:border-box;border:1px solid #164e63;border-radius:8px;
        background:#0f172a;color:#e2e8f0;padding:7px 8px;font-size:12px;outline:none;
      }
      .cv-stones-mini-btn{
        border:1px solid #164e63;border-radius:8px;background:#0f172a;color:#67e8f9;
        min-width:30px;height:30px;cursor:pointer;font-weight:800;transition:background .15s,border-color .15s,transform .15s;
      }
      .cv-stones-panel > .cv-stones-mini-btn{width:calc(100% - 24px);margin:0 12px;}
      .cv-stones-mini-btn:hover{background:#123044;border-color:#0891b2;transform:translateY(-1px);}
      .cv-stones-floating-btn{
        position:fixed;top:50%;right:20px;transform:translateY(-50%);z-index:999;
        width:52px;height:52px;border-radius:14px;border:1px solid rgba(34,211,238,.45);
        background:rgba(12,12,22,.96);color:#67e8f9;font-size:24px;cursor:pointer;
        box-shadow:0 8px 28px rgba(0,0,0,.55);backdrop-filter:blur(6px);
        transition:background .15s,border-color .15s,transform .15s,filter .15s;
      }
      .cv-stones-floating-btn:hover{background:#123044;border-color:#22d3ee;filter:brightness(1.08);}
      .cv-stones-progress{
        position:fixed;right:20px;bottom:24px;z-index:2147483600;
        max-width:min(360px,calc(100vw - 40px));box-sizing:border-box;
        background:rgba(12,12,22,.98);color:#e2e8f0;padding:9px 14px;border-radius:12px;
        font-size:13px;font-family:'Segoe UI',Arial,sans-serif;display:none;
        border:1px solid rgba(34,211,238,.35);box-shadow:0 8px 32px rgba(0,0,0,.65);
      }
    `;
    document.head.appendChild(s);
  }

  function loadStonesPanelPos(){return gmStoreGet(STONES_EXTRA_POS_KEY, null);}
  function saveStonesPanelPos(left,top){gmStoreSet(STONES_EXTRA_POS_KEY,{left,top});}

  /*** Утилиты ***/
  const DAY_MS = 24 * 60 * 60 * 1000;

  function parseDateSafe(raw) {
    if (!raw || typeof raw !== 'string') return 0;
    const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return 0;
    const [, d, mo, y, h, mi, s] = m;
    return new Date(+y, +mo - 1, +d, +h, +mi, s ? +s : 0).getTime();
  }

  async function save(key, val) { await GM.setValue(key, val); }
  async function load(key, def) { return GM.getValue(key, def); }
  async function saveJSON(key, obj) { await save(key, JSON.stringify(obj)); }
  async function loadJSON(key, def = []) {
    try { return JSON.parse(await load(key, JSON.stringify(def))); } catch { return def; }
  }

  async function robustFetch(url, opts = {}, retries = 3, baseDelay = 600) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const resp = await fetch(url, opts);
        if (resp.ok) return resp;
        if (![429, 500, 502, 503, 504].includes(resp.status)) {
          throw new Error(`HTTP ${resp.status} for ${url}`);
        }
      } catch (e) {
        if (attempt === retries) throw e;
      }
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 300;
      await new Promise(r => setTimeout(r, delay));
    }
    throw new Error('robustFetch exhausted retries');
  }

  function parseTransactions(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const rows = [...doc.querySelectorAll('.table-responsive.ncard-transactions__table tbody tr.new-tr-item')];
    return rows.map(row => {
      const amountText = row.querySelector('.new-tr-amount span')?.textContent?.trim() ?? '+0';
      const amount = parseInt(amountText.replace(/[^\d\-+]/g, ''), 10) || 0;
      const dayPart = row.querySelectorAll('.new-tr-date')[0]?.textContent?.trim() ?? '';
      const datePart = row.querySelectorAll('.new-tr-date')[1]?.textContent?.trim() ?? '';
      const dateStr = datePart || dayPart;
      const description = row.querySelector('td:last-child')?.textContent?.trim() ?? '';
      const date = parseDateSafe(dateStr);
      return { amount, date, description };
    }).filter(t => t.date > 0);
  }

  async function fetchPage(pageNum) {
    const url = `/transactions/page/${pageNum}/`;
    const resp = await robustFetch(url);
    const text = await resp.text();
    const data = parseTransactions(text);

    const spent = data.filter(t => t.amount < 0);
    const earned = data.filter(t => t.amount > 0);
    const spentSum = spent.reduce((s, t) => s + Math.abs(t.amount), 0);
    const earnedSum = earned.reduce((s, t) => s + t.amount, 0);

    return data;
  }

  async function getMaxPageCount() {
    try {
      const resp = await robustFetch('/transactions/');
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const anchors = [...doc.querySelectorAll('#pagination a[href*="/transactions/page/"]')];
      let max = 1;
      for (const a of anchors) {
        const m = a.getAttribute('href')?.match(/page\/(\d+)/);
        if (m) {
          const n = +m[1];
          if (n > max) max = n;
        }
      }
      return max || 1;
    } catch (e) {
      console.warn('Не удалось определить количество страниц, используем 1', e);
      return 1;
    }
  }

  function calculateTotals(transactions) {
    let earned = 0, spent = 0;
    for (const tr of transactions) {
      if (tr.amount > 0) earned += tr.amount; else spent += -tr.amount;
    }
    return { earned, spent };
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function updateCacheIncremental({ showProgress = null, maxPages = 1000, forceFull = false, onTotals = null } = {}) {
    const [lastUpdate, cached, knownLatestDate] = await Promise.all([
      load(LAST_UPDATE_KEY, '0').then(Number),
      loadJSON(CACHE_KEY, []),
      load(DATE_KEY, '0').then(Number),
    ]);

    const now = Date.now();

    if (!forceFull && now - lastUpdate < DAY_MS && cached.length > 0) {
      onTotals?.(calculateTotals(cached));
      return cached;
    }

    let earned = 0, spent = 0;
    for (const tr of cached) {
      if (tr.amount > 0) earned += tr.amount; else spent += -tr.amount;
    }

    let page = 1;
    let newEntries = [];
    let stop = false;

    while (!stop && page <= maxPages) {
      let transactions = [];
      try {
        transactions = await fetchPage(page);
        if (transactions.length === 0) break;
      } catch (e) {
        console.error('Ошибка загрузки страницы транзакций:', e);
        break;
      }

      for (const tr of transactions) {
        if (!forceFull && tr.date <= knownLatestDate) { stop = true; break; }
        newEntries.push(tr);
        if (tr.amount > 0) earned += tr.amount; else spent += -tr.amount;
      }

      onTotals?.({ earned, spent });

      if (typeof showProgress === 'function' && forceFull) showProgress(page, maxPages);

      if (stop) break;
      page++;
      await sleep(900 + Math.random() * 300);
    }

    const uniq = new Map();
    for (const tr of [...newEntries, ...cached]) {
      const key = `${tr.date}|${tr.amount}|${tr.description}`;
      if (!uniq.has(key)) uniq.set(key, tr);
    }

    const merged = [...uniq.values()].sort((a, b) => b.date - a.date);

    await Promise.all([
      saveJSON(CACHE_KEY, merged),
      save(DATE_KEY, (merged[0]?.date ?? 0).toString()),
      save(LAST_UPDATE_KEY, now.toString()),
    ]);

    return merged;
  }

  /**
   * Клонирует <div class="diamond"> прямо со страницы, чтобы получить
   * тот же элемент с теми же CSS-стилями (background-image и т.д.),
   * что отображается в блоке "Ваши камни".
   * Если на странице алмаза нет — возвращает null.
   */
  function cloneDiamond() {
    const source = document.querySelector('.diamond');
    if (!source) return null;
    const clone = source.cloneNode(true);
    // Сбрасываем позиционирование оригинала
    clone.style.position = 'static';
    clone.style.margin = '0';
    clone.style.marginLeft = '8px';
    clone.style.flexShrink = '0';
    // Масштабируем под fontSize родителя (2em): берём computed-размер оригинала
    // и увеличиваем в 2 раза, чтобы алмаз не выглядел мелким
    const srcSize = getComputedStyle(source);
    const w = parseFloat(srcSize.width);
    const h = parseFloat(srcSize.height);
    if (w && h) {
      clone.style.width  = `${w * 2}px`;
      clone.style.height = `${h * 2}px`;
    }
    // Не трогаем filter и цвет — алмаз остаётся точно таким же, как на сайте
    clone.style.filter = '';
    return clone;
  }

  /**
   * Создаёт блок отображения суммы (earned или spent).
   * Алмаз берётся клонированием из DOM страницы.
   * При необходимости перекрашивается через CSS filter.
   */
  function createSideDiv(className, text, color) {
    const div = document.createElement('div');
    div.className = className;
    Object.assign(div.style, {
      display: 'inline-flex',
      alignItems: 'center',
      fontWeight: 'bold',
      fontSize: '2em',
      userSelect: 'none',
      color,
    });

    const span = document.createElement('span');
    span.textContent = text;
    span.style.color = color;
    div.appendChild(span);

    const diamond = cloneDiamond();
    if (diamond) {
      div.appendChild(diamond);
    } else {
      // Запасной вариант, если .diamond не найден в DOM
      const fallback = document.createElement('span');
      fallback.textContent = '💎';
      fallback.style.marginLeft = '5px';
      fallback.style.fontSize = '0.8em';
      div.appendChild(fallback);
    }

    return div;
  }

  function mountProgressBox() {
    const el = document.createElement('div');
    el.className = 'cv-stones-progress';
    document.body.appendChild(el);
    return el;
  }

  function showStonesProgress(el, text) {
    if(!el) return;
    el.style.display = 'block';
    el.textContent = text;
  }

  function hideStonesProgress(el, delay = 800) {
    if(!el) return;
    setTimeout(() => { el.style.display = 'none'; }, delay);
  }

  /** Блокирует кнопку на время async-операции, исключая двойной клик */
  function withButtonLock(btn, asyncFn) {
    return async (...args) => {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      try {
        await asyncFn(...args);
      } finally {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      }
    };
  }

  async function main() {
    try {
      const container = document.querySelector('.ncard-shop__text.lootbox__descr.d-flex.fd-column.r-gap-20');
      if (!container) return;
      const captionBlock = container.querySelector('.ncard-shop__text-main.lootbox__descr-section.ta-center');
      if (!captionBlock) return;

      const flexWrapper = document.createElement('div');
      flexWrapper.className = 'cv-stones-summary-row';
      Object.assign(flexWrapper.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' });
      captionBlock.style.flex = '1';
      captionBlock.style.textAlign = 'center';
      container.insertBefore(flexWrapper, container.firstChild);
      flexWrapper.appendChild(captionBlock);

      const progressBox = mountProgressBox();

      const earnedDiv = createSideDiv('earned-diamonds', `+0`, 'rgb(76, 175, 80)');
      const spentDiv = createSideDiv('spent-diamonds', `-0`, 'rgb(244, 67, 54)');
      flexWrapper.insertBefore(earnedDiv, captionBlock);
      flexWrapper.appendChild(spentDiv);

      const updateTotalsUI = (totals) => {
        earnedDiv.querySelector('span').textContent = `+${totals.earned}`;
        spentDiv.querySelector('span').textContent = `-${totals.spent}`;
      };

      const refreshBtn = document.createElement('button');
      refreshBtn.innerHTML = '🔄';
      refreshBtn.className = 'cv-stones-floating-btn';
      refreshBtn.title = 'Сбросить и пересчитать кэш';

      // Вся логика клика обёрнута в withButtonLock — двойной клик невозможен
      refreshBtn.addEventListener('click', withButtonLock(refreshBtn, async () => {
        try {
          showStonesProgress(progressBox, 'ИДЕТ ПОДСЧЕТ КАМНЕЙ');

          await Promise.all([
            save(CACHE_KEY, '[]'),
            save(DATE_KEY, '0'),
            save(LAST_UPDATE_KEY, (Date.now() - 2 * DAY_MS).toString()),
          ]);

          const maxPages = await getMaxPageCount();
          await updateCacheIncremental({
            showProgress: (page, total) => { showStonesProgress(progressBox, `Подсчитано: ${page} / ${total}`); },
            maxPages,
            forceFull: true,
            onTotals: updateTotalsUI,
          });
        } catch (e) {
          console.error(e);
          showStonesProgress(progressBox, 'Ошибка подсчета камней');
        } finally {
          hideStonesProgress(progressBox);
        }
      }));

      document.body.appendChild(refreshBtn);
      suiteKeepInViewport(refreshBtn, {margin:8, constrainSize:false});

      showStonesProgress(progressBox, 'ИДЕТ ПОДСЧЕТ КАМНЕЙ');
      const maxPages = await getMaxPageCount();
      const transactions = await updateCacheIncremental({ maxPages, forceFull: false, onTotals: updateTotalsUI });
      hideStonesProgress(progressBox, 300);
      updateTotalsUI(calculateTotals(transactions));

      const extraBox = document.createElement('div');
      extraBox.className = 'cv-stones-panel';

      const extraTitle = document.createElement('div');
      extraTitle.textContent = 'Потрачено не на паки';
      extraTitle.className = 'cv-stones-panel__header';
      extraBox.appendChild(extraTitle);

      const totalWrapper = document.createElement('div');
      totalWrapper.className = 'cv-stones-panel__total';

      const extraTotal = document.createElement('div');
      extraTotal.className = 'cv-stones-panel__value';
      extraTotal.textContent = '0';
      totalWrapper.appendChild(extraTotal);

      const resetBtn = document.createElement('button');
      resetBtn.textContent = '🗑';
      resetBtn.className = 'cv-stones-mini-btn';
      resetBtn.title = 'Обнулить значение';
      totalWrapper.appendChild(resetBtn);

      extraBox.appendChild(totalWrapper);

      const input = document.createElement('input');
      input.type = 'number';
      input.placeholder = 'Введите число';
      input.className = 'cv-stones-input';
      extraBox.appendChild(input);

      const addBtn = document.createElement('button');
      addBtn.textContent = '+';
      addBtn.className = 'cv-stones-mini-btn';
      extraBox.appendChild(addBtn);

      document.body.appendChild(extraBox);
      const savedStonesPos=loadStonesPanelPos();
      if(savedStonesPos){
        extraBox.style.right='auto';
        extraBox.style.left=savedStonesPos.left+'px';
        extraBox.style.top=savedStonesPos.top+'px';
      }
      makeDraggable(extraBox,extraTitle,saveStonesPanelPos);

      async function loadExtra() { extraTotal.textContent = String(+await load(EXTRA_KEY, '0') || 0); }
      async function addExtra() {
        const current = +await load(EXTRA_KEY, '0') || 0;
        const toAdd = parseInt(input.value, 10) || 0;
        const newVal = current + toAdd;
        await save(EXTRA_KEY, newVal.toString());
        extraTotal.textContent = String(newVal);
        input.value = '';
      }
      async function resetExtra() { await save(EXTRA_KEY, '0'); extraTotal.textContent = '0'; }

      addBtn.addEventListener('click', addExtra);
      resetBtn.addEventListener('click', resetExtra);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') addExtra(); });

      loadExtra();
    } catch (e) {
      console.error('Ошибка в основном скрипте:', e);
    }
  }

  main();
  }

  function cleanupStonesUi(){
    const container = document.querySelector('.ncard-shop__text.lootbox__descr.d-flex.fd-column.r-gap-20');
    const captionBlock = container?.querySelector('.ncard-shop__text-main.lootbox__descr-section.ta-center');
    const parent = captionBlock?.parentElement;
    if(container && captionBlock && parent && parent !== container){
      container.insertBefore(captionBlock, container.firstChild);
      if(!parent.querySelector('.earned-diamonds,.spent-diamonds,.cv-stones-summary-row *')) parent.remove();
    }
    document.querySelectorAll('.earned-diamonds,.spent-diamonds').forEach(el=>el.remove());
    document.querySelectorAll('.cv-stones-summary-row').forEach(el=>{
      if(!el.querySelector('.ncard-shop__text-main.lootbox__descr-section.ta-center')) el.remove();
    });
    document.getElementById('cv-stones-style')?.remove();
    document.querySelectorAll('.cv-stones-panel,.cv-stones-floating-btn,.cv-stones-progress').forEach(el=>el.remove());
    window.__suiteStonesInstalled = false;
  }

  // ============================================================
  //  АВТОЛУТ КАМНЯ ИЗ ЧАТА
  // ============================================================

  function cleanupChatStoneAutoloot(){
    const state = window.__suiteChatStoneAutolootState;
    if(state || window.__suiteChatStoneAutolootInstalled) {
      suiteTelemetryLog('chat_stone', 'module_cleanup', { hadState:!!state, queueSize:state?.queueSize || 0 });
    }
    if(state){
      (state.timers || []).forEach(timer => { try{ clearInterval(timer); }catch(e){} });
      try{ state.verifyTimer && clearTimeout(state.verifyTimer); }catch(e){}
      try{ state.observer?.disconnect(); }catch(e){}
      (state.listeners || []).forEach(id => { try{ GM_removeValueChangeListener(id); }catch(e){} });
      (state.windowEvents || []).forEach(item => {
        try{ window.removeEventListener(item.type, item.handler); }catch(e){}
      });
      try{ state.releaseLeader?.(); }catch(e){}
      try{
        if(state.hookedFetch && state.originalFetch && getPageWindow().fetch === state.hookedFetch) getPageWindow().fetch = state.originalFetch;
      }catch(e){}
      try{
        const proto = state.xhrPrototype;
        if(proto && state.hookedXhrOpen && proto.open === state.hookedXhrOpen) proto.open = state.originalXhrOpen;
        if(proto && state.hookedXhrSend && proto.send === state.hookedXhrSend) proto.send = state.originalXhrSend;
        if(proto) delete proto.__suiteChatStoneHooked;
      }catch(e){}
    }
    window.__suiteChatStoneAutolootState = null;
    window.__suiteChatStoneAutolootInstalled = false;
  }

  function initChatStoneAutoloot(){
    if(!cfg.modChatStoneAutoloot) return;
    if(window.__suiteChatStoneAutolootInstalled) return;
    window.__suiteChatStoneAutolootInstalled = true;

    const uw = getPageWindow();
    const TAB_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const KEYS = {
      lock:'suite_chat_stone_leader_lock_v1',
      seen:'suite_chat_stone_seen_message_ids_v1',
      history:'suite_chat_stone_history_v1',
      verified:'suite_chat_stone_verified_transactions_v1',
      baselineReady:'suite_chat_stone_transactions_baseline_ready_v1',
      lastChatActivity:'suite_chat_stone_last_chat_activity_v1',
      lastOnlinePing:'suite_chat_stone_last_online_ping_v1'
    };
    const LIMIT = 10;
    const DEFAULTS = {
      chatIdleMs:60000,
      watchdogMs:3000,
      onlinePingMs:60000,
      queueIntervalMs:10000,
      lockTtlMs:25000,
      lockRenewMs:5000,
      verifyDelayMs:3000,
      rateLimitPauseMs:60000
    };
    const EMPTY_RESULT_RE = /(К сожалению\s+вы\s+опоздали|данный\s+камень\s+больше\s+не\s+активн|Тут\s+уже\s+пусто|приятного\s+просмотра)/i;
    const state = {
      accountKey:'site',
      isLeader:false,
      pausedUntil:0,
      lastChatActivity:0,
      seen:new Set(),
      inFlight:new Set(),
      queued:new Set(),
      collectChain:Promise.resolve(),
      queueSize:0,
      observer:null,
      timers:[],
      listeners:[],
      windowEvents:[],
      verifyTimer:null,
      snapshotInFlight:false,
      originalFetch:null,
      hookedFetch:null,
      xhrPrototype:null,
      originalXhrOpen:null,
      originalXhrSend:null,
      hookedXhrOpen:null,
      hookedXhrSend:null,
      userHash:'',
      ready:false,
      releaseLeader:null
    };
    window.__suiteChatStoneAutolootState = state;

    const log = (...args) => console.log('[Suite Chat Stone]', ...args);
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const normalizeText = text => String(text || '').replace(/\s+/g, ' ').trim();
    const rawKey = key => `suite-chat-stone:${location.host}:${key}`;
    const scopedKey = key => `suite-chat-stone:${location.host}:${state.accountKey}:${key}`;
    const getRaw = (key, fallback) => gmStoreGet(rawKey(key), fallback);
    const setRaw = (key, value) => gmStoreSet(rawKey(key), value);
    const delRaw = key => gmStoreDelete(rawKey(key));
    const getScoped = (key, fallback) => gmStoreGet(scopedKey(key), fallback);
    const setScoped = (key, value) => gmStoreSet(scopedKey(key), value);

    function isEnabled(){ return !!cfg.modChatStoneAutoloot; }
    function parseJson(text){ try{ return JSON.parse(text); }catch(e){ return null; } }

    function getUserHash(){
      if(state.userHash) return state.userHash;
      state.userHash = suiteGetUserHash();
      return state.userHash;
    }

    function getAccountKey(){
      const hash = getUserHash();
      if(hash) return `hash_${hash.slice(0, 12)}`;
      const nick = suiteGetCurrentUserName();
      if(nick) return String(nick).replace(/[^\w.-]+/g, '_').slice(0, 40);
      return 'site';
    }

    function toUrl(value){
      try{
        if(!value) return '';
        if(typeof value === 'string') return new URL(value, location.origin).href;
        if(value.url) return new URL(value.url, location.origin).href;
        return new URL(String(value), location.origin).href;
      }catch(e){ return String(value || ''); }
    }

    function bodyToString(body){
      if(!body) return '';
      if(typeof body === 'string') return body;
      if(body instanceof URLSearchParams) return body.toString();
      if(typeof FormData !== 'undefined' && body instanceof FormData){
        return [...body.entries()].map(([key, value]) => `${key}=${value}`).join('&');
      }
      try{ return String(body); }catch(e){ return ''; }
    }

    function isMainChatUrl(url){
      const href = String(url || '');
      if(href.includes('animesss_chat_init') || href.includes('animesss_chat_load_new')){
        return !href.includes('room_id=') || href.includes('room_id=main');
      }
      return href.includes('mod=light_chat') || href.includes('actions_chat');
    }

    function shouldIgnoreChatPayload(payload){ return String(payload || '').includes('page_id=club'); }
    function isOnlinePingUrl(url){ return String(url || '').includes('online_in_cinema'); }
    function resultText(data){
      if(!data) return 'Нет ответа';
      return String(data.text || data.message || data.error || JSON.stringify(data));
    }
    function isTerminalEmptyResult(data){ return EMPTY_RESULT_RE.test(resultText(data)); }

    function notify(type, message){
      log(message);
      try{
        const push = uw.DLEPush;
        if(push && typeof push[type] === 'function') push[type](message);
        else if(typeof push === 'function') push(type, message);
      }catch(e){}
    }

    async function acquireLeader(){
      if(!isEnabled()) return false;
      const now = Date.now();
      const visible = !document.hidden;
      const lock = getRaw(KEYS.lock, null);
      const expired = !lock || Number(lock.expiresAt || 0) <= now;
      const ownLock = lock && lock.owner === TAB_ID;
      const canPreferVisible = visible && lock && lock.visible === false;
      if(expired || ownLock || canPreferVisible){
        setRaw(KEYS.lock, { owner:TAB_ID, visible, updatedAt:now, expiresAt:now + DEFAULTS.lockTtlMs });
        state.isLeader = true;
        return true;
      }
      state.isLeader = false;
      return false;
    }

    function renewLeader(){
      if(!state.isLeader) return;
      const lock = getRaw(KEYS.lock, null);
      if(!lock || lock.owner !== TAB_ID){
        state.isLeader = false;
        return;
      }
      const now = Date.now();
      setRaw(KEYS.lock, { owner:TAB_ID, visible:!document.hidden, updatedAt:now, expiresAt:now + DEFAULTS.lockTtlMs });
    }

    function releaseLeader(){
      const lock = getRaw(KEYS.lock, null);
      if(lock && lock.owner === TAB_ID) delRaw(KEYS.lock);
      state.isLeader = false;
    }
    state.releaseLeader = releaseLeader;

    function saveSeen(){
      const list = [...state.seen].slice(-LIMIT);
      state.seen = new Set(list);
      setScoped(KEYS.seen, list);
    }

    function saveHistory(entry){
      const history = getScoped(KEYS.history, []);
      history.unshift(entry);
      if(history.length > LIMIT) history.length = LIMIT;
      setScoped(KEYS.history, history);
    }

    function markSeen(diamond, statusText, ok){
      state.seen.add(diamond.messageId);
      saveSeen();
      saveHistory({
        id:diamond.messageId,
        code:diamond.code,
        status:statusText,
        ok:!!ok,
        source:diamond.source,
        chatTime:diamond.chatTime,
        at:Date.now()
      });
    }

    function extractChatTime(li, fallback = ''){
      const text = normalizeText(li?.querySelector('.animesss-chat__date')?.textContent);
      return text || fallback || '';
    }

    function extractDiamondsFromHtml(htmlString, source){
      if(!htmlString || !String(htmlString).trim()) return [];
      if(!String(htmlString).includes('diamonds-chat')) return [];
      const doc = new DOMParser().parseFromString(`<div>${htmlString}</div>`, 'text/html');
      const result = [];
      for(const node of [...doc.querySelectorAll('#diamonds-chat')]){
        const code = node.getAttribute('data-code');
        if(!code) continue;
        const item = node.closest('.animesss-chat__item');
        const itemId = item?.getAttribute('data-id');
        const nodeId = node.getAttribute('data-id');
        const baseId = itemId || nodeId || 'diamond';
        result.push({
          code,
          messageId:`${baseId}:${code}`,
          chatTime:extractChatTime(item),
          source
        });
      }
      return result;
    }

    async function analyzeChatHtml(htmlString, source = 'chat'){
      if(!state.ready || !isEnabled()) return;
      if(!htmlString || !String(htmlString).includes('diamonds-chat')) return 0;
      if(!state.isLeader) await acquireLeader();
      if(!state.isLeader) return 0;
      const diamonds = extractDiamondsFromHtml(htmlString, source);
      if(!diamonds.length) return 0;
      let queuedCount = 0;
      for(const diamond of diamonds){
        if(state.seen.has(diamond.messageId)) continue;
        if(state.inFlight.has(diamond.messageId) || state.queued.has(diamond.messageId)) continue;
        state.queued.add(diamond.messageId);
        queueCollect(diamond);
        queuedCount += 1;
      }
      suiteTelemetryLog('chat_stone', 'chat_analyzed', {
        source,
        diamondCount:diamonds.length,
        queuedCount,
        queueSize:state.queueSize
      });
      return diamonds.length;
    }

    async function analyzeChatItems(items, source){
      const list = Array.isArray(items) ? items : [];
      const candidates = list
        .map(item => item?.html)
        .filter(html => typeof html === 'string' && html.includes('diamonds-chat'));
      if(!candidates.length){
        return { itemCount:list.length, candidateItemCount:0, diamondCount:0 };
      }
      const diamondCount = await analyzeChatHtml(candidates.join(''), source);
      return {
        itemCount:list.length,
        candidateItemCount:candidates.length,
        diamondCount:Number(diamondCount || 0)
      };
    }

    function queueCollect(diamond){
      state.queueSize += 1;
      state.collectChain = state.collectChain
        .then(() => collectDiamond(diamond))
        .catch(error => log('Queue error:', error?.message || error))
        .finally(() => {
          state.queueSize = Math.max(0, state.queueSize - 1);
          state.queued.delete(diamond.messageId);
        });
    }

    async function postDiamondOnce(code, userHash){
      const response = await fetch(`${location.origin}/ajax/find_diamond/`, {
        method:'POST',
        credentials:'same-origin',
        headers:{
          'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With':'XMLHttpRequest',
          'Accept':'application/json, text/javascript, */*; q=0.01'
        },
        body:new URLSearchParams({ code, user_hash:userHash })
      });
      const text = await response.text();
      const data = parseJson(text) || { text };
      if(!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${resultText(data)}`);
        error.status = response.status;
        throw error;
      }
      return data;
    }

    async function postDiamond(code){
      let userHash = getUserHash();
      if(!userHash) throw new Error('Не найден user_hash');
      try {
        const data = await postDiamondOnce(code, userHash);
        if(!suiteIsUserHashError(JSON.stringify(data))) return data;
      } catch(error) {
        if(!suiteIsUserHashError(error?.message)) throw error;
      }
      state.userHash = '';
      const refreshedHash = await suiteRefreshUserHashFromServer();
      if(!refreshedHash || refreshedHash === userHash) throw new Error('Не удалось обновить user_hash');
      state.userHash = refreshedHash;
      return postDiamondOnce(code, refreshedHash);
    }

    async function collectDiamond(diamond){
      if(!isEnabled()) return;
      if(state.inFlight.has(diamond.messageId) || state.seen.has(diamond.messageId)) return;
      state.inFlight.add(diamond.messageId);
      suiteTelemetryLog('chat_stone', 'collect_started', { diamond, queueSize:state.queueSize });
      let data = null;
      let text = 'Ошибка сети';
      try{
        data = await postDiamond(diamond.code);
        text = resultText(data);
        suiteTelemetryLog('chat_stone', 'collect_response', { diamond, attempt:1, response:data, text });

        if((!data.text && !data.status && !data.message && !data.error) && !isTerminalEmptyResult(data)){
          await sleep(DEFAULTS.queueIntervalMs);
          data = await postDiamond(diamond.code);
          text = resultText(data);
          suiteTelemetryLog('chat_stone', 'collect_response', { diamond, attempt:2, response:data, text });
        }

        const ok = data.status === 'ok';
        if(ok || data.status === 'no' || data.status === 'error' || data.error || isTerminalEmptyResult(data)){
          markSeen(diamond, text, ok);
        }
        if(ok){
          notify('success', `Камень собран: ${text}`);
          scheduleTransactionVerification();
        }
      }catch(error){
        text = error?.message || 'Ошибка сети';
        suiteTelemetryLog('chat_stone', 'collect_failed', { diamond, error:text }, 'error');
        log(`Collect failed for ${diamond.code}:`, text);
      }finally{
        state.inFlight.delete(diamond.messageId);
        suiteTelemetryLog('chat_stone', 'collect_finished', {
          diamond,
          result:text,
          seen:state.seen.has(diamond.messageId)
        });
        await sleep(DEFAULTS.queueIntervalMs);
      }
    }

    async function fetchText(path){
      const response = await fetch(new URL(path, location.origin).href, {
        method:'GET',
        credentials:'same-origin',
        cache:'no-cache',
        headers:{ 'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
      });
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    }

    function extractStoneTransactions(html){
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const rows = [...doc.querySelectorAll('.ncard-transactions__table tbody tr.new-tr-item')];
      const found = [];
      for(const row of rows){
        const date = normalizeText(row.querySelector('td:nth-child(3)')?.textContent);
        const desc = normalizeText(row.querySelector('td:nth-child(4)')?.textContent);
        if(date && desc.includes('Найден небесный камень')) found.push(date);
      }
      return found;
    }

    async function createTransactionBaseline(){
      if(getScoped(KEYS.baselineReady, false)) return;
      try{
        const html = await fetchText('/transactions/');
        const verified = {};
        extractStoneTransactions(html).forEach(date => { verified[date] = true; });
        setScoped(KEYS.verified, verified);
        setScoped(KEYS.baselineReady, true);
      }catch(error){
        log('Transaction baseline failed:', error?.message || error);
      }
    }

    function scheduleTransactionVerification(){
      if(state.verifyTimer) clearTimeout(state.verifyTimer);
      state.verifyTimer = setTimeout(() => {
        state.verifyTimer = null;
        verifyTransactions();
      }, DEFAULTS.verifyDelayMs);
    }

    async function verifyTransactions(){
      if(!isEnabled()) return;
      try{
        const html = await fetchText('/transactions/');
        const verified = getScoped(KEYS.verified, {});
        let newCount = 0;
        for(const date of extractStoneTransactions(html)){
          if(!verified[date]){
            verified[date] = true;
            newCount += 1;
          }
        }
        if(newCount > 0){
          setScoped(KEYS.verified, verified);
          log(`Подтверждено начислений камня: ${newCount}`);
        }
        suiteTelemetryLog('chat_stone', 'transactions_verified', { newCount, transactionCount:Object.keys(verified).length });
      }catch(error){
        suiteTelemetryLog('chat_stone', 'transaction_verification_failed', { error:error?.message || String(error) }, 'error');
        log('Transaction verification failed:', error?.message || error);
      }
    }

    function handleChatResponseText(text, url, payload){
      if(!isEnabled()) return;
      if(isOnlinePingUrl(url)){
        setRaw(KEYS.lastOnlinePing, Date.now());
        return;
      }
      if(!isMainChatUrl(url) || shouldIgnoreChatPayload(payload)) return;
      state.lastChatActivity = Date.now();
      setRaw(KEYS.lastChatActivity, state.lastChatActivity);
      const data = parseJson(text);
      if(data && Array.isArray(data.items)){
        void analyzeChatItems(data.items, 'hook');
        return;
      }
      if(data?.html){
        void analyzeChatHtml(data.html, 'hook');
        return;
      }
      if(String(text || '').includes('diamonds-chat')) void analyzeChatHtml(text, 'hook');
    }

    function installFetchHook(){
      const originalFetch = uw.fetch;
      if(typeof originalFetch !== 'function' || originalFetch.__suiteChatStoneHooked) return;
      function hookedFetch(resource, init){
        const url = toUrl(resource);
        const payload = bodyToString(init?.body);
        return originalFetch.apply(this, arguments).then(response => {
          if(isMainChatUrl(url) || isOnlinePingUrl(url)){
            response.clone().text()
              .then(text => handleChatResponseText(text, url, payload))
              .catch(()=>{});
          }
          return response;
        });
      }
      hookedFetch.__suiteChatStoneHooked = true;
      state.originalFetch = originalFetch;
      state.hookedFetch = hookedFetch;
      uw.fetch = hookedFetch;
    }

    function installXhrHook(){
      const XHR = uw.XMLHttpRequest;
      if(!XHR?.prototype || XHR.prototype.__suiteChatStoneHooked) return;
      const originalOpen = XHR.prototype.open;
      const originalSend = XHR.prototype.send;
      const hookedOpen = function(method, url){
        this.__suiteChatStoneUrl = toUrl(url);
        return originalOpen.apply(this, arguments);
      };
      const hookedSend = function(body){
        this.__suiteChatStonePayload = bodyToString(body);
        this.addEventListener('loadend', function(){
          const url = this.__suiteChatStoneUrl || '';
          if(!isMainChatUrl(url) && !isOnlinePingUrl(url)) return;
          let text = '';
          try{
            if(!this.responseType || this.responseType === 'text') text = this.responseText || '';
          }catch(e){ text = ''; }
          if(text) handleChatResponseText(text, url, this.__suiteChatStonePayload);
        });
        return originalSend.apply(this, arguments);
      };
      XHR.prototype.open = hookedOpen;
      XHR.prototype.send = hookedSend;
      XHR.prototype.__suiteChatStoneHooked = true;
      state.xhrPrototype = XHR.prototype;
      state.originalXhrOpen = originalOpen;
      state.originalXhrSend = originalSend;
      state.hookedXhrOpen = hookedOpen;
      state.hookedXhrSend = hookedSend;
    }

    function scanExistingDom(){
      if(!document.body) return;
      const items = new Set();
      document.querySelectorAll('#diamonds-chat').forEach(node => {
        items.add(node.closest('.animesss-chat__item') || node);
      });
      if(items.size) void analyzeChatHtml([...items].map(node => node.outerHTML).join(''), 'dom');
    }

    function installDomObserver(){
      if(!document.body || state.observer) return;
      state.observer = new MutationObserver(mutations => {
        for(const mutation of mutations){
          for(const node of mutation.addedNodes){
            if(!node || node.nodeType !== 1) continue;
            if(node.matches?.('#diamonds-chat')) analyzeChatHtml(node.outerHTML, 'dom');
            else if(node.querySelector?.('#diamonds-chat')) analyzeChatHtml(node.outerHTML, 'dom');
          }
        }
      });
      state.observer.observe(document.body, { childList:true, subtree:true });
    }

    async function fetchChatSnapshot(source = 'watchdog'){
      if(!state.ready || !isEnabled()) return;
      if(state.snapshotInFlight) return;
      if(Date.now() < state.pausedUntil) return;
      const sharedLastActivity = Number(getRaw(KEYS.lastChatActivity, 0) || 0);
      state.lastChatActivity = Math.max(state.lastChatActivity, sharedLastActivity);
      if(Date.now() - state.lastChatActivity < DEFAULTS.chatIdleMs) return;
      if(!state.isLeader) await acquireLeader();
      if(!state.isLeader) return;
      state.snapshotInFlight = true;
      suiteTelemetryLog('chat_stone', 'snapshot_started', { source });
      try{
        const response = await fetch(`${location.origin}/index.php?controller=ajax&mod=animesss_chat_init&room_id=main`, {
          method:'GET',
          credentials:'same-origin',
          headers:{ 'Accept':'*/*', 'X-Requested-With':'XMLHttpRequest' }
        });
        if(response.status === 429){
          suiteTelemetryLog('chat_stone', 'snapshot_rate_limited', { source, status:response.status }, 'error');
          state.pausedUntil = Date.now() + DEFAULTS.rateLimitPauseMs;
          state.lastChatActivity = Date.now();
          setRaw(KEYS.lastChatActivity, state.lastChatActivity);
          return;
        }
        if(!response.ok){
          suiteTelemetryLog('chat_stone', 'snapshot_http_error', { source, status:response.status }, 'error');
          state.lastChatActivity = Date.now();
          setRaw(KEYS.lastChatActivity, state.lastChatActivity);
          return;
        }
        const data = await response.json();
        state.lastChatActivity = Date.now();
        setRaw(KEYS.lastChatActivity, state.lastChatActivity);
        const summary = await analyzeChatItems(data.items, source);
        suiteTelemetryLog('chat_stone', 'snapshot_response', {
          source,
          status:data?.status || '',
          ...summary
        });
      }catch(error){
        state.lastChatActivity = Date.now();
        setRaw(KEYS.lastChatActivity, state.lastChatActivity);
        log('Chat fetch failed:', error?.message || error);
        suiteTelemetryLog('chat_stone', 'snapshot_failed', { source, error:error?.message || String(error) }, 'error');
      }finally{
        suiteTelemetryLog('chat_stone', 'snapshot_finished', { source });
        state.snapshotInFlight = false;
      }
    }

    async function pingOnline(){
      if(!state.ready || !isEnabled()) return;
      if(!state.isLeader) await acquireLeader();
      if(!state.isLeader) return;
      const lastPing = Number(getRaw(KEYS.lastOnlinePing, 0) || 0);
      if(Date.now() - lastPing < DEFAULTS.onlinePingMs) return;
      const userHash = getUserHash();
      if(!userHash) return;
      try{
        await fetch(`${location.origin}/index.php?controller=ajax&mod=online_in_cinema&user_hash=${encodeURIComponent(userHash)}`, {
          method:'GET',
          credentials:'same-origin',
          headers:{ 'X-Requested-With':'XMLHttpRequest', 'Accept':'application/json, text/javascript, */*; q=0.01' }
        });
        setRaw(KEYS.lastOnlinePing, Date.now());
      }catch(error){
        log('Online ping failed:', error?.message || error);
      }
    }

    async function waitForBody(timeoutMs = 10000){
      const started = Date.now();
      while(!document.body && Date.now() - started < timeoutMs) await sleep(100);
    }

    async function waitForUserHash(timeoutMs = 10000){
      const started = Date.now();
      while(!getUserHash() && Date.now() - started < timeoutMs) await sleep(250);
    }

    async function start(){
      installFetchHook();
      installXhrHook();
      state.lastChatActivity = Number(getRaw(KEYS.lastChatActivity, 0) || 0);
      await waitForBody();
      await waitForUserHash();
      if(!isEnabled()) return;
      state.accountKey = getAccountKey();
      state.seen = new Set(getScoped(KEYS.seen, []));
      await acquireLeader();
      await createTransactionBaseline();
      state.ready = true;
      scanExistingDom();
      installDomObserver();
      state.timers.push(setInterval(renewLeader, DEFAULTS.lockRenewMs));
      state.timers.push(setInterval(async () => {
        if(!state.ready || !isEnabled()) return;
        if(Date.now() - state.lastChatActivity >= DEFAULTS.chatIdleMs && state.queueSize === 0){
          fetchChatSnapshot('watchdog');
        }
      }, DEFAULTS.watchdogMs));
      state.timers.push(setInterval(pingOnline, 5000));
      state.listeners.push(GM_addValueChangeListener(rawKey(KEYS.lastChatActivity), (_key, _oldValue, newValue, remote) => {
        if(remote) state.lastChatActivity = Math.max(state.lastChatActivity, Number(newValue || 0));
      }));
      state.listeners.push(GM_addValueChangeListener(scopedKey(KEYS.seen), (_key, _oldValue, newValue, remote) => {
        if(remote && Array.isArray(newValue)) newValue.forEach(id => state.seen.add(id));
      }));
      window.addEventListener('visibilitychange', acquireLeader);
      state.windowEvents.push({ type:'visibilitychange', handler:acquireLeader });
      window.addEventListener('beforeunload', releaseLeader);
      state.windowEvents.push({ type:'beforeunload', handler:releaseLeader });
      fetchChatSnapshot('startup');
      log(`Started for ${state.accountKey}`);
    }

    start().catch(error => {
      window.__suiteChatStoneAutolootInstalled = false;
      log('Init failed:', error?.message || error);
    });
  }

  function initBrickFill(){
    if(!cfg.modBrickFill) return;
    if(isPremiumLockedSetting('modBrickFill')){
      enforcePremiumSettings();
      return;
    }
    if(!/\/celestial_stone\/?$/.test(location.pathname)) return;
    if(window.__suiteBrickFillInstalled) return;
    window.__suiteBrickFillInstalled=true;
    const brickCleanup=[];
    window.__suiteBrickFillCleanup=()=>{
      brickCleanup.splice(0).forEach(fn=>{try{fn();}catch(e){}});
      document.getElementById('stone-brick-panel')?.remove();
      window.__suiteBrickFillInstalled=false;
    };
    function brickOn(target,type,handler,opts){
      target.addEventListener(type,handler,opts);
      brickCleanup.push(()=>target.removeEventListener(type,handler,opts));
    }

    const BRICK_SETTINGS_KEY='stone_brick_settings_v3';
    const BRICK_WISHLIST_KEY='stone_brick_wishlist_cache_v3';
    const BRICK_POS_KEY='stone_brick_panel_pos';
    const BRICK_CACHE_TTL=60*60*1000;
    const BRICK_SLOT_LIMIT=70;
    const BRICK_RANKS=['','a','b','c','d','e'];
    const BRICK_ENERGY={e:1,d:1,c:1,b:2,a:6};

    const defaultRankCfg=()=>({
      wantEnabled:true,wantLimit:50,
      dupEnabled:false,dupLimit:3,
      ownersEnabled:false,ownersLimit:500,
    });
    const defaultBrickSettings=()=>{
      const s={excludeWishlist:true,targetEnergy:0};
      BRICK_RANKS.forEach(r=>{s[r]=defaultRankCfg();});
      return s;
    };
    function loadBrickSettings(){
      try{
        const s=gmStoreGet(BRICK_SETTINGS_KEY, defaultBrickSettings());
        if(!('excludeWishlist' in s))s.excludeWishlist=!!s.wishlistUser;
        delete s.wishlistUser;
        if(!('targetEnergy' in s))s.targetEnergy=0;
        BRICK_RANKS.forEach(r=>{if(!s[r])s[r]=defaultRankCfg();});
        return s;
      }catch(e){return defaultBrickSettings();}
    }
    function saveBrickSettings(s){gmStoreSet(BRICK_SETTINGS_KEY,s);}
    function loadBrickCache(){return gmStoreGet(BRICK_WISHLIST_KEY, null);}
    function saveBrickCache(username,images){gmStoreSet(BRICK_WISHLIST_KEY,{ts:Date.now(),username,images:[...images]});}
    function isBrickCacheValid(cache,username){return cache&&cache.username===username&&(Date.now()-cache.ts)<BRICK_CACHE_TTL;}

    function brickNotify(text,duration=3500){
      const clean=String(text||'').replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}⚠️✅⬇️⏳🔄⛔⚡🧱]+\s*/u,'');
      if(cfg.modCustomPush){
        const t=clean.toLowerCase();
        let icon='bolt',title='Кирпич',theme='neon-blue';
        if(t.includes('ошибка')||t.includes('не найд')||t.includes('нет ')||t.includes('⛔')){icon='err';title='Ошибка';theme='rose';}
        else if(t.includes('добавлено')||t.includes('готов')||t.includes('достиг')||t.includes('обмен')){icon='check';title='Готово';theme='emerald';}
        else if(t.includes('фильтр')||t.includes('работ')){icon='refresh';title='Работа';theme='indigo';}
        else if(t.includes('стр.')||t.includes('иду на')){icon='refresh';title='Страница';theme='neon-blue';}
        else if(t.includes('энерг')){icon='bolt';title='Энергия';theme='neon-green';}
        cptShow('brick:'+clean,icon,title,clean,CPT_CLS[theme]||CPT_CLS['neon-blue']);
        return;
      }
      showToast(clean);
    }

    async function fetchBrickUrl(url){
      const r=await fetch(url,{credentials:'same-origin'});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      return r.text();
    }
    function parseLockedImages(html){
      const doc=new DOMParser().parseFromString(html,'text/html');
      const images=new Set();
      doc.querySelectorAll('.card-offer-lock-btn[data-locked="1"]').forEach(btn=>{
        const card=btn.closest('[data-image]');
        if(card?.dataset.image)images.add(card.dataset.image);
      });
      return images;
    }
    async function fetchAllLockedImages(username){
      const all=new Set(), host=location.hostname;
      await Promise.all(BRICK_RANKS.map(async r=>{
        const url=`https://${host}/user/cards/need/?name=${encodeURIComponent(username)}${r?'&rank='+r:''}`;
        try{parseLockedImages(await fetchBrickUrl(url)).forEach(i=>all.add(i));}
        catch(e){console.warn(`[Кирпич] вишлист ранг "${r}":`,e);}
      }));
      return all;
    }
    async function getLockedImages(username,forceRefresh=false){
      if(!username)return new Set();
      const cache=loadBrickCache();
      if(!forceRefresh&&isBrickCacheValid(cache,username))return new Set(cache.images);
      brickNotify('🔄 Загружаю вишлист…',0);
      const images=await fetchAllLockedImages(username);
      saveBrickCache(username,images);
      return images;
    }

    function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
    function getBasket(){return document.querySelector('.stone__main-items[data-type="creator"]');}
    function getUsedSlots(){const b=getBasket();return b?b.querySelectorAll('.stone__main-item').length:0;}
    function getFreeSlots(){return Math.max(0,BRICK_SLOT_LIMIT-getUsedSlots());}
    function getFutureEnergy(){return parseInt(document.getElementById('future-energy')?.textContent?.replace(/\D/g,''),10)||0;}
    function getPageSelect(){return document.getElementById('choose_stone_filter_page');}
    function getLastPage(){
      const sel=getPageSelect();
      if(!sel||!sel.options.length)return null;
      return parseInt(sel.options[sel.options.length-1].value,10);
    }
    function getCurrentPage(){const sel=getPageSelect();if(!sel)return null;const n=parseInt(sel.value,10);return isNaN(n)?null:n;}
    function goToPage(pageNum){
      const sel=getPageSelect(),last=getLastPage();
      if(!sel||!last||pageNum<1||pageNum>last)return false;
      sel.value=String(pageNum);
      sel.dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    }
    async function goToLastPage(){
      const last=getLastPage();
      const cur=getCurrentPage();
      if(!last||last<=1)return false;
      if(cur===last)return true;
      brickNotify(`⬇️ Иду на последнюю стр. ${last}…`,0);
      if(!goToPage(last))return false;
      await waitForInventoryUpdate();
      return getCurrentPage()===last;
    }
    function waitForInventoryUpdate(timeoutMs=8000){
      return new Promise(resolve=>{
        const list=document.querySelector('.stone__inventory-list')||document.querySelector('.stone__inventory');
        if(!list){setTimeout(resolve,500);return;}
        const before=list.innerHTML;let done=false;
        const finish=()=>{if(done)return;done=true;obs.disconnect();clearInterval(poll);clearTimeout(fallback);setTimeout(resolve,200);};
        const obs=new MutationObserver(()=>{if(list.innerHTML!==before)finish();});
        obs.observe(list,{childList:true,subtree:true,characterData:true});
        const poll=setInterval(()=>{if(list.innerHTML!==before)finish();},100);
        const fallback=setTimeout(finish,timeoutMs);
      });
    }
    function getActiveRank(){
      const btn=document.querySelector('.stone__rank-item.stone__rank-item--active');
      return btn?(btn.dataset.rank??'').toLowerCase():'';
    }
    function initBrickRankWatcher(){
      let lastRank=getActiveRank(),jumpPending=false;
      brickOn(document,'click',async e=>{
        const btn=e.target.closest('.stone__rank-item');if(!btn||jumpPending)return;
        const clicked=(btn.dataset.rank??'').toLowerCase();
        if(clicked===lastRank)return;
        jumpPending=true;
        lastRank=clicked;
        await waitForInventoryUpdate(3000);
        await goToLastPage();
        jumpPending=false;
      },true);
    }
    function parseCardStats(card){
      let want=null,dups=null,owners=null;
      card.querySelectorAll('.card-stats span').forEach(span=>{
        const title=(span.title||'').trim().toLowerCase();
        const num=parseInt((span.textContent||'').replace(/\D/g,''),10);
        if(isNaN(num))return;
        if(title.includes('хотят')||title.includes('жела'))want=num;
        if(title.includes('дубли')||title.includes('руках'))dups=num;
        if(title.includes('влад'))owners=num;
      });
      const spans=card.querySelectorAll('.card-stats span');
      if(want===null&&spans[1]){const m=(spans[1].textContent||'').match(/(\d+)/);if(m)want=parseInt(m[1],10);}
      return {want,dups,owners};
    }
    function getCardImage(card){return card.dataset.image||card.querySelector('img')?.getAttribute('src')||card.querySelector('img')?.getAttribute('data-src')||'';}
    function getCardRank(card){return (card.dataset.rank||getActiveRank()||'').toLowerCase();}
    function getCardEnergy(card){return BRICK_ENERGY[getCardRank(card)]||1;}
    function isCardAvailable(card){
      if(!card)return false;
      if(card.classList.contains('stone__inventory-item--lock'))return false;
      if(card.classList.contains('stone__inventory-item--not-available'))return false;
      return !!(card.offsetWidth||card.offsetHeight||card.getClientRects().length);
    }
    function filterBrickCards(rankCfg,activeRank,lockedImages,takenMap){
      const all=[...document.querySelectorAll('.stone__inventory-item')];
      const filtered=all.filter(card=>{
        if(activeRank!==''&&(card.dataset.rank||'').toLowerCase()!==activeRank)return false;
        if(!isCardAvailable(card))return false;
        if(lockedImages.size>0){const img=getCardImage(card);if(img&&lockedImages.has(img))return false;}
        const {want,dups,owners}=parseCardStats(card);
        if(rankCfg.wantEnabled&&(want===null||want>=rankCfg.wantLimit))return false;
        if(rankCfg.dupEnabled&&(dups===null||dups<=rankCfg.dupLimit))return false;
        if(rankCfg.ownersEnabled&&(owners===null||owners<=rankCfg.ownersLimit))return false;
        return true;
      });
      if(!rankCfg.dupEnabled)return filtered;
      const pageAllowed=new Map();
      return filtered.filter(card=>{
        const img=getCardImage(card);if(!img)return true;
        if(!pageAllowed.has(img)){
          const {dups}=parseCardStats(card);
          const already=takenMap.get(img)||0;
          const quota=dups!==null?Math.max(0,dups-rankCfg.dupLimit):1;
          pageAllowed.set(img,Math.max(0,quota-already));
        }
        const canTake=pageAllowed.get(img);
        if(canTake<=0)return false;
        pageAllowed.set(img,canTake-1);
        return true;
      });
    }

    let brickBusy=false,brickReadyToTrade=false;
    function updateBrickButton(busy=false){
      const btn=document.getElementById('stone-brick-main-btn');if(!btn)return;
      const isBusy=busy||brickBusy;
      const energy=getFutureEnergy();
      if(!isBusy&&energy>0&&brickReadyToTrade){btn.textContent='⚡ В энергию';btn.style.background='#276749';btn.dataset.mode='trade';}
      else{btn.textContent=isBusy?'⏳ В работе':'🧱 В кирпич';btn.style.background=isBusy?'#4a5568':'#6b46c1';btn.dataset.mode='fill';}
      btn.disabled=isBusy;btn.style.opacity=isBusy?'0.65':'1';btn.style.cursor=isBusy?'not-allowed':'pointer';
    }
    function setBrickReady(v){brickReadyToTrade=!!v;updateBrickButton(false);}
    function clickBrickTrade(){
      const btn=document.querySelector('.stone__send-trade-btn');
      if(!btn){brickNotify('⚠️ Кнопка обмена не найдена');return false;}
      btn.click();
      brickNotify('⚡ Отправлено на обмен');
      setBrickReady(false);
      setTimeout(()=>updateBrickButton(false),700);
      return true;
    }
    async function waitAfterBrickTrade(){
      const before=getFutureEnergy();
      for(let i=0;i<20;i++){
        await sleep(150);
        if(getFutureEnergy()!==before || getUsedSlots()===0)break;
      }
      await sleep(350);
    }
    async function fillBrickOnce({targetEnergy=0,rankCfg,activeRank,lockedImages,forceRefresh=false}){
      const takenMap=new Map();
      let addedTotal=0,noMore=false,reached=false;
      while(true){
        brickNotify('⏳ Фильтрую карты…',0);
        const free=getFreeSlots();
        if(free<=0){reached=true;break;}
        if(targetEnergy>0&&getFutureEnergy()>=targetEnergy){reached=true;break;}
        const cards=filterBrickCards(rankCfg,activeRank,lockedImages,takenMap);
        const cur=getCurrentPage();
        let addedOnPage=0;
        if(!cards.length){
          if(cur!==null&&cur>1){
            brickNotify(`⬇️ Стр. ${cur} пуста → иду на ${cur-1}…`,0);
            goToPage(cur-1);
            await waitForInventoryUpdate();
            continue;
          }
          noMore=true;
          break;
        }
        const energyBeforeBatch=getFutureEnergy();
        const batch=[];
        let plannedEnergy=energyBeforeBatch;
        for(const card of cards){
          if(batch.length>=free)break;
          if(targetEnergy>0&&plannedEnergy>=targetEnergy)break;
          batch.push(card);
          plannedEnergy+=getCardEnergy(card);
        }
        suiteTelemetryLog('suite','brick_batch_selected',{
          page:cur,
          matchingCards:cards.length,
          selectedCards:batch.length,
          freeSlots:free,
          energyBefore:energyBeforeBatch,
          plannedEnergy,
          targetEnergy
        });
        for(const card of batch){
          card.click();
          const img=getCardImage(card);if(img)takenMap.set(img,(takenMap.get(img)||0)+1);
          addedTotal++;
          addedOnPage++;
        }
        await sleep(30);
        const energyAfterBatch=getFutureEnergy();
        suiteTelemetryLog('suite','brick_batch_clicked',{
          page:cur,
          clickedCards:batch.length,
          energyBefore:energyBeforeBatch,
          energyAfter:energyAfterBatch,
          plannedEnergy,
          targetEnergy
        });
        if(getFreeSlots()<=0||(targetEnergy>0&&(energyAfterBatch>=targetEnergy||plannedEnergy>=targetEnergy)))reached=true;
        if(reached)break;
        const curAfter=getCurrentPage();
        if(curAfter!==null&&curAfter>1){
          brickNotify(`⬇️ Стр. ${curAfter}: добавлено ${addedOnPage} карт → иду на ${curAfter-1}…`,0);
          goToPage(curAfter-1);
          await waitForInventoryUpdate();
        }else{
          noMore=true;
          break;
        }
      }
      return {energy:getFutureEnergy(),addedTotal,noMore,reached};
    }
    async function clickMatchingBrickCards(forceRefresh=false){
      if(brickBusy)return;
      if(warnCardStatsDemandRequired('stone_demand')) return;
      brickBusy=true;updateBrickButton(true);
      try{
        const settings=loadBrickSettings();
        const activeRank=getActiveRank();
        const rankCfg=settings[activeRank]||defaultRankCfg();
        const target=Math.max(0,parseInt(settings.targetEnergy,10)||0);
        let lockedImages=new Set();
        if(settings.excludeWishlist){
          const wishlistUser=suiteGetCurrentUserName();
          if(wishlistUser){
            try{lockedImages=await getLockedImages(wishlistUser,forceRefresh);}
            catch(e){console.error('[Кирпич] вишлист:',e);brickNotify('⚠️ Ошибка вишлиста, продолжаю без него');await sleep(700);}
          }else{
            brickNotify('⚠️ Ник не найден, исключение желаемого пропущено');
          }
        }
        if(target<=0){
          const result=await fillBrickOnce({targetEnergy:0,rankCfg,activeRank,lockedImages,forceRefresh});
          const energy=getFutureEnergy();
          if(energy>0){setBrickReady(true);brickNotify(`✅ В кирпиче энергии: ${energy}`);}
          else{setBrickReady(false);brickNotify(result.noMore?'✅ Подходящих карт нет — конец':'⛔ Корзина пуста');}
          return;
        }

        let gained=0;
        while(gained<target){
          const remaining=target-gained;
          brickNotify(`⏳ Цель: ${gained}/${target}. Наполняю ещё ${remaining} энергии…`,0);
          const result=await fillBrickOnce({targetEnergy:remaining,rankCfg,activeRank,lockedImages,forceRefresh});
          const energy=getFutureEnergy();
          if(energy<=0){
            brickNotify(result.noMore?`⛔ Дошёл до первой страницы. Набрано ${gained}/${target}`:`⛔ Не удалось набрать энергию. Набрано ${gained}/${target}`);
            setBrickReady(false);
            break;
          }
          brickNotify(`⚡ Обмениваю ${energy} энергии…`,0);
          const traded=clickBrickTrade();
          if(!traded){setBrickReady(true);break;}
          gained+=energy;
          await waitAfterBrickTrade();
          setBrickReady(false);
          if(gained>=target){
            brickNotify(`✅ Цель выполнена: ${gained}/${target}`);
            break;
          }
          brickNotify(`⏳ Набрано ${gained}/${target}. Продолжаю с текущей страницы…`,0);
          await sleep(500);
        }
      }finally{
        brickBusy=false;
        if((Math.max(0,parseInt(loadBrickSettings().targetEnergy,10)||0))<=0)updateBrickButton(false);
        else{setBrickReady(false);updateBrickButton(false);}
      }
    }

    function el(tag,{style='',text=''}={}){const e=document.createElement(tag);if(style)e.style.cssText=style;if(text)e.textContent=text;return e;}
    function sep(){return el('div',{style:'height:1px;background:rgba(255,255,255,0.07);margin:1px 0;'});}
    function makeBrickBtn(text,bg,hover){
      const b=document.createElement('button');b.textContent=text;
      b.style.cssText=`padding:8px 0;border:none;border-radius:7px;background:${bg};color:#fff;font-weight:700;font-size:13px;cursor:pointer;transition:background .15s`;
      b.addEventListener('mouseenter',()=>{if(!b.disabled)b.style.filter='brightness(.92)';});
      b.addEventListener('mouseleave',()=>{b.style.filter='';});
      return b;
    }
    function updateBrickCfg(settings,rank,key,value){if(!settings[rank])settings[rank]=defaultRankCfg();settings[rank][key]=value;saveBrickSettings(settings);}
    function makeBrickCriterion({label,hint,enabled,value,onToggle,onChange}){
      const wrap=el('div',{style:'display:flex;flex-direction:column;gap:5px;'});
      const row1=document.createElement('label');row1.style.cssText='display:flex;align-items:center;gap:7px;cursor:pointer;';
      const chk=document.createElement('input');chk.type='checkbox';chk.checked=enabled;chk.style.cssText='width:15px;height:15px;cursor:pointer;accent-color:#6b46c1;';
      row1.append(chk,el('span',{style:'font-weight:600;',text:label}));
      const row2=el('div',{style:'display:flex;align-items:center;gap:6px;padding-left:22px;'});
      const inp=document.createElement('input');inp.type='number';inp.min='0';inp.step='1';inp.value=value;
      inp.style.cssText='width:72px;height:28px;padding:3px 7px;border:1px solid rgba(255,255,255,.15);border-radius:6px;background:rgba(0,0,0,.35);color:#fff;outline:none;font-size:13px;box-sizing:border-box;';
      const setDim=en=>{inp.disabled=!en;row2.style.opacity=en?'1':'0.4';};setDim(enabled);
      chk.addEventListener('change',()=>{setDim(chk.checked);onToggle(chk.checked);});
      inp.addEventListener('change',()=>{const n=parseInt(inp.value,10);if(!isNaN(n))onChange(n);});
      row2.append(el('span',{style:'font-size:11px;color:#718096;flex:1;',text:hint}),inp);
      wrap.append(row1,row2);return wrap;
    }
    function makeBrickWishlistSection(settings){
      const wrap=el('div',{style:'display:flex;flex-direction:column;gap:5px;'});
      const row=document.createElement('label');row.style.cssText='display:flex;align-items:center;gap:7px;cursor:pointer;';
      const chk=document.createElement('input');chk.type='checkbox';chk.checked=!!settings.excludeWishlist;chk.style.cssText='width:15px;height:15px;cursor:pointer;accent-color:#6b46c1;';
      row.append(chk,el('span',{style:'font-weight:600;',text:'🔒 Исключать желаемое'}));
      const hint=el('div',{style:'font-size:11px;color:#718096;padding-left:22px;',text:`Ник: ${suiteGetCurrentUserName()||'не найден'}`});
      chk.addEventListener('change',()=>{settings.excludeWishlist=chk.checked;saveBrickSettings(settings);gmStoreDelete(BRICK_WISHLIST_KEY);renderBrickBody(document.getElementById('stone-brick-body'));});
      wrap.append(row,hint);return wrap;
    }
    function makeBrickTargetRow(settings){
      const wrap=el('div',{style:'display:flex;flex-direction:column;gap:5px;'});
      wrap.appendChild(el('div',{style:'font-weight:600;',text:'⚡ Цель энергии'}));
      const row=el('div',{style:'display:flex;align-items:center;gap:6px;'});
      row.appendChild(el('span',{style:'font-size:11px;color:#718096;flex:1;',text:'0 = ручной режим'}));
      const inp=document.createElement('input');inp.type='number';inp.min='0';inp.step='1';inp.value=Math.max(0,parseInt(settings.targetEnergy,10)||0);
      inp.style.cssText='width:82px;height:28px;padding:3px 7px;border:1px solid rgba(255,255,255,.15);border-radius:6px;background:rgba(0,0,0,.35);color:#fff;outline:none;font-size:13px;box-sizing:border-box;';
      inp.addEventListener('change',()=>{settings.targetEnergy=Math.max(0,parseInt(inp.value,10)||0);inp.value=settings.targetEnergy;saveBrickSettings(settings);});
      row.appendChild(inp);wrap.appendChild(row);return wrap;
    }
    function renderBrickBody(body){
      body.innerHTML='';
      const settings=loadBrickSettings(),activeRank=getActiveRank(),rankCfg=settings[activeRank]||defaultRankCfg();
      const rankName=activeRank===''?'Все':activeRank.toUpperCase();
      body.appendChild(el('div',{style:'font-size:11px;color:#718096;font-weight:600;letter-spacing:.04em;text-transform:uppercase;',text:`Ранг: ${rankName}`}));
      body.appendChild(sep());
      body.appendChild(makeBrickCriterion({label:'❤️ Хотят получить',hint:'меньше →',enabled:rankCfg.wantEnabled,value:rankCfg.wantLimit,onToggle:v=>updateBrickCfg(settings,activeRank,'wantEnabled',v),onChange:v=>updateBrickCfg(settings,activeRank,'wantLimit',v)}));
      body.appendChild(makeBrickCriterion({label:'📋 Дубли на руках',hint:'больше →',enabled:rankCfg.dupEnabled,value:rankCfg.dupLimit,onToggle:v=>updateBrickCfg(settings,activeRank,'dupEnabled',v),onChange:v=>updateBrickCfg(settings,activeRank,'dupLimit',v)}));
      body.appendChild(makeBrickCriterion({label:'👥 Владельцев',hint:'больше →',enabled:rankCfg.ownersEnabled,value:rankCfg.ownersLimit,onToggle:v=>updateBrickCfg(settings,activeRank,'ownersEnabled',v),onChange:v=>updateBrickCfg(settings,activeRank,'ownersLimit',v)}));
      body.appendChild(sep());
      body.appendChild(makeBrickWishlistSection(settings));
      body.appendChild(makeBrickTargetRow(settings));
      body.appendChild(sep());
      const btnRow=el('div',{style:'display:flex;gap:6px;'});
      const btnMain=makeBrickBtn('🧱 В кирпич','#6b46c1','#553c9a');
      btnMain.id='stone-brick-main-btn';
      btnMain.style.flex='1';
      btnMain.addEventListener('click',()=>{
        if(warnCardStatsDemandRequired('stone_demand')) return;
        if(btnMain.dataset.mode==='trade')clickBrickTrade();
        else clickMatchingBrickCards(false);
      });
      const btnRefresh=makeBrickBtn('🔄','#2d3748','#1a202c');
      btnRefresh.title='Обновить кэш вишлиста';
      btnRefresh.style.width='34px';
      btnRefresh.style.flex='none';
      btnRefresh.addEventListener('click',()=>clickMatchingBrickCards(true));
      btnRow.append(btnMain,btnRefresh);body.appendChild(btnRow);
      const cache=loadBrickCache();
      const wishlistUser=suiteGetCurrentUserName();
      if(cache&&settings.excludeWishlist&&wishlistUser&&isBrickCacheValid(cache,wishlistUser)){
        const age=Math.round((Date.now()-cache.ts)/60000);
        body.appendChild(el('div',{style:'font-size:10px;color:#4a5568;text-align:center;',text:`Кэш вишлиста: ${cache.images.length} карт · ${age} мин. назад`}));
      }
      setBrickReady(getFutureEnergy()>0&&brickReadyToTrade);
      updateBrickButton(false);
    }
    function saveBrickPanelPos(left,top){gmStoreSet(BRICK_POS_KEY,{left,top});}
    function loadBrickPanelPos(){return gmStoreGet(BRICK_POS_KEY, null);}
    function applyBrickPanelPos(panel){
      const pos=loadBrickPanelPos();if(!pos)return;
      const margin=8;
      const left=Math.min(Math.max(margin,pos.left),Math.max(margin,window.innerWidth-panel.offsetWidth-margin));
      const top=Math.min(Math.max(margin,pos.top),Math.max(margin,window.innerHeight-panel.offsetHeight-margin));
      panel.style.right='auto';panel.style.bottom='auto';panel.style.left=left+'px';panel.style.top=top+'px';
    }
    function makeBrickPanelDraggable(panel,handle){
      makeDraggable(panel,handle,saveBrickPanelPos);
    }
    function buildBrickPanel(){
      if(document.getElementById('stone-brick-panel'))return;
      const panel=document.createElement('div');panel.id='stone-brick-panel';
      panel.style.cssText='position:fixed;top:80px;right:20px;z-index:999;width:270px;background:rgba(12,12,22,.98);color:#e2e8f0;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.7);font-family:sans-serif;font-size:13px;user-select:none;border:1px solid rgba(255,255,255,.09);overflow:hidden;';
      const header=document.createElement('div');header.style.cssText='padding:9px 14px;background:linear-gradient(90deg,#4c1d95,#6b46c1);cursor:move;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:space-between;';
      const headerTitle=document.createElement('span');headerTitle.textContent='🧱 Наполнение кирпича';
      appendCrown(headerTitle);
      const toggleBtn=document.createElement('button');toggleBtn.textContent='−';toggleBtn.style.cssText='background:transparent;border:none;color:#fff;cursor:pointer;font-size:18px;line-height:1;padding:0 2px;';
      header.append(headerTitle,toggleBtn);
      const body=document.createElement('div');body.id='stone-brick-body';body.style.cssText='padding:12px 14px;display:flex;flex-direction:column;gap:10px;';
      panel.append(header,body);document.body.appendChild(panel);
      let collapsed=false;toggleBtn.addEventListener('click',()=>{
        collapsed=!collapsed;
        suiteApplyCollapsibleState(panel,collapsed,()=>{
          body.style.display=collapsed?'none':'flex';
          toggleBtn.textContent=collapsed?'+':'−';
        });
      });
      makeBrickPanelDraggable(panel,header);applyBrickPanelPos(panel);renderBrickBody(body);
      brickOn(document,'click',e=>{
        if(e.target.closest('.stone__rank-item')) setTimeout(()=>renderBrickBody(body),500);
      },true);
      const brickButtonTimer=setInterval(()=>updateBrickButton(false),1000);
      brickCleanup.push(()=>clearInterval(brickButtonTimer));
    }

    buildBrickPanel();
    initBrickRankWatcher();
  }

  // ============================================================
  //  ПЕРЕПЛАВКА
  // ============================================================

  function initRemelt(){
    if(!cfg.modRemelt) return;
    if(isPremiumLockedSetting('modRemelt')){
      enforcePremiumSettings();
      return;
    }
    if(!/\/cards_remelt\/?$/.test(location.pathname)) return;
    if(window.__suiteRemeltInstalled) return;
    window.__suiteRemeltInstalled=true;
    const remeltCleanup=[];
    window.__suiteRemeltCleanup=()=>{
      remeltCleanup.splice(0).forEach(fn=>{try{fn();}catch(e){}});
      document.getElementById('remelt-panel')?.remove();
      window.__suiteRemeltInstalled=false;
    };
    function remeltOn(target,type,handler,opts){
      target.addEventListener(type,handler,opts);
      remeltCleanup.push(()=>target.removeEventListener(type,handler,opts));
    }

    const REMELT_SETTINGS_KEY='suite_remelt_settings_v1';
    const REMELT_WISHLIST_KEY='stone_brick_wishlist_cache_v3';
    const REMELT_POS_KEY='suite_remelt_panel_pos_v1';
    const REMELT_CACHE_TTL=60*60*1000;
    const REMELT_RANKS=['e','d','c','b','a'];
    const REMELT_WISHLIST_RANKS=['','a','b','c','d','e'];
    const defaultRankCfg=()=>({
      wantEnabled:true,wantLimit:50,
      dupEnabled:false,dupLimit:3,
      ownersEnabled:false,ownersLimit:500,
    });
    const defaultRemeltSettings=()=>{
      const s={targetCount:1,excludeWishlist:true};
      REMELT_RANKS.forEach(r=>{s[r]=defaultRankCfg();});
      return s;
    };
    function loadRemeltSettings(){
      try{
        const s=gmStoreGet(REMELT_SETTINGS_KEY, defaultRemeltSettings());
        if(!('targetCount' in s))s.targetCount=1;
        if(!('excludeWishlist' in s))s.excludeWishlist=true;
        REMELT_RANKS.forEach(r=>{if(!s[r])s[r]=defaultRankCfg();});
        return s;
      }catch(e){return defaultRemeltSettings();}
    }
    function saveRemeltSettings(s){gmStoreSet(REMELT_SETTINGS_KEY,s);}
    function loadRemeltWishlistCache(){return gmStoreGet(REMELT_WISHLIST_KEY, null);}
    function saveRemeltWishlistCache(username,images){gmStoreSet(REMELT_WISHLIST_KEY,{ts:Date.now(),username,images:[...images]});}
    function isRemeltWishlistCacheValid(cache,username){return cache&&cache.username===username&&(Date.now()-cache.ts)<REMELT_CACHE_TTL;}
    function remeltNotify(text){
      const clean=String(text||'').replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}⚠️✅⬇️⏳🔄⛔⚡🔥]+\s*/u,'');
      if(cfg.modCustomPush){
        const t=clean.toLowerCase();
        let icon='fire',title='Переплавка',theme='neon-amber';
        if(t.includes('ошибка')||t.includes('не найд')||t.includes('нужно')||t.includes('нет ')){icon='err';title='Ошибка';theme='rose';}
        else if(t.includes('готов')||t.includes('выполн')){icon='check';title='Готово';theme='emerald';}
        else if(t.includes('стр.')||t.includes('иду')){icon='refresh';title='Страница';theme='neon-blue';}
        cptShow('remelt:'+clean,icon,title,clean,CPT_CLS[theme]||CPT_CLS['neon-amber']);
        return;
      }
      showToast(clean);
    }
    function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
    function getRemeltPageSelect(){return document.getElementById('choose_remelt_filter_page')||document.querySelector('.remelt__pagination select, .remelt__filter select[name*="page"], select[id*="remelt"][id*="page"], select[id*="filter_page"], select[name*="page"]');}
    function getRemeltLastPage(){const sel=getRemeltPageSelect();if(!sel||!sel.options.length)return null;return parseInt(sel.options[sel.options.length-1].value,10);}
    function getRemeltCurrentPage(){const sel=getRemeltPageSelect();if(!sel)return null;const n=parseInt(sel.value,10);return isNaN(n)?null:n;}
    function remeltGoToPage(pageNum){
      const sel=getRemeltPageSelect(),last=getRemeltLastPage();
      if(!sel||!last||pageNum<1||pageNum>last)return false;
      sel.value=String(pageNum);
      sel.dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    }
    function getRemeltInventorySignature(){
      return getRemeltCards().map(c=>c.dataset.id||c.getAttribute('data-id')||getRemeltCardImage(c)).join('|');
    }
    function waitForRemeltInventoryUpdate(timeoutMs=2800){
      return new Promise(resolve=>{
        const before=getRemeltInventorySignature();let done=false;
        const finish=()=>{if(done)return;done=true;obs.disconnect();clearInterval(poll);clearTimeout(fallback);setTimeout(resolve,120);};
        const changed=()=>getRemeltInventorySignature()!==before;
        const obs=new MutationObserver(()=>{if(changed())finish();});
        obs.observe(document.body,{childList:true,subtree:true,characterData:true});
        const poll=setInterval(()=>{if(changed())finish();},80);
        const fallback=setTimeout(finish,timeoutMs);
      });
    }
    async function remeltGoToLastPage(){
      const last=getRemeltLastPage();
      const cur=getRemeltCurrentPage();
      if(!last||last<=1||cur===last)return false;
      remeltNotify(`⬇️ Иду на последнюю стр. ${last}…`);
      if(!remeltGoToPage(last))return false;
      await waitForRemeltInventoryUpdate();
      return true;
    }
    function getRemeltActiveRank(){
      const btn=document.querySelector('.remelt__rank-item--active,[class*="rank-item--active"]');
      return btn?(btn.dataset.rank||btn.getAttribute('data-rank')||'e').toLowerCase():'e';
    }
    function getRemeltNeedCount(rank=getRemeltActiveRank()){return rank==='b'?6:3;}
    function initRemeltRankWatcher(){
      let lastRank=getRemeltActiveRank(),jumpPending=false;
      remeltOn(document,'click',async e=>{
        const btn=e.target.closest('.remelt__rank-item,[class*="rank-item"]');
        if(!btn||jumpPending)return;
        const clicked=(btn.dataset.rank||btn.getAttribute('data-rank')||'').toLowerCase();
        if(!clicked||clicked===lastRank)return;
        jumpPending=true;lastRank=clicked;
        await waitForRemeltInventoryUpdate(3000);
        await remeltGoToLastPage();
        const body=document.getElementById('remelt-panel-body');
        if(body) renderRemeltBody(body);
        jumpPending=false;
      },true);
    }
    function parseRemeltCardStats(card){
      let want=null,dups=null,owners=null;
      card.querySelectorAll('.card-stats span').forEach(span=>{
        const title=(span.title||'').trim().toLowerCase();
        const num=parseInt((span.textContent||'').replace(/\D/g,''),10);
        if(isNaN(num))return;
        if(title.includes('хотят')||title.includes('жела'))want=num;
        if(title.includes('дубли')||title.includes('руках'))dups=num;
        if(title.includes('влад'))owners=num;
      });
      const spans=card.querySelectorAll('.card-stats span');
      if(want===null&&spans[1]){const m=(spans[1].textContent||'').match(/(\d+)/);if(m)want=parseInt(m[1],10);}
      return {want,dups,owners};
    }
    function getRemeltCardImage(card){return card.dataset.image||card.querySelector('img')?.getAttribute('src')||card.querySelector('img')?.getAttribute('data-src')||'';}
    function parseRemeltLockedImages(html){
      const doc=new DOMParser().parseFromString(html,'text/html');
      const images=new Set();
      doc.querySelectorAll('.card-offer-lock-btn[data-locked="1"]').forEach(btn=>{
        const card=btn.closest('[data-image]');
        if(card?.dataset.image)images.add(card.dataset.image);
      });
      return images;
    }
    async function fetchRemeltUrl(url){
      const r=await fetch(url,{credentials:'same-origin'});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      return r.text();
    }
    async function fetchRemeltLockedImages(username){
      const all=new Set(),host=location.hostname;
      await Promise.all(REMELT_WISHLIST_RANKS.map(async r=>{
        const url=`https://${host}/user/cards/need/?name=${encodeURIComponent(username)}${r?'&rank='+r:''}`;
        try{parseRemeltLockedImages(await fetchRemeltUrl(url)).forEach(i=>all.add(i));}
        catch(e){console.warn(`[Переплавка] желаемое ранг "${r}":`,e);}
      }));
      return all;
    }
    async function getRemeltLockedImages(username,forceRefresh=false){
      if(!username)return new Set();
      const cache=loadRemeltWishlistCache();
      if(!forceRefresh&&isRemeltWishlistCacheValid(cache,username))return new Set(cache.images);
      remeltNotify('🔄 Загружаю желаемое');
      const images=await fetchRemeltLockedImages(username);
      saveRemeltWishlistCache(username,images);
      return images;
    }
    function isRemeltCardAvailable(card){
      if(!card)return false;
      if(card.dataset.suiteRemeltPicked==='1')return false;
      if(card.classList.contains('remelt__inventory-item--lock')||card.classList.contains('remelt__inventory-item--locked'))return false;
      if(card.classList.contains('remelt__inventory-item--not-available')||card.classList.contains('remelt__inventory-item--disabled'))return false;
      if(card.style.display==='none'||card.hidden)return false;
      return !!(card.offsetWidth||card.offsetHeight||card.getClientRects().length);
    }
    function getRemeltCards(){
      const list=document.querySelector('.remelt__inventory-list')||document.querySelector('.remelt__inventory');
      if(!list)return [];
      return [...list.querySelectorAll('.remelt__inventory-item[data-id]')].filter(c=>c.closest('#remelt-panel')===null);
    }
    function filterRemeltCards(rankCfg,activeRank,takenMap,lockedImages=new Set()){
      const all=getRemeltCards();
      const filtered=all.filter(card=>{
        const rank=(card.dataset.rank||activeRank||'').toLowerCase();
        if(activeRank&&rank&&rank!==activeRank)return false;
        if(!isRemeltCardAvailable(card))return false;
        if(lockedImages.size>0){const img=getRemeltCardImage(card);if(img&&lockedImages.has(img))return false;}
        const {want,dups,owners}=parseRemeltCardStats(card);
        if(rankCfg.wantEnabled&&(want===null||want>=rankCfg.wantLimit))return false;
        if(rankCfg.dupEnabled&&(dups===null||dups<=rankCfg.dupLimit))return false;
        if(rankCfg.ownersEnabled&&(owners===null||owners<=rankCfg.ownersLimit))return false;
        return true;
      });
      if(!rankCfg.dupEnabled)return filtered;
      const pageAllowed=new Map();
      return filtered.filter(card=>{
        const img=getRemeltCardImage(card);if(!img)return true;
        if(!pageAllowed.has(img)){
          const {dups}=parseRemeltCardStats(card);
          const already=takenMap.get(img)||0;
          const quota=dups!==null?Math.max(0,dups-rankCfg.dupLimit):1;
          pageAllowed.set(img,Math.max(0,quota-already));
        }
        const canTake=pageAllowed.get(img);
        if(canTake<=0)return false;
        pageAllowed.set(img,canTake-1);
        return true;
      });
    }
    function getRemeltStartBtn(){
      return document.querySelector('.remelt__start-btn')||[...document.querySelectorAll('button')].find(b=>(b.textContent||'').trim().includes('Перековка'));
    }
    function isRemeltVisible(el){
      if(!el)return false;
      const cs=getComputedStyle(el);
      return cs.display!=='none'&&cs.visibility!=='hidden'&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length);
    }
    function getRemeltActiveWrapper(rank=getRemeltActiveRank()){
      const preferred=rank==='b'
        ? [...document.querySelectorAll('.remelt__wrapper.remelt6,.remelt6')]
        : [...document.querySelectorAll('.remelt__wrapper:not(.remelt6)')];
      return preferred.find(isRemeltVisible)||[...document.querySelectorAll('.remelt__wrapper')].find(isRemeltVisible)||null;
    }
    function getRemeltFilledSlotCount(){
      const rank=getRemeltActiveRank();
      const wrapper=getRemeltActiveWrapper(rank);
      if(!wrapper)return 0;
      const selector=rank==='b'
        ? '.remelt6__slot:not(.remelt6__slot--result)'
        : '.remelt__item:not(.remelt__item--result):not(.remelt6__slot--result)';
      return [...wrapper.querySelectorAll(selector)]
        .filter(slot=>!!slot.querySelector('img[data-id]')).length;
    }
    async function waitForRemeltSlotsFilled(need,timeoutMs=3000){
      const start=Date.now();
      while(Date.now()-start<timeoutMs){
        const filled=getRemeltFilledSlotCount();
        if(filled>=need)return true;
        await sleep(100);
      }
      return getRemeltFilledSlotCount()>=need;
    }
    async function waitForRemeltStartBtn(timeoutMs=3000){
      const start=Date.now();
      while(Date.now()-start<timeoutMs){
        const btn=getRemeltStartBtn();
        if(btn&&getComputedStyle(btn).display!=='none'&&!btn.disabled)return btn;
        await sleep(100);
      }
      return getRemeltStartBtn();
    }

    let remeltBusy=false,remeltHadSuccessfulRun=false;
    function updateRemeltButton(busy=false){
      const btn=document.getElementById('remelt-main-btn');if(!btn)return;
      const isBusy=busy||remeltBusy;
      btn.textContent=isBusy?'⏳ В работе':'🔥 Переплавка';
      btn.style.background=isBusy?'#4a5568':'#c2410c';
      btn.disabled=isBusy;btn.style.opacity=isBusy?'0.65':'1';btn.style.cursor=isBusy?'not-allowed':'pointer';
    }
    async function runRemelt(){
      if(remeltBusy)return;
      if(warnCardStatsDemandRequired('trade_demand')) return;
      const settings=loadRemeltSettings();
      const target=Math.max(0,parseInt(settings.targetCount,10)||0);
      if(target<=0){remeltNotify('⛔ Укажи количество переплавок больше 0');return;}
      remeltBusy=true;updateRemeltButton(true);
      try{
        let lockedImages=new Set();
        if(settings.excludeWishlist){
          const wishlistUser=suiteGetCurrentUserName();
          if(wishlistUser){
            try{lockedImages=await getRemeltLockedImages(wishlistUser);}
            catch(e){console.error('[Переплавка] желаемое:',e);remeltNotify('⚠️ Ошибка желаемого, продолжаю без него');await sleep(700);}
          }else{
            remeltNotify('⚠️ Ник не найден, исключение желаемого пропущено');
          }
        }
        if(!remeltHadSuccessfulRun) await remeltGoToLastPage();
        let done=0;
        while(done<target){
          const activeRank=getRemeltActiveRank();
          const need=getRemeltNeedCount(activeRank);
          const rankCfg=settings[activeRank]||defaultRankCfg();
          const takenMap=new Map();
          let stopped=false,stalePasses=0;
          let pageNo=getRemeltCurrentPage();
          let pageStartFilled=getRemeltFilledSlotCount();
          while(getRemeltFilledSlotCount()<need){
            const cards=filterRemeltCards(rankCfg,activeRank,takenMap,lockedImages);
            const cur=getRemeltCurrentPage();
            if(!cards.length){
              if(cur!==null&&cur>1){
                const addedOnPage=Math.max(0,getRemeltFilledSlotCount()-pageStartFilled);
                remeltNotify(`⬇️ Стр. ${cur}: добавлено ${addedOnPage} карт → иду на ${cur-1}…`);
                remeltGoToPage(cur-1);
                await waitForRemeltInventoryUpdate();
                pageNo=getRemeltCurrentPage();
                pageStartFilled=getRemeltFilledSlotCount();
                continue;
              }
              stopped=true;break;
            }
            if(cur!==pageNo){
              pageNo=cur;
              pageStartFilled=getRemeltFilledSlotCount();
            }
            for(const card of cards){
              if(getRemeltFilledSlotCount()>=need)break;
              const beforeFilled=getRemeltFilledSlotCount();
              card.click();
              card.dataset.suiteRemeltPicked='1';
              const img=getRemeltCardImage(card);if(img)takenMap.set(img,(takenMap.get(img)||0)+1);
              await sleep(260);
              if(getRemeltFilledSlotCount()===beforeFilled) await waitForRemeltSlotsFilled(beforeFilled+1,1600);
              if(getRemeltFilledSlotCount()===beforeFilled){
                delete card.dataset.suiteRemeltPicked;
                if(img)takenMap.set(img,Math.max(0,(takenMap.get(img)||1)-1));
              }
            }
            const filledNow=getRemeltFilledSlotCount();
            if(filledNow>=need)break;
            if(filledNow===0)stalePasses++;
            else stalePasses=0;
            if(stalePasses>=2){
              getRemeltCards().forEach(c=>{delete c.dataset.suiteRemeltPicked;});
              stalePasses=0;
              await sleep(500);
            }
          }
          if(stopped){remeltNotify(`⛔ Недостаточно карт. Выполнено ${done}/${target}`);break;}
          const slotsReady=await waitForRemeltSlotsFilled(need,6000);
          if(!slotsReady){
            const filled=getRemeltFilledSlotCount();
            remeltNotify(`⏳ В слотах ${filled}/${need} карт. Добираю недостающие…`);
            getRemeltCards().forEach(c=>{delete c.dataset.suiteRemeltPicked;});
            continue;
          }
          const startBtn=await waitForRemeltStartBtn();
          if(!startBtn){remeltNotify('⛔ Кнопка «Перековка» не появилась');break;}
          startBtn.click();
          done++;
          remeltHadSuccessfulRun=true;
          remeltNotify(`✅ Переплавка ${done}/${target}`);
          await waitForRemeltInventoryUpdate(4000);
          getRemeltCards().forEach(c=>{delete c.dataset.suiteRemeltPicked;});
          await sleep(500);
        }
        if(done>=target)remeltNotify(`✅ Готово: ${done}/${target}`);
      }finally{
        remeltBusy=false;updateRemeltButton(false);
      }
    }
    function remeltEl(tag,{style='',text=''}={}){const e=document.createElement(tag);if(style)e.style.cssText=style;if(text)e.textContent=text;return e;}
    function remeltSep(){return remeltEl('div',{style:'height:1px;background:rgba(255,255,255,0.07);margin:1px 0;'});}
    function makeRemeltBtn(text,bg){
      const b=document.createElement('button');b.textContent=text;
      b.style.cssText=`padding:8px 0;border:none;border-radius:7px;background:${bg};color:#fff;font-weight:700;font-size:13px;cursor:pointer;transition:filter .15s`;
      b.onmouseenter=()=>{if(!b.disabled)b.style.filter='brightness(.92)';};
      b.onmouseleave=()=>{b.style.filter='';};
      return b;
    }
    function updateRemeltCfg(settings,rank,key,value){if(!settings[rank])settings[rank]=defaultRankCfg();settings[rank][key]=value;saveRemeltSettings(settings);}
    function makeRemeltCriterion({label,hint,enabled,value,onToggle,onChange}){
      const wrap=remeltEl('div',{style:'display:flex;flex-direction:column;gap:5px;'});
      const row1=document.createElement('label');row1.style.cssText='display:flex;align-items:center;gap:7px;cursor:pointer;';
      const chk=document.createElement('input');chk.type='checkbox';chk.checked=enabled;chk.style.cssText='width:15px;height:15px;cursor:pointer;accent-color:#c2410c;';
      row1.append(chk,remeltEl('span',{style:'font-weight:600;',text:label}));
      const row2=remeltEl('div',{style:'display:flex;align-items:center;gap:6px;padding-left:22px;'});
      const inp=document.createElement('input');inp.type='number';inp.min='0';inp.step='1';inp.value=value;
      inp.style.cssText='width:72px;height:28px;padding:3px 7px;border:1px solid rgba(255,255,255,.15);border-radius:6px;background:rgba(0,0,0,.35);color:#fff;outline:none;font-size:13px;box-sizing:border-box;';
      const setDim=en=>{inp.disabled=!en;row2.style.opacity=en?'1':'0.4';};setDim(enabled);
      chk.addEventListener('change',()=>{setDim(chk.checked);onToggle(chk.checked);});
      inp.addEventListener('change',()=>{const n=parseInt(inp.value,10);if(!isNaN(n))onChange(n);});
      row2.append(remeltEl('span',{style:'font-size:11px;color:#718096;flex:1;',text:hint}),inp);
      wrap.append(row1,row2);return wrap;
    }
    function makeRemeltWishlistSection(settings){
      const wrap=remeltEl('div',{style:'display:flex;flex-direction:column;gap:5px;'});
      const row=document.createElement('label');row.style.cssText='display:flex;align-items:center;gap:7px;cursor:pointer;';
      const chk=document.createElement('input');chk.type='checkbox';chk.checked=!!settings.excludeWishlist;chk.style.cssText='width:15px;height:15px;cursor:pointer;accent-color:#c2410c;';
      row.append(chk,remeltEl('span',{style:'font-weight:600;',text:'🔒 Исключать желаемое'}));
      const hint=remeltEl('div',{style:'font-size:11px;color:#718096;padding-left:22px;',text:`Ник: ${suiteGetCurrentUserName()||'не найден'}`});
      chk.addEventListener('change',()=>{settings.excludeWishlist=chk.checked;saveRemeltSettings(settings);gmStoreDelete(REMELT_WISHLIST_KEY);renderRemeltBody(document.getElementById('remelt-panel-body'));});
      wrap.append(row,hint);return wrap;
    }
    function renderRemeltBody(body){
      body.innerHTML='';
      const settings=loadRemeltSettings(),rank=getRemeltActiveRank(),rankCfg=settings[rank]||defaultRankCfg();
      body.appendChild(remeltEl('div',{style:'font-size:11px;color:#718096;font-weight:600;letter-spacing:.04em;text-transform:uppercase;',text:`Ранг: ${rank.toUpperCase()} · карт на переплавку: ${getRemeltNeedCount(rank)}`}));
      body.appendChild(remeltSep());
      body.appendChild(makeRemeltCriterion({label:'❤️ Хотят получить',hint:'меньше →',enabled:rankCfg.wantEnabled,value:rankCfg.wantLimit,onToggle:v=>updateRemeltCfg(settings,rank,'wantEnabled',v),onChange:v=>updateRemeltCfg(settings,rank,'wantLimit',v)}));
      body.appendChild(makeRemeltCriterion({label:'📋 Дубли на руках',hint:'больше →',enabled:rankCfg.dupEnabled,value:rankCfg.dupLimit,onToggle:v=>updateRemeltCfg(settings,rank,'dupEnabled',v),onChange:v=>updateRemeltCfg(settings,rank,'dupLimit',v)}));
      body.appendChild(makeRemeltCriterion({label:'👥 Владельцев',hint:'больше →',enabled:rankCfg.ownersEnabled,value:rankCfg.ownersLimit,onToggle:v=>updateRemeltCfg(settings,rank,'ownersEnabled',v),onChange:v=>updateRemeltCfg(settings,rank,'ownersLimit',v)}));
      body.appendChild(remeltSep());
      body.appendChild(makeRemeltWishlistSection(settings));
      body.appendChild(remeltSep());
      const targetWrap=remeltEl('div',{style:'display:flex;flex-direction:column;gap:5px;'});
      targetWrap.appendChild(remeltEl('div',{style:'font-weight:600;',text:'🔥 Количество переплавок'}));
      const targetInput=document.createElement('input');targetInput.type='number';targetInput.min='1';targetInput.step='1';targetInput.value=Math.max(0,parseInt(settings.targetCount,10)||0);
      targetInput.style.cssText='width:100%;height:30px;padding:3px 8px;border:1px solid rgba(255,255,255,.15);border-radius:6px;background:rgba(0,0,0,.35);color:#fff;outline:none;font-size:13px;box-sizing:border-box;';
      targetInput.addEventListener('change',()=>{settings.targetCount=Math.max(0,parseInt(targetInput.value,10)||0);targetInput.value=settings.targetCount;saveRemeltSettings(settings);});
      targetWrap.appendChild(targetInput);body.appendChild(targetWrap);
      const btn=makeRemeltBtn('🔥 Переплавка','#c2410c');btn.id='remelt-main-btn';btn.style.width='100%';btn.addEventListener('click',runRemelt);body.appendChild(btn);
      updateRemeltButton(false);
    }
    function saveRemeltPanelPos(left,top){gmStoreSet(REMELT_POS_KEY,{left,top});}
    function loadRemeltPanelPos(){return gmStoreGet(REMELT_POS_KEY, null);}
    function makeRemeltPanelDraggable(panel,handle){
      makeDraggable(panel,handle,saveRemeltPanelPos);
    }
    function buildRemeltPanel(){
      if(document.getElementById('remelt-panel'))return;
      const panel=document.createElement('div');panel.id='remelt-panel';
      panel.style.cssText='position:fixed;top:80px;right:20px;z-index:999;width:270px;background:rgba(12,12,22,.98);color:#e2e8f0;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.7);font-family:sans-serif;font-size:13px;user-select:none;border:1px solid rgba(255,255,255,.09);overflow:hidden;';
      const header=document.createElement('div');header.style.cssText='padding:9px 14px;background:linear-gradient(90deg,#7c2d12,#c2410c);cursor:move;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:space-between;';
      const title=document.createElement('span');title.textContent='🔥 Переплавка';
      appendCrown(title);
      const toggle=document.createElement('button');toggle.textContent='−';toggle.style.cssText='background:transparent;border:none;color:#fff;cursor:pointer;font-size:18px;line-height:1;padding:0 2px;';
      header.append(title,toggle);
      const body=document.createElement('div');body.id='remelt-panel-body';body.style.cssText='padding:12px 14px;display:flex;flex-direction:column;gap:10px;';
      panel.append(header,body);document.body.appendChild(panel);
      let collapsed=false;toggle.addEventListener('click',()=>{
        collapsed=!collapsed;
        suiteApplyCollapsibleState(panel,collapsed,()=>{
          body.style.display=collapsed?'none':'flex';
          toggle.textContent=collapsed?'+':'−';
        });
      });
      makeRemeltPanelDraggable(panel,header);
      const pos=loadRemeltPanelPos();if(pos){const margin=8;const left=Math.min(Math.max(margin,pos.left),Math.max(margin,window.innerWidth-panel.offsetWidth-margin));const top=Math.min(Math.max(margin,pos.top),Math.max(margin,window.innerHeight-panel.offsetHeight-margin));panel.style.right='auto';panel.style.left=left+'px';panel.style.top=top+'px';}
      renderRemeltBody(body);
    }
    buildRemeltPanel();
    initRemeltRankWatcher();
    setTimeout(()=>remeltGoToLastPage(),700);
  }

  // ============================================================
  //  ЗАЩИТА ПОКУПКИ ПАКОВ (100 и 500 камней)
  // ============================================================

  let packConfirmCallback = null;

  function createPackConfirmDialog() {
    const overlay = document.createElement('div');
    overlay.id = 'cv-pack-confirm-overlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.65);backdrop-filter:blur(3px);align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#0a0f1a;border:1px solid #1e293b;border-radius:16px;padding:28px 28px 22px;max-width:360px;width:90%;box-shadow:0 24px 64px rgba(0,0,0,.9);font-family:\'Segoe UI\',sans-serif;color:#e2e8f0;text-align:center;';
    const icon = document.createElement('div'); icon.textContent = '💎'; icon.style.cssText = 'font-size:36px;margin-bottom:12px';
    const title = document.createElement('div'); title.id = 'cv-pack-confirm-title'; title.style.cssText = 'font-size:16px;font-weight:700;margin-bottom:10px;color:#fb923c';
    const msg = document.createElement('div'); msg.id = 'cv-pack-confirm-msg'; msg.style.cssText = 'font-size:13px;color:#94a3b8;line-height:1.6;margin-bottom:20px';
    const btns = document.createElement('div'); btns.style.cssText = 'display:flex;gap:10px;justify-content:center';
    const btnOk = document.createElement('button'); btnOk.textContent = 'Да, купить';
    btnOk.style.cssText = 'padding:9px 22px;border:none;border-radius:9px;cursor:pointer;background:#7f1d1d;color:#fca5a5;font-weight:600;font-size:13px;';
    btnOk.onmouseover = () => btnOk.style.background = '#991b1b'; btnOk.onmouseout = () => btnOk.style.background = '#7f1d1d';
    const btnCancel = document.createElement('button'); btnCancel.textContent = 'Отмена';
    btnCancel.style.cssText = 'padding:9px 22px;border:none;border-radius:9px;cursor:pointer;background:#1e293b;color:#94a3b8;font-weight:600;font-size:13px;';
    btnCancel.onmouseover = () => btnCancel.style.background = '#334155'; btnCancel.onmouseout = () => btnCancel.style.background = '#1e293b';
    btns.append(btnOk, btnCancel); box.append(icon, title, msg, btns); overlay.appendChild(box); document.body.appendChild(overlay);
    btnOk.addEventListener('click', () => {
      overlay.style.display = 'none';
      if (packConfirmCallback) { packConfirmCallback(); packConfirmCallback = null; }
    });
    const close = () => { overlay.style.display = 'none'; packConfirmCallback = null; };
    btnCancel.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    return overlay;
  }

  let packConfirmDialog = null;

  function showPackConfirmDialog(cost, onConfirm) {
    if (!packConfirmDialog) packConfirmDialog = createPackConfirmDialog();
    packConfirmCallback = onConfirm;
    document.getElementById('cv-pack-confirm-title').textContent = `Покупка пака за ${cost} 💎`;
    document.getElementById('cv-pack-confirm-msg').innerHTML =
      `Вы собираетесь купить пак за <b style="color:#fb923c">${cost} камней</b>.<br>Рекомендуется покупать паки за <b style="color:#4ade80">1600 камней</b> — они выгоднее.<br><br>Вы уверены?`;
    packConfirmDialog.style.display = 'flex';
  }

  function getActivePack20Cost() {
    const active = document.querySelector('.lootbox__middle-item--active');
    if (!active) return null;
    const count = active.getAttribute('data-count');
    if (count === '1') return 100;
    if (count === '6') return 500;
    if (count === '20') return 1600;
    return null;
  }

  function setupBuyButtonGuard() {
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('.lootbox__open-btn');
      if (!btn) return;
      if (!cfg.modGuard) return;
      const cost = getActivePack20Cost();
      if (cost === 100 || cost === 500) {
        e.preventDefault(); e.stopImmediatePropagation();
        showPackConfirmDialog(cost, () => {
          // Вызываем с флагом skipCostCheck чтобы не зациклиться
          const b = document.querySelector('.lootbox__open-btn');
          if (b) clickBuyButton(true);
        });
      }
    }, true);
  }

  function normalizeKeyCode(code){
    if(!code)return'';
    const c=String(code).trim();
    if(/^Key[A-Z]$/i.test(c))return'Key'+c.slice(-1).toUpperCase();
    if(/^Digit[0-9]$/.test(c))return c;
    const a={' ':'Space','Spacebar':'Space','Space':'Space','Enter':'Enter','NumpadEnter':'Enter','Escape':'Escape','Esc':'Escape','Tab':'Tab','Backspace':'Backspace','Delete':'Delete','Insert':'Insert','Home':'Home','End':'End','PageUp':'PageUp','PageDown':'PageDown','ArrowUp':'ArrowUp','ArrowDown':'ArrowDown','ArrowLeft':'ArrowLeft','ArrowRight':'ArrowRight'};
    return a[c]||c;
  }
  function codeToLabel(code){
    const n=normalizeKeyCode(code);
    if(n==='Space')return'Пробел'; if(n==='Enter')return'Enter'; if(n==='Escape')return'Esc';
    if(/^Key[A-Z]$/.test(n))return n.slice(3); if(/^Digit[0-9]$/.test(n))return n.slice(5);
    if(/^Arrow/.test(n))return n.replace('ArrowUp','↑').replace('ArrowDown','↓').replace('ArrowLeft','←').replace('ArrowRight','→');
    return n||'—';
  }
  function isTypingTarget(el){ return el&&(el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.isContentEditable); }
  function getPack20(){ return document.querySelector('.lootbox__middle-item[data-count="20"]'); }
  function isPack20Active(){ const e=getPack20(); return !!(e&&e.classList.contains('lootbox__middle-item--active')); }
  function selectPack20(){ const e=getPack20(); if(e&&!isPack20Active())e.click(); }
  function clickBuyButton(skipCostCheck){
    const b=document.querySelector('.lootbox__open-btn'); if(!b)return;
    const s=window.getComputedStyle(b); if(s.display==='none'||s.visibility==='hidden'||b.disabled||b.classList.contains('disabled'))return;
    if(!skipCostCheck && cfg.modGuard){
      const cost=getActivePack20Cost();
      if(cost===100||cost===500){ showPackConfirmDialog(cost,()=>b.click()); return; }
    }
    b.click();
  }
  function getCardsFromActiveRow(){ const r=getActiveRow(); return r?[...r.querySelectorAll('.lootbox__card')]:[];}
  function clickCardByIndex(i){ if(isConfirmDialogOpen())return; const c=getCardsFromActiveRow()[i]; if(c)c.click(); }

  function showToast(text){
    cptInjectStyles();
    let t=document.getElementById('cv-toast');
    if(!t){
      t=document.createElement('div');
      t.id='cv-toast';
      t.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:999;max-width:calc(100vw - 16px);box-sizing:border-box;font-family:\'Segoe UI\',Arial,sans-serif;pointer-events:none;';
      const head=document.createElement('div'); head.className='cpt-head';
      const titleEl=document.createElement('span'); titleEl.className='cv-toast-title';
      head.appendChild(titleEl);
      const subEl=document.createElement('div'); subEl.className='cpt-sub cv-toast-sub';
      const bar=document.createElement('div'); bar.className='cpt-bar cv-toast-bar';
      t.append(head,subEl,bar);
      document.body.appendChild(t);
    }
    t.className='cpt-toast cpt-neon-blue';
    const head=t.querySelector('.cpt-head');
    const titleEl=t.querySelector('.cv-toast-title');
    const subEl=t.querySelector('.cv-toast-sub');
    const bar=t.querySelector('.cv-toast-bar');
    head.querySelector('svg')?.remove();
    head.insertAdjacentHTML('afterbegin',CPT_ICO.check||CPT_ICO.info||'');
    titleEl.textContent='Р“РѕСЂСЏС‡РёРµ РєР»Р°РІРёС€Рё';
    subEl.textContent=text;
    if(bar)cptAnimBar(bar);
    t.classList.remove('hide');
    clearTimeout(showToast._t);
    showToast._t=setTimeout(()=>t.classList.add('hide'),2200);
  }

  let captureState=null;
  let hkPanel,hkExpanded,hkCollapsedBtn,hkSummary;

  function makeHkField(labelText,settingKey){
    const row=document.createElement('div'); row.style.cssText='display:flex;flex-direction:column;gap:5px;margin-bottom:10px';
    const label=document.createElement('label'); label.textContent=labelText; label.style.cssText='font-size:11px;color:#64748b';
    const input=document.createElement('input'); input.type='text'; input.value=codeToLabel(cfg[settingKey]); input.readOnly=true; input.dataset.settingKey=settingKey;
    input.style.cssText='width:100%;border:1px solid #1e293b;border-radius:7px;background:#0f172a;color:#e2e8f0;padding:7px 10px;font-size:13px;outline:none;cursor:pointer;transition:border-color .15s';
    input.addEventListener('click',()=>startKeyCapture(input,settingKey));
    row.appendChild(label); row.appendChild(input); return {row,input};
  }
  function startKeyCapture(input,settingKey){
    if(captureState){ captureState.input.value=codeToLabel(cfg[captureState.settingKey]); captureState.input.style.borderColor='#1e293b'; }
    captureState={input,settingKey}; input.value='Нажмите клавишу...'; input.style.borderColor='#0ea5e9';
  }
  function finishKeyCapture(code){
    if(!captureState)return;
    const {input,settingKey}=captureState, norm=normalizeKeyCode(code);
    cfg[settingKey]=norm; saveCfg(); input.value=codeToLabel(norm); input.style.borderColor='#1e293b'; captureState=null;
    refreshHkSummary();
  }
  function cancelKeyCapture(){ if(!captureState)return; captureState.input.value=codeToLabel(cfg[captureState.settingKey]); captureState.input.style.borderColor='#1e293b'; captureState=null; }
  function refreshHkSummary(){ if(!hkSummary)return; hkSummary.innerHTML=`Купить: <b style="color:#e2e8f0">${codeToLabel(cfg.buyKey)}</b><br>← <b style="color:#e2e8f0">${codeToLabel(cfg.leftKey)}</b> &nbsp;↕ <b style="color:#e2e8f0">${codeToLabel(cfg.middleKey)}</b> &nbsp;→ <b style="color:#e2e8f0">${codeToLabel(cfg.rightKey)}</b><br>Защитное окно: <b style="color:#e2e8f0">${codeToLabel(cfg.guardConfirmKey)}</b> выбрать &nbsp; <b style="color:#e2e8f0">${codeToLabel(cfg.guardCancelKey)}</b> отмена`; }
  function setHkPanelCollapsed(c){
    cfg.panelCollapsed=!!c; saveCfg();
    if(!hkExpanded||!hkCollapsedBtn||!hkPanel)return;
    suiteApplyCollapsibleState(hkPanel,!!c,()=>{
      hkExpanded.style.display=c?'none':'block';
      hkCollapsedBtn.style.display=c?'flex':'none';
    });
  }

  function createHotkeyPanel(){
    if(!cfg.modHotkeys||!location.pathname.includes('/cards/pack'))return;
    if(hkPanel?.isConnected) return;
    hkPanel=document.createElement('div'); hkPanel.style.cssText='position:fixed;right:14px;top:50%;transform:translateY(-50%);z-index:999;font-family:\'Segoe UI\',sans-serif';
    hkExpanded=document.createElement('div'); hkExpanded.style.cssText='width:230px;background:#0a0f1a;color:#e2e8f0;border:1px solid #1e293b;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.6);overflow:hidden';
    const hdr=document.createElement('div'); hdr.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#0f172a;border-bottom:1px solid #1e293b';
    const title=document.createElement('div'); title.textContent='⌨ Горячие клавиши'; title.style.cssText='font-size:13px;font-weight:700';
    const colBtn=document.createElement('button'); colBtn.textContent='—'; colBtn.type='button'; colBtn.style.cssText='width:26px;height:26px;border:none;border-radius:7px;background:#1e293b;color:#94a3b8;cursor:pointer;font-size:14px;line-height:1';
    colBtn.addEventListener('click',()=>setHkPanelCollapsed(true)); hdr.append(title,colBtn);
    const body=document.createElement('div'); body.style.cssText='padding:12px;max-height:calc(100dvh - 70px);overflow-y:auto;overscroll-behavior:contain';
    const info=document.createElement('div'); info.textContent='Кликни поле и нажми клавишу'; info.style.cssText='font-size:11px;color:#334155;margin-bottom:10px';
    const buyF=makeHkField('Купить пак','buyKey'), leftF=makeHkField('Левая карта','leftKey'), midF=makeHkField('Средняя карта','middleKey'), rightF=makeHkField('Правая карта','rightKey');
    const guardOkF=makeHkField('Защитное окно: да','guardConfirmKey'), guardCancelF=makeHkField('Защитное окно: отмена','guardCancelKey');
    hkSummary=document.createElement('div'); hkSummary.style.cssText='margin-top:10px;padding:9px;border-radius:8px;background:#0f172a;font-size:11px;line-height:1.8;color:#64748b'; refreshHkSummary();
    const resetBtn=document.createElement('button'); resetBtn.type='button'; resetBtn.textContent='По умолчанию'; resetBtn.style.cssText='width:100%;margin-top:10px;border:none;border-radius:8px;background:#1e293b;color:#94a3b8;padding:8px;cursor:pointer;font-size:12px';
    resetBtn.addEventListener('click',()=>{ ['buyKey','leftKey','middleKey','rightKey','guardConfirmKey','guardCancelKey'].forEach(k=>{ cfg[k]=DEFAULT_SETTINGS[k]; }); saveCfg(); [buyF,leftF,midF,rightF,guardOkF,guardCancelF].forEach(f=>f.input.value=codeToLabel(cfg[f.input.dataset.settingKey])); refreshHkSummary(); setHkPanelCollapsed(false); });
    body.append(info,buyF.row,leftF.row,midF.row,rightF.row,guardOkF.row,guardCancelF.row,hkSummary,resetBtn); hkExpanded.append(hdr,body);
    hkCollapsedBtn=document.createElement('button'); hkCollapsedBtn.type='button'; hkCollapsedBtn.textContent='⌨'; hkCollapsedBtn.title='Горячие клавиши';
    hkCollapsedBtn.style.cssText='width:44px;height:44px;display:none;align-items:center;justify-content:center;border:1px solid #1e293b;border-radius:12px;background:#0a0f1a;color:#e2e8f0;cursor:pointer;font-size:20px;box-shadow:0 6px 20px rgba(0,0,0,.5)';
    hkCollapsedBtn.addEventListener('click',()=>setHkPanelCollapsed(false));
    hkPanel.append(hkExpanded,hkCollapsedBtn); document.body.appendChild(hkPanel);
    // Восстанавливаем сохранённую позицию панели хоткеев
    if(cfg.hkPanelLeft!==null && cfg.hkPanelTop!==null){
      hkPanel.style.transform='none';
      hkPanel.style.top=cfg.hkPanelTop+'px';
      hkPanel.style.left=cfg.hkPanelLeft+'px';
      hkPanel.style.right='auto';
    }
    // Перетаскиваем hkPanel за заголовок hkExpanded
    makeDraggable(hkPanel, hdr, (left,top)=>{
      cfg.hkPanelLeft=left; cfg.hkPanelTop=top; saveCfg();
    });
    setHkPanelCollapsed(!!cfg.panelCollapsed);
  }

  function cleanupHotkeyPanel(){
    cancelKeyCapture();
    hkPanel?.remove();
    hkPanel = null;
    hkExpanded = null;
    hkCollapsedBtn = null;
    hkSummary = null;
  }

  const KEY_COOLDOWN_MS = 600; // минимальный интервал между срабатываниями одной клавиши
  const keyCooldowns = {};

  function isKeyCoolingDown(code) {
    const now = Date.now();
    if (keyCooldowns[code] && now - keyCooldowns[code] < KEY_COOLDOWN_MS) return true;
    keyCooldowns[code] = now;
    return false;
  }

  document.addEventListener('keydown',function(e){
    if(captureState){ e.preventDefault(); e.stopPropagation(); if(e.code==='Escape'){cancelKeyCapture();return;} if(/^(Shift|Control|Alt|Meta)(Left|Right)$/.test(e.code))return; finishKeyCapture(e.code); return; }
    if(isTypingTarget(document.activeElement)||e.repeat)return;
    if(!cfg.modHotkeys||!location.pathname.includes('/cards/pack'))return;
    if(isConfirmDialogOpen()){
      if(e.code===normalizeKeyCode(cfg.guardConfirmKey)){ e.preventDefault(); if(!isKeyCoolingDown(e.code)) confirmGuardSelection(); return; }
      if(e.code===normalizeKeyCode(cfg.guardCancelKey)){ e.preventDefault(); if(!isKeyCoolingDown(e.code)) cancelGuardSelection(); return; }
    }
    if(e.code===normalizeKeyCode(cfg.buyKey)){ e.preventDefault(); if(!isKeyCoolingDown(e.code)){ selectPack20(); setTimeout(()=>isPack20Active()&&clickBuyButton(),50); } return; }
    if(e.code===normalizeKeyCode(cfg.leftKey)){ e.preventDefault(); if(!isKeyCoolingDown(e.code)) clickCardByIndex(0); return; }
    if(e.code===normalizeKeyCode(cfg.middleKey)){ e.preventDefault(); if(!isKeyCoolingDown(e.code)) clickCardByIndex(1); return; }
    if(e.code===normalizeKeyCode(cfg.rightKey)){ e.preventDefault(); if(!isKeyCoolingDown(e.code)) clickCardByIndex(2); return; }
  },true);

  // ============================================================
  //  АВТООТКРЫТИЕ ПАКОВ
  // ============================================================

  let autoPanel=null, autoRunInput=null, autoTargetInput=null, autoStatusEl=null, autoCountEl=null;
  let autoLoopTimer=null, autoOpenedCount=Number(cfg.autoOpenedCount)||0, autoWaitingManual=false, autoBusy=false;
  let autoLastChosenPackId='', autoManualPackId='';
  let autoPausedAfterReload=false;
  const AUTO_DELAY_START=250;
  const AUTO_DELAY_BEFORE_PICK=900;
  const AUTO_DELAY_AFTER_PICK=650;
  const AUTO_DELAY_AFTER_BUY=1000;
  const AUTO_DELAY_WAIT_HIGHLIGHT=500;
  const AUTO_DELAY_WAIT_CLOSE=350;
  const AUTO_DELAY_BEFORE_BUY=180;
  const AUTO_DELAY_RARE_VIEW=3000;

  function isAutoOpenAvailable() {
    return !!(cfg.modCardValue && cfg.modBestCard && cfg.modAutoOpen && location.pathname.includes('/cards/pack'));
  }
  function setAutoStatus(text) { if(autoStatusEl) autoStatusEl.textContent=text; }
  function updateAutoCount() {
    if(autoCountEl) {
      const limit=Number(cfg.autoOpenTarget)||0;
      autoCountEl.textContent=limit>0?`${autoOpenedCount}/${limit}`:`${autoOpenedCount}/∞`;
    }
  }
  function saveAutoOpenedCount() {
    cfg.autoOpenedCount=Math.max(0, Number(autoOpenedCount)||0);
    saveCfg();
  }
  function resetAutoOpenedCount() {
    autoOpenedCount=0;
    cfg.autoOpenedCount=0;
    saveCfg();
    updateAutoCount();
  }
  function pauseAutoOpenAfterReload() {
    if(!cfg.autoOpenEnabled || autoPausedAfterReload) return;
    cfg.autoOpenEnabled=false;
    autoPausedAfterReload=true;
    const limit=Number(cfg.autoOpenTarget)||0;
    if(limit>0 && autoOpenedCount>=limit) {
      resetAutoOpenedCount();
    } else {
      saveCfg();
    }
    if(hasActivePremium()) savePremiumDesiredSettings();
    if(autoRunInput) autoRunInput.checked=false;
    updateAutoOpenPanel();
  }
  function stopAutoOpen(reason='Остановлено') {
    cfg.autoOpenEnabled=false; saveCfg();
    if(autoRunInput) autoRunInput.checked=false;
    clearTimeout(autoLoopTimer); autoLoopTimer=null;
    autoBusy=false; autoWaitingManual=false;
    autoOpenSuppressGuard=false;
    autoPausedAfterReload=false;
    autoLastChosenPackId=''; autoManualPackId='';
    setAutoStatus(reason);
    updateAutoCount();
  }
  function pauseAutoOpen(reason,packId='') {
    cfg.autoOpenEnabled=true; saveCfg();
    if(autoRunInput) autoRunInput.checked=true;
    autoBusy=false; autoWaitingManual=true;
    autoOpenSuppressGuard=true;
    autoManualPackId=packId||getActiveRow()?.getAttribute('data-pack-id')||'';
    clearTimeout(autoLoopTimer); autoLoopTimer=null;
    setAutoStatus(reason);
  }
  function handleAutoManualPick(card) {
    if(!autoWaitingManual || !cfg.autoOpenEnabled || !isAutoOpenAvailable()) return;
    const row=card.closest('.lootbox__row[data-pack-id]');
    if(!row) return;
    const packId=row.getAttribute('data-pack-id')||'';
    if(autoManualPackId && packId && packId!==autoManualPackId) return;
    autoWaitingManual=false;
    autoOpenSuppressGuard=false;
    autoManualPackId='';
    autoLastChosenPackId=packId;
    autoOpenedCount++;
    saveAutoOpenedCount();
    updateAutoCount();
    const limit=Number(cfg.autoOpenTarget)||0;
    if(limit>0 && autoOpenedCount>=limit) {
      stopAutoOpen('Готово');
      return;
    }
    autoBusy=false;
    setAutoStatus('Ручной выбор принят, жду следующий пак...');
    scheduleAutoLoop(AUTO_DELAY_AFTER_PICK);
  }
  function scheduleAutoLoop(delay=350) {
    clearTimeout(autoLoopTimer);
    if(cfg.autoOpenEnabled && isAutoOpenAvailable()) autoLoopTimer=setTimeout(autoOpenStep,delay);
  }
  function getVisibleBestCards() {
    const row=getActiveRow();
    if(!row) return [];
    return [...row.querySelectorAll('.lootbox__card.cv-best-card')].filter(c=>c.isConnected);
  }
  function getAutoCardIdentity(card) {
    const img=card.querySelector('img');
    const src=(img?.getAttribute('data-src')||img?.getAttribute('src')||'').replace(/\?.*$/,'');
    const name=(
      card.querySelector('.anime-cards__name,.card__name,.lootbox__card-name')?.textContent
      || img?.alt
      || ''
    ).replace(/\s+/g,' ').trim();
    return `${src}|${name}`;
  }
  function areSameAutoCards(cards) {
    if(!cards || cards.length<2) return false;
    const first=getAutoCardIdentity(cards[0]);
    return !!first && cards.every(c=>getAutoCardIdentity(c)===first);
  }
  function needsAutoRareViewDelay(card) {
    const r=computeCardValue(card);
    const rank=(r?.rankUpper||'').toUpperCase();
    return rank==='S' || rank==='ASS' || rank.endsWith('_PLUS');
  }
  function hasOpenCardsReady() {
    const cards=getCardsFromActiveRow();
    return cards.length>0;
  }
  function getCurrentStoneBalance() {
    const el=document.querySelector('.lootbox__balance');
    if(!el) return null;
    return parseInt(el.textContent.replace(/\D/g,''),10)||0;
  }
  function startAutoOpen() {
    if(isPremiumLockedSetting('modAutoOpen')){
      cfg.modAutoOpen=false;
      cfg.autoOpenEnabled=false;
      saveCfg();
      if(autoRunInput) autoRunInput.checked=false;
      setAutoStatus('Нужно возвышение');
      warnPremiumRequired();
      return;
    }
    if(warnCardStatsDemandRequired('packs_demand')) {
      cfg.autoOpenEnabled=false;
      saveCfg();
      if(autoRunInput) autoRunInput.checked=false;
      setAutoStatus('Нужна статистика карт');
      return;
    }
    if(!isAutoOpenAvailable()) {
      cfg.autoOpenEnabled=false; saveCfg();
      if(autoRunInput) autoRunInput.checked=false;
      setAutoStatus('Включи ценность и подсветку');
      return;
    }
    cfg.autoOpenEnabled=true; saveCfg();
    autoPausedAfterReload=false;
    autoWaitingManual=false;
    autoOpenSuppressGuard=false;
    autoBusy=false;
    setAutoStatus('Запуск...');
    updateAutoCount();
    scheduleAutoLoop(AUTO_DELAY_START);
  }
  function autoClickBestCard(card) {
    autoBusy=true;
    const extraDelay=needsAutoRareViewDelay(card)?AUTO_DELAY_RARE_VIEW:0;
    setAutoStatus('Выбираю лучшую карту...');
    if(extraDelay)setAutoStatus('Редкая карта, пауза 3 сек...');
    setTimeout(()=>{
      if(!cfg.autoOpenEnabled){ autoBusy=false; return; }
      autoLastChosenPackId=getActiveRow()?.getAttribute('data-pack-id')||'';
      autoOpenSuppressGuard=true;
      try {
        card.click();
      } finally {
        autoOpenSuppressGuard=false;
      }
      autoOpenedCount++;
      saveAutoOpenedCount();
      updateAutoCount();
      const limit=Number(cfg.autoOpenTarget)||0;
      if(limit>0 && autoOpenedCount>=limit) {
        stopAutoOpen('Готово');
        return;
      }
      autoBusy=false;
      setAutoStatus('Жду следующий пак...');
      scheduleAutoLoop(AUTO_DELAY_AFTER_PICK);
    },AUTO_DELAY_BEFORE_PICK+extraDelay);
  }
  function autoBuyPack() {
    const stones=getCurrentStoneBalance();
    if(stones!==null && stones<1600) {
      stopAutoOpen('Не хватает камней');
      return;
    }
    autoBusy=true;
    setAutoStatus('Покупаю пак...');
    selectPack20();
    setTimeout(()=>{
      if(!cfg.autoOpenEnabled){ autoBusy=false; return; }
      clickBuyButton(true);
      autoBusy=false;
      setAutoStatus('Жду карты...');
      scheduleAutoLoop(AUTO_DELAY_AFTER_BUY);
    },AUTO_DELAY_BEFORE_BUY);
  }
  function autoOpenStep() {
    if(autoBusy || !cfg.autoOpenEnabled) return;
    if(isPremiumLockedSetting('modAutoOpen')) {
      stopAutoOpen('Нужно возвышение');
      warnPremiumRequired();
      return;
    }
    if(warnCardStatsDemandRequired('packs_demand')) {
      stopAutoOpen('Нужна статистика карт');
      return;
    }
    if(!isAutoOpenAvailable()) { stopAutoOpen('Модуль выключен'); return; }

    const limit=Number(cfg.autoOpenTarget)||0;
    if(limit>0 && autoOpenedCount>=limit) { stopAutoOpen('Готово'); return; }

    if(hasOpenCardsReady()) {
      const packId=getActiveRow()?.getAttribute('data-pack-id')||'';
      if(packId && packId===autoLastChosenPackId) {
        setAutoStatus('Жду закрытие пака...');
        scheduleAutoLoop(AUTO_DELAY_WAIT_CLOSE);
        return;
      }
      addCardValue();
      const best=getVisibleBestCards();
      if(best.length===1) { autoClickBestCard(best[0]); return; }
      if(best.length>1 && areSameAutoCards(best)) { autoClickBestCard(best[0]); return; }
      if(best.length>1) { pauseAutoOpen('Пауза: выбери одну из лучших',packId); return; }
      setAutoStatus('Жду подсветку...');
      scheduleAutoLoop(AUTO_DELAY_WAIT_HIGHLIGHT);
      return;
    }

    autoBuyPack();
  }
  function createAutoOpenPanel() {
    if(autoPanel || !location.pathname.includes('/cards/pack')) return;
    pauseAutoOpenAfterReload();
    autoPanel=document.createElement('div');
    autoPanel.id='cv-auto-open-panel';
    autoPanel.style.cssText=[
      'position:fixed',
      'left:14px',
      'top:50%',
      'transform:translateY(-50%)',
      'z-index:999',
      'width:230px',
      'background:rgba(12,12,22,.98)',
      'color:#e2e8f0',
      'border:1px solid rgba(255,255,255,.09)',
      'border-radius:12px',
      'box-shadow:0 8px 40px rgba(0,0,0,.7)',
      'font-family:\'Segoe UI\',sans-serif',
      'overflow:hidden',
      'display:none',
      'user-select:none'
    ].join(';');

    const hdr=document.createElement('div');
    hdr.style.cssText=[
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'padding:9px 14px',
      'background:linear-gradient(90deg,#164e63,#0891b2)',
      'cursor:move'
    ].join(';');
    const title=document.createElement('div');
    title.textContent='🤖 Автопаки';
    title.style.cssText='font-size:13px;font-weight:700';
    const close=document.createElement('button');
    close.type='button';
    close.textContent='×';
    close.style.cssText=[
      'background:none',
      'border:none',
      'color:#64748b',
      'cursor:pointer',
      'font-size:20px',
      'line-height:1',
      'padding:0'
    ].join(';');
    close.addEventListener('click',()=>{
      stopAutoOpen('Остановлено');
      cfg.modAutoOpen=false;
      saveCfg();
      autoPanel.style.display='none';
    });
    hdr.append(title,close);

    const body=document.createElement('div');
    body.style.cssText=[
      'padding:12px 14px',
      'display:flex',
      'flex-direction:column',
      'gap:10px',
      'max-height:calc(100dvh - 70px)',
      'overflow-y:auto',
      'overscroll-behavior:contain'
    ].join(';');
    const runRow=document.createElement('div');
    runRow.style.cssText=[
      'display:flex',
      'align-items:center',
      'justify-content:space-between'
    ].join(';');
    const runLabel=document.createElement('span');
    runLabel.textContent='Работа';
    runLabel.style.cssText='font-size:12px;color:#cbd5e1';
    const runToggle=document.createElement('label'); runToggle.className='suite-toggle';
    autoRunInput=document.createElement('input');
    autoRunInput.type='checkbox';
    autoRunInput.checked=!!cfg.autoOpenEnabled;
    const runSlider=document.createElement('span'); runSlider.className='suite-slider';
    runToggle.append(autoRunInput,runSlider); runRow.append(runLabel,runToggle);

    const countWrap=document.createElement('label');
    countWrap.style.cssText=[
      'display:flex',
      'flex-direction:column',
      'gap:5px',
      'font-size:11px',
      'color:#64748b'
    ].join(';');
    countWrap.textContent='Количество паков (0 = без лимита и сброс)';
    autoTargetInput=document.createElement('input');
    autoTargetInput.type='number';
    autoTargetInput.min='0';
    autoTargetInput.step='1';
    autoTargetInput.value=Number(cfg.autoOpenTarget)||0;
    autoTargetInput.style.cssText=[
      'width:100%',
      'box-sizing:border-box',
      'border:1px solid #164e63',
      'border-radius:8px',
      'background:rgba(15,23,42,.72)',
      'color:#e2e8f0',
      'padding:7px 9px',
      'font-size:13px',
      'outline:none'
    ].join(';');
    countWrap.appendChild(autoTargetInput);

    autoStatusEl=document.createElement('div');
    autoStatusEl.style.cssText=[
      'min-height:18px',
      'padding:7px 8px',
      'border-radius:8px',
      'background:#0f172a',
      'color:#94a3b8',
      'font-size:11px',
      'line-height:1.35',
      'border:1px solid rgba(255,255,255,.06)'
    ].join(';');
    autoCountEl=document.createElement('div');
    autoCountEl.style.cssText='font-size:11px;color:#67e8f9;text-align:right;font-weight:700';
    body.append(runRow,countWrap,autoStatusEl,autoCountEl);
    autoPanel.append(hdr,body);
    document.body.appendChild(autoPanel);

    autoRunInput.addEventListener('change',()=>{
      if(autoRunInput.checked) startAutoOpen();
      else stopAutoOpen('Остановлено');
      if(hasActivePremium()) savePremiumDesiredSettings();
    });
    autoTargetInput.addEventListener('change',()=>{
      const nextTarget=Math.max(0,parseInt(autoTargetInput.value,10)||0);
      const currentTarget=Number(cfg.autoOpenTarget)||0;
      const shouldReset=nextTarget===0 || nextTarget!==currentTarget;
      cfg.autoOpenTarget=nextTarget;
      autoTargetInput.value=cfg.autoOpenTarget;
      if(shouldReset) resetAutoOpenedCount();
      else { saveCfg(); updateAutoCount(); }
    });

    if(cfg.autoPanelLeft!==null && cfg.autoPanelTop!==null){
      autoPanel.style.transform='none';
      autoPanel.style.left=cfg.autoPanelLeft+'px';
      autoPanel.style.top=cfg.autoPanelTop+'px';
    }
    makeDraggable(autoPanel,hdr,(left,top)=>{ cfg.autoPanelLeft=left; cfg.autoPanelTop=top; saveCfg(); });
    updateAutoOpenPanel();
    if(cfg.autoOpenEnabled && isAutoOpenAvailable()) scheduleAutoLoop(300);
  }
  function updateAutoOpenPanel() {
    if(!autoPanel) return;
    autoPanel.style.display=(cfg.modAutoOpen && location.pathname.includes('/cards/pack'))?'block':'none';
    if(!cfg.modAutoOpen && cfg.autoOpenEnabled) stopAutoOpen('Модуль выключен');
    if(autoRunInput) autoRunInput.checked=!!cfg.autoOpenEnabled;
    setAutoStatus(cfg.autoOpenEnabled?'Работает':(autoPausedAfterReload?'Пауза после перезагрузки':'Остановлено'));
    updateAutoCount();
    if(autoPanel.style.display!=='none') requestAnimationFrame(()=>suiteClampToViewport(autoPanel,{margin:8,constrainSize:true}));
  }

  // ============================================================
  //  ПАНЕЛЬ НАСТРОЕК
  // ============================================================

  function makeCrownIcon(size=16){
    const wrap=document.createElement('span');
    wrap.className='suite-crown-icon';
    wrap.title='Возвышение';
    wrap.style.cssText=`display:inline-flex;align-items:center;justify-content:center;width:${size+10}px;height:${size+6}px;margin-left:6px;border-radius:4px;background:#c76a22;color:#fff;vertical-align:-3px;flex:0 0 auto;box-shadow:inset 0 -1px 0 rgba(0,0,0,.18);`;
    wrap.innerHTML=`<i class="fas fa-crown" style="font-size:${Math.max(10,size-4)}px;line-height:1;"></i>`;
    return wrap;
  }
  function appendCrown(target,size=16){
    if(!target||target.querySelector?.('.suite-crown-icon'))return;
    target.appendChild(makeCrownIcon(size));
  }
  function fillMenuLabel(el,label){
    const parts=String(label).split(' ');
    const lead=parts.length>1?parts.shift():'';
    const text=parts.join(' ')||String(label);
    el.textContent='';
    el.style.display='inline-flex';
    el.style.alignItems='center';
    el.style.minWidth='0';
    const icon=document.createElement('span');
    icon.className='suite-menu-leading-icon';
    icon.textContent=lead;
    icon.style.cssText='width:20px;min-width:20px;text-align:center;margin-right:5px;line-height:1;display:inline-flex;align-items:center;justify-content:center;';
    const txt=document.createElement('span');
    txt.className='suite-menu-label-text';
    txt.textContent=text;
    txt.style.cssText='min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    if(lead)el.appendChild(icon);
    el.appendChild(txt);
  }

  const SUITE_MENU_TOOLTIPS = {
    modCardValue: 'добавляет ценность карты в значение зафисящем от спроса. готовых обменять. количество карт, так же наличие у вас дублей и хотите ли вы ее или нет, работает как в паках так и в трейдах (в трейдах хорошо раскрывается на S ранге).',
    modBestCard: 'Выделяет самую ценную карту при открытии пака.',
    modGuard: 'не дает выбрать карт с меньшей ценнностью чем есть в паке, разницу можно отрегулировать ползунком ниже.',
    modAutoOpen: 'Автоматически открывает паки выбирая лучшую карту, можно выставить нужное количество паков, при выпадение нескольких лучших карт нужно выбрать самому.',
    modStats: 'Собирает историю выпавших и выбранных карт.',
    modHotkeys: 'Включает быстрые действия с клавиатуры.',
    modGuarantee: 'Показывает прогресс до гарантированной карты.',
    modOnlyPack20: 'Ограничивает покупку паков только паком за 1600.',
    modNeon: 'Добавляет цветные обводки и подсветку карт (красный - в блоке, фиолетовый - зафиксирована, зеленый - в листе желаемого, оранжевый - дубль, синий - в трейде).',
    modNeonAnimation: 'Включает движение и мерцание неоновой рамки.',
    modMenuBg: 'растягивает фон на все меню в окошке которое открывается по нажатию на свою аватарку на любой странице сайта.',
    modProfileBtns: 'Добавляет быстрые кнопки на страницах в профиля по которым можно быстро перейти на нужную страницу пользователя.',
    modEnlightenment: 'подсчитывает полное просветление у клуба на странице всех клубов.',
    modVoteCardsToggle: 'Сворачивает блоки голосования за карты.',
    modSuggestionAuthors: 'показывает предложку и авторов замен и S карт на голосовании',
    modCustomPush: 'Заменяет стандартные уведомления сайта на красивые всплывающие.',
    modStones: 'Отслеживает камни и прогресс их накопления.',
    modChatStoneAutoloot: 'автолут камня в кинотеатре, ну я хз, если уж вы не это не поймете то другие слова бессильны будут',
    modGachaAutoloot: 'Автолут гачи клуба, если это не понятно, то я не знаю как еще объяснить. ах да, можете на странице клуба выбрать что лутать, а что нет',
    modAutoLootCards: 'Автоматически получает карты за просмотр аниме.',
    modWantCards: 'Добавляет инструменты для добавления в желаемое в библиотеке карт и на странице аниме.',
    wantButtonsAlways: 'Показывает кнопки всегда, а не только при наведении, если выключить функцию кнопки будут появляться только при наведения на ряд карт.',
    modNoNeedCards: 'Добавляет инструменты для работы с ненужными картами на странице ваших карт.',
    noNeedButtonsAlways: 'Показывает кнопки всегда, а не только при наведении, если выключить функцию кнопки будут появляться только при наведения на ряд карт.',
    modBrickFill: 'Подбирает карты для превращения в энергию кирпича.',
    modRemelt: 'Помогает выбирать карты для переплавки.',
    modLabyrinthQuiz: 'Подсвечивает ответы в викторине лабиринта.',
    modLabyrinthEmission: 'Добавляет окончания выброса и таймер до начала нового выброса.',
    modLabyrinthFatigue: 'показывает статистику ходов после усталости, отката, мимика для лучшего контроля',
    modLabyrinthClubWar: 'Подсвечивает союзные и вражеские клубы.'
  };

  const SUITE_PREMIUM_TOOLTIP_TEXT = 'Требуется Возвышение.';
  PREMIUM_REQUIRED_SETTINGS.forEach(key=>{
    if(SUITE_MENU_TOOLTIPS[key] && !SUITE_MENU_TOOLTIPS[key].includes(SUITE_PREMIUM_TOOLTIP_TEXT)) {
      SUITE_MENU_TOOLTIPS[key] += `\n${SUITE_PREMIUM_TOOLTIP_TEXT}`;
    }
  });

  const SUITE_MENU_SLIDER_TOOLTIPS = {
    menuBgDim: 'Регулирует затемнение фона меню.',
    menuTextClarity: 'Делает текст меню контрастнее на фоне.'
  };

  const SUITE_TOOLTIP_ACCENTS = ['#f59e0b','#38bdf8','#22c55e','#a78bfa','#fb7185','#facc15'];
  let suiteMenuTooltipEl = null;
  let suiteMenuTooltipTimer = null;

  function getSuiteMenuTooltip(){
    if(suiteMenuTooltipEl && document.body.contains(suiteMenuTooltipEl)) return suiteMenuTooltipEl;
    suiteMenuTooltipEl = document.createElement('div');
    suiteMenuTooltipEl.id = 'suite-menu-tooltip';
    document.body.appendChild(suiteMenuTooltipEl);
    return suiteMenuTooltipEl;
  }

  function placeSuiteMenuTooltip(row, tip){
    const rect = row.getBoundingClientRect();
    const width = 270;
    const gap = 12;
    let left = rect.right + gap;
    if(left + width > window.innerWidth - 8) left = rect.left - width - gap;
    let top = rect.top + rect.height / 2;
    top = Math.max(18, Math.min(window.innerHeight - 18, top));
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${top}px`;
  }

  function placeSuiteMenuTouchTooltip(row, tip){
    const rect = row.getBoundingClientRect();
    const width = Math.min(270, window.innerWidth - 16);
    let left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    let top = rect.bottom + 8;
    if(top + tip.offsetHeight > window.innerHeight - 8) top = Math.max(8, rect.top - tip.offsetHeight - 8);
    tip.style.width = `${width}px`;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  function renderSuiteMenuTooltip(tip, text){
    tip.textContent = '';
    const premiumIndex = text.indexOf(SUITE_PREMIUM_TOOLTIP_TEXT);
    if(premiumIndex < 0) {
      tip.textContent = text;
      return;
    }
    const mainText = text.slice(0, premiumIndex).trim();
    if(mainText) tip.appendChild(document.createTextNode(mainText));
    const premiumText = document.createElement('span');
    premiumText.className = 'suite-menu-tooltip-premium';
    premiumText.textContent = SUITE_PREMIUM_TOOLTIP_TEXT;
    tip.appendChild(premiumText);
  }

  function bindSuiteMenuTooltip(row, text){
    if(!row || !text || row.dataset.suiteTooltipBound === '1') return;
    row.dataset.suiteTooltipBound = '1';
    const showTip = (touch=false)=>{
      const tip = getSuiteMenuTooltip();
      clearTimeout(suiteMenuTooltipTimer);
      renderSuiteMenuTooltip(tip, text);
      tip.classList.toggle('is-touch', touch);
      tip.style.width = '';
      tip.style.setProperty('--suite-tip-accent', SUITE_TOOLTIP_ACCENTS[Math.floor(Math.random() * SUITE_TOOLTIP_ACCENTS.length)]);
      if(touch) {
        tip.classList.add('show');
        placeSuiteMenuTouchTooltip(row, tip);
        suiteMenuTooltipTimer = setTimeout(()=>tip.classList.remove('show','is-touch'), 4200);
      } else {
        placeSuiteMenuTooltip(row, tip);
        tip.classList.add('show');
      }
    };
    row.addEventListener('mouseenter',()=>{
      showTip(false);
    });
    row.addEventListener('mousemove',()=>{
      if(!suiteMenuTooltipEl?.classList.contains('show')) return;
      if(suiteMenuTooltipEl.classList.contains('is-touch')) return;
      placeSuiteMenuTooltip(row, suiteMenuTooltipEl);
    });
    row.addEventListener('mouseleave',()=>{
      if(!suiteMenuTooltipEl?.classList.contains('is-touch')) suiteMenuTooltipEl?.classList.remove('show');
    });
    row.addEventListener('click',e=>{
      if(!window.matchMedia?.('(hover: none)').matches) return;
      if(e.target.closest('input,button,label,.suite-toggle,[type="range"]')) return;
      showTip(true);
    });
  }

  function makeToggle(key, label){
    const row=document.createElement('div');
    row.style.cssText=[
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'padding:8px 0',
      'border-bottom:1px solid #0f172a'
    ].join(';');

    const lbl=document.createElement('span');
    lbl.style.cssText='font-size:13px;color:#cbd5e1;min-width:0;flex:1 1 auto;padding-right:10px;';
    fillMenuLabel(lbl,label);

    const toggle=document.createElement('label');
    toggle.className='suite-toggle';

    const input=document.createElement('input');
    input.type='checkbox';
    input.checked=!!cfg[key];
    input.addEventListener('change',()=>{
      if(input.checked && isPremiumLockedSetting(key)){
        input.checked = false;
        cfg[key] = false;
        enforcePremiumSettings();
        warnPremiumRequired();
        return;
      }
      cfg[key]=input.checked;
      saveCfg();
      if(hasActivePremium() && isPremiumRequiredSetting(key)) savePremiumDesiredSettings();
      document.dispatchEvent(new CustomEvent('suite-setting-change',{
        detail:{ key, value:input.checked }
      }));
    });

    const slider=document.createElement('span');
    slider.className='suite-slider';
    toggle.append(input,slider);
    row.append(lbl,toggle);
    bindSuiteMenuTooltip(row, SUITE_MENU_TOOLTIPS[key]);
    applyPremiumLockToToggle(row,key);
    return row;
  }

  function applyPremiumLockToToggle(row,key){
    if(!isPremiumRequiredSetting(key)) return;
    if(row.dataset.premiumLockBound !== '1'){
      row.dataset.premiumLockBound = '1';
      row.addEventListener('click',e=>{
        if(!isPremiumLockedSetting(key)) return;
        e.preventDefault();
        e.stopPropagation();
        warnPremiumRequired();
      },true);
    }

    const input=row.querySelector('input[type="checkbox"]');
    if(!input) return;

    const locked=isPremiumLockedSetting(key);
    if(locked){
      input.checked = false;
      input.disabled = true;
      row.style.opacity = '0.45';
      row.style.cursor = 'not-allowed';
      row.title = 'Нужно возвышение';
    } else {
      input.disabled = false;
      row.style.opacity = '';
      row.style.cursor = '';
      row.title = '';
    }
  }

  function makeSliderRow(key, label, min, max, step){
    const row=document.createElement('div'); row.style.cssText='padding:8px 0;border-bottom:1px solid #0f172a';
    const top=document.createElement('div'); top.style.cssText='display:flex;justify-content:space-between;margin-bottom:6px';
    const lbl=document.createElement('span'); lbl.textContent=label; lbl.style.cssText='font-size:13px;color:#cbd5e1';
    const val=document.createElement('span'); val.textContent=cfg[key]; val.style.cssText='font-size:13px;color:#0ea5e9;font-weight:700';
    const slider=document.createElement('input'); slider.type='range'; slider.min=min; slider.max=max; slider.step=step; slider.value=cfg[key];
    slider.addEventListener('input',()=>{ cfg[key]=Number(slider.value); val.textContent=cfg[key]; saveCfg(); });
    top.append(lbl,val); row.append(top,slider); return row;
  }

  function makePercentSliderRow(key, label, min, max, step, onChange){
    const row=document.createElement('div');
    row.style.cssText='padding:8px 0 8px 14px;border-bottom:1px solid #0f172a;border-left:2px solid #1e3a5f;margin-left:6px';
    const top=document.createElement('div');
    top.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:10px';
    const lbl=document.createElement('span');
    lbl.textContent=label;
    lbl.style.cssText='font-size:13px;color:#cbd5e1;min-width:0;';
    const val=document.createElement('span');
    val.style.cssText='font-size:13px;color:#0ea5e9;font-weight:800;white-space:nowrap';
    const slider=document.createElement('input');
    slider.type='range';
    slider.min=String(min);
    slider.max=String(max);
    slider.step=String(step);
    slider.value=Math.min(max, Math.max(min, Number(cfg[key] ?? DEFAULT_SETTINGS[key])));
    const render=()=>{
      const value=Number(slider.value);
      cfg[key]=Number(value.toFixed(2));
      val.textContent=Math.round(cfg[key]*100)+'%';
      saveCfg();
      if(typeof onChange==='function') onChange();
    };
    slider.addEventListener('input',render);
    val.textContent=Math.round(Number(slider.value)*100)+'%';
    top.append(lbl,val);
    row.append(top,slider);
    bindSuiteMenuTooltip(row, SUITE_MENU_SLIDER_TOOLTIPS[key]);
    return row;
  }

  function makeCustomPushScaleRow(){
    const row=document.createElement('div');
    row.style.cssText='padding:8px 0 10px 14px;border-bottom:1px solid #0f172a;border-left:2px solid #1e3a5f;margin-left:6px';
    const top=document.createElement('div');
    top.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:10px';
    const lbl=document.createElement('span');
    lbl.textContent='Масштаб уведомлений';
    lbl.style.cssText='font-size:13px;color:#cbd5e1';
    const val=document.createElement('span');
    val.style.cssText='font-size:13px;color:#0ea5e9;font-weight:800;white-space:nowrap';
    const slider=document.createElement('input');
    slider.type='range';
    slider.min='0.8';
    slider.max='1.4';
    slider.step='0.05';
    slider.value=cptGetScale();
    const render=()=>{
      const scale=Number(slider.value);
      cfg.customPushScale=Number(scale.toFixed(2));
      val.textContent=cfg.customPushScale.toFixed(2).replace(/\.?0+$/,'')+'x';
      saveCfg();
      cptApplyScale();
      cptShow('__cpt-scale-preview','bell','Пример уведомления',`Масштаб ${val.textContent}`,CPT_CLS['neon-blue']);
    };
    slider.addEventListener('input',render);
    val.textContent=cptGetScale().toFixed(2).replace(/\.?0+$/,'')+'x';
    top.append(lbl,val);
    row.append(top,slider);
    return row;
  }

  document.addEventListener('suite-setting-change',e=>{
    const key = e.detail?.key;
    if(!key) return;
    if(isPremiumLockedSetting(key)){
      cfg[key] = false;
      enforcePremiumSettings();
      warnPremiumRequired();
      return;
    }
    if(key==='modCardValue'){
      if(!cfg.modCardValue && (cfg.modAutoOpen || cfg.autoOpenEnabled)){
        stopAutoOpen('Модуль выключен');
        updateAutoOpenPanel();
      }
      debouncedAddCardValue();
      return;
    }
    if(key==='modBestCard'){
      if(cfg.modAutoOpen && !cfg.modBestCard){
        cfg.modBestCard = true;
        saveCfg();
        document.querySelectorAll('#suite-settings-panel input[type="checkbox"]').forEach(input=>{
          const row = input.closest('div');
          const text = row?.querySelector('.suite-menu-label-text')?.textContent || '';
          if(text.includes('Подсветка лучшей карты')) input.checked = true;
        });
      }
      debouncedAddCardValue();
      return;
    }
    if(key==='modStats'){ if(cfg.modStats) insertStatsButton(); else cleanupStatsUi(); insertGuaranteeInfo(); return; }
    if(key==='modGuarantee'){ insertGuaranteeInfo(); return; }
    if(key==='modOnlyPack20'){ applyOnlyPack20(); return; }
    if(key==='modNeon'){ if(cfg.modNeon) setupNeonObservers(); else cleanupNeonUi(); return; }
    if(key==='modNeonAnimation'){ applyNeonAnimationSetting(); return; }
    if(key==='modMenuBg'){ if(cfg.modMenuBg) applyMenuBackground(); else cleanupMenuBackground(); return; }
    if(key==='modProfileBtns'){ if(cfg.modProfileBtns) addProfileButtons(); else cleanupProfileButtons(); return; }
    if(key==='modEnlightenment'){ if(cfg.modEnlightenment) applyEnlightenment(); else cleanupEnlightenment(); return; }
    if(key==='modHotkeys'){ if(cfg.modHotkeys) createHotkeyPanel(); else cleanupHotkeyPanel(); return; }
    if(key==='modStones'){ if(cfg.modStones) initStones(); else cleanupStonesUi(); return; }
    if(key==='modChatStoneAutoloot'){ if(cfg.modChatStoneAutoloot) initChatStoneAutoloot(); else cleanupChatStoneAutoloot(); return; }
    if(key==='modGachaAutoloot'){ if(cfg.modGachaAutoloot) initGachaAutoloot(); else cleanupGachaAutoloot(); return; }
    if(key==='modSuggestionAuthors'){ if(cfg.modSuggestionAuthors) initSuggestionAuthors(); else cleanupSuggestionAuthors(); return; }
    if(key==='modWantCards'){
      if(cfg.modWantCards) initWantCards();
      else if(typeof window.__suiteWantCardsCleanup==='function') window.__suiteWantCardsCleanup();
      return;
    }
    if(key==='modLabyrinthQuiz'){
      if(cfg.modLabyrinthQuiz) initLabyrinthQuiz();
      else cleanupLabyrinthQuiz();
      return;
    }
    if(key==='modLabyrinthFatigue'){
      if(cfg.modLabyrinthFatigue) initLabyrinthFatigue();
      else cleanupLabyrinthFatigue();
      return;
    }
    if(key==='modLabyrinthClubWar'){
      if(cfg.modLabyrinthClubWar) initClubWarRelations();
      else cleanupClubWarRelations();
      return;
    }
    if(key==='modNoNeedCards'){
      if(cfg.modNoNeedCards) initNoNeedCards();
      else if(typeof window.__suiteNoNeedCardsCleanup==='function') window.__suiteNoNeedCardsCleanup();
      return;
    }
  });

  function applySuiteSettingsButtonUpdateState(btn, state) {
    if(!btn) return;
    btn.classList.toggle('suite-update-available', !!state.hasUpdate);
    btn.title = state.hasUpdate && state.remoteVersion
      ? `Доступна версия ${state.remoteVersion}`
      : 'Настройки ANIMESSS SUITE';
  }

  function createSettingsPanel(){
    enforcePremiumSettings();
    const panel=document.createElement('div'); panel.id='suite-settings-panel';
    panel.style.cssText=[
      'display:none',
      'position:fixed',
      'top:50%',
      'right:20px',
      'transform:translateY(-50%)',
      'width:fit-content',
      'max-width:calc(100vw - 24px)',
      'max-height:90vh',
      'overflow:visible',
      'background:transparent',
      'border:0',
      'border-radius:0',
      'box-shadow:none',
      'contain:layout',
      'z-index:999',
      "font-family:'Segoe UI',sans-serif",
      'color:#e2e8f0'
    ].join(';');

    const keepSettingsPanelInViewport = () => {
      const margin = 12;
      const viewport = suiteGetVisibleViewport();
      const maxHeight = Math.max(160, viewport.height - margin * 2);
      panel.style.maxHeight = maxHeight + 'px';
      if (panel.style.display === 'none') return;
      suiteClampToViewport(panel, {margin, constrainSize:true});
    };
    panel._suiteKeepInViewport = keepSettingsPanelInViewport;

    const hdr=document.createElement('div');
    hdr.className='suite-settings-header';
    hdr.style.cssText=[
      'background:linear-gradient(135deg,rgba(8,145,178,.55),rgba(15,23,42,.96))',
      'padding:14px 18px',
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'border:1px solid rgba(103,232,249,.24)',
      'border-radius:20px',
      'box-shadow:0 0 0 1px rgba(34,211,238,.10),inset 0 1px 0 rgba(255,255,255,.08)',
      'margin-bottom:12px',
      'z-index:1'
    ].join(';');
    const titleWrap=document.createElement('div');
    titleWrap.style.cssText='display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap;';
    const htitle=document.createElement('div');
    htitle.innerHTML='⚙️ <b>Меню настроек</b>';
    htitle.style.cssText='font-size:15px;';
    const versionBadge=document.createElement('span');
    versionBadge.textContent=`v${SUITE_ACCESS_VERSION}`;
    versionBadge.style.cssText=[
      'display:inline-flex',
      'align-items:center',
      'height:20px',
      'padding:0 7px',
      'border-radius:999px',
      'background:#111c2f',
      'border:1px solid rgba(103,232,249,.18)',
      'color:#93c5fd',
      'font-size:11px',
      'font-weight:800',
      'line-height:1'
    ].join(';');
    const updateBtn=document.createElement('button');
    updateBtn.type='button';
    updateBtn.textContent='Обновить';
    updateBtn.style.cssText=[
      'display:none',
      'height:22px',
      'padding:0 8px',
      'border-radius:7px',
      'border:1px solid #0ea5e9',
      'background:#082f49',
      'color:#e0f2fe',
      'font-size:11px',
      'font-weight:800',
      'cursor:pointer',
      'font-family:inherit'
    ].join(';');
    updateBtn.addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
      window.open(SUITE_SCRIPT_DOWNLOAD_URL, '_blank', 'noopener,noreferrer');
    });
    titleWrap.append(htitle,versionBadge,updateBtn);
    const closeBtn=document.createElement('button');
    closeBtn.textContent='×';
    closeBtn.style.cssText=[
      'background:none',
      'border:none',
      'color:#475569',
      'cursor:pointer',
      'font-size:24px',
      'line-height:1',
      'padding:0'
    ].join(';');
    closeBtn.addEventListener('click',()=>panel.style.display='none');
    hdr.append(titleWrap,closeBtn);
    subscribeSuiteUpdateState(state=>{
      updateBtn.style.display=state.hasUpdate ? 'inline-flex' : 'none';
      versionBadge.title=`Текущая версия: ${SUITE_ACCESS_VERSION}`;
      if(state.remoteVersion) {
        versionBadge.title += `. Версия в репозитории: ${state.remoteVersion}`;
      }
      if(state.hasUpdate) {
        updateBtn.title=`Доступна версия ${state.remoteVersion}`;
      }
    });

    const body=document.createElement('div');
    body.style.cssText='padding:0;max-height:calc(100dvh - 100px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;';

    cfg.settingsSections = { ...DEFAULT_SETTINGS.settingsSections, ...(cfg.settingsSections||{}) };
    const sectionNav=document.createElement('div');
    sectionNav.className='suite-section-nav';
    const sectionsHost=document.createElement('div');
    sectionsHost.className='suite-sections-host';
    const sectionEntries=[];
    body.append(sectionNav,sectionsHost);
    const getSectionTabOpenWidth=(entry)=>{
      const label = entry.tab.querySelector('.suite-section-tab-label');
      const labelWidth = Math.ceil(label?.scrollWidth || 0);
      return Math.max(44, Math.min(260, 26 + 18 + 8 + labelWidth + 10));
    };
    const getCompactMenuPlateWidth=()=>{
      const count = sectionEntries.length;
      if(!count) return 0;
      return 18 + count * 44 + Math.max(0, count - 1) * 8;
    };
    const clearSectionHover=()=>{
      sectionEntries.forEach(entry=>entry.tab.classList.remove('is-hovered'));
    };
    const getEntryFromNavPointer=(event)=>{
      const navRect = sectionNav.getBoundingClientRect();
      if(event.clientX < navRect.left || event.clientX > navRect.right ||
         event.clientY < navRect.top || event.clientY > navRect.bottom) {
        return null;
      }
      const x = event.clientX - navRect.left;
      const rects = sectionEntries.map(entry=>({
        entry,
        rect:entry.tab.getBoundingClientRect()
      }));
      const direct = rects.find(({rect})=>
        event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom
      );
      if(direct) return direct.entry;

      for(let index = 0; index < rects.length - 1; index += 1){
        const current = rects[index].rect;
        const next = rects[index + 1].rect;
        if(event.clientX > current.right && event.clientX < next.left) {
          return rects[index + 1].entry;
        }
      }
      if(x < 8) return sectionEntries[0] || null;
      return null;
    };
    const setSectionHoverFromPointer=(event)=>{
      const hovered = getEntryFromNavPointer(event);
      sectionEntries.forEach(entry=>entry.tab.classList.toggle('is-hovered', entry === hovered));
      syncMenuPlateWidthToContent();
    };
    const syncMenuPlateWidthToContent=()=>{
      const compactWidth = getCompactMenuPlateWidth();
      let width = compactWidth;
      let openWidth = 44;
      sectionEntries.forEach(entry=>{
        const entryOpenWidth = getSectionTabOpenWidth(entry);
        entry.tab.style.setProperty('--suite-section-tab-open-width', entryOpenWidth + 'px');
        if(entry.tab.classList.contains('is-active') || entry.tab.classList.contains('is-hovered')){
          width += entryOpenWidth - 44;
          openWidth = Math.max(openWidth, entryOpenWidth);
        }
      });
      if(width > 0) panel.style.setProperty('--suite-menu-plate-width', Math.ceil(width) + 'px');
      panel.style.setProperty('--suite-section-tab-open-width', Math.ceil(openWidth) + 'px');
    };
    const scheduleMenuPlateWidthSync=()=>{
      requestAnimationFrame(()=>{
        syncMenuPlateWidthToContent();
        requestAnimationFrame(syncMenuPlateWidthToContent);
        setTimeout(syncMenuPlateWidthToContent, 320);
      });
    };
    sectionNav.addEventListener('mousemove', setSectionHoverFromPointer);
    sectionNav.addEventListener('mouseleave', ()=>{
      clearSectionHover();
      syncMenuPlateWidthToContent();
    });
    sectionNav.addEventListener('click', event=>{
      const entry = getEntryFromNavPointer(event);
      if(!entry) return;
      event.preventDefault();
      event.stopPropagation();
      setActiveSection(entry.key);
    }, true);
    const splitSectionTitle=(title)=>{
      const raw=String(title||'').trim();
      const parts=raw.split(/\s+/);
      const icon=parts.length>1?parts.shift():'';
      return { icon: icon || '•', text: parts.join(' ') || raw };
    };
    const setActiveSection=(key)=>{
      const current=sectionEntries.find(entry=>entry.key===key && entry.content.classList.contains('is-active'));
      const nextKey=current ? '' : key;
      sectionEntries.forEach(entry=>{
        const active=entry.key===nextKey;
        entry.content.classList.toggle('is-active',active);
        entry.tab.classList.toggle('is-active',active);
        entry.tab.setAttribute('aria-selected',active?'true':'false');
        cfg.settingsSections[entry.key]=active;
      });
      saveCfg();
      scheduleMenuPlateWidthSync();
      requestAnimationFrame(keepSettingsPanelInViewport);
    };
    const makeSection=(key,title)=>{
      const meta=splitSectionTitle(title);
      const tab=document.createElement('button');
      tab.type='button';
      tab.className='suite-section-tab';
      tab.setAttribute('role','tab');
      tab.setAttribute('aria-label',meta.text);
      const icon=document.createElement('span');
      icon.className='suite-section-tab-icon';
      icon.textContent=meta.icon;
      const label=document.createElement('span');
      label.className='suite-section-tab-label';
      label.textContent=meta.text;
      tab.append(icon,label);
      const content=document.createElement('div');
      content.className='suite-section-panel';
      sectionEntries.push({key,tab,content});
      sectionNav.appendChild(tab);
      sectionsHost.appendChild(content);
      return content;
    };
    // ── ЦЕННОСТЬ КАРТ ──────────────────────────────────────────
    const cardValueSection = makeSection('cardValue','⭐ Ценность');

    const cardValueRow = makeToggle('modCardValue', '⭐ Ценность карт');
    appendCrown(cardValueRow.querySelector('.suite-menu-label-text'));
    cardValueSection.appendChild(cardValueRow);

    // Зависимые: подсветка лучшей карты и защитное окно
    const bestCardRow = makeToggle('modBestCard', '🏆 Подсветка лучшей карты');
    const guardRow    = makeToggle('modGuard',    '🛡️ Защитное окно');
    const guardGroup  = document.createElement('div');
    const autoOpenRow = makeToggle('modAutoOpen', '🤖 Автооткрытие паков');

    // Отступ для визуального "вложения"
    [bestCardRow, guardGroup, autoOpenRow].forEach(r => {
      r.style.paddingLeft = '14px';
      r.style.borderLeft  = '2px solid #1e3a5f';
      r.style.marginLeft  = '6px';
    });

    const guardSliderRow = makeSliderRow('guardThreshold','Порог защитного окна',5,50,1);
    guardSliderRow.style.padding = '0 0 8px 0';
    guardSliderRow.style.borderBottom = '1px solid #0f172a';
    guardSliderRow.style.display = cfg.modGuard ? 'block' : 'none';
    guardGroup.append(guardRow, guardSliderRow);

    function syncDependents() {
      const on = cfg.modCardValue;
      const guardOn = on && cfg.modGuard;
      [bestCardRow, guardGroup, autoOpenRow].forEach(r => {
        r.style.opacity       = on ? '1' : '0.35';
        r.style.pointerEvents = on ? '' : 'none';
      });
      guardSliderRow.style.display = guardOn ? 'block' : 'none';
      guardSliderRow.style.opacity = guardOn ? '1' : '0.35';
      guardSliderRow.style.pointerEvents = guardOn ? '' : 'none';
      if (!on) {
        // Только визуально снимаем галочки — cfg не трогаем, чтобы состояние сохранилось
        [bestCardRow, guardRow, autoOpenRow].forEach(r => { const inp = r.querySelector('input'); if(inp) inp.checked = false; });
        if(cfg.modAutoOpen || cfg.autoOpenEnabled){
          stopAutoOpen('Модуль выключен');
          updateAutoOpenPanel();
        }
      } else {
        // Восстанавливаем галочки из cfg (которое не было затронуто при выключении)
        bestCardRow.querySelector('input').checked = !!cfg.modBestCard;
        guardRow.querySelector('input').checked    = !!cfg.modGuard;
        autoOpenRow.querySelector('input').checked  = !!cfg.modAutoOpen;
        updateAutoOpenPanel();
      }
    }
    cardValueRow.querySelector('input').addEventListener('change', syncDependents);
    guardRow.querySelector('input').addEventListener('change', syncDependents);
    autoOpenRow.querySelector('input').addEventListener('change', () => {
      if(
        cfg.modAutoOpen
        && location.pathname.includes('/cards/pack')
        && warnCardStatsDemandRequired('packs_demand')
      ){
        cfg.modAutoOpen=false;
        cfg.autoOpenEnabled=false;
        saveCfg();
        autoOpenRow.querySelector('input').checked=false;
        updateAutoOpenPanel();
        return;
      }
      if(cfg.modAutoOpen && !cfg.modBestCard){
        cfg.modBestCard = true;
        saveCfg();
        const bestCardInput = bestCardRow.querySelector('input');
        if(bestCardInput) bestCardInput.checked = true;
        debouncedAddCardValue();
      }
      if(cfg.modAutoOpen) createAutoOpenPanel();
      updateAutoOpenPanel();
    });
    syncDependents();

    cardValueSection.appendChild(bestCardRow);
    cardValueSection.appendChild(guardGroup);
    cardValueSection.appendChild(autoOpenRow);

    // ── ПАКИ ──────────────────────────────────────────────────
    const packsSection = makeSection('packs','🎁 Паки');
    packsSection.appendChild(makeToggle('modStats',   '📊 Статистика паков'));
    packsSection.appendChild(makeToggle('modHotkeys', '⌨️ Горячие клавиши'));
    const guaranteeRow = makeToggle('modGuarantee', '🏅 Расчёт гаранта');
    guaranteeRow.querySelector('input').addEventListener('change', () => insertGuaranteeInfo());
    packsSection.appendChild(guaranteeRow);

    const onlyPack20Row = makeToggle('modOnlyPack20', '💎 Только паки за 1600');
    onlyPack20Row.querySelector('input').addEventListener('change', () => applyOnlyPack20());
    packsSection.appendChild(onlyPack20Row);

    // ── UI ────────────────────────────────────────────────────
    const uiSection = makeSection('ui','🖥️ UI');
    uiSection.appendChild(makeToggle('modProfileBtns',   '🔍 Кнопки в профиле'));
    uiSection.appendChild(makeToggle('modEnlightenment', '🧘 Просветление на странице клубов'));
    const voteCardsRow = makeToggle('modVoteCardsToggle', '🗳️ Скрытие голосования');
    voteCardsRow.querySelector('input').addEventListener('change', () => {
      if(cfg.modVoteCardsToggle) initVoteCardsToggle();
      else cleanupVoteCardsToggle();
    });
    uiSection.appendChild(voteCardsRow);
    const suggestionAuthorsRow = makeToggle('modSuggestionAuthors', '📬 Предложка и авторы');
    suggestionAuthorsRow.querySelector('input').addEventListener('change', () => {
      if(cfg.modSuggestionAuthors) initSuggestionAuthors();
      else cleanupSuggestionAuthors();
    });
    uiSection.appendChild(suggestionAuthorsRow);
    const stonesRow = makeToggle('modStones',        '💎 Учет камней');
    stonesRow.querySelector('input').addEventListener('change', () => { if(cfg.modStones) initStones(); });
    uiSection.appendChild(stonesRow);
    const chatStoneRow = makeToggle('modChatStoneAutoloot', '💎 Автолут камня');
    chatStoneRow.querySelector('input').addEventListener('change', () => {
      if(cfg.modChatStoneAutoloot) initChatStoneAutoloot();
      else cleanupChatStoneAutoloot();
    });
    uiSection.appendChild(chatStoneRow);
    const gachaAutolootRow = makeToggle('modGachaAutoloot', '🎰 Автолут гачи');
    gachaAutolootRow.querySelector('input').addEventListener('change', () => {
      if(cfg.modGachaAutoloot) initGachaAutoloot();
      else cleanupGachaAutoloot();
    });
    uiSection.appendChild(gachaAutolootRow);

    // ── ВИЗУАЛ ────────────────────────────────────────────────
    const visualSection = makeSection('visual','🎨 Визуал');
    const neonRow = makeToggle('modNeon', '✨ Неоновые обводки');
    const neonAnimationRow = makeToggle('modNeonAnimation', '↻ Анимация неоновой обводки');
    neonAnimationRow.style.paddingLeft = '14px';
    neonAnimationRow.style.borderLeft = '2px solid #1e3a5f';
    neonAnimationRow.style.marginLeft = '6px';
    const syncNeonAnimationRow = () => {
      neonAnimationRow.style.opacity = cfg.modNeon ? '1' : '0.35';
      neonAnimationRow.style.pointerEvents = cfg.modNeon ? '' : 'none';
      neonAnimationRow.querySelector('input').checked = !!cfg.modNeonAnimation;
    };
    neonRow.querySelector('input').addEventListener('change', syncNeonAnimationRow);
    syncNeonAnimationRow();
    visualSection.append(neonRow, neonAnimationRow);
    const menuBgRow = makeToggle('modMenuBg', '🎬 Фон меню');
    const refreshMenuBgTuning = () => {
      const wrapper = document.querySelector('.lgn.is-active .lgn__inner, .lgn.done .lgn__inner, .lgn .lgn__inner');
      if(cfg.modMenuBg) {
        applyMenuBgTuning(wrapper);
        applyMenuBackground();
      }
    };
    const menuDimRow = makePercentSliderRow('menuBgDim', 'Затемнение фона', 0, 0.6, 0.02, refreshMenuBgTuning);
    const menuTextRow = makePercentSliderRow('menuTextClarity', 'Четкость текста', 0, 1, 0.02, refreshMenuBgTuning);
    const syncMenuBgRows = () => {
      [menuDimRow, menuTextRow].forEach(row=>{
        row.style.opacity = cfg.modMenuBg ? '1' : '0.35';
        row.style.pointerEvents = cfg.modMenuBg ? '' : 'none';
      });
    };
    menuBgRow.querySelector('input').addEventListener('change', syncMenuBgRows);
    syncMenuBgRows();
    visualSection.append(menuBgRow, menuDimRow, menuTextRow);
    const customPushRow = makeToggle('modCustomPush',    '🔔 Кастомные уведомления');
    customPushRow.querySelector('input').addEventListener('change', () => {
      if(cfg.modCustomPush) installCustomPush();
      else {
        const dlePushEl=document.getElementById('DLEPush');
        if(dlePushEl) dlePushEl.style.display='';
      }
    });
    visualSection.appendChild(customPushRow);
    visualSection.appendChild(makeCustomPushScaleRow());

    const cardsSection = makeSection('cards','🃏 Карты');
    const autoLootRow = makeToggle('modAutoLootCards', '🃏 Автолут карт');
    autoLootRow.querySelector('input').addEventListener('change', () => {
      if(cfg.modAutoLootCards) initAutoLootCards();
      else if(typeof window.__suiteAutoLootCardsCleanup==='function') window.__suiteAutoLootCardsCleanup();
    });
    cardsSection.appendChild(autoLootRow);
    const wantRow = makeToggle('modWantCards', '💙 Работа с желаемым');
    cardsSection.appendChild(wantRow);
    const wantButtonsRow = makeToggle('wantButtonsAlways', '↳ Кнопки постоянно');
    wantButtonsRow.style.paddingLeft='22px';
    wantButtonsRow.style.borderLeft='2px solid #334155';
    wantButtonsRow.style.marginLeft='12px';
    cardsSection.appendChild(wantButtonsRow);
    const noNeedRow = makeToggle('modNoNeedCards', '🗑 Работа с ненужным');
    cardsSection.appendChild(noNeedRow);
    const noNeedButtonsRow = makeToggle('noNeedButtonsAlways', '↳ Кнопки постоянно');
    noNeedButtonsRow.style.paddingLeft='22px';
    noNeedButtonsRow.style.borderLeft='2px solid #334155';
    noNeedButtonsRow.style.marginLeft='12px';
    cardsSection.appendChild(noNeedButtonsRow);

    const brickFillRow = makeToggle('modBrickFill', '🧱 Наполнение кирпича');
    appendCrown(brickFillRow.querySelector('.suite-menu-label-text'));
    brickFillRow.querySelector('input').addEventListener('change', () => {
      if(cfg.modBrickFill) initBrickFill();
      else if(typeof window.__suiteBrickFillCleanup==='function') window.__suiteBrickFillCleanup();
    });
    cardsSection.appendChild(brickFillRow);

    const remeltRow = makeToggle('modRemelt', '🔥 Переплавка');
    appendCrown(remeltRow.querySelector('.suite-menu-label-text'));
    remeltRow.querySelector('input').addEventListener('change', () => {
      if(cfg.modRemelt) initRemelt();
      else if(typeof window.__suiteRemeltCleanup==='function') window.__suiteRemeltCleanup();
    });
    cardsSection.appendChild(remeltRow);

    const labyrinthSection = makeSection('labyrinth','🌀 Лабиринт');
    const quizRow = makeToggle('modLabyrinthQuiz', '👑 Викторина');
    quizRow.querySelector('input').addEventListener('change', () => {
      if(cfg.modLabyrinthQuiz) initLabyrinthQuiz();
      else cleanupLabyrinthQuiz();
    });
    labyrinthSection.appendChild(quizRow);
    const emissionRow = makeToggle('modLabyrinthEmission', '☢️ Выброс');
    emissionRow.querySelector('input').addEventListener('change', () => {
      if(cfg.modLabyrinthEmission) initLabyrinthEmission();
      else cleanupLabyrinthEmission();
    });
    labyrinthSection.appendChild(emissionRow);
    const fatigueRow = makeToggle('modLabyrinthFatigue', '💤 Усталость');
    fatigueRow.querySelector('input').addEventListener('change', () => {
      if(cfg.modLabyrinthFatigue) initLabyrinthFatigue();
      else cleanupLabyrinthFatigue();
    });
    labyrinthSection.appendChild(fatigueRow);
    const clubWarRow = makeToggle('modLabyrinthClubWar', '⚔️ Битва клубов');
    clubWarRow.querySelector('input').addEventListener('change', () => {
      if(cfg.modLabyrinthClubWar) initClubWarRelations();
      else cleanupClubWarRelations();
    });
    labyrinthSection.appendChild(clubWarRow);

    sectionEntries.forEach(entry=>{
      entry.content.classList.remove('is-active');
      entry.tab.classList.remove('is-active');
      entry.tab.setAttribute('aria-selected','false');
      cfg.settingsSections[entry.key]=false;
    });
    saveCfg();

    panel.append(hdr,body); document.body.appendChild(panel);
    scheduleMenuPlateWidthSync();
    // Восстанавливаем сохранённую позицию панели настроек
    if(cfg.settingsPanelLeft!==null && cfg.settingsPanelTop!==null){
      panel.style.transform='none';
      panel.style.top=cfg.settingsPanelTop+'px';
      panel.style.left=cfg.settingsPanelLeft+'px';
      panel.style.right='auto';
    }
    window.addEventListener('resize', keepSettingsPanelInViewport);
    makeDraggable(panel, '#suite-settings-panel > div:first-child', (left,top)=>{
      keepSettingsPanelInViewport();
      const rect = panel.getBoundingClientRect();
      cfg.settingsPanelLeft=rect.left; cfg.settingsPanelTop=rect.top; saveCfg();
    });
    return panel;
  }

  // Кнопка открытия настроек (фиксированная, левый нижний угол)
  function createSettingsButton(){
    const btn=document.createElement('button'); btn.id='suite-settings-btn';
    btn.textContent='⚙️'; btn.title='Настройки ANIMESSS SUITE';
    btn.style.cssText='position:fixed;bottom:20px;left:20px;z-index:999;width:44px;height:44px;border-radius:12px;border:1px solid #1e293b;background:#0a0f1a;color:#e2e8f0;font-size:20px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.5);transition:background .15s;display:flex;align-items:center;justify-content:center;';
    btn.onmouseover=()=>btn.style.background='#1e293b'; btn.onmouseout=()=>btn.style.background='#0a0f1a';
    // Восстанавливаем сохранённую позицию кнопки
    if(cfg.settingsBtnLeft!==null)  {
      btn.style.left=cfg.settingsBtnLeft+'px';
      btn.style.bottom=(cfg.settingsBtnBottom||20)+'px';
      btn.style.right='auto';
    }
    document.body.appendChild(btn);
    suiteKeepInViewport(btn, {margin:8, constrainSize:false});
    btn._suitePersistFloatingPosition=()=>{
      const rect=btn.getBoundingClientRect();
      cfg.settingsBtnLeft=rect.left;
      cfg.settingsBtnBottom=Math.max(0,window.innerHeight-rect.bottom);
      saveCfg();
    };
    const panel=createSettingsPanel();
    subscribeSuiteUpdateState(state=>applySuiteSettingsButtonUpdateState(btn, state));
    startSuiteVersionChecker();

    // Перетаскивание кнопки настроек
    let btnDragging=false, btnMoved=false, bx, by, bLeft, bTop;
    const startButtonDrag=(e,point)=>{
      btnDragging=true; btnMoved=false;
      bx=point.clientX; by=point.clientY;
      const rect=btn.getBoundingClientRect();
      bLeft=rect.left;
      bTop=rect.top;
      btn.style.left=bLeft+'px';
      btn.style.top=bTop+'px';
      btn.style.right='auto';
      btn.style.bottom='auto';
      btn.style.transition='none';
      e.preventDefault();
    };
    const moveButtonDrag=(e,point)=>{
      if(!btnDragging)return;
      const dx=point.clientX-bx, dy=point.clientY-by;
      if(Math.abs(dx)>3||Math.abs(dy)>3) btnMoved=true;
      const viewport=suiteGetVisibleViewport();
      const newLeft=Math.max(viewport.left,Math.min(viewport.right-btn.offsetWidth,bLeft+dx));
      const newTop=Math.max(viewport.top,Math.min(viewport.bottom-btn.offsetHeight,bTop+dy));
      btn.style.left=newLeft+'px';
      btn.style.top=newTop+'px';
      e.preventDefault();
    };
    let suppressButtonClickUntil=0;
    const toggleSettingsPanel=()=>{
      panel.style.display=panel.style.display==='none'?'block':'none';
      if(panel.style.display !== 'none') suiteScheduleViewportRefresh();
    };
    const finishButtonDrag=(activate=false)=>{
      if(!btnDragging)return;
      btnDragging=false;
      btn.style.transition='';
      suiteClampToViewport(btn,{margin:8,constrainSize:false});
      suiteResolveFloatingButtonOverlaps(btn);
      btn._suitePersistFloatingPosition();
      if(activate&&!btnMoved){
        suppressButtonClickUntil=Date.now()+700;
        toggleSettingsPanel();
      }
    };
    btn.addEventListener('mousedown', function(e){
      if(e.button!==0)return;
      startButtonDrag(e,e);
    });
    document.addEventListener('mousemove', function(e){
      moveButtonDrag(e,e);
    });
    document.addEventListener('mouseup',finishButtonDrag);
    btn.addEventListener('touchstart',e=>startButtonDrag(e,e.touches[0]),{passive:false});
    document.addEventListener('touchmove',e=>{
      if(btnDragging) moveButtonDrag(e,e.touches[0]);
    },{passive:false});
    document.addEventListener('touchend',()=>finishButtonDrag(true));
    document.addEventListener('touchcancel',()=>finishButtonDrag(false));
    btn.addEventListener('click',e=>{
      if(Date.now()<suppressButtonClickUntil){
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if(btnMoved)return; // не открываем если тащили
      toggleSettingsPanel();
    });
  }

  // ============================================================
  //  ЗАПУСК
  // ============================================================

  // ============================================================
  //  ТОЛЬКО ПАК ЗА 1600 — скрыть кнопки 100 и 500 камней
  // ============================================================

  function applyOnlyPack20() {
    const middle = document.querySelector('.lootbox__middle');
    const items = document.querySelectorAll('.lootbox__middle-item');
    items.forEach(item => {
      const count = item.getAttribute('data-count');
      if (count === '1' || count === '6') {
        item.style.display = cfg.modOnlyPack20 ? 'none' : '';
      } else if (count === '20') {
        if (cfg.modOnlyPack20) {
          item.style.flex      = '0 0 auto';
          item.style.width     = 'auto';
          item.style.minWidth  = '160px';
          item.style.maxWidth  = '280px';
          item.style.margin    = '0';
        } else {
          item.style.flex      = '';
          item.style.width     = '';
          item.style.minWidth  = '';
          item.style.maxWidth  = '';
          item.style.margin    = '';
        }
      }
    });
    if (middle) {
      if (cfg.modOnlyPack20) {
        middle.style.display        = 'flex';
        middle.style.justifyContent = 'center';
        middle.style.alignItems     = 'center';
      } else {
        middle.style.justifyContent = '';
        middle.style.alignItems     = '';
      }
    }
    if (cfg.modOnlyPack20) {
      const pack20 = document.querySelector('.lootbox__middle-item[data-count="20"]');
      if (pack20 && !pack20.classList.contains('lootbox__middle-item--active')) pack20.click();
    }
  }

  function watchLootboxMiddle() {
    if (!location.pathname.startsWith('/cards/pack')) return;
    applyOnlyPack20();
    new MutationObserver(() => applyOnlyPack20())
      .observe(document.body, { childList: true, subtree: true });
  }

  // ============================================================
  //  РАСЧЁТ ГАРАНТА
  // ============================================================

  const GUARANTEE_PACKS      = 1800;   // паков на полный гарант
  const GUARANTEE_STONES     = 144000; // камней на полный гарант (1800 * 80)
  const PACK20_STONES        = 1600;   // стоимость 20 паков в камнях
  const PACK20_COUNT         = 20;     // паков в одной покупке за 1600

  function insertGuaranteeInfo() {
    if (!cfg.modGuarantee) {
      // Убираем элементы если выключено
      const old1 = document.getElementById('cv-guarantee-stones-inline');
      const old2 = document.getElementById('cv-guarantee-block');
      if (old1) old1.remove();
      if (old2) old2.remove();
      return;
    }

    // ── 1. Камни рядом со счётчиком оставшихся паков ──────────
    const counterSpan = document.querySelector('.lootbox__counter__s');
    if (counterSpan && !document.getElementById('cv-guarantee-stones-inline')) {
      const packsLeft = parseInt(counterSpan.textContent.replace(/\D/g, '')) || 0;
      // Формула: каждые 20 паков стоят 1600 камней
      const stonesNeeded = Math.ceil(packsLeft / PACK20_COUNT) * PACK20_STONES;
      const badge = document.createElement('span');
      badge.id = 'cv-guarantee-stones-inline';
      badge.style.cssText = [
        'display:inline-block',
        'margin-left:8px',
        'padding:2px 9px',
        'background:#1e1035',
        'border:1px solid #7c3aed',
        'border-radius:20px',
        'color:#c4b5fd',
        'font-size:12px',
        'font-weight:700',
        'vertical-align:middle',
        'white-space:nowrap',
      ].join(';');
      badge.title = `До гаранта S нужно открыть ${packsLeft} паков`;
      badge.textContent = `💎 ~${stonesNeeded.toLocaleString('ru-RU')} камней до гаранта`;
      // Вставляем после слова «паков», а не после цифры
      let inserted = false;
      const li = counterSpan.closest('li');
      if (li) {
        const nodes = [...li.childNodes];
        const spanIdx = nodes.indexOf(counterSpan);
        for (let i = spanIdx + 1; i < nodes.length; i++) {
          const node = nodes[i];
          if (node.nodeType === 3 && /паков/i.test(node.textContent)) {
            const text = node.textContent;
            const match = text.match(/^(.*?паков\.?)(\s*[\s\S]*)$/i);
            if (match) {
              const before = document.createTextNode(match[1]);
              const after  = document.createTextNode(match[2]);
              node.replaceWith(before, badge, after);
              inserted = true;
            }
            break;
          }
        }
      }
      if (!inserted) counterSpan.insertAdjacentElement('afterend', badge);
    } else if (counterSpan && document.getElementById('cv-guarantee-stones-inline')) {
      // Обновляем значение при повторном вызове
      const packsLeft = parseInt(counterSpan.textContent.replace(/\D/g, '')) || 0;
      const stonesNeeded = Math.ceil(packsLeft / PACK20_COUNT) * PACK20_STONES;
      const badge = document.getElementById('cv-guarantee-stones-inline');
      badge.textContent = `💎 ~${stonesNeeded.toLocaleString('ru-RU')} камней до гаранта`;
      badge.title = `До гаранта S нужно открыть ${packsLeft} паков`;
    }

    // ── 2. Блок с количеством гарантов и остатком ─────────────
    const balanceSpan = document.querySelector('.lootbox__balance');
    if (!balanceSpan) return;

    const stones = parseInt(balanceSpan.textContent.replace(/\D/g, '')) || 0;

    // Первый гарант берём из бейджа — там уже посчитано сколько реально нужно
    // (зависит от того сколько паков уже открыто до текущего гаранта)
    const badgeEl = document.getElementById('cv-guarantee-stones-inline');
    const firstGuaranteeStones = badgeEl
      ? (parseInt(badgeEl.textContent.replace(/[^\d]/g, '')) || GUARANTEE_STONES)
      : GUARANTEE_STONES;

    let fullGuarantees, stonesNeededForNext;
    if (stones < firstGuaranteeStones) {
      // Ещё не хватает даже на первый гарант
      fullGuarantees = 0;
      stonesNeededForNext = firstGuaranteeStones - stones;
    } else {
      // Первый гарант достигнут, считаем остаток по 144000
      const afterFirst = stones - firstGuaranteeStones;
      const extraGuarantees = Math.floor(afterFirst / GUARANTEE_STONES);
      fullGuarantees = 1 + extraGuarantees;
      const remainder = afterFirst - extraGuarantees * GUARANTEE_STONES;
      stonesNeededForNext = GUARANTEE_STONES - remainder;
    }

    // Определяем якорь для вставки блока:
    // 1. Если включена статистика и кнопка есть — после кнопки статистики
    // 2. Иначе — после label.checkbox с #packs_demand
    const statsBtn = document.getElementById('cv-stats-btn');
    const packsDemandLabel = document.querySelector('label.checkbox input#packs_demand')?.closest('label.checkbox');

    let block = document.getElementById('cv-guarantee-block');
    if (!block) {
      block = document.createElement('div');
      block.id = 'cv-guarantee-block';
      block.style.cssText = [
        'margin:10px auto 0',
        'max-width:320px',
        'background:#0a0f1a',
        'border:1px solid #1e293b',
        'border-radius:10px',
        'padding:9px 16px',
        'font-family:\'Segoe UI\',sans-serif',
        'text-align:center',
        'line-height:1.7',
      ].join(';');

      if (cfg.modStats && statsBtn) {
        statsBtn.insertAdjacentElement('afterend', block);
      } else if (packsDemandLabel) {
        packsDemandLabel.insertAdjacentElement('afterend', block);
      } else {
        // Запасной вариант — под заголовком с балансом
        const title = balanceSpan.closest('h2') || balanceSpan.parentElement;
        title.insertAdjacentElement('afterend', block);
      }
    } else {
      // Блок уже есть — перемещаем если нужно (статистика включилась/выключилась)
      const shouldBeAfter = cfg.modStats && statsBtn ? statsBtn : packsDemandLabel;
      if (shouldBeAfter && block.previousElementSibling !== shouldBeAfter) {
        shouldBeAfter.insertAdjacentElement('afterend', block);
      }
    }

    block.innerHTML = `
      <div style="font-size:13px;font-weight:700;color:#818cf8;">
        🏅 Полных гарантов: <span style="font-size:15px;color:#a78bfa">${fullGuarantees}</span>
      </div>
      <div style="font-size:13px;font-weight:700;color:#f59e0b;">
        🔮 До следующего гаранта: <span style="font-size:15px;color:#fcd34d">${stonesNeededForNext.toLocaleString('ru-RU')} 💎</span>
      </div>
    `;
  }

  function watchGuarantee() {
    if (!location.pathname.startsWith('/cards/pack')) return;
    insertGuaranteeInfo();
    let guardBusy = false;
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        const t = m.target;
        if (!t) continue;
        if (t.id === 'cv-guarantee-block' || t.id === 'cv-guarantee-stones-inline') return;
        if (typeof t.closest === 'function' &&
            (t.closest('#cv-guarantee-block') || t.closest('#cv-guarantee-stones-inline'))) return;
      }
      if (guardBusy) return;
      guardBusy = true;
      requestAnimationFrame(() => { insertGuaranteeInfo(); checkGuaranteeS(); guardBusy = false; });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  let labyrinthRouteWatcherInstalled=false;
  function setupLabyrinthQuizRouteWatcher(){
    if(labyrinthRouteWatcherInstalled) return;
    labyrinthRouteWatcherInstalled=true;
    const isLabyrinthRoute=()=>/\/labyrinth(?:\/|$)/.test(location.pathname);
    let wasLabyrinth=isLabyrinthRoute();
    let routeCheckTimer=null;
    const check=()=>{
      const isLabyrinth=isLabyrinthRoute();
      if(!isLabyrinth){
        const hasActiveModule = wasLabyrinth
          || window.__suiteLabyrinthQuizInstalled
          || window.__suiteLabyrinthEmissionInstalled
          || window.__suiteLabyrinthFatigueInstalled
          || window.__suiteClubWarRelationsInstalled;
        wasLabyrinth=false;
        if(!hasActiveModule) return;
        cleanupLabyrinthQuiz();
        cleanupLabyrinthEmission();
        cleanupLabyrinthFatigue();
        cleanupClubWarRelations();
        return;
      }
      if(wasLabyrinth) return;
      wasLabyrinth=true;
      if(cfg.modLabyrinthQuiz) initLabyrinthQuiz();
      if(cfg.modLabyrinthEmission) initLabyrinthEmission();
      if(cfg.modLabyrinthFatigue) initLabyrinthFatigue();
      if(cfg.modLabyrinthClubWar) initClubWarRelations();
    };
    const scheduleCheck=()=>{
      clearTimeout(routeCheckTimer);
      routeCheckTimer=setTimeout(check,100);
    };
    ['pushState','replaceState'].forEach(name=>{
      const original=history[name];
      if(typeof original!=='function') return;
      history[name]=function(...args){
        const result=original.apply(this,args);
        scheduleCheck();
        return result;
      };
    });
    window.addEventListener('popstate',scheduleCheck);
    window.addEventListener('hashchange',scheduleCheck);
    window.addEventListener('pageshow',scheduleCheck);
  }

  async function init(){
    await suiteAccessGate();
    insertNeonGradients();
    applyNeonAnimationSetting();
    setupNeonObservers();
    initObservers();
    observeContainer(document.querySelector('.lootbox__list'));
    observeContainer(document.querySelector('.trade__main'));
    debouncedAddCardValue();
    insertStatsButton();
    createHotkeyPanel();
    createAutoOpenPanel();
    createSettingsButton();
    applyMenuBackground();
    addProfileButtons();
    applyEnlightenment();
    // Небольшая задержка — DLEPush инициализируется чуть позже основных скриптов
    setTimeout(()=>{ installCustomPush(); }, 300);
    if(cfg.modWantCards)   initWantCards();
    if(cfg.modNoNeedCards) initNoNeedCards();
    if(cfg.modBrickFill)   initBrickFill();
    if(cfg.modRemelt)      initRemelt();
    if(cfg.modStones)      initStones();
    if(cfg.modChatStoneAutoloot) initChatStoneAutoloot();
    if(cfg.modGachaAutoloot) initGachaAutoloot();
    if(cfg.modVoteCardsToggle) initVoteCardsToggle();
    if(cfg.modSuggestionAuthors) initSuggestionAuthors();
    if(cfg.modAutoLootCards) initAutoLootCards();
    if(cfg.modLabyrinthQuiz) initLabyrinthQuiz();
    if(cfg.modLabyrinthEmission) initLabyrinthEmission();
    if(cfg.modLabyrinthFatigue) initLabyrinthFatigue();
    if(cfg.modLabyrinthClubWar) initClubWarRelations();
    setupLabyrinthQuizRouteWatcher();
    watchLootboxMiddle();
    setupBuyButtonGuard();
    watchGuarantee();
  }

  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',init); }
  else{ init(); }

  const NN_PANEL_KEY  = 'missingCardIdsPanel';
  const NN_ENABLE_KEY = 'tradeScriptEnabled';
  const NN_BATCH      = 49;
  const NN_DELAY_OK   = 2500;
  const NN_DELAY_BASE = 200;
  const NN_DELAY_MAX  = 10000;
  const NN_SCAN_DELAY = 1000;

  const nnMissingIds  = new Set(gmStoreGet(NN_PANEL_KEY, []));
  const nnDomain      = location.hostname;
  let nnEnabled       = gmStoreGet(NN_ENABLE_KEY, true);
  let nnQueue         = [], nnQueueRunning = false, nnRetryCount = 0;
  let nnAutoRunning   = false;
  let nnIsScanning    = false, nnCancelScan = false;
  let nnScanBuffer    = [], nnSentCount = 0, nnFoundTotal = 0, nnTotalPages = 0, nnCurPage = 0;
  let nnPanelCollapsed = false;
  let nnToggleBtn, nnScanBtn, nnRefreshBtn, nnStopBtn;
  let wantActiveRowId='';

  function getWantWrappers(){
    return [...document.querySelectorAll('.anime-cards__item-wrapper')]
      .filter(w=>w.querySelector('.want-card-btn,.cv-want-btn'));
  }
  function getWantRowItems(id){
    return [...document.querySelectorAll(`.anime-cards__item-wrapper[data-want-row="${id}"]`)];
  }
  function hideWantRow(){
    document.querySelectorAll('.anime-cards__item-wrapper.want-row-hover').forEach(x=>x.classList.remove('want-row-hover'));
    wantActiveRowId='';
  }
  function showWantRow(id){
    if(wantActiveRowId&&wantActiveRowId!==id)hideWantRow();
    wantActiveRowId=id;
    getWantRowItems(id).forEach(x=>x.classList.add('want-row-hover'));
  }
  function getWantRowRect(items){
    let rect=null;
    items.forEach(item=>{
      [item,item.querySelector('.want-card-btn,.cv-want-btn')].filter(Boolean).forEach(el=>{
        const r=el.getBoundingClientRect();
        if(!r.width&&!r.height)return;
        rect=rect?{left:Math.min(rect.left,r.left),top:Math.min(rect.top,r.top),right:Math.max(rect.right,r.right),bottom:Math.max(rect.bottom,r.bottom)}:{left:r.left,top:r.top,right:r.right,bottom:r.bottom};
      });
    });
    return rect;
  }
  function trackWantRowMouse(e){
    if(cfg.wantButtonsAlways){hideWantRow();return;}
    const wrapper=e.target.closest?.('.anime-cards__item-wrapper');
    if(wrapper?.dataset?.wantRow){showWantRow(wrapper.dataset.wantRow);return;}
    if(!wantActiveRowId)return;
    const rect=getWantRowRect(getWantRowItems(wantActiveRowId));
    if(!rect){hideWantRow();return;}
    const pad=8;
    if(e.clientX>=rect.left-pad&&e.clientX<=rect.right+pad&&e.clientY>=rect.top-pad&&e.clientY<=rect.bottom+pad)return;
    hideWantRow();
  }
  function applyWantButtonMode(){
    const touchDevice = window.matchMedia?.('(hover: none)').matches;
    const hoverOnly = !cfg.wantButtonsAlways && !touchDevice;
    document.body.classList.toggle('want-hover-only',hoverOnly);
    const wrappers=getWantWrappers();
    const rows=[];
    wrappers.forEach(w=>{
      if(!hoverOnly)w.classList.remove('want-row-hover');
      const top=Math.round(w.getBoundingClientRect().top);
      let row=rows.find(r=>Math.abs(r.top-top)<=12);
      if(!row){row={top,items:[]};rows.push(row);}
      row.items.push(w);
    });
    rows.forEach((row,idx)=>row.items.forEach(w=>{
      w.dataset.wantRow=String(idx);
      if(w.dataset.wantHoverBound==='1')return;
      w.dataset.wantHoverBound='1';
      w.addEventListener('mouseenter',()=>{if(document.body.classList.contains('want-hover-only'))showWantRow(w.dataset.wantRow);});
    }));
    if(!document.body.dataset.wantMouseTracker){
      document.body.dataset.wantMouseTracker='1';
      document.addEventListener('mousemove',trackWantRowMouse,true);
    }
    if(!hoverOnly)hideWantRow();
  }
  document.addEventListener('suite-setting-change',e=>{
    if(e.detail?.key==='wantButtonsAlways')applyWantButtonMode();
  });

  // ============================================================
  //  РАБОТА С ЖЕЛАЕМЫМ
  // ============================================================

  function initWantCards() {
    if(!cfg.modWantCards) return;
    if(window.__suiteWantCardsInstalled) return;
    window.__suiteWantCardsInstalled = true;
    const path = location.pathname;

    // Работаем только на:
    // 1. /cards/ и подстраницы (но не /user/, /trade/, /need/, /search_users/, /pack/)
    // 2. Страницы аниме вида /.../*.html
    const isCardsPage = /^\/cards(\/|$|\?)/.test(path) || /^\/cards\/page\//.test(path);
    const isAnimePage = /\.html$/.test(path);

    if(!isCardsPage && !isAnimePage) return;

    // Исключения для /cards/
    if(/\/user\//.test(path)) return;
    if(/\/cards\/users\/need\//.test(path)) return;
    if(/\/cards\/users\/trade\//.test(path)) return;
    if(/\/cards\/search_users\//.test(path)) return;
    if(/\/cards\/pack\//.test(path)) return;
    if(/\/cards\/[^/]+\/trade\//.test(path)) return;

    const PROPOSE_TYPE_WANT = '0';
    const activeObservers = [];
    window.__suiteWantCardsCleanup = () => {
      activeObservers.forEach(observer => { try{ observer.disconnect(); }catch(e){} });
      document.querySelectorAll('.want-card-btn').forEach(btn => btn.remove());
      document.querySelectorAll('[data-button-added]').forEach(el => delete el.dataset.buttonAdded);
      document.getElementById('fast-propose-all')?.remove();
      document.getElementById('want-btn-styles')?.remove();
      document.body.classList.remove('want-hover-only');
      hideWantRow();
      window.__suiteWantCardsInstalled = false;
    };

    function injectStyles() {
      if(document.getElementById('want-btn-styles')) return;
      const style = document.createElement('style');
      style.id = 'want-btn-styles';
      style.textContent = `
        .want-card-btn {
          width:152px; font-weight:bold; margin:5px auto; padding:5px 0;
          text-transform:uppercase; border:none; border-radius:6px;
          display:block; font-size:12px; overflow:hidden;
          transition:
            opacity .2s ease,
            transform .2s ease,
            max-height .2s ease,
            margin .2s ease,
            padding .2s ease,
            visibility 0s linear .2s,
            filter .2s ease;
        }
        .want-card-btn:hover:not(:disabled) { filter:brightness(1.1); transform:scale(1.03); }
        .want-card-btn:not(:disabled) { cursor: pointer; }
        .want-card-btn:disabled { cursor: default; }
        body.want-hover-only .want-card-btn {
          opacity:0; visibility:hidden; pointer-events:none;
          max-height:0; margin:0 auto; padding-top:0; padding-bottom:0;
          transform:translateY(-6px) scale(.98);
        }
        body.want-hover-only .want-row-hover .want-card-btn {
          opacity:1; visibility:visible; pointer-events:auto;
          max-height:40px; margin:5px auto; padding-top:5px; padding-bottom:5px;
          transform:translateY(0) scale(1);
          transition:
            opacity .2s ease,
            transform .2s ease,
            max-height .2s ease,
            margin .2s ease,
            padding .2s ease,
            visibility 0s linear 0s,
            filter .2s ease;
        }
      `;
      document.head.appendChild(style);
    }

    function applyHover(button, { hoverBg, hoverColor, hoverHTML, defaultBg, defaultColor, defaultHTML }) {
      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = hoverBg;
        button.style.color = hoverColor;
        button.innerHTML = hoverHTML;
        button.style.transform = 'scale(1.05)';
      });
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = defaultBg;
        button.style.color = defaultColor;
        button.innerHTML = defaultHTML;
        button.style.transform = 'scale(1)';
      });
    }

    function cleanupExcludedWantButtons(scope) {
      (scope||document).querySelectorAll(
        '.anime-cards-center.anime-cards--full-page .want-card-btn,'+
        '.anime-cards-center.anime-cards--full-page .all-owners,'+
        '.cards-replace-vote-list .want-card-btn,'+
        '.cards-replace-vote-list .all-owners'
      ).forEach(btn => btn.remove());
    }

    function addWantCardButtons(container) {
      const scope = container || document;
      cleanupExcludedWantButtons(scope);
      scope.querySelectorAll('[data-id]').forEach((element) => {
        if(element.closest('#cards-carousel')) return;
        if(element.closest('.ui-dialog')) return;

        // Исключение: блоки голосования
        if(element.closest('.anime-cards-center.anime-cards--full-page,.cards-replace-vote-list,.card-replace-vote')) return;

        if(element.dataset.buttonAdded) return;
        const dataId = element.getAttribute('data-id');
        const existingButton = element.parentElement.querySelector('.all-owners');
        if(existingButton) return;
        const isOwned  = element.classList.contains('anime-cards__owned-by-user');
        const isWanted = element.classList.contains('anime-cards__owned-by-user-want');
        const button = document.createElement('button');
        button.className = 'all-owners want-card-btn';
        if(isOwned) {
          button.innerHTML = 'УЖЕ ЕСТЬ';
          button.disabled = true;
          button.style.backgroundColor = '#d96a13';
          button.style.color = 'black';
        } else {
          button.setAttribute('data-id', dataId);
          button.setAttribute('data-type', PROPOSE_TYPE_WANT);
          button.style.transform = 'scale(1)';
          button.setAttribute('onclick', 'ProposeAdd.call(this); return false;');
          button.addEventListener('click', function() {
            setTimeout(() => {
              delete element.dataset.buttonAdded;
              const oldBtn = element.parentElement.querySelector('.all-owners');
              if(oldBtn) oldBtn.remove();
              addWantCardButtons(element.parentElement);
            }, 500);
          });
          if(isWanted) {
            button.innerHTML = 'ХОЧУ';
            button.style.backgroundColor = '#05801a';
            button.style.color = 'black';
            applyHover(button, {
              hoverBg: '#dc3545', hoverColor: 'black', hoverHTML: 'УДАЛИТЬ',
              defaultBg: '#05801a', defaultColor: 'black', defaultHTML: 'ХОЧУ'
            });
          } else {
            button.innerHTML = '<i class="fal fa-search"></i> В ЖЕЛАЕМОЕ';
            button.style.backgroundColor = 'lightgrey';
            button.style.color = 'black';
            applyHover(button, {
              hoverBg: '#007bff', hoverColor: 'black', hoverHTML: 'ДОБАВИТЬ',
              defaultBg: 'lightgrey', defaultColor: 'black',
              defaultHTML: '<i class="fal fa-search"></i> В ЖЕЛАЕМОЕ'
            });
          }
        }
        element.insertAdjacentElement('afterend', button);
        element.dataset.buttonAdded = 'true';
      });
      applyWantButtonMode();
    }

    function observeCards(container) {
      const scope = container || document;
      let timer = null;
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => addWantCardButtons(scope), 100);
      });
      observer.observe(scope, { childList: true, subtree: true });
      activeObservers.push(observer);
      addWantCardButtons(scope);
    }

    function addFastProposeButton() {
      if(document.querySelector('#fast-propose-all')) return;
      const progressNumber = document.querySelector('.cards-progress__number');
      if(!progressNumber) return;
      const match = progressNumber.textContent.match(/\/\s*(\d+)/);
      if(!match) return;
      if(parseInt(match[1]) >= 10) return;
      const subscribeCheckbox = document.querySelector('#subscribe_cards');
      if(!subscribeCheckbox) return;
      const animeId  = subscribeCheckbox.dataset.anime;
      const userHash = window.user_hash || document.querySelector('[name="user_hash"]')?.value;
      if(!animeId || !userHash) return;
      const button = document.createElement('button');
      button.id = 'fast-propose-all';
      button.textContent = '⚡ Добавить все карты в лист';
      button.style.cssText = 'margin-top:10px;padding:7px 12px;background:#071a10;color:#86efac;border:1px solid #14532d;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;display:block;font-family:"Segoe UI",sans-serif;transition:background .15s,border-color .15s,transform .15s;';
      let isProcessing = false;
      button.addEventListener('click', async function() {
        if(isProcessing) return;
        isProcessing = true;
        button.disabled = true;
        button.textContent = 'Отправка...';
        try {
          const response = await fetch('/index.php?controller=ajax&mod=cards_ajax', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
            body: new URLSearchParams({ action: 'fast_propose_add', anime_id: animeId, user_hash: userHash })
          });
          if(!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          const data = await response.json();
          if(data.success === false || data.error) throw new Error(data.message || data.error || 'Сервер вернул ошибку');
          button.textContent = '✅ Добавлено';
          button.style.background = '#052e16';
          button.style.color = '#bbf7d0';
          button.style.borderColor = '#166534';
        } catch(err) {
          console.error('[WantScript] Ошибка массового добавления:', err);
          button.textContent = `Ошибка: ${err.message}`;
          button.style.background = '#4c0519';
          button.style.color = '#fecdd3';
          button.style.borderColor = '#9f1239';
          button.disabled = false;
          isProcessing = false;
        }
      });
      subscribeCheckbox.closest('.cards-progress').insertAdjacentElement('afterend', button);
    }

    function observeProgress() {
      let timer = null;
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => addFastProposeButton(), 100);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      activeObservers.push(observer);
    }

    injectStyles();

    if(isAnimePage) {
      function tryAttach() {
        const btn = document.querySelector('a.glav-s[onclick^="AllAnimeCards"]');
        if(btn) {
          btn.addEventListener('click', () => {
            const container = document.querySelector('.sect.pmovie__related.sbox.cards-carousel');
            if(container) observeCards(container);
            observeProgress();
          }, { once: true });
          return true;
        }
        return false;
      }
      if(!tryAttach()) {
        const obs = new MutationObserver(() => { if(tryAttach()) obs.disconnect(); });
        obs.observe(document.body, { childList: true, subtree: true });
      }
      return;
    }

    observeCards(document);
  }

  // ============================================================
  //  РАБОТА С НЕНУЖНЫМ
  // ============================================================

  function initNoNeedCards() {
    if(!cfg.modNoNeedCards) return;
    if(window.__suiteNoNeedCardsInstalled) return;
    const myName = suiteGetCurrentUserName();
    if(!myName) return;
    const urlName = suiteDecodeNickname(new URLSearchParams(location.search).get('name') || '');
    if(!urlName || urlName.toLowerCase() !== myName.toLowerCase()) return;
    if(!/\/user\/cards\//.test(location.pathname)) return;
    window.__suiteNoNeedCardsInstalled = true;
    nnInit(myName);
  }

  function nnGetHash(source=document) {
    if(source !== document) {
      const extracted = suiteReadUserHashFromPage(source, true);
      return extracted ? suiteSaveUserHash(extracted) : suiteGetUserHash();
    }
    return suiteGetUserHash();
  }

  function nnInit(userName) {
    const currentDomain = location.hostname;
    const encodedUserName = encodeURIComponent(userName);
    const scanBaseURL = `https://${currentDomain}/user/cards/?name=${encodedUserName}&page=`;

    const ENABLE_KEY            = 'tradeScriptEnabled';
    const PANEL_KEY             = 'missingCardIdsPanel';
    const REQUEST_DELAY_SCAN    = 1000;
    const QUEUE_DELAY_SUCCESS   = 2500;
    const QUEUE_DELAY_BASE      = 200;
    const QUEUE_DELAY_MAX       = 10000;
    const BATCH_SIZE            = 49;
    const HASH_KEY              = `noNeedUserHash:${currentDomain}:${userName.toLowerCase()}`;
    const PANEL_POS_KEY         = `noNeedPanelPos:${currentDomain}:${userName.toLowerCase()}`;

    const missingIds = new Set(gmStoreGet(PANEL_KEY, []));
    let enabled      = gmStoreGet(ENABLE_KEY, true);
    let buttonsHoverOnly = !cfg.noNeedButtonsAlways;
    let refreshButton, scanButton, stopScanButton;
    let isScanning = false, cancelScan = false;
    let noNeedQueue = [], noNeedQueueRunning = false, autoNoNeedRunning = false, noNeedRetryCount = 0;
    let scanBuffer = [], scanSent = 0, scanFound = 0, scanTotalPages = 0, scanCurPage = 0;
    let panelCollapsed = false;
    let cachedUserHash = nnGetHash() || gmStoreGet(HASH_KEY, '');
    if(cachedUserHash) {
      suiteSaveUserHash(cachedUserHash);
      gmStoreSet(HASH_KEY,cachedUserHash);
    }
    document.addEventListener('suite-setting-change',e=>{
      if(e.detail?.key!=='noNeedButtonsAlways')return;
      buttonsHoverOnly=!cfg.noNeedButtonsAlways;
      applyNoNeedButtonMode();
    });

    // ── Стили ─────────────────────────────────────────────────
    if(!document.getElementById('cv-nn-style')) {
      const s = document.createElement('style');
      s.id = 'cv-nn-style';
      s.textContent = `
        .circle-btn {
          position:fixed; right:10px; width:48px; height:48px; margin-bottom:10px;
          border-radius:14px; border:1px solid var(--nn-accent,#3b82f6); font-size:21px; font-weight:bold; color:var(--nn-accent-text,#dbeafe);
          display:flex; align-items:center; justify-content:center; z-index:999;
          cursor:pointer; box-shadow:0 0 10px color-mix(in srgb,var(--nn-accent,#3b82f6) 35%,transparent),0 8px 28px rgba(0,0,0,.55);
          transition:background .18s,border-color .18s,transform .18s,filter .18s;
          backdrop-filter:blur(4px);
          background:rgba(12,12,22,.96) !important;
        }
        .circle-btn:hover { transform:translateY(-1px) scale(1.03); filter:brightness(1.12); background:rgba(15,23,42,.98) !important; }
        .circle-btn:active { transform:scale(0.97); }
        .circle-btn[data-tooltip]:hover::after {
          content:attr(data-tooltip); position:absolute; right:58px;
          background:rgba(5,7,13,.96); color:#e2e8f0; padding:5px 8px; border-radius:8px;
          border:1px solid rgba(255,255,255,.08); box-shadow:0 8px 24px rgba(0,0,0,.45);
          font-size:12px; white-space:nowrap; pointer-events:none;
          max-width:calc(100vw - 80px); overflow:hidden; text-overflow:ellipsis;
        }
        .nn-all-owners {
          width:152px; font-weight:bold; margin:5px 0; padding:5px 0;
          text-transform:uppercase; transition:all .3s ease; border:none; border-radius:6px;
        }
        .nn-all-owners:hover { filter:brightness(1.1); transform:scale(1.03); }
        .nn-btn-container {
          margin-top:4px; display:flex; justify-content:center; align-items:center;
          overflow:hidden;
          transition:
            opacity .2s ease,
            transform .2s ease,
            max-height .2s ease,
            margin .2s ease,
            visibility 0s linear .2s;
        }
        body.nn-hover-only .anime-cards__item-wrapper {
          position:relative;
        }
        body.nn-hover-only .nn-btn-container {
          opacity:0; visibility:hidden; pointer-events:none;
          max-height:0; margin-top:0;
          transform:translateY(-6px) scale(.98);
        }
        body.nn-hover-only .nn-row-hover .nn-btn-container {
          opacity:1; visibility:visible; pointer-events:auto;
          max-height:48px; margin-top:4px;
          transform:translateY(0) scale(1);
          transition:
            opacity .2s ease,
            transform .2s ease,
            max-height .2s ease,
            margin .2s ease,
            visibility 0s linear 0s;
        }
        #missing-panel {
          position:fixed; bottom:20px; left:10px; width:270px; max-height:450px;
          background:rgba(12,12,22,.98); color:#e2e8f0; border-radius:12px;
          padding:0; z-index:999; font-family:'Segoe UI',Arial,sans-serif;
          display:flex; flex-direction:column; overflow:hidden;
          border:1px solid rgba(255,255,255,.09); box-shadow:0 8px 40px rgba(0,0,0,.7);
        }
        #missing-panel-header {
          display:flex; align-items:center; justify-content:space-between;
          flex-shrink:0; padding:9px 14px;
          background:linear-gradient(90deg,#1e3a5f,#2563eb);
          font-weight:700; font-size:13px; cursor:move;
        }
        #missing-panel-title { font-size:13px; font-weight:700; color:#fff; user-select:none; }
        #missing-panel-collapse-btn {
          background:transparent; border:none; color:#fff; cursor:pointer; font-size:18px; padding:0 2px; line-height:1;
        }
        #missing-panel-collapse-btn:hover { filter:brightness(1.2); }
        #missing-panel-body { overflow-y:auto; flex:1; min-height:0; padding:10px 12px 0; }
        #missing-panel.collapsed #missing-panel-body,
        #missing-panel.collapsed #missing-panel-actions { display:none; }
        #missing-panel.collapsed { max-height:none; }
        #missing-panel .item {
          display:flex; align-items:center; gap:6px; margin:4px 0;
          padding:5px 7px; border-radius:7px; background:rgba(255,255,255,.04);
          border:1px solid rgba(255,255,255,.06);
        }
        #missing-panel .item span {
          cursor:pointer; color:#93c5fd; text-decoration:none;
          flex:1; min-width:0; word-break:break-word;
          font-size:12px; font-weight:600;
        }
        #missing-panel .item span:hover { color:#bfdbfe; }
        #missing-panel .item button { border:none; cursor:pointer; font-size:13px; border-radius:5px; padding:2px 6px; }
        .missing-del-btn { background:#4c0519; color:#fecdd3; padding:0 5px; }
        .missing-del-btn:hover { background:#9f1239; }
        #missing-panel-actions { flex-shrink:0; padding:8px 12px 12px; display:flex; flex-direction:column; gap:6px; }
        .script-indicator {
          position:fixed !important; right:10px; width:300px; max-width:calc(100vw - 20px);
          z-index:999; pointer-events:none !important;
          font-family:'Segoe UI',Arial,sans-serif;
          text-align:left;
        }
        .script-indicator .cpt-sub {
          white-space:normal;
          word-break:break-word;
        }
      `;
      document.head.appendChild(s);
    }

    function nnDelay(ms) { return new Promise(r=>setTimeout(r,ms)); }
    function saveMissing() { gmStoreSet(PANEL_KEY,[...missingIds]); }
    function loadPanelPos(){return gmStoreGet(PANEL_POS_KEY, null);}
    function savePanelPos(left,top){gmStoreSet(PANEL_POS_KEY,{left,top});}

    // ── Индикаторы ────────────────────────────────────────────
    function getNoNeedIndMeta(msg){
      const clean=String(msg||'').replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}♻️✅❌⏳🛑🗑🔁⌛]+\s*/u,'');
      const t=clean.toLowerCase();
      let icon='refresh',title='Ненужное',theme='neon-blue';
      if(t.includes('ошибка')||t.includes('повтор')||t.includes('отмен')){icon='warn';title='Ненужное';theme='neon-amber';}
      if(t.includes('готов')||t.includes('заверш')||t.includes('отправлен')){icon='check';title='Готово';theme='emerald';}
      if(t.includes('останов')){icon='warn';title='Остановка';theme='neon-amber';}
      return {clean,icon,title,themeCls:CPT_CLS[theme]||CPT_CLS['neon-blue']};
    }
    function showInd(id, msg, bottom) {
      cptInjectStyles();
      const meta=getNoNeedIndMeta(msg);
      let el=document.getElementById(id);
      if(!el){
        el=document.createElement('div');
        el.id=id;
        el.className='script-indicator cpt-toast';
        el.style.bottom=bottom;
        const head=document.createElement('div'); head.className='cpt-head';
        const titleEl=document.createElement('span'); titleEl.className='script-indicator-title';
        head.appendChild(titleEl);
        const subEl=document.createElement('div'); subEl.className='cpt-sub script-indicator-sub';
        const bar=document.createElement('div'); bar.className='cpt-bar script-indicator-bar';
        el.append(head,subEl,bar);
        document.body.appendChild(el);
      }
      el.className=`script-indicator cpt-toast ${meta.themeCls}`;
      const head=el.querySelector('.cpt-head');
      const titleEl=el.querySelector('.script-indicator-title');
      const subEl=el.querySelector('.script-indicator-sub');
      const bar=el.querySelector('.script-indicator-bar');
      if(head)head.querySelector('svg')?.remove();
      if(head)head.insertAdjacentHTML('afterbegin',CPT_ICO[meta.icon]||CPT_ICO.warn);
      if(titleEl)titleEl.textContent=meta.title;
      if(subEl)subEl.textContent=meta.clean;
      if(bar)cptAnimBar(bar);
    }
    function hideInd(id) { document.getElementById(id)?.remove(); }
    function showScanInd(m)  { showInd('scan-progress-indicator', m, '112px'); }
    function showQueueInd(m) { showInd('no-need-queue-indicator', m, '20px'); }

    // ── HTTP ─────────────────────────────────────────────────
    function parseHtmlDoc(html) { return new DOMParser().parseFromString(html,'text/html'); }
    function saveUserHash(hash) {
      if(!hash) return '';
      cachedUserHash=String(hash);
      suiteSaveUserHash(cachedUserHash);
      gmStoreSet(HASH_KEY,cachedUserHash);
      return cachedUserHash;
    }
    function extractHash(html) { return nnGetHash(parseHtmlDoc(html)); }
    function rememberHashFromHtml(html) { return saveUserHash(extractHash(html)); }
    async function refreshUserHash() {
      const pageUrl = `${scanBaseURL}1&locked=0`;
      const html = await fetchHtml(pageUrl);
      return rememberHashFromHtml(html);
    }
    async function fetchHtml(url) {
      const r=await fetch(url,{method:'GET',credentials:'same-origin'});
      if(!r.ok) throw new Error(`HTTP ${r.status} при загрузке ${url}`);
      const html=await r.text();
      rememberHashFromHtml(html);
      return html;
    }
    async function postTrade(params) {
      const r=await fetch('/index.php?controller=ajax&mod=trade_ajax',{
        method:'POST', credentials:'same-origin',
        headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},
        body:new URLSearchParams(params).toString()
      });
      try{ return JSON.parse(await r.text()); }catch(e){ return {status:null}; }
    }
    function getMaxPages(doc) {
      const nums=[...doc.querySelectorAll('.pagination__pages a')].map(a=>parseInt(a.textContent)).filter(n=>!isNaN(n));
      return nums.length?Math.max(...nums):1;
    }
    async function getTotalPages(url) {
      try{ const r=await fetch(url,{credentials:'same-origin'}); const t=await r.text(); return getMaxPages(new DOMParser().parseFromString(t,'text/html')); }catch(e){ return 1; }
    }
    function extractOwnerIds(html) {
      return [...parseHtmlDoc(html).querySelectorAll('.anime-cards__item[data-owner-id]')]
        .map(c=>c.getAttribute('data-owner-id')).filter(Boolean);
    }
    function collectNoNeed(doc) {
      return [...doc.querySelectorAll('.anime-cards__item[data-owner-id]')].filter(c=>{
        if((c.getAttribute('data-rank')||'').toLowerCase()==='sss') return false;
        if(c.getAttribute('data-proposed')!=='0') return false;
        if(c.querySelector('.lock-card-btn i.fal.fa-arrow-right-arrow-left')) return false;
        return true;
      }).map(c=>c.getAttribute('data-owner-id')).filter(Boolean);
    }
    function parseResp(text) {
      const raw=String(text||'');
      const norm=raw.replace(/\s+/g,' ').trim().toLowerCase();
      let json=null;
      try{ json=JSON.parse(raw); }catch(e){ console.debug('[parseResp] Ответ не JSON:',e.message); }
      if(json&&typeof json==='object') {
        const s=(json.status||'').replace(/\s+/g,' ').trim().toLowerCase();
        const m=(json.message||'').replace(/\s+/g,' ').trim().toLowerCase();
        const e=(json.error||'').replace(/\s+/g,' ').trim().toLowerCase();
        const cnt=Number(json.count);
        const successByStatus=s.includes('добавлены в ненуж')||s.includes('добавлено в ненуж')||s.includes('в ненужные');
        const successByMessage=m.includes('добавлены в ненуж')||m.includes('добавлено в ненуж')||m.includes('в ненужные');
        const hasKnownError=!!json.error||[s,m,e].some(x=>
          x.includes('ошибка')||x.includes('слишком быстро')||x.includes('подождите')||x.includes('429'));
        if(hasKnownError) return {ok:false,message:json.error||json.message||json.status||raw||'Ошибка сервера',count:Number.isFinite(cnt)?cnt:null};
        if(successByStatus||successByMessage) return {ok:true,message:json.status||json.message||raw||'Успешно',count:Number.isFinite(cnt)?cnt:null};
      }
      const errorHints=['ошибка','error','слишком быстро','подождите','подожди','попробуйте позже','попробуй позже','too fast','too many','429','rate limit','задержк','нельзя','не удалось','failed','forbidden','denied'];
      const successHints=['успеш','отправлен','добавлен','добавлено','карты добавлены','в ненужное','в ненужные','добавлены в ненуж'];
      if(errorHints.some(h=>norm.includes(h))) return {ok:false,message:raw||'Ошибка ответа',count:null};
      if(successHints.some(h=>norm.includes(h))) return {ok:true,message:raw||'Успешно',count:null};
      return {ok:false,message:raw||'Не удалось определить результат запроса',count:null};
    }
    async function sendIds(ids, hashHint='') {
      if(!ids||!ids.length) throw new Error('Нет ids');
      let hash=saveUserHash(hashHint)||cachedUserHash||saveUserHash(nnGetHash());
      if(!hash) hash=await refreshUserHash();
      if(!hash) throw new Error('Не найден user_hash');

      const postOnce = async (userHash) => {
      const body=new URLSearchParams();
      body.append('controller','ajax');
      body.append('mod','cards_ajax');
      body.append('action','add_no_need');
      ids.forEach(id=>body.append('ids[]',id));
        body.append('user_hash',userHash);
      const r=await fetch('/index.php?controller=ajax&mod=cards_ajax',{
        method:'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},
        body:body.toString()
      });
      const text=await r.text(), parsed=parseResp(text);
      if(!r.ok) throw new Error(`HTTP ${r.status}: ${parsed.message||text}`);
        return parsed;
      };

      let parsed=await postOnce(hash);
      if(!parsed.ok && /hash|хеш|сесс|session|token|токен/i.test(parsed.message||'')) {
        gmStoreDelete(HASH_KEY);
        suiteInvalidateUserHash();
        cachedUserHash='';
        hash=await refreshUserHash();
        if(hash) parsed=await postOnce(hash);
      }
      if(!parsed.ok) throw new Error(parsed.message||'Сервер не подтвердил успешную отправку');
      return parsed;
    }

    // ── Очередь ──────────────────────────────────────────────
    function getPendingCount() { return noNeedQueue.filter(t=>t.type==='batch'&&Array.isArray(t.ids)).reduce((s,t)=>s+t.ids.length,0); }
    function updateScanInd(done=false,cancelled=false) {
      const pref=done?(cancelled?'❌':'✅'):'⏳';
      const pg=scanTotalPages?`${scanCurPage}/${scanTotalPages}`:scanCurPage;
      showScanInd(`${pref} Стр. ${pg} | найдено: ${scanFound} | в буфере: ${scanBuffer.length} | в очереди: ${getPendingCount()} | отправлено: ${scanSent}`);
    }
    function enqueueBatch(ids) {
      if(!ids||!ids.length) return;
      noNeedQueue.push({type:'batch',ids:[...ids]});
      runQueue(); updateScanInd();
    }
    function flushBuffer(force=false) {
      while(scanBuffer.length>=BATCH_SIZE) enqueueBatch(scanBuffer.splice(0,BATCH_SIZE));
      if(force&&scanBuffer.length) enqueueBatch(scanBuffer.splice(0));
    }
    function markBtns(type,value,fn) {
      document.querySelectorAll('.missing-no-need-btn').forEach(b=>{
        if(b.dataset.taskType===type&&b.dataset.taskValue===String(value)) fn(b);
      });
    }
    function removeEntry(entry) {
      if(!missingIds.has(entry)) return;
      missingIds.delete(entry); saveMissing(); renderPanel();
    }

    async function runQueue() {
      if(noNeedQueueRunning) return;
      noNeedQueueRunning=true; noNeedRetryCount=0;
      while(noNeedQueue.length) {
        const task=noNeedQueue[0];
        try {
          if(task.type==='page') {
            markBtns('page',task.value,b=>{b.disabled=true;b.textContent='⏳';b.style.opacity='.7';b.title='Выполняется';});
            showQueueInd(`🗑 Страница ${task.value}: сбор owner-id...`);
            const html=await fetchHtml(`${scanBaseURL}${task.value}&locked=0`);
            const ids=extractOwnerIds(html);
            if(!ids.length) throw new Error(`На странице ${task.value} не найдены data-owner-id`);
            showQueueInd(`🗑 Страница ${task.value}: отправка ${ids.length} карт...`);
            const parsed=await sendIds(ids);
            const cnt=Number.isFinite(parsed.count)?parsed.count:ids.length;
            markBtns('page',task.value,b=>{b.disabled=true;b.textContent='✅';b.style.background='#28a745';b.style.color='white';b.style.opacity='1';b.title=`Успешно отправлено ${cnt} карт`;b.dataset.done='1';});
            setTimeout(()=>removeEntry(`page:${task.value}`),500);
            noNeedQueue.shift(); noNeedRetryCount=0;
            showQueueInd(`✅ Страница ${task.value}: отправлено ${cnt}`);
            await nnDelay(QUEUE_DELAY_SUCCESS);
          } else if(task.type==='card') {
            markBtns('card',task.value,b=>{b.disabled=true;b.textContent='⏳';b.style.opacity='.7';b.title='Выполняется';});
            showQueueInd(`🗑 ID ${task.value}: поиск owner-id...`);
            const html=await fetchHtml(`https://${currentDomain}/user/cards/?name=${encodedUserName}&card_id=${encodeURIComponent(task.value)}`);
            const ids=extractOwnerIds(html);
            if(!ids.length) throw new Error(`Для card_id=${task.value} не найден data-owner-id`);
            showQueueInd(`🗑 ID ${task.value}: отправка ${ids.length} карт...`);
            const parsed=await sendIds(ids);
            const cnt=Number.isFinite(parsed.count)?parsed.count:ids.length;
            markBtns('card',task.value,b=>{b.disabled=true;b.textContent='✅';b.style.background='#28a745';b.style.color='white';b.style.opacity='1';b.title=`Успешно отправлено ${cnt} карт`;b.dataset.done='1';});
            setTimeout(()=>removeEntry(String(task.value)),500);
            noNeedQueue.shift(); noNeedRetryCount=0;
            showQueueInd(`✅ ID ${task.value}: отправлено ${cnt}`);
            await nnDelay(QUEUE_DELAY_SUCCESS);
          } else if(task.type==='batch') {
            if(!task.ids||!task.ids.length) throw new Error('Пустая batch-задача');
            showQueueInd(`🗑 Отправка batch: ${task.ids.length} ID...`);
            const parsed=await sendIds(task.ids);
            const cnt=Number.isFinite(parsed.count)?parsed.count:task.ids.length;
            scanSent+=cnt; noNeedQueue.shift(); noNeedRetryCount=0;
            showQueueInd(`✅ Batch отправлен: ${cnt} ID`);
            updateScanInd(!isScanning&&!scanBuffer.length&&!getPendingCount(),false);
            await nnDelay(QUEUE_DELAY_SUCCESS);
          } else throw new Error(`Неизвестный тип: ${task.type}`);
        } catch(err) {
          noNeedRetryCount++;
          if(task.type==='page'||task.type==='card')
            markBtns(task.type,task.value,b=>{b.disabled=true;b.textContent='🔁';b.style.background='#ff9800';b.style.color='black';b.style.opacity='1';b.title=`Повтор: ${err.message}`;});
          if(task.type==='batch') showQueueInd(`🔁 Повтор batch (${task.ids.length}) | ${err.message}`);
          else showQueueInd(`🔁 Повтор ${task.type}:${task.value} | ${err.message}`);
          await nnDelay(Math.min(QUEUE_DELAY_BASE*Math.pow(2,noNeedRetryCount-1),QUEUE_DELAY_MAX));
        }
      }
      noNeedQueueRunning=false; autoNoNeedRunning=false; noNeedRetryCount=0;
      renderPanel();
      if(!isScanning&&!scanBuffer.length&&!getPendingCount()) {
        showScanInd(`✅ Готово! Найдено: ${scanFound} | отправлено: ${scanSent}`);
        showQueueInd('✅ Очередь отправки завершена');
        setTimeout(()=>hideInd('scan-progress-indicator'),3000);
        setTimeout(()=>hideInd('no-need-queue-indicator'),3000);
      } else if(isScanning) { updateScanInd(); if(!noNeedQueue.length) showQueueInd('⏳ Очередь ожидает новые batch...'); }
    }

    // ── Сканирование ─────────────────────────────────────────
    function updateStopBtn() {
      if(!stopScanButton) return;
      const show=enabled&&isScanning;
      stopScanButton.style.display=show?'flex':'none';
      stopScanButton.disabled=!show;
      stopScanButton.style.opacity=show?'1':'0';
      stopScanButton.style.cursor=show?'pointer':'default';
      positionCircleButtons();
    }
    function requestStop() {
      if(!enabled||!isScanning) return;
      cancelScan=true;
      showScanInd(`🛑 Остановка после текущей страницы... Найдено: ${scanFound} | в буфере: ${scanBuffer.length}`);
      showQueueInd('⏳ После остановки буфер будет отправлен в очередь...');
      updateStopBtn();
    }

    async function scanAllPages() {
      if(isScanning){ requestStop(); return; }
      isScanning=true; cancelScan=false; updateStopBtn();
      scanBuffer=[]; scanSent=0; scanFound=0; scanTotalPages=0; scanCurPage=0;
      showQueueInd('⏳ Очередь ожидает новые batch...');
      try {
        scanTotalPages=await getTotalPages(`${scanBaseURL}1&locked=0`);
        for(let p=1;p<=scanTotalPages;p++) {
          if(cancelScan) break;
          scanCurPage=p; updateScanInd();
          try {
            const r=await fetch(`${scanBaseURL}${p}&locked=0`,{credentials:'same-origin'});
            if(!r.ok) throw new Error(`HTTP ${r.status}`);
            const html=await r.text(), doc=new DOMParser().parseFromString(html,'text/html');
            rememberHashFromHtml(html);
            const ids=collectNoNeed(doc);
            if(ids.length){ scanBuffer.push(...ids); scanFound+=ids.length; flushBuffer(false); }
            updateScanInd(); await nnDelay(REQUEST_DELAY_SCAN);
          } catch(err){ console.error(`Ошибка стр.${p}:`,err); }
        }
        flushBuffer(true); isScanning=false; updateStopBtn();
        if(cancelScan) {
          if(getPendingCount()||noNeedQueueRunning) { updateScanInd(true,true); showQueueInd('⏳ Сканирование остановлено, буфер продолжает отправку...'); }
          else { showScanInd(`❌ Остановлено. Найдено: ${scanFound} | отправлено: ${scanSent}`); showQueueInd('✅ Буфер отправлен'); setTimeout(()=>hideInd('scan-progress-indicator'),3000); setTimeout(()=>hideInd('no-need-queue-indicator'),3000); }
        } else if(getPendingCount()||noNeedQueueRunning) { updateScanInd(true,false); }
        else { showScanInd(`✅ Готово! Найдено: ${scanFound} | отправлено: ${scanSent}`); showQueueInd('✅ Очередь завершена'); setTimeout(()=>hideInd('scan-progress-indicator'),3000); setTimeout(()=>hideInd('no-need-queue-indicator'),3000); }
      } catch(err){ isScanning=false; updateStopBtn(); console.error('scanAllPages:',err); showScanInd(`❌ Ошибка: ${err.message}`); setTimeout(()=>hideInd('scan-progress-indicator'),3000); }
    }

    async function scanLocked() {
      if(isScanning){ cancelScan=true; showScanInd('❌ Сканирование отменено!'); return; }
      isScanning=true; cancelScan=false; updateStopBtn();
      const counts={1:{},2:{}};
      for(const lt of [1,2]) {
        const max=await getTotalPages(`${scanBaseURL}1&locked=${lt}`);
        for(let p=1;p<=max;p++) {
          if(cancelScan) break;
          showScanInd(`♻️ Заблок. (locked=${lt}) стр. ${p}/${max}`);
          try {
            const r=await fetch(`${scanBaseURL}${p}&locked=${lt}`,{credentials:'same-origin'});
            const html=await r.text();
            rememberHashFromHtml(html);
            const doc=new DOMParser().parseFromString(html,'text/html');
            doc.querySelectorAll('.anime-cards__item').forEach(c=>{ const id=c.getAttribute('data-id'); if(id) counts[lt][id]=(counts[lt][id]||0)+1; });
            await nnDelay(REQUEST_DELAY_SCAN);
          } catch(e){}
        }
        if(cancelScan) break;
      }
      Object.entries(counts[1]).forEach(([id,n])=>{ if(n>=2) missingIds.add(id); });
      Object.entries(counts[2]).forEach(([id,n])=>{ if(n>=2) missingIds.add(id); });
      Object.keys(counts[1]).forEach(id=>{ if(counts[2][id]) missingIds.add(id); });
      saveMissing(); renderPanel();
      showScanInd(cancelScan?'❌ Сканирование отменено!':'✅ Дубли завершены');
      isScanning=false; updateStopBtn();
      setTimeout(()=>hideInd('scan-progress-indicator'),3000);
    }

    // ── Панель ───────────────────────────────────────────────
    function renderPanel() {
      const panelId='missing-panel';
      let panel=document.getElementById(panelId);
      if(!panel){ panel=document.createElement('div'); panel.id=panelId; document.body.appendChild(panel); }
      panel.innerHTML='';
      const hdr=document.createElement('div'); hdr.id='missing-panel-header';
      const title=document.createElement('span'); title.id='missing-panel-title'; title.textContent=`Список ID (${missingIds.size})`;
      const colBtn=document.createElement('button'); colBtn.id='missing-panel-collapse-btn';
      colBtn.textContent=panelCollapsed?'▲':'▼'; colBtn.title=panelCollapsed?'Развернуть':'Свернуть';
      colBtn.onclick=()=>{
        panelCollapsed=!panelCollapsed;
        suiteApplyCollapsibleState(panel,panelCollapsed,()=>{
          panel.classList.toggle('collapsed',panelCollapsed);
          colBtn.textContent=panelCollapsed?'▲':'▼';
          colBtn.title=panelCollapsed?'Развернуть':'Свернуть';
        });
      };
      hdr.append(title,colBtn); panel.appendChild(hdr);
      const pos=loadPanelPos();
      if(pos&&Number.isFinite(pos.left)&&Number.isFinite(pos.top)){
        panel.style.left=Math.max(0,pos.left)+'px';
        panel.style.top=Math.max(0,pos.top)+'px';
        panel.style.right='auto';
        panel.style.bottom='auto';
      }
      makeDraggable(panel,hdr,savePanelPos);
      if(!missingIds.size){ panel.style.display='none'; return; }
      panel.style.display='flex'; panel.classList.toggle('collapsed',panelCollapsed);
      const body=document.createElement('div'); body.id='missing-panel-body';
      for(const entry of missingIds) {
        const row=document.createElement('div'); row.className='item';
        const link=document.createElement('span'); const del=document.createElement('button'); del.className='missing-del-btn'; del.textContent='✖'; del.title='Удалить из списка';
        if(entry.startsWith('page:')) {
          const pg=entry.split(':')[1]; link.textContent=`Страница ${pg}`; link.style.color='#ffd700';
          link.onclick=()=>{ window.location.href=`${scanBaseURL}${pg}&locked=0`; };
        } else {
          link.textContent=entry;
          link.onclick=()=>{ window.location.href=`https://${currentDomain}/user/cards/?name=${encodedUserName}&card_id=${encodeURIComponent(entry)}`; };
        }
        del.onclick=()=>{ missingIds.delete(entry); saveMissing(); row.remove(); title.textContent=`Список ID (${missingIds.size})`; if(!missingIds.size) panel.style.display='none'; };
        row.append(link,del); body.appendChild(row);
      }
      const actions=document.createElement('div'); actions.id='missing-panel-actions';
      const clearBtn=document.createElement('button');
      clearBtn.textContent='🗑 Очистить всё'; clearBtn.style.cssText='width:100%;background:#4c0519;color:#fecdd3;border:1px solid #9f1239;border-radius:7px;padding:8px 0;font-weight:700;cursor:pointer;';
      clearBtn.onclick=()=>{ if(confirm('Удалить все ID из списка?')){ missingIds.clear(); saveMissing(); panel.style.display='none'; } };
      actions.appendChild(clearBtn); panel.append(body,actions);
    }

    // ── Кнопки на карточках ──────────────────────────────────
    function updateButtons() {
      if(!enabled||!cfg.modNoNeedCards) return;
      document.querySelectorAll('.anime-cards__item-wrapper .anime-cards__item').forEach(card=>{
        const ownerId=card.getAttribute('data-owner-id'); if(!ownerId) return;
        const wrapper=card.parentElement;
        let wrap=wrapper.querySelector('.nn-btn-container');
        if(!wrap){ wrap=document.createElement('div'); wrap.className='nn-btn-container'; wrap.style.marginTop='4px'; wrapper.appendChild(wrap); }
        let btn=wrap.querySelector('.nn-all-owners');
        if(!btn){ btn=document.createElement('button'); btn.className='nn-all-owners'; wrap.appendChild(btn); }
        btn.style.cssText='display:block;background:lightgrey;color:black;padding:3px 6px;border-radius:4px;border:none;cursor:pointer;font-size:12px;';
        btn.onmouseenter=null;btn.onmouseleave=null;btn.onclick=null;btn.disabled=false;
        const isLocked=!!card.querySelector('i.fal.fa-lock');
        const isPinned=!!card.querySelector('i.fal.fa-trophy-alt');
        const isInTrade=!!card.querySelector('i.fal.fa-arrow-right-arrow-left');
        const isStarred=card.getAttribute('data-stars')!=='0';
        const isProposed=card.dataset.proposed==='1';
        const upd=(t,bg,c)=>{ btn.textContent=t; btn.style.background=bg; btn.style.color=c; };
        if(isLocked||isPinned||isInTrade||isStarred) {
          btn.disabled=true;
          if(isStarred){ upd('Звездная','#d96a13','black'); }
          else if(isLocked){ upd('ЗАБЛОКИРОВАНО','#dc2626','black'); }
          else if(isPinned){ upd('ЗАФИКСИРОВАНО','#7c3aed','black'); }
          else{ upd('В ТРЕЙДЕ','#2563eb','black'); }
        } else {
          const setR=()=>{
            upd('ГОТОВ ПОМЕНЯТЬ','grey','black'); btn.disabled=false;
            btn.onmouseenter=()=>upd('УДАЛИТЬ','#dc2626','black');
            btn.onmouseleave=()=>setR();
            btn.onclick=async()=>{ upd('⏳ Добавление','grey','black'); btn.disabled=true;
              try{ const d=await postTrade({action:'propose_add',type:1,card_id:ownerId,user_hash:nnGetHash()});
                if(d.status==='added'){card.setAttribute('data-proposed','1');setR();}
                else if(d.status==='deleted'){card.removeAttribute('data-proposed');setA();}
                else{upd('❌ Ошибка','#dc3545','white');btn.disabled=false;} }catch(e){upd('❌ Ошибка','#dc3545','white');btn.disabled=false;} };
            if(btn.matches(':hover'))upd('УДАЛИТЬ','#dc2626','black');
          };
          const setA=()=>{
            upd('МЕНЯТЬ','lightgrey','black'); btn.disabled=false;
            btn.onmouseenter=()=>upd('ДОБАВИТЬ','#2563eb','black');
            btn.onmouseleave=()=>setA();
            btn.onclick=async()=>{ upd('⏳ Добавление','#007bff','white'); btn.disabled=true;
              try{ const d=await postTrade({action:'propose_add',type:1,card_id:ownerId,user_hash:nnGetHash()});
                if(d.status==='added'){card.setAttribute('data-proposed','1');setR();}
                else{upd('❌ Ошибка','#dc3545','white');btn.disabled=false;} }catch(e){upd('❌ Ошибка','#dc3545','white');btn.disabled=false;} };
            if(btn.matches(':hover'))upd('ДОБАВИТЬ','#2563eb','black');
          };
          if(isProposed) setR(); else setA();
        }
      });
      applyNoNeedButtonMode();
    }

    // ── Кнопки управления ────────────────────────────────────
    function applyNoNeedButtonMode() {
      const touchDevice = window.matchMedia?.('(hover: none)').matches;
      const hoverOnly = buttonsHoverOnly && !touchDevice;
      document.body.classList.toggle('nn-hover-only',hoverOnly);
      const wrappers=[...document.querySelectorAll('.anime-cards__item-wrapper')].filter(w=>w.querySelector('.nn-btn-container'));
      const rows=[];
      wrappers.forEach(w=>{
        if(!hoverOnly)w.classList.remove('nn-row-hover');
        const top=Math.round(w.getBoundingClientRect().top);
        let row=rows.find(r=>Math.abs(r.top-top)<=12);
        if(!row){row={top,items:[]};rows.push(row);}
        row.items.push(w);
      });
      rows.forEach((row,idx)=>row.items.forEach(w=>{
        w.dataset.nnRow=String(idx);
        if(w.dataset.nnHoverBound==='1')return;
        w.dataset.nnHoverBound='1';
        w.addEventListener('mouseenter',()=>{
          if(!document.body.classList.contains('nn-hover-only'))return;
          const id=w.dataset.nnRow;
          showNoNeedRow(id);
        });
      }));
      if(!document.body.dataset.nnMouseTracker){
        document.body.dataset.nnMouseTracker='1';
        document.addEventListener('mousemove',trackNoNeedRowMouse,true);
      }
      if(!hoverOnly)hideNoNeedRow();
    }
    let nnActiveRowId='';
    function getNoNeedRowItems(id){
      return [...document.querySelectorAll(`.anime-cards__item-wrapper[data-nn-row="${id}"]`)];
    }
    function showNoNeedRow(id){
      if(nnActiveRowId&&nnActiveRowId!==id)hideNoNeedRow();
      nnActiveRowId=id;
      getNoNeedRowItems(id).forEach(x=>x.classList.add('nn-row-hover'));
    }
    function hideNoNeedRow(){
      document.querySelectorAll('.anime-cards__item-wrapper.nn-row-hover').forEach(x=>x.classList.remove('nn-row-hover'));
      nnActiveRowId='';
    }
    function getNoNeedRowRect(items){
      let rect=null;
      items.forEach(item=>{
        [item,item.querySelector('.nn-btn-container')].filter(Boolean).forEach(el=>{
          const r=el.getBoundingClientRect();
          if(!r.width&&!r.height)return;
          rect=rect?{
            left:Math.min(rect.left,r.left),
            top:Math.min(rect.top,r.top),
            right:Math.max(rect.right,r.right),
            bottom:Math.max(rect.bottom,r.bottom)
          }:{left:r.left,top:r.top,right:r.right,bottom:r.bottom};
        });
      });
      return rect;
    }
    function trackNoNeedRowMouse(e){
      if(!buttonsHoverOnly){hideNoNeedRow();return;}
      const wrapper=e.target.closest?.('.anime-cards__item-wrapper');
      if(wrapper?.dataset?.nnRow){
        showNoNeedRow(wrapper.dataset.nnRow);
        return;
      }
      if(!nnActiveRowId)return;
      const items=getNoNeedRowItems(nnActiveRowId);
      const rect=getNoNeedRowRect(items);
      if(!rect){hideNoNeedRow();return;}
      const pad=8;
      if(e.clientX>=rect.left-pad&&e.clientX<=rect.right+pad&&e.clientY>=rect.top-pad&&e.clientY<=rect.bottom+pad)return;
      hideNoNeedRow();
    }
    function makeCircleBtn(icon,color,top,action,tip='') {
      const btn=document.createElement('button'); btn.className='circle-btn';
      btn.textContent=icon; btn.style.top=top; btn.style.setProperty('--nn-accent',color); btn.style.setProperty('--nn-accent-text','#e2e8f0');
      btn.onclick=action; if(tip) btn.setAttribute('data-tooltip',tip);
      document.body.appendChild(btn); return btn;
    }
    function positionCircleButtons() {
      const buttons=[refreshButton,scanButton,stopScanButton].filter(btn=>btn&&getComputedStyle(btn).display!=='none');
      if(!buttons.length)return;
      const viewport=suiteGetVisibleViewport();
      const gap=12;
      const heights=buttons.map(btn=>btn.offsetHeight||48);
      const total=heights.reduce((sum,height)=>sum+height,0)+gap*(buttons.length-1);
      let top=Math.max(viewport.top+8,Math.min(viewport.top+viewport.height/2,viewport.bottom-total-8));
      buttons.forEach((btn,index)=>{
        btn.style.top=Math.round(top)+'px';
        btn.style.bottom='auto';
        top+=heights[index]+gap;
      });
      suiteResolveFloatingButtonOverlaps();
    }
    function updateBtnState() {
      [scanButton,refreshButton].forEach(b=>{
        if(!b) return;
        b.disabled=!enabled;
        b.style.opacity=enabled?'1':'0.5';
        b.style.cursor=enabled?'pointer':'not-allowed';
      });
      updateStopBtn();
    }
    function createUI() {
      enabled=true; gmStoreSet(ENABLE_KEY,enabled);
      refreshButton=makeCircleBtn('📚','#9C27B0','50%',()=>{ if(!enabled) return; scanLocked(); },'ПОИСК ЗАБЛОКИРОВАННЫХ ДУБЛЕЙ КАРТ');
      scanButton   =makeCircleBtn('🔍','#FFA500','calc(50% + 60px)',()=>{ if(!enabled) return; scanAllPages(); },'ПРОЙТИ ПО ВСЕМ ОТКРЫТЫМ КАРТАМ И ОТПРАВИТЬ В НЕНУЖНОЕ');
      stopScanButton=makeCircleBtn('🛑','#d9534f','calc(50% + 120px)',()=>{ requestStop(); },'Остановить сканирование и отправить буфер');
      applyNoNeedButtonMode();
      updateBtnState();
      requestAnimationFrame(positionCircleButtons);
    }

    window.addEventListener('resize',positionCircleButtons,{passive:true});
    window.visualViewport?.addEventListener('resize',positionCircleButtons,{passive:true});

    let obsTimer=null;
    new MutationObserver(mutations=>{
      if(!enabled||!cfg.modNoNeedCards) return;
      if(mutations.every(m=>m.target instanceof Element && m.target.closest('.nn-btn-container'))) return;
      clearTimeout(obsTimer); obsTimer=setTimeout(updateButtons,200);
    })
      .observe(document.body,{childList:true,subtree:true});

    if(enabled){ renderPanel(); updateButtons(); }
    createUI();
    window.__suiteNoNeedCardsCleanup = () => {
      enabled = false;
      try{ gmStoreSet(ENABLE_KEY, false); }catch(e){}
      document.body.classList.remove('nn-hover-only');
      document.querySelectorAll('.nn-btn-container,.__nn-circle-btn,#missing-panel,#cv-nn-style').forEach(el=>el.remove());
      document.querySelectorAll('.anime-cards__item-wrapper.nn-row-hover').forEach(el=>el.classList.remove('nn-row-hover'));
      document.querySelectorAll('[data-nn-row],[data-nn-hover-bound]').forEach(el=>{
        delete el.dataset.nnRow;
        delete el.dataset.nnHoverBound;
      });
      hideNoNeedRow();
      window.removeEventListener('resize',positionCircleButtons);
      window.visualViewport?.removeEventListener('resize',positionCircleButtons);
      window.__suiteNoNeedCardsInstalled = false;
    };
  }




  // ============================================================
  //  ЛАБИРИНТ И ВИКТОРИНА
  // ============================================================

  // ============================================================
  //  ??????? ????
  // ============================================================

  function initAutoLootCards(){
    if(!cfg.modAutoLootCards) return;
    if(window.__suiteAutoLootCardsInstalled) return;
    window.__suiteAutoLootCardsInstalled=true;

    (function () {
        'use strict';

        // =========================================================
        // STORAGE
        // =========================================================
        const STORAGE_KEY_WATCH = 'aw_active_tab_enabled_v2';
        const SMART_PROGRESSION_KEY = 'aw_active_tab_smart_progression_v2';
        const EP_ORDER_KEY = 'aw_active_tab_ep_order_v2';
        const LAST_SUCCESSFUL_REQUEST_KEY = 'aw_active_tab_last_successful_request_v2';
        const COLLECTION_PAUSED_KEY = 'aw_active_tab_collection_paused_v2';
        const PAUSE_DATE_KEY = 'aw_active_tab_pause_date_v2';
        const PAUSE_ON_LIMIT_ENABLED_KEY = 'aw_active_tab_pause_on_limit_enabled_v2';
        const MAX_FAILED_ATTEMPTS_KEY = 'aw_active_tab_max_failed_attempts_v2';
        const KODIK_WARMUP_DONE_KEY = 'aw_active_tab_daily_watch_quest_sent_v2';
        const KODIK_WARMUP_NOTICE_KEY = 'aw_active_tab_kodik_warmup_notice_v1';
        const SERVER_DAY_CONFIRMED_KEY = 'aw_active_tab_server_day_confirmed_v1';

        const CARD_COUNT_CACHE_KEY = 'aw_active_tab_card_count_cache_v2';
        const CARD_COUNT_SYNC_KEY = 'aw_active_tab_card_count_sync_v2';
        const LAST_PROFILE_FETCH_KEY = 'aw_active_tab_last_profile_fetch_v2';
        const KNOWN_DAILY_LIMIT_KEY = 'aw_active_tab_known_daily_limit_v2';
        const DAILY_PROGRESS_KEY = 'aw_active_tab_daily_progress_v2';
        const PANEL_COLLAPSED_KEY = 'aw_active_tab_panel_collapsed_v2';
        const DIAGNOSTIC_TEXT_LIMIT = 30000;

        const ANIME_DB_KEY = 'aw_anime_database_v2';
        const FINISHED_ANIME_ARCHIVE_KEY = 'aw_finished_anime_archive_v2';
        const ANIME_DB_MODAL_ID = 'aw-anime-db-modal-v2';
        const MANUAL_MAX_EP_MODAL_ID = 'aw-manual-max-ep-modal-v2';
        const STATS_MODAL_ID = 'aw-stats-modal-v2';
        const PANEL_POSITION_KEY = 'aw_active_tab_panel_position_v2';

        const TAB_ID = `aw_tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const TAB_LOCK_KEY = 'aw_active_visible_tab_lock_v2';
        const TAB_LOCK_HEARTBEAT_MS = 2000;
        const TAB_LOCK_STALE_MS = 5000;

        const MANUAL_USERNAME = '';

        // =========================================================
        // INTERVALS
        // =========================================================
        const CHECK_NEW_CARD_INTERVAL = 177000;
        const CARD_COUNT_UPDATE_INTERVAL = 30 * 60 * 1000;
        const RETRY_NO_HASH_MS = 5000;
        const RETRY_DISABLED_MS = 10000;
        const NEXT_LOOP_EXTRA_DELAY = 0;
        const NO_CARD_RETRY_DELAY_MS = 15000;
        const START_DELAY_MS = 1200;
        const RESUME_DELAY_MS = 300;
        const RECEIPTS_PER_EP_COMPLETE = 5;

        // =========================================================
        // STATE
        // =========================================================
        let scriptEnabledWatch = true;
        let pauseOnLimitEnabled = true;
        let checkNewCardTimeoutId = null;
        let isLoopRunning = false;
        let tabLockIntervalId = null;
        let panelTickerIntervalId = null;
        let storageHandler = null;
        let storageListenerId = null;
        let nextRunAt = 0;
        let profileFetchInProgress = false;
        let kodikWarmupPromise = null;
        let diagnosticRequestSequence = 0;

        const currentUser = getCurrentUser();
        const AW_GM_DB_PREFIX = `aw_active_tab_store_v1_${currentUser || 'guest'}_`;
        const AW_GM_STORES = ['anime_history', 'card_receipts', 'skipped_episodes'];

        // =========================================================
        // UTIL
        // =========================================================
        function getCurrentUser() {
            if (MANUAL_USERNAME && MANUAL_USERNAME.trim()) {
                return MANUAL_USERNAME.trim();
            }

            try {
                const suiteNick = typeof suiteGetMyNickname === 'function'
                    ? String(suiteGetMyNickname() || '').trim()
                    : '';
                if (suiteNick) return suiteDecodeNickname(suiteNick);
            } catch (e) {}

            try {
                const safeNick = typeof suiteGetSafeNickname === 'function'
                    ? String(suiteGetSafeNickname() || '').trim()
                    : '';
                if (safeNick && safeNick !== 'Неизвестно') return safeNick;
            } catch (e) {}

            const profileLink = document.querySelector('.header__group-menu a[href*="/user/"]');
            if (profileLink) {
                const href = profileLink.getAttribute('href') || '';
                const match =
                    href.match(/^\/user\/([^/]+)\/?$/i)
                    || href.match(/https?:\/\/[^/]+\/user\/([^/]+)\/?$/i);
                if (match && match[1]) {
                    return suiteDecodeNickname(match[1]);
                }
            }

            const links = [...document.querySelectorAll('a[href*="/user/"]')];
            for (const a of links) {
                const href = a.getAttribute('href') || '';
                const match =
                    href.match(/^\/user\/([^/]+)\/?$/i)
                    || href.match(/https?:\/\/[^/]+\/user\/([^/]+)\/?$/i);
                if (match && match[1]) {
                    return suiteDecodeNickname(match[1]);
                }
            }

            return null;
        }

        const AW_DEBUG = false;

        function log(...args) {
            if (AW_DEBUG) console.log('[AutoWatch VisibleTab]', ...args);
        }

        function warn(...args) {
            console.warn('[AutoWatch VisibleTab]', ...args);
        }

        function error(...args) {
            console.error('[AutoWatch VisibleTab]', ...args);
        }

        function clean(s) {
            return String(s || '').replace(/\s+/g, ' ').trim();
        }

        const AW_MAP = [
            { r:/Получена карта:\s*.+\[/i,           icon:'card',  title:'Карта',       cls:'cpt-neon-green' },
            { s:'Статистика карт полностью очищена',   icon:'clear', title:'Очищено',     cls:'cpt-indigo'     },
            { s:'Новый день подтверждён профилем',     icon:'check', title:'Новый день',  cls:'cpt-emerald'    },
            { s:'Всё выфармлено. Жду нового дня',      icon:'clock', title:'Ожидание',    cls:'cpt-neon-amber' },
            { s:'Автолут включён, но эта вкладка',     icon:'info',  title:'Автолут',     cls:'cpt-indigo'     },
            { s:'Автолут включён',                     icon:'bolt',  title:'Автолут',     cls:'cpt-neon-green' },
            { s:'Автолут выключен',                    icon:'bolt',  title:'Автолут',     cls:'cpt-rose'       },
            { s:'Добавьте аниме в базу',                icon:'info',  title:'База аниме',  cls:'cpt-neon-amber' },
            { s:'Проверка лимита через профиль',        icon:'check', title:'Лимит',       cls:'cpt-emerald'    },
        ];

        function awResolve(text) {
            const t = String(text || '');
            for (const row of AW_MAP) {
                if (row.r && row.r.test(t)) return row;
                if (row.s && t.includes(row.s)) return row;
            }
            return { icon:'info', title:'Auto-Watch', cls:'cpt-neon-blue' };
        }

        function safePush(type, text) {
            const clean = String(text || '').replace(/^\[Auto-Watch\]\s*/i, '');
            const m = awResolve(text);
            cptShow('aw:'+clean, m.icon, m.title, clean, m.cls);
            if (type === 'error') error(clean);
        }

        function escapeHtml(str) {
            return String(str || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        async function copyText(text) {
            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(text);
                    return true;
                }
            } catch (e) {}

            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                ta.style.top = '0';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                const ok = document.execCommand('copy');
                ta.remove();
                return !!ok;
            } catch (e) {}

            return false;
        }

        function getMskDateParts(date = new Date()) {
            const msk = new Date(date.getTime() + 3 * 60 * 60 * 1000);
            return {
                year: msk.getUTCFullYear(),
                month: String(msk.getUTCMonth() + 1).padStart(2, '0'),
                day: String(msk.getUTCDate()).padStart(2, '0'),
                hours: String(msk.getUTCHours()).padStart(2, '0'),
                minutes: String(msk.getUTCMinutes()).padStart(2, '0'),
                seconds: String(msk.getUTCSeconds()).padStart(2, '0')
            };
        }

        function getMskDateKey(date = new Date()) {
            const p = getMskDateParts(date);
            return `${p.year}-${p.month}-${p.day}`;
        }

        function getMoscowTimeString(date = new Date()) {
            const p = getMskDateParts(date);
            return `${p.year}-${p.month}-${p.day} ${p.hours}:${p.minutes}:${p.seconds}`;
        }

        function formatMs(ms) {
            const total = Math.max(0, Math.ceil(ms / 1000));
            const h = Math.floor(total / 3600);
            const m = Math.floor((total % 3600) / 60);
            const s = total % 60;
            if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            return `${m}:${String(s).padStart(2, '0')}`;
        }

        function isTabVisible() {
            return document.visibilityState === 'visible';
        }

        function parsePayload(payload) {
            const params = new URLSearchParams(payload);
            return {
                watched_news_id: params.get('news_id'),
                episode: parseInt(params.get('kodik_data[episode]') || '0', 10),
                season: parseInt(params.get('kodik_data[season]') || '1', 10),
                translation_id: params.get('kodik_data[translation][id]') || '',
                translation_title: decodeURIComponent(params.get('kodik_data[translation][title]') || '')
            };
        }

        function diagnosticSecretId(value) {
            const text = String(value ?? '');
            let hash = 2166136261;
            for (let i = 0; i < text.length; i++) {
                hash ^= text.charCodeAt(i);
                hash = Math.imul(hash, 16777619);
            }
            return (hash >>> 0).toString(16).padStart(8, '0');
        }

        function diagnosticTruncate(value, limit = DIAGNOSTIC_TEXT_LIMIT) {
            const text = String(value ?? '');
            if (text.length <= limit) return text;
            return `${text.slice(0, limit)}...[обрезано ${text.length - limit} символов]`;
        }

        function diagnosticSanitize(value, key = '', depth = 0, seen = new WeakSet()) {
            if (/user_?hash|login_?hash|csrf|token|authorization|cookie|password|session|secret/i.test(String(key))) {
                const text = String(value ?? '');
                return `[скрыто, ${text.length} симв., id ${diagnosticSecretId(text)}]`;
            }
            if (value === null || typeof value === 'undefined') return value ?? null;
            if (typeof value === 'string') return diagnosticTruncate(value);
            if (typeof value === 'number' || typeof value === 'boolean') return value;
            if (typeof value === 'bigint') return String(value);
            if (value instanceof Error) {
                return {
                    name: value.name || 'Error',
                    message: diagnosticTruncate(value.message || String(value), 5000),
                    stack: diagnosticTruncate(value.stack || '', 15000)
                };
            }
            if (depth >= 8) return '[максимальная глубина]';
            if (typeof value === 'object') {
                if (seen.has(value)) return '[циклическая ссылка]';
                seen.add(value);
            }
            if (Array.isArray(value)) {
                return value.slice(0, 250).map(item => diagnosticSanitize(item, '', depth + 1, seen));
            }
            const result = {};
            for (const [childKey, childValue] of Object.entries(value || {})) {
                result[childKey] = diagnosticSanitize(childValue, childKey, depth + 1, seen);
            }
            return result;
        }

        function diagnosticSanitizeBody(body) {
            if (body === null || typeof body === 'undefined') return null;
            if (body instanceof URLSearchParams) body = body.toString();
            if (typeof body !== 'string') return diagnosticSanitize(body);
            const text = body.trim();
            if (!text) return '';
            if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
                try { return diagnosticSanitize(JSON.parse(text)); } catch (e) {}
            }
            if (text.includes('=')) {
                try {
                    const result = {};
                    for (const [paramKey, paramValue] of new URLSearchParams(text).entries()) {
                        let value = paramValue;
                        if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
                            try { value = JSON.parse(value); } catch (e) {}
                        }
                        const safeValue = diagnosticSanitize(value, paramKey);
                        if (Object.prototype.hasOwnProperty.call(result, paramKey)) {
                            result[paramKey] = Array.isArray(result[paramKey])
                                ? [...result[paramKey], safeValue]
                                : [result[paramKey], safeValue];
                        } else {
                            result[paramKey] = safeValue;
                        }
                    }
                    return result;
                } catch (e) {}
            }
            return diagnosticTruncate(text);
        }

        function diagnosticSanitizeHeaders(headers) {
            const result = {};
            try {
                new Headers(headers || {}).forEach((value, key) => {
                    result[key] = diagnosticSanitize(value, key);
                });
            } catch (e) {}
            return result;
        }

        function diagnosticParseResponse(text) {
            const value = String(text ?? '').trim();
            if (!value) return '';
            const candidates = [value];
            if (value.startsWith('cards{') || value.startsWith('cards(')) {
                const start = value.indexOf('{');
                if (start >= 0) candidates.push(value.slice(start).replace(/\)\s*$/, ''));
            }
            for (const candidate of candidates) {
                try { return diagnosticSanitize(JSON.parse(candidate)); } catch (e) {}
            }
            return diagnosticTruncate(value);
        }

        function saveDiagnosticLog(event, data = {}) {
            const record = {
                timestamp: Date.now(),
                at: new Date().toISOString(),
                dateMsk: getMoscowTimeString(),
                event,
                tabId: TAB_ID,
                user: currentUser || 'guest',
                page: location.href,
                visibility: document.visibilityState,
                tabLock: diagnosticSanitize(readTabLock()),
                data: diagnosticSanitize(data)
            };

            suiteTelemetryLog('autowatch', event, record, /error|failed|limit/i.test(event) ? 'error' : 'debug');
        }

        async function fetchData(url, options = {}, type = 'json', requireOk = true) {
            const requestId = `aw_${Date.now()}_${++diagnosticRequestSequence}`;
            const startedAt = Date.now();
            const request = {
                requestId,
                method: String(options?.method || 'GET').toUpperCase(),
                url: new URL(url, location.href).href,
                headers: diagnosticSanitizeHeaders(options?.headers),
                body: diagnosticSanitizeBody(options?.body)
            };
            saveDiagnosticLog('network_request_started', request);

            try {
                const response = await fetch(url, options);
                try {
                    const clone = response.clone();
                    clone.text().then(responseText => {
                        saveDiagnosticLog('network_request_finished', {
                            ...request,
                            status: response.status,
                            statusText: response.statusText,
                            ok: response.ok,
                            responseUrl: response.url,
                            responseHeaders: diagnosticSanitizeHeaders(response.headers),
                            response: diagnosticParseResponse(responseText),
                            durationMs: Date.now() - startedAt
                        });
                    }).catch(e => {
                        saveDiagnosticLog('network_response_read_failed', {
                            ...request,
                            status: response.status,
                            error: diagnosticSanitize(e),
                            durationMs: Date.now() - startedAt
                        });
                    });
                } catch (e) {
                    saveDiagnosticLog('network_response_clone_failed', {
                        ...request,
                        status: response.status,
                        error: diagnosticSanitize(e),
                        durationMs: Date.now() - startedAt
                    });
                }

                if (requireOk && !response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
                if (type === 'json') return response.json();
                if (type === 'text') return response.text();
                return response;
            } catch (e) {
                saveDiagnosticLog('network_request_failed', {
                    ...request,
                    durationMs: Date.now() - startedAt,
                    error: diagnosticSanitize(e)
                });
                throw e;
            }
        }

        // =========================================================
        // SINGLE TAB LOCK
        // =========================================================
        function readTabLock() {
            try {
                const raw = localStorage.getItem(TAB_LOCK_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (e) {
                return null;
            }
        }

        function writeTabLock(data) {
            try {
                localStorage.setItem(TAB_LOCK_KEY, JSON.stringify(data));
            } catch (e) {}
        }

        function clearTabLock() {
            try {
                localStorage.removeItem(TAB_LOCK_KEY);
            } catch (e) {}
        }

        function removeTabLockIfMine() {
            try {
                const lock = readTabLock();
                if (lock && lock.tabId === TAB_ID) {
                    clearTabLock();
                }
            } catch (e) {}
        }

        function isLockStale(lock) {
            if (!lock || !lock.ts) return true;
            return (Date.now() - lock.ts) > TAB_LOCK_STALE_MS;
        }

        function normalizeTabLock() {
            const lock = readTabLock();
            if (!lock || typeof lock !== 'object' || !lock.tabId || !lock.ts || isLockStale(lock)) {
                clearTabLock();
                return null;
            }
            return lock;
        }

        function isThisTabLeader() {
            const lock = normalizeTabLock();
            return !!(lock && lock.tabId === TAB_ID && !isLockStale(lock));
        }

        function tryAcquireTabLock() {
            if (!isTabVisible()) return false;

            const now = Date.now();
            const current = normalizeTabLock();

            if (!current || current.tabId === TAB_ID) {
                writeTabLock({ tabId: TAB_ID, ts: now, url: location.href });
                const verify = readTabLock();
                return !!(verify && verify.tabId === TAB_ID);
            }
            return false;
        }

        function claimTabLock(force = false) {
            if (!isTabVisible()) return false;

            const current = normalizeTabLock();
            if (force || !current || current.tabId === TAB_ID) {
                writeTabLock({ tabId: TAB_ID, ts: Date.now(), url: location.href });
                const verify = readTabLock();
                return !!(verify && verify.tabId === TAB_ID);
            }
            return false;
        }

        function refreshTabLock() {
            if (!isTabVisible()) {
                removeTabLockIfMine();
                return false;
            }

            const current = normalizeTabLock();
            if (!current || current.tabId === TAB_ID) {
                writeTabLock({ tabId: TAB_ID, ts: Date.now(), url: location.href });
                return true;
            }
            return false;
        }

        function startTabLockHeartbeat() {
            stopTabLockHeartbeat();
            tabLockIntervalId = setInterval(() => {
                if (isTabVisible()) {
                    refreshTabLock();
                } else {
                    removeTabLockIfMine();
                }
                updateButtonState();
            }, TAB_LOCK_HEARTBEAT_MS);
        }

        function stopTabLockHeartbeat() {
            if (tabLockIntervalId) {
                clearInterval(tabLockIntervalId);
                tabLockIntervalId = null;
            }
        }

        // =========================================================
        // DB
        // =========================================================
        function getGmStoreKey(storeName) {
            return `${AW_GM_DB_PREFIX}${storeName}`;
        }

        async function getGmStore(storeName) {
            if (!AW_GM_STORES.includes(storeName)) return [];
            const value = await GM_getValue(getGmStoreKey(storeName), []);
            return Array.isArray(value) ? value : [];
        }

        async function setGmStore(storeName, records) {
            if (!AW_GM_STORES.includes(storeName)) return;
            await GM_setValue(getGmStoreKey(storeName), Array.isArray(records) ? records : []);
        }

        async function saveCardReceipt(receipt) {
            const receipts = await getGmStore('card_receipts');
            receipts.push(receipt);
            await setGmStore('card_receipts', receipts);
        }

        function saveRequestLog(entry) {
            suiteTelemetryLog('autowatch', 'request_result', {
                requestedAt: Date.now(),
                dateMsk: getMoscowTimeString(),
                source: entry.source || 'auto',
                watchedAnimeId: entry.watchedAnimeId || 0,
                watchedSeason: entry.watchedSeason || 1,
                watchedEpisode: entry.watchedEpisode || 0,
                status: entry.status || 'error',
                cardName: entry.cardName || '—',
                cardRank: entry.cardRank || '—',
                serverMsg: entry.serverMsg || '',
                scriptNote: entry.scriptNote || ''
            }, entry.status === 'error' ? 'error' : 'debug');
        }

        async function getAllReceipts() {
            return getGmStore('card_receipts');
        }

        async function getHistoryEntry(animeId) {
            const history = await getGmStore('anime_history');
            return history.find(row => String(row?.animeId) === String(animeId)) || null;
        }

        async function isEpisodeSkipped(skipKey) {
            const skipped = await getGmStore('skipped_episodes');
            return skipped.some(row => String(row?.skipKey) === String(skipKey));
        }

        async function saveSkippedEpisode(data) {
            const skipped = await getGmStore('skipped_episodes');
            const index = skipped.findIndex(row => String(row?.skipKey) === String(data?.skipKey));
            if (index >= 0) skipped[index] = data;
            else skipped.push(data);
            await setGmStore('skipped_episodes', skipped);
        }

        // =========================================================
        // RANK STATISTICS
        // =========================================================
        const RANK_CONFIG = [
            { key: 'ass', label: 'ASS', color: '#4a0080', bg: 'rgba(74,0,128,0.22)'   },
            { key: 's+',  label: 'S+',  color: '#9b30ff', bg: 'rgba(155,48,255,0.18)' },
            { key: 's',   label: 'S',   color: '#c77dff', bg: 'rgba(199,125,255,0.15)' },
            { key: 'a+',  label: 'A+',  color: '#cc0000', bg: 'rgba(204,0,0,0.18)'    },
            { key: 'a',   label: 'A',   color: '#ff4d4d', bg: 'rgba(255,77,77,0.15)'  },
            { key: 'b+',  label: 'B+',  color: '#1565c0', bg: 'rgba(21,101,192,0.18)' },
            { key: 'b',   label: 'B',   color: '#4d9fff', bg: 'rgba(77,159,255,0.15)' },
            { key: 'c+',  label: 'C+',  color: '#1b7a1b', bg: 'rgba(27,122,27,0.18)'  },
            { key: 'c',   label: 'C',   color: '#4dcc6a', bg: 'rgba(77,204,106,0.15)' },
            { key: 'd+',  label: 'D+',  color: '#6b6b6b', bg: 'rgba(107,107,107,0.18)'},
            { key: 'd',   label: 'D',   color: '#adb5bd', bg: 'rgba(173,181,189,0.15)'},
            { key: 'e+',  label: 'E+',  color: '#7d4e1f', bg: 'rgba(125,78,31,0.18)'  },
            { key: 'e',   label: 'E',   color: '#b07540', bg: 'rgba(176,117,64,0.15)' },
        ];

        async function buildRankStats() {
            const receipts = await getAllReceipts();
            const today = getMskDateKey(); // "YYYY-MM-DD"

            const allCounts   = {};
            const todayCounts = {};
            for (const rc of RANK_CONFIG) {
                allCounts[rc.key]   = 0;
                todayCounts[rc.key] = 0;
            }

            let totalAll   = 0;
            let totalToday = 0;

            for (const rc of receipts) {
                const rank = String(rc.rank || rc.cardRank || 'e').toLowerCase();
                const key  = RANK_CONFIG.find(r => r.key === rank) ? rank : 'e';

                // Определяем дату чека по МСК: используем dateMsk если есть, иначе конвертируем receivedAt
                let recDateKey = '';
                if (rc.dateMsk && typeof rc.dateMsk === 'string' && rc.dateMsk.length >= 10) {
                    recDateKey = rc.dateMsk.slice(0, 10); // "YYYY-MM-DD"
                } else if (rc.receivedAt) {
                    recDateKey = getMskDateKey(new Date(rc.receivedAt));
                }

                const isToday = recDateKey === today;

                allCounts[key]++;
                totalAll++;
                if (isToday) {
                    todayCounts[key]++;
                    totalToday++;
                }
            }

            return { allCounts, todayCounts, totalAll, totalToday };
        }

        async function openStatsModal() {
            document.getElementById(STATS_MODAL_ID)?.remove();

            const { allCounts, todayCounts, totalAll, totalToday } = await buildRankStats();

            const rows = RANK_CONFIG.map(rc => {
                const all   = allCounts[rc.key]   || 0;
                const today = todayCounts[rc.key] || 0;
                const pctAll   = totalAll   > 0 ? ((all   / totalAll)   * 100).toFixed(1) : '0.0';
                const pctToday = totalToday > 0 ? ((today / totalToday) * 100).toFixed(1) : '0.0';
                return `
                    <tr>
                        <td>
                            <span class="aw-rank-badge" style="background:${rc.bg};color:${rc.color};border-color:${rc.color}22">
                                ${rc.label}
                            </span>
                        </td>
                        <td class="aw-stat-num">${today}</td>
                        <td class="aw-stat-pct">${pctToday}%</td>
                        <td class="aw-stat-num">${all}</td>
                        <td class="aw-stat-pct">${pctAll}%</td>
                    </tr>
                `;
            }).join('');

            const barAll = RANK_CONFIG.map(rc => {
                const pct = totalAll > 0 ? ((allCounts[rc.key] || 0) / totalAll * 100) : 0;
                return pct > 0
                    ? `<div title="${rc.label}: ${pct.toFixed(1)}%" style="flex:${pct};background:${rc.color};min-width:2px"></div>`
                    : '';
            }).join('');

            const barToday = RANK_CONFIG.map(rc => {
                const pct = totalToday > 0 ? ((todayCounts[rc.key] || 0) / totalToday * 100) : 0;
                return pct > 0
                    ? `<div title="${rc.label}: ${pct.toFixed(1)}%" style="flex:${pct};background:${rc.color};min-width:2px"></div>`
                    : '';
            }).join('');

            const modal = createSimpleModal(
                STATS_MODAL_ID,
                'Статистика карт по рангам',
                `
                    <div class="aw-summary" style="grid-template-columns:1fr 1fr;margin-bottom:16px">
                        <div class="aw-card">
                            <div class="aw-card-label">Всего карт</div>
                            <div class="aw-card-value">${totalAll}</div>
                        </div>
                        <div class="aw-card">
                            <div class="aw-card-label">Сегодня</div>
                            <div class="aw-card-value">${totalToday}</div>
                        </div>
                    </div>

                    <div style="margin-bottom:6px;font-size:12px;color:rgba(255,255,255,.6)">Распределение за всё время</div>
                    <div class="aw-rank-bar" style="margin-bottom:14px">${barAll || '<span style="color:rgba(255,255,255,.3);font-size:12px">нет данных</span>'}</div>

                    <div style="margin-bottom:6px;font-size:12px;color:rgba(255,255,255,.6)">Распределение сегодня</div>
                    <div class="aw-rank-bar" style="margin-bottom:18px">${barToday || '<span style="color:rgba(255,255,255,.3);font-size:12px">нет данных</span>'}</div>

                    <table class="aw-stat-table">
                        <thead>
                            <tr>
                                <th>Ранг</th>
                                <th>Сегодня</th>
                                <th>%</th>
                                <th>Всего</th>
                                <th>%</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>

                    <div style="margin-top:18px;display:flex;justify-content:flex-end">
                        <button class="aw-cancel-btn" id="aw-clear-stats-btn" type="button" style="background:#7a2828">
                            Очистить статистику
                        </button>
                    </div>
                `,
                '480px'
            );

            modal.querySelector('#aw-clear-stats-btn')?.addEventListener('click', async () => {
                const confirmed = await showConfirmModal(
                    'Очистка статистики',
                    'Удалить все чеки карт, историю запросов и пропущенные серии? Счётчики рангов сбросятся. Отменить нельзя.'
                );
                if (!confirmed) return;

                try {
                    for (const store of ['card_receipts', 'skipped_episodes']) {
                        await setGmStore(store, []);
                    }
                    // Сбрасываем дневной прогресс
                    await setDailyProgress(0);
                    // Сбрасываем smart-progression чтобы начать с начала
                    await GM_setValue(SMART_PROGRESSION_KEY, null);
                    modal.remove();
                    await openStatsModal();
                    safePush('success', 'Статистика карт полностью очищена.');
                } catch (e) {
                    error('Ошибка очистки статистики:', e);
                }
            });

            return modal;
        }

        async function getAllFromStore(storeName) {
            return getGmStore(storeName);
        }

        // =========================================================
        // DAILY LIMIT / DAY RESET
        // =========================================================
        async function ensureDailyProgressState() {
            const today = getMskDateKey();
            let state = await GM_getValue(DAILY_PROGRESS_KEY, null);
            if (!state || state.date !== today) {
                state = { date: today, current: 0 };
                await GM_setValue(DAILY_PROGRESS_KEY, state);
            }
            return state;
        }

        async function incrementDailyProgress() {
            const today = getMskDateKey();
            let state = await GM_getValue(DAILY_PROGRESS_KEY, null);
            if (!state || state.date !== today) {
                state = { date: today, current: 0 };
            }
            state.current += 1;
            await GM_setValue(DAILY_PROGRESS_KEY, state);
            return state;
        }

        async function setDailyProgress(current) {
            const today = getMskDateKey();
            const state = { date: today, current: Math.max(0, Number(current) || 0) };
            await GM_setValue(DAILY_PROGRESS_KEY, state);
            return state;
        }

        async function setKnownDailyLimit(limit) {
            const n = parseInt(limit, 10);
            if (!Number.isFinite(n) || n <= 0) return;
            await GM_setValue(KNOWN_DAILY_LIMIT_KEY, n);
        }

        async function getKnownDailyLimit() {
            const n = await GM_getValue(KNOWN_DAILY_LIMIT_KEY, null);
            return Number.isFinite(Number(n)) ? Number(n) : null;
        }

        async function confirmCurrentServerDay(source) {
            const date = getMskDateKey();
            const previous = await GM_getValue(SERVER_DAY_CONFIRMED_KEY, null);
            if (previous?.date === date) return previous;
            const confirmation = { date, source, at: Date.now() };
            await GM_setValue(SERVER_DAY_CONFIRMED_KEY, confirmation);
            saveDiagnosticLog('server_day_confirmed', confirmation);
            return confirmation;
        }

        async function isCurrentServerDayConfirmed() {
            const confirmation = await GM_getValue(SERVER_DAY_CONFIRMED_KEY, null);
            return !!(confirmation && confirmation.date === getMskDateKey());
        }

        async function parseAndStoreLimitFromReason(reason) {
            if (!reason) return null;
            const match = String(reason).match(/получил(?:а)?\s+свои\s+(\d+)\s+карт/i);
            if (!match) return null;

            const limit = parseInt(match[1], 10);
            if (Number.isFinite(limit) && limit > 0) {
                await setKnownDailyLimit(limit);
                await setDailyProgress(limit);
                updateButtonState();
                return limit;
            }
            return null;
        }

        // =========================================================
        // PROFILE COUNT CHECK
        // =========================================================
        async function fetchUserProfileHtml(username) {
            const variants = [
                `/user/${encodeURIComponent(username)}/`,
                `/index.php?do=users&subaction=userinfo&user=${encodeURIComponent(username)}`
            ];

            for (const url of variants) {
                try {
                    const response = await fetch(url, { credentials: 'include' });
                    if (!response.ok) continue;

                    const text = await response.text();
                    if (text && text.length > 1000) {
                        return text;
                    }
                } catch (e) {}
            }

            throw new Error(`Не удалось загрузить профиль пользователя: ${username}`);
        }

        function parseCardQuestFromHtml(html) {
            if (!html) return null;
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const text = (doc.body?.innerText || '').replace(/\s+/g, ' ');

            const around = text.match(/Получено карточек за просмотр аниме[^0-9]{0,80}(\d+)\s+из\s+(\d+)/i);
            if (around) {
                return { current: parseInt(around[1], 10), limit: parseInt(around[2], 10) };
            }

            const generic = text.match(/Получено карточек за просмотр аниме[\s\S]{0,200}?(\d+)\s+из\s+(\d+)/i);
            if (generic) {
                return { current: parseInt(generic[1], 10), limit: parseInt(generic[2], 10) };
            }

            return null;
        }

        async function updateCardCounter(forceUpdate = false) {
            if (!currentUser || profileFetchInProgress) return;

            const now = Date.now();
            const cachedData = await GM_getValue(CARD_COUNT_CACHE_KEY, null);
            const lastFetch = await GM_getValue(LAST_PROFILE_FETCH_KEY, 0);

            if (!forceUpdate && cachedData && (now - lastFetch < CARD_COUNT_UPDATE_INTERVAL)) {
                return;
            }

            profileFetchInProgress = true;
            try {
                await GM_setValue(LAST_PROFILE_FETCH_KEY, now);
                const html = await fetchUserProfileHtml(currentUser);
                const quest = parseCardQuestFromHtml(html);
                if (!quest) return;

                const { current, limit } = quest;
                await setKnownDailyLimit(limit);
                await setDailyProgress(current);

                const isAtLimit = current >= limit;
                if (!isAtLimit) await confirmCurrentServerDay('profile');
                const payload = {
                    text: `${current} / ${limit}`,
                    className: isAtLimit ? 'limit-reached' : 'in-progress',
                    timestamp: now
                };

                await GM_setValue(CARD_COUNT_CACHE_KEY, payload);
                await GM_setValue(CARD_COUNT_SYNC_KEY, payload);

                if (!isAtLimit) {
                    const wasPaused = await GM_getValue(COLLECTION_PAUSED_KEY, false);
                    if (wasPaused) {
                        await GM_setValue(COLLECTION_PAUSED_KEY, false);
                        await GM_deleteValue(PAUSE_DATE_KEY);
                        safePush('success', 'Новый день подтверждён профилем. Пауза снята.');
                    }
                }

                updateButtonState();
            } catch (e) {
                warn('Ошибка обновления счётчика из профиля:', e);
            } finally {
                profileFetchInProgress = false;
            }
        }

        // =========================================================
        // ANIME DB
        // =========================================================
        function buildAnimeUniqueKey(entry) {
            return [
                String(entry.anime_id || ''),
                String(entry.s || 1),
                String(entry.t_id || ''),
                String(entry.t_title || '')
            ].join('::');
        }

        function normalizeAnimeEntry(entry) {
            return {
                anime_id: String(entry.anime_id),
                s: Number(entry.s || 1),
                min_ep: Number(entry.min_ep || 1),
                max_ep: Number(entry.max_ep || 1),
                t_title: String(entry.t_title || ''),
                t_id: String(entry.t_id || ''),
                t_link: String(entry.t_link || ''),
                title: String(entry.title || ''),
                addedAt: Number(entry.addedAt || 0)
            };
        }

        async function getAnimeDb() {
            const data = await GM_getValue(ANIME_DB_KEY, null);
            return Array.isArray(data) ? data.map(normalizeAnimeEntry) : [];
        }

        async function setAnimeDb(data) {
            await GM_setValue(ANIME_DB_KEY, Array.isArray(data) ? data.map(normalizeAnimeEntry) : []);
        }

        async function ensureAnimeDbInitialized() {
            return await getAnimeDb();
        }

        async function getFinishedAnimeArchive() {
            const data = await GM_getValue(FINISHED_ANIME_ARCHIVE_KEY, []);
            return Array.isArray(data) ? data.map(normalizeAnimeEntry) : [];
        }

        async function setFinishedAnimeArchive(data) {
            await GM_setValue(FINISHED_ANIME_ARCHIVE_KEY, Array.isArray(data) ? data.map(normalizeAnimeEntry) : []);
        }

        async function addFinishedAnimeToArchive(entry) {
            const archive = await getFinishedAnimeArchive();
            const key = buildAnimeUniqueKey(entry);
            const progress = await getAnimeProgress(entry);
            if (!progress.isFullyFarmed) {
                await removeFinishedAnimeArchiveByKey(key);
                return false;
            }
            if (archive.some(item => buildAnimeUniqueKey(item) === key)) return false;
            archive.unshift(normalizeAnimeEntry(entry));
            await setFinishedAnimeArchive(archive);
            return true;
        }

        async function isAnimeInFinishedArchive(entry) {
            const archive = await getFinishedAnimeArchive();
            const key = buildAnimeUniqueKey(entry);
            return archive.some(item => buildAnimeUniqueKey(item) === key);
        }

        async function removeFinishedAnimeArchiveByKey(key) {
            const archive = await getFinishedAnimeArchive();
            const next = archive.filter(item => buildAnimeUniqueKey(item) !== key);
            if (next.length !== archive.length) {
                await setFinishedAnimeArchive(next);
            }
        }

        async function removeAnimeFromDbByKey(key) {
            const db = await getAnimeDb();
            const next = db.filter(item => buildAnimeUniqueKey(item) !== key);
            await setAnimeDb(next);
        }

        function parseCurrentPageTranslationId(link) {
            const m = String(link || '').match(/[?&]only_translations=(\d+)/);
            return m ? m[1] : null;
        }

        function getElementKodikLink(el) {
            if (!el) return '';

            const attrNames = [
                'data-this_link',
                'data-this-link',
                'data-link',
                'data-url',
                'data-src',
                'href',
                'src'
            ];

            for (const attr of attrNames) {
                const value = el.getAttribute?.(attr) || '';
                if (/kodik|only_translations|kodikplayer/i.test(value)) {
                    return value;
                }
            }

            const child = el.querySelector?.('[data-this_link], [data-this-link], [data-link], [data-url], [data-src], a[href*="kodik"], iframe[src*="kodik"]');
            return child ? getElementKodikLink(child) : '';
        }

        function getCurrentPageAnimeId() {
            return (
                document.querySelector('#kodik_player_ajax')?.getAttribute('data-news_id') ||
                document.querySelector('[data-news_id]')?.getAttribute('data-news_id') ||
                (location.href.match(/\/(\d+)-/) || [])[1] ||
                null
            );
        }

        function getCurrentPageActiveTranslation() {
            const active =
                document.querySelector('#translators-list .b-translator__item.active') ||
                document.querySelector('.b-translators__list .b-translator__item.active') ||
                document.querySelector('#translators-list li.active') ||
                document.querySelector('.b-translators__list li.active');

            if (!active) return null;

            const t_link =
                getElementKodikLink(active) ||
                getElementKodikLink(document.querySelector('#kodik_player_ajax')) ||
                getElementKodikLink(document.querySelector('[data-this_link]')) ||
                '';
            const t_id =
                parseCurrentPageTranslationId(t_link) ||
                active.getAttribute('data-id') ||
                active.getAttribute('data-translation-id') ||
                active.getAttribute('data-translation_id') ||
                null;

            return {
                t_title: clean(active.textContent) || null,
                t_id,
                t_link
            };
        }

        function getCurrentPageSeason() {
            const animeId = getCurrentPageAnimeId();
            if (!animeId) return 1;

            for (const s of document.scripts) {
                const txt = s.textContent || '';
                if (!txt.includes('anime_episode_arr')) continue;

                const m = txt.match(/anime_episode_arr\s*=\s*(\{[\s\S]*?\});/);
                if (!m) continue;

                try {
                    const obj = JSON.parse(m[1]);
                    return parseInt(obj?.[animeId]?.season, 10) || 1;
                } catch (e) {}
            }

            return 1;
        }

        function addEpisodeNumber(set, value) {
            const n = parseInt(value, 10);
            if (Number.isFinite(n) && n >= 1 && n <= 3000) {
                set.add(n);
            }
        }

        function buildEpisodeRange(numbers, source = '') {
            const list = [...numbers]
                .map(n => parseInt(n, 10))
                .filter(n => Number.isFinite(n) && n >= 1 && n <= 3000)
                .sort((a, b) => a - b);

            if (!list.length) return null;

            const unique = [...new Set(list)];
            const min = unique[0];
            const max = unique[unique.length - 1];
            const hasUsefulRange = unique.length >= 2 || max > 1;

            if (!hasUsefulRange) return null;
            log(`Автоопределение серий (${source}): ${min}-${max}`, unique.slice(0, 40));
            return { min_ep: min, max_ep: max };
        }

        function collectEpisodeNumbersFromValue(value, set, inEpisodeContext = false) {
            if (value == null) return;

            if (typeof value === 'number' || typeof value === 'string') {
                if (inEpisodeContext) addEpisodeNumber(set, value);
                return;
            }

            if (Array.isArray(value)) {
                value.forEach((item, index) => {
                    collectEpisodeNumbersFromValue(item, set, inEpisodeContext);
                    if (inEpisodeContext && typeof item === 'object' && item !== null && !('episode' in item) && !('series' in item)) {
                        addEpisodeNumber(set, index + 1);
                    }
                });
                return;
            }

            if (typeof value !== 'object') return;

            for (const [key, val] of Object.entries(value)) {
                const keyText = String(key).toLowerCase();
                const isEpisodeKey = /(episode|episodes|ep|seria|series|серия|серии)/i.test(keyText);
                const isSeasonKey = /(season|сезон)/i.test(keyText);

                if (inEpisodeContext && /^\d+$/.test(key) && !isSeasonKey) {
                    addEpisodeNumber(set, key);
                }

                if (isEpisodeKey && !isSeasonKey) {
                    collectEpisodeNumbersFromValue(val, set, true);
                } else if (val && typeof val === 'object') {
                    collectEpisodeNumbersFromValue(val, set, inEpisodeContext);
                }
            }
        }

        function getEpisodeRangeFromAnimeEpisodeArr() {
            const animeId = getCurrentPageAnimeId();
            if (!animeId) return null;

            for (const s of document.scripts) {
                const txt = s.textContent || '';
                if (!txt.includes('anime_episode_arr')) continue;

                const m = txt.match(/anime_episode_arr\s*=\s*(\{[\s\S]*?\});/);
                if (!m) continue;

                try {
                    const obj = JSON.parse(m[1]);
                    const data = obj?.[animeId];
                    const directMaxEpisode = parseInt(data?.episode, 10);
                    if (Number.isFinite(directMaxEpisode) && directMaxEpisode >= 1) {
                        log(`Автоопределение серий (anime_episode_arr): 1-${directMaxEpisode}`, data);
                        return { min_ep: 1, max_ep: directMaxEpisode };
                    }

                    const episodes = new Set();
                    collectEpisodeNumbersFromValue(data, episodes, true);

                    if (data && typeof data === 'object') {
                        for (const [key, val] of Object.entries(data)) {
                            if (/^\d+$/.test(key) && key !== String(data.season || '')) {
                                addEpisodeNumber(episodes, key);
                            }
                            if (val && typeof val === 'object') {
                                for (const nestedKey of Object.keys(val)) {
                                    if (/^\d+$/.test(nestedKey)) addEpisodeNumber(episodes, nestedKey);
                                }
                            }
                        }
                    }

                    const range = buildEpisodeRange(episodes, 'anime_episode_arr');
                    if (range) return range;
                } catch (e) {}
            }

            return null;
        }

        function getEpisodeRangeFromDom() {
            const episodes = new Set();
            const selectors = [
                '[data-episode]',
                '[data-episode_id]',
                '[data-episode-number]',
                '[data-episode_number]',
                '[data-seria]',
                '[data-seriya]',
                '[data-kodik-episode]',
                '[data-num]',
                '[data-number]',
                '.b-simple_episode__item',
                '.b-simple_episode__number',
                '.b-episode__item',
                '.b-episodes__item',
                '.b-episode',
                '.episode',
                '.episodes li',
                '.serial-series-box li',
                '.kodik-episode',
                '[onclick*="episode"]'
            ];

            for (const el of document.querySelectorAll(selectors.join(','))) {
                for (const attr of ['data-episode', 'data-episode_id', 'data-episode-number', 'data-episode_number', 'data-seria', 'data-seriya', 'data-kodik-episode', 'data-num', 'data-number']) {
                    const value = el.getAttribute(attr);
                    if (value) addEpisodeNumber(episodes, value);
                }

                for (const attr of [...el.attributes]) {
                    if (/(episode|seria|series|kodik|сер)/i.test(attr.name)) {
                        addEpisodeNumber(episodes, attr.value);
                    }
                }

                const text = clean(el.textContent || '');
                const textPatterns = [
                    /^(?:серия\s*)?(\d{1,4})(?:\s*(?:серия|серии|эпизод|$))/i,
                    /(?:серия|серии|серий|эпизод)\s*(\d{1,4})/i,
                    /(\d{1,4})\s*(?:серия|серии|серий|эпизод)/i
                ];
                for (const pattern of textPatterns) {
                    const textMatch = text.match(pattern);
                    if (textMatch) addEpisodeNumber(episodes, textMatch[1]);
                }

                const onclick = el.getAttribute('onclick') || '';
                for (const match of onclick.matchAll(/(?:episode|seria|series)['"]?\s*[:=,]\s*['"]?(\d{1,4})/gi)) {
                    addEpisodeNumber(episodes, match[1]);
                }
            }

            return buildEpisodeRange(episodes, 'dom');
        }

        function getCurrentPageEpisodeRange() {
            const range =
                getEpisodeRangeFromAnimeEpisodeArr() ||
                getEpisodeRangeFromDom();

            if (!range) {
                warn('Автоопределение серий не нашло данные на странице.');
            }

            return range;
        }

        function normalizeKodikUrl(url) {
            const raw = String(url || '').trim();
            if (!raw) return '';
            if (raw.startsWith('//')) return location.protocol + raw;
            if (raw.startsWith('/')) return location.origin + raw;
            return raw;
        }

        function fetchTextViaTampermonkey(url) {
            const target = normalizeKodikUrl(url);
            if (!target) return Promise.reject(new Error('Пустая ссылка Kodik'));

            if (typeof GM_xmlhttpRequest === 'function') {
                return new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: target,
                        onload: response => resolve(response.responseText || ''),
                        onerror: () => reject(new Error('Не удалось загрузить Kodik')),
                        ontimeout: () => reject(new Error('Таймаут загрузки Kodik')),
                        timeout: 15000
                    });
                });
            }

            return fetch(target, { credentials: 'omit' }).then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status} for Kodik`);
                return r.text();
            });
        }

        function buildEpisodeRangeFromOptions(options, source) {
            const episodes = new Set();
            for (const option of options) {
                addEpisodeNumber(episodes, option.getAttribute('value'));
                addEpisodeNumber(episodes, option.getAttribute('data-title'));
                addEpisodeNumber(episodes, option.textContent);
            }
            return buildEpisodeRange(episodes, source);
        }

        function parseEpisodeRangeFromKodikHtml(html) {
            const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');

            const seasonSelect = doc.querySelector('.serial-seasons-box select');
            const selectedSeason =
                seasonSelect?.querySelector('option[selected]')?.getAttribute('value') ||
                seasonSelect?.querySelector('option[selected="selected"]')?.getAttribute('value') ||
                seasonSelect?.querySelector('option')?.getAttribute('value') ||
                null;

            if (selectedSeason != null) {
                const seasonBox = [...doc.querySelectorAll('.series-options > div')]
                    .find(el => el.classList.contains(`season-${selectedSeason}`));
                if (seasonBox) {
                    const range = buildEpisodeRangeFromOptions(seasonBox.querySelectorAll('option'), `kodik season ${selectedSeason}`);
                    if (range) return { ...range, season: parseInt(selectedSeason, 10) || 1 };
                }
            }

            const range = buildEpisodeRangeFromOptions(
                doc.querySelectorAll('.serial-series-box select option'),
                'kodik serial-series-box'
            );
            if (range) return { ...range, season: parseInt(selectedSeason, 10) || 1 };

            return null;
        }

        async function getEpisodeRangeFromKodik(translationLink) {
            if (!translationLink) return null;

            try {
                const html = await fetchTextViaTampermonkey(translationLink);
                const range = parseEpisodeRangeFromKodikHtml(html);
                if (range) {
                    log('Автоопределение серий из Kodik:', range);
                } else {
                    warn('Kodik загружен, но список серий не найден.');
                }
                return range;
            } catch (e) {
                warn('Не удалось получить серии из Kodik:', e);
                return null;
            }
        }

        async function isKodikWarmupDoneForCurrentCardDay() {
            const progress = await ensureDailyProgressState();
            const data = await GM_getValue(KODIK_WARMUP_DONE_KEY, null);
            return !!(data && data.date === progress.date && data.status === 'ok');
        }

        async function markKodikWarmupDoneForCurrentCardDay(entry, episode, status = 'sent') {
            const progress = await ensureDailyProgressState();
            await GM_setValue(KODIK_WARMUP_DONE_KEY, {
                date: progress.date,
                animeId: entry?.anime_id || '',
                season: entry?.s || 1,
                episode: episode || 1,
                status,
                at: Date.now()
            });
        }

        async function showKodikMissingLinkNotice(entry) {
            const noticeKey = `${getMskDateKey()}::${entry?.anime_id || 'unknown'}::${entry?.t_id || ''}`;
            const lastNotice = await GM_getValue(KODIK_WARMUP_NOTICE_KEY, '');
            if (lastNotice === noticeKey) return;
            await GM_setValue(KODIK_WARMUP_NOTICE_KEY, noticeKey);
            warn('Квест просмотра не выполнен: у записи аниме нет данных перевода. Добавьте аниме в базу заново со страницы аниме.');
            safePush('info', 'Не хватает данных для квеста просмотра. Добавьте это аниме в базу заново со страницы аниме.');
        }

        async function ensureDailyKodikWarmup(entry, episode) {
            if (await isKodikWarmupDoneForCurrentCardDay()) return true;
            if (!(await isCurrentServerDayConfirmed())) {
                log('Запрос квеста просмотра ждёт подтверждения нового дня от сайта.');
                return false;
            }
            if (kodikWarmupPromise) return kodikWarmupPromise;

            kodikWarmupPromise = (async () => {
                if (!entry?.anime_id || !entry?.t_id || !entry?.t_title) {
                    await showKodikMissingLinkNotice(entry);
                    return false;
                }

                const targetEpisode = parseInt(episode || entry.min_ep || 1, 10) || 1;
                const watchData = {
                    episode: targetEpisode,
                    season: parseInt(entry.s || 1, 10) || 1,
                    translation: {
                        id: parseInt(entry.t_id, 10) || entry.t_id,
                        title: entry.t_title
                    }
                };

                try {
                    const result = await fetchData('/index.php?controller=ajax&mod=anime_grabber&module=kodik_watched', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        body: new URLSearchParams({
                            action: 'save_watched',
                            news_id: entry.anime_id,
                            kodik_data: JSON.stringify(watchData)
                        }).toString()
                    }, 'json');

                    if (result?.status) {
                        await markKodikWarmupDoneForCurrentCardDay(entry, targetEpisode, 'ok');
                        log('Квест просмотра засчитан через watched endpoint.');
                        safePush('success', 'Квест просмотра засчитан.');
                        return true;
                    }

                    warn('Квест просмотра не был принят сайтом:', result);
                    return false;
                } catch (e) {
                    throw e;
                }
            })();

            try {
                return await kodikWarmupPromise;
            } finally {
                kodikWarmupPromise = null;
            }
        }

        function getCurrentPageAnimeTitle() {
            return clean(document.querySelector('h1')?.textContent || document.title || 'Аниме');
        }

        function collectCurrentAnimeBaseData() {
            const anime_id = getCurrentPageAnimeId();
            const tr = getCurrentPageActiveTranslation();
            const s = getCurrentPageSeason();
            const title = getCurrentPageAnimeTitle();
            const episodeRange = getCurrentPageEpisodeRange();

            return {
                anime_id,
                s,
                min_ep: episodeRange?.min_ep || 1,
                max_ep: episodeRange?.max_ep || null,
                t_title: tr?.t_title || null,
                t_id: tr?.t_id || null,
                t_link: tr?.t_link || '',
                title
            };
        }

        async function getAnimeProgress(entry) {
            const animeId = String(entry.anime_id);
            const minEp = Number(entry.min_ep || 1);
            const maxEp = Number(entry.max_ep || 0);

            if (!animeId || !maxEp || maxEp < minEp) {
                return {
                    processedEpisodes: 0,
                    totalEpisodes: 0,
                    isFullyFarmed: false,
                    episodeStates: []
                };
            }

            const [receipts, skippedEpisodes, historyEntry] = await Promise.all([
                getAllReceipts(),
                getAllFromStore('skipped_episodes'),
                getHistoryEntry(animeId)
            ]);

            const watchedSet = new Set(
                Array.isArray(historyEntry?.episodes)
                    ? historyEntry.episodes.map(v => Number(v))
                    : []
            );

            const skippedSet = new Set(
                skippedEpisodes
                    .filter(item => String(item?.animeId) === animeId)
                    .map(item => Number(item?.episode))
                    .filter(Number.isFinite)
            );

            const receiptMap = new Map();

            for (const rc of receipts) {
                if (String(rc?.watchedAnimeId) !== animeId) continue;
                const ep = Number(rc?.watchedEpisode);
                if (!Number.isFinite(ep)) continue;
                receiptMap.set(ep, (receiptMap.get(ep) || 0) + 1);
            }

            const episodeStates = [];
            let processedEpisodes = 0;

            for (let ep = minEp; ep <= maxEp; ep++) {
                const receiptCount = receiptMap.get(ep) || 0;
                const isSkipped = skippedSet.has(ep);
                const isWatched = watchedSet.has(ep);
                const isComplete = receiptCount >= RECEIPTS_PER_EP_COMPLETE || isSkipped || isWatched;

                if (isComplete) processedEpisodes++;

                episodeStates.push({
                    ep,
                    receiptCount,
                    isSkipped,
                    isWatched,
                    isComplete
                });
            }

            const totalEpisodes = maxEp - minEp + 1;

            return {
                processedEpisodes,
                totalEpisodes,
                isFullyFarmed: totalEpisodes > 0 && processedEpisodes >= totalEpisodes,
                episodeStates
            };
        }

        async function syncFinishedArchiveWithDb() {
            const db = await getAnimeDb();
            for (const item of db) {
                const progress = await getAnimeProgress(item);
                if (progress.isFullyFarmed) {
                    await addFinishedAnimeToArchive(item);
                }
            }
        }

        // =========================================================
        // ORDER / TARGET
        // =========================================================
        async function getEpOrder(animeEntry) {
            const key = `${animeEntry.anime_id}_s${animeEntry.s || 1}`;
            const saved = await GM_getValue(EP_ORDER_KEY, null);

            if (saved && saved[key] && Array.isArray(saved[key]) && saved[key].length) {
                return saved[key];
            }

            const base = parseInt(animeEntry.min_ep, 10);
            const max = parseInt(animeEntry.max_ep || 12, 10);
            return Array.from({ length: max - base + 1 }, (_, i) => base + i);
        }

        async function buildOrderedPool() {
            return await getAnimeDb();
        }

        async function updateSmartTarget() {
            let state = await GM_getValue(SMART_PROGRESSION_KEY, null);
            if (!state) {
                state = { index: 0, ep_offset: 0, cards_collected: 0, failed_attempts: 0 };
            }

            const allReceipts = await getAllReceipts();
            const animePoolByOrder = await buildOrderedPool();

            if (!animePoolByOrder.length) {
                state.index = -1;
                await GM_setValue(SMART_PROGRESSION_KEY, state);
                return state;
            }

            if (state.index < 0 || state.index >= animePoolByOrder.length) {
                state.index = 0;
                state.ep_offset = 0;
                state.cards_collected = 0;
                state.failed_attempts = 0;
            }

            let targetFound = false;
            let checkedAnimeCount = 0;

            while (checkedAnimeCount < animePoolByOrder.length) {
                const curAnime = animePoolByOrder[state.index];
                if (!curAnime) break;

                const orderedEps = await getEpOrder(curAnime);
                const maxEpisodes = orderedEps.length;

                while (state.ep_offset < maxEpisodes) {
                    const currentEp = orderedEps[state.ep_offset];
                    const skipKey = `${curAnime.anime_id}_s${curAnime.s || 1}_e${currentEp}`;

                    const collected = allReceipts.filter(rc =>
                        String(rc.watchedAnimeId) === String(curAnime.anime_id) &&
                        Number(rc.watchedEpisode) === Number(currentEp)
                    ).length;

                    const history = await getHistoryEntry(curAnime.anime_id);
                    const isAlreadyWatched = !!(history && Array.isArray(history.episodes) && history.episodes.includes(currentEp));
                    const skipped = await isEpisodeSkipped(skipKey);

                    if (collected >= RECEIPTS_PER_EP_COMPLETE || isAlreadyWatched || skipped) {
                        state.ep_offset++;
                        state.cards_collected = 0;
                        state.failed_attempts = 0;
                    } else {
                        state.cards_collected = collected;
                        targetFound = true;
                        break;
                    }
                }

                if (targetFound) break;

                const progress = await getAnimeProgress(curAnime);
                if (progress.isFullyFarmed) {
                    await addFinishedAnimeToArchive(curAnime);
                }

                state.index = (state.index + 1) % animePoolByOrder.length;
                state.ep_offset = 0;
                state.cards_collected = 0;
                state.failed_attempts = 0;
                checkedAnimeCount++;
            }

            if (!targetFound) state.index = -1;

            await GM_setValue(SMART_PROGRESSION_KEY, state);
            return state;
        }

        // =========================================================
        // REWARD / ERRORS
        // =========================================================
        function handleCardError(reason, source) {
            if (!reason) return;

            const isLimit = /получил(?:а)?\s+свои\s+\d+\s+карт/i.test(reason);
            let msg = reason;

            if (!Number.isNaN(parseInt(reason, 10)) && String(reason).length < 5) {
                msg = `Откат: еще ${reason} сек.`;
            }

            warn(`[${source}] ${msg}`);

            if (!isLimit) {
                safePush('info', msg);
            }
        }

        async function processCardReward(responseData, requestPayload, source = 'site') {
            await GM_setValue(LAST_SUCCESSFUL_REQUEST_KEY, Date.now());

            if (!responseData) return;

            if (!responseData.cards) {
                const reason = responseData.reason || responseData.error || '';

                if (/получил(?:а)?\s+свои\s+\d+\s+карт/i.test(reason)) {
                    await parseAndStoreLimitFromReason(reason);
                    await GM_setValue(COLLECTION_PAUSED_KEY, true);
                    await GM_setValue(PAUSE_DATE_KEY, getMskDateKey());
                    warn('Сервер подтвердил лимит карт. Пауза включена.');
                }

                if (reason) handleCardError(reason, source);
                updateButtonState();
                return;
            }

            try {
                const card = responseData.cards;
                const watchedInfo = parsePayload(requestPayload);
                const animeIdValue = watchedInfo.watched_news_id || card.news_id || '???';

                const receipt = {
                    receivedAt: Date.now(),
                    dateMsk: getMoscowTimeString(),
                    cardId: card.id,
                    cardName: card.name || 'Без названия',
                    rank: String(card.rank || 'e').toLowerCase(),
                    cardAnimeId: card.news_id,
                    image: card.image || '',
                    watchedAnimeId: animeIdValue,
                    watchedEpisode: watchedInfo.episode || '?',
                    watchedSeason: watchedInfo.season || '?',
                    translationId: watchedInfo.translation_id || '',
                    translationTitle: watchedInfo.translation_title || '',
                    source
                };

                let state = await GM_getValue(SMART_PROGRESSION_KEY, null);
                if (state && state.index !== -1) {
                    const pool = await buildOrderedPool();
                    const currentTargetAnimeId = pool[state.index]?.anime_id;

                    if (source !== 'site' || String(animeIdValue) === String(currentTargetAnimeId)) {
                        state.cards_collected = (state.cards_collected || 0) + 1;
                        if (state.cards_collected >= RECEIPTS_PER_EP_COMPLETE) {
                            state.ep_offset++;
                            state.cards_collected = 0;
                        }
                        state.failed_attempts = 0;
                        await GM_setValue(SMART_PROGRESSION_KEY, state);
                    }
                }

                await saveCardReceipt(receipt);
                await saveRequestLog({
                    source,
                    watchedAnimeId: animeIdValue,
                    watchedSeason: watchedInfo.season || 1,
                    watchedEpisode: watchedInfo.episode || 0,
                    status: 'success',
                    cardName: card.name || '—',
                    cardRank: String(card.rank || 'e').toLowerCase(),
                    serverMsg: 'OK'
                });

                const dailyProgress = await incrementDailyProgress();
                saveDiagnosticLog('card_received', {
                    receipt,
                    serverResponse: responseData,
                    smartProgressionAfter: state,
                    dailyProgress
                });
                updateButtonState();

                safePush('success', `Получена карта: ${card.name} [${String(card.rank || '?').toUpperCase()}]`);
            } catch (e) {
                error('Ошибка в processCardReward:', e);
                saveDiagnosticLog('process_card_reward_error', {
                    source,
                    requestPayload: diagnosticSanitizeBody(requestPayload),
                    serverResponse: responseData,
                    error: e
                });
            }
        }

        // =========================================================
        // MAIN LOOP
        // =========================================================

        // Вычисляет сколько миллисекунд до ближайшего 00:00 МСК
        function getMsUntilMskMidnight() {
            const now = Date.now();
            const mskOffset = 3 * 60 * 60 * 1000;
            const mskNowMs = now + mskOffset;
            const mskNowDate = new Date(mskNowMs);
            const todayMidnightMsk = Date.UTC(
                mskNowDate.getUTCFullYear(),
                mskNowDate.getUTCMonth(),
                mskNowDate.getUTCDate() + 1,
                0, 0, 5 // 5 секунд после полуночи для надёжности
            );
            return todayMidnightMsk - mskOffset - now;
        }

        function stopMainCardCheckLogic() {
            if (checkNewCardTimeoutId) {
                clearTimeout(checkNewCardTimeoutId);
                checkNewCardTimeoutId = null;
            }
            nextRunAt = 0;
            isLoopRunning = false;
            log('Цикл остановлен.');
            updateButtonState();
        }

        function scheduleNext(delayMs) {
            if (checkNewCardTimeoutId) clearTimeout(checkNewCardTimeoutId);
            const clampedDelay = Math.max(0, delayMs);
            nextRunAt = Date.now() + clampedDelay;
            checkNewCardTimeoutId = setTimeout(mainCardCheckLogic, clampedDelay);
            saveDiagnosticLog('next_attempt_scheduled', {
                delayMs: clampedDelay,
                nextRunAt,
                loopRunning: isLoopRunning
            });
            updateButtonState();
        }

        // Восстанавливает nextRunAt из сохранённого времени последнего запроса,
        // чтобы после перезагрузки страницы таймер продолжил отсчёт, а не сбросился
        async function restoreTimerFromStorage() {
            const lastRequest = await GM_getValue(LAST_SUCCESSFUL_REQUEST_KEY, 0);
            if (!lastRequest) return false;
            const elapsed = Date.now() - lastRequest;
            const remaining = CHECK_NEW_CARD_INTERVAL - elapsed;
            if (remaining > 0) {
                log(`Восстановление таймера: осталось ${Math.ceil(remaining / 1000)} сек.`);
                scheduleNext(remaining + 1000);
                return true;
            }
            return false;
        }

        async function mainCardCheckLogic() {
            if (isLoopRunning) return;
            isLoopRunning = true;

            try {
                if (!isTabVisible()) {
                    log('Вкладка скрыта. Автолут остановлен до возврата.');
                    stopMainCardCheckLogic();
                    return;
                }

                if (!isThisTabLeader()) {
                    const acquired = tryAcquireTabLock();
                    if (!acquired) {
                        log('Другая вкладка уже держит lock автосбора.');
                        stopMainCardCheckLogic();
                        return;
                    }
                }

                scriptEnabledWatch = await GM_getValue(STORAGE_KEY_WATCH, true);
                pauseOnLimitEnabled = await GM_getValue(PAUSE_ON_LIMIT_ENABLED_KEY, true);

                if (!scriptEnabledWatch) {
                    scheduleNext(RETRY_DISABLED_MS);
                    return;
                }

                let isCollectionPaused = await GM_getValue(COLLECTION_PAUSED_KEY, false);

                if (isCollectionPaused && pauseOnLimitEnabled) {
                    // Проверяем — не наступил ли новый день МСК?
                    const pauseDate = await GM_getValue(PAUSE_DATE_KEY, null);
                    const today = getMskDateKey();

                    if (pauseDate && pauseDate !== today) {
                        // Новый день — сбрасываем паузу и счётчик
                        log('Новый день по МСК. Сбрасываю паузу и счётчик карт.');
                        await GM_setValue(COLLECTION_PAUSED_KEY, false);
                        await GM_deleteValue(PAUSE_DATE_KEY);
                        await setDailyProgress(0);
                        isCollectionPaused = false;
                    } else {
                        // Тот же день — пробуем проверить профиль
                        await updateCardCounter(false);
                        isCollectionPaused = await GM_getValue(COLLECTION_PAUSED_KEY, false);

                        if (isCollectionPaused) {
                            // Всё ещё на паузе — ждём до 00:00 МСК
                            const msToMidnight = getMsUntilMskMidnight();
                            log(`Лимит не сброшен. Жду до 00:00 МСК (${Math.ceil(msToMidnight / 60000)} мин.).`);
                            scheduleNext(msToMidnight);
                            return;
                        }
                    }
                }

                const userHash = unsafeWindow?.dle_login_hash || window.dle_login_hash;
                if (!userHash) {
                    scheduleNext(RETRY_NO_HASH_MS);
                    return;
                }

                const now = Date.now();
                const globalLastRequestTime = await GM_getValue(LAST_SUCCESSFUL_REQUEST_KEY, 0);
                const timeSinceLast = now - globalLastRequestTime;

                if (timeSinceLast < CHECK_NEW_CARD_INTERVAL) {
                    const timeLeftMs = CHECK_NEW_CARD_INTERVAL - timeSinceLast;
                    log(`Слишком рано. Жду еще ${Math.ceil(timeLeftMs / 1000)} сек.`);
                    scheduleNext(timeLeftMs + 1000);
                    return;
                }

                const initialPool = await buildOrderedPool();
                if (!initialPool.length) {
                    log('База аниме пуста. Автолут остановлен до добавления аниме.');
                    saveDiagnosticLog('anime_database_empty');
                    safePush('info', 'Добавьте аниме в базу, чтобы автолут мог получать карты.');
                    stopMainCardCheckLogic();
                    return;
                }

                const state = await updateSmartTarget();
                if (!state || state.index === -1) {
                    // База есть, но все доступные серии уже выфармлены — ждём до 00:00 МСК
                    const msToMidnight = getMsUntilMskMidnight();
                    log(`Всё выфармлено. Жду до 00:00 МСК (${Math.ceil(msToMidnight / 60000)} мин.).`);
                    saveDiagnosticLog('all_episodes_considered_farmed', {
                        smartProgression: state,
                        animePoolSize: initialPool.length,
                        waitMs: msToMidnight
                    });
                    safePush('info', 'Всё выфармлено. Жду нового дня по МСК.');
                    scheduleNext(msToMidnight);
                    return;
                }

                const poolByOrder = await buildOrderedPool();
                const cur = poolByOrder[state.index];
                if (!cur) {
                    const msToMidnight = getMsUntilMskMidnight();
                    scheduleNext(msToMidnight);
                    return;
                }

                const orderedEpsForCur = await getEpOrder(cur);
                const targetEp = orderedEpsForCur[state.ep_offset] ?? (parseInt(cur.min_ep, 10) + state.ep_offset);
                saveDiagnosticLog('target_episode_selected', {
                    animeId: cur.anime_id,
                    animeTitle: cur.title || '',
                    season: cur.s || 1,
                    episode: targetEp,
                    translationId: cur.t_id,
                    translationTitle: cur.t_title,
                    smartProgression: state,
                    episodeOrderLength: orderedEpsForCur.length
                });

                const rawBody =
                    `news_id=${cur.anime_id}` +
                    `&kodik_data[episode]=${targetEp}` +
                    `&kodik_data[season]=${cur.s}` +
                    `&kodik_data[translation][id]=${cur.t_id}` +
                    `&kodik_data[translation][title]=${encodeURIComponent(cur.t_title)}` +
                    `&user_hash=${userHash}`;

                const headers = {
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-AW-AUTO': '1'
                };

                await fetchData('/ajax/calculate_series_watch/', {
                    method: 'POST',
                    headers,
                    body: rawBody
                }, 'response', false);

                await fetchData('/ajax/calculate_time_watch/', {
                    method: 'POST',
                    headers,
                    body: rawBody
                }, 'response', false);

                const serverDayConfirmed = await isCurrentServerDayConfirmed();
                if (serverDayConfirmed) {
                    ensureDailyKodikWarmup(cur, targetEp).catch(e => {
                        warn('Не удалось отправить запрос квеста просмотра:', e);
                    });
                }

                const data = await fetchData('/ajax/card_for_watch/', {
                    method: 'POST',
                    headers,
                    body: rawBody
                }, 'json');

                if (data.cards) {
                    if (!serverDayConfirmed) {
                        await confirmCurrentServerDay('card_response');
                        ensureDailyKodikWarmup(cur, targetEp).catch(e => {
                            warn('Не удалось отправить запрос квеста просмотра:', e);
                        });
                    }
                    state.failed_attempts = 0;
                    await GM_setValue(SMART_PROGRESSION_KEY, state);
                    await processCardReward(data, rawBody, 'auto');
                } else {
                    if (data.reason === 'no') {
                        const maxFailed = await GM_getValue(MAX_FAILED_ATTEMPTS_KEY, 2);
                        state.failed_attempts = (state.failed_attempts || 0) + 1;
                        const failedAttemptNumber = state.failed_attempts;
                        const skipKey = `${cur.anime_id}_s${cur.s || 1}_e${targetEp}`;
                        let episodeSkipped = false;

                        if (state.failed_attempts >= maxFailed) {
                            warn(`Нет карты ${state.failed_attempts}/${maxFailed} — серия исключена: ${skipKey}`);

                            await saveSkippedEpisode({
                                skipKey,
                                animeId: cur.anime_id,
                                season: cur.s || 1,
                                episode: targetEp,
                                skippedAt: Date.now(),
                                skippedAtMsk: getMoscowTimeString(),
                                reason: 'no_card'
                            });

                            state.ep_offset++;
                            state.cards_collected = 0;
                            state.failed_attempts = 0;
                            episodeSkipped = true;
                        }

                        saveDiagnosticLog('card_response_no', {
                            animeId: cur.anime_id,
                            animeTitle: cur.title || '',
                            season: cur.s || 1,
                            episode: targetEp,
                            serverResponse: data,
                            failedAttemptNumber,
                            maxFailedAttempts: maxFailed,
                            episodeSkipped,
                            skipKey,
                            smartProgressionAfter: state
                        });

                        await saveRequestLog({
                            source: 'auto',
                            watchedAnimeId: cur.anime_id,
                            watchedSeason: cur.s || 1,
                            watchedEpisode: targetEp,
                            status: 'empty',
                            cardName: '—',
                            cardRank: '—',
                            serverMsg: 'no',
                            scriptNote: `попытка ${state.failed_attempts}/${maxFailed}`
                        });

                        await GM_setValue(SMART_PROGRESSION_KEY, state);
                        await updateSmartTarget();
                        handleCardError(data.reason, 'auto');
                        scheduleNext(NO_CARD_RETRY_DELAY_MS);
                        return;

                    } else if (pauseOnLimitEnabled && /получил(?:а)?\s+свои\s+\d+\s+карт/i.test(data.reason || data.error || '')) {
                        await parseAndStoreLimitFromReason(data.reason || data.error || '');
                        await GM_setValue(COLLECTION_PAUSED_KEY, true);
                        await GM_setValue(PAUSE_DATE_KEY, getMskDateKey());
                        saveDiagnosticLog('server_daily_limit', {
                            animeId: cur.anime_id || 0,
                            season: cur.s || 1,
                            episode: targetEp,
                            serverResponse: data,
                            smartProgression: state
                        });

                        await saveRequestLog({
                            source: 'auto',
                            watchedAnimeId: cur.anime_id || 0,
                            watchedSeason: cur.s || 1,
                            watchedEpisode: targetEp,
                            status: 'rate_limit',
                            cardName: '—',
                            cardRank: '—',
                            serverMsg: data.error || data.reason || 'unknown',
                            scriptNote: ''
                        });

                        handleCardError(data.reason || data.error || '', 'auto');

                        // Ждём до 00:00 МСК, не останавливаемся полностью
                        const msToMidnight = getMsUntilMskMidnight();
                        log(`Лимит достигнут. Жду до 00:00 МСК (${Math.ceil(msToMidnight / 60000)} мин.).`);
                        scheduleNext(msToMidnight);
                        return;

                    } else {
                        saveDiagnosticLog('card_response_error', {
                            animeId: cur.anime_id || 0,
                            season: cur.s || 1,
                            episode: targetEp,
                            serverResponse: data,
                            smartProgression: state
                        });
                        await saveRequestLog({
                            source: 'auto',
                            watchedAnimeId: cur.anime_id || 0,
                            watchedSeason: cur.s || 1,
                            watchedEpisode: targetEp,
                            status: /часто/.test(data.reason || data.error || '') ? 'rate_limit' : 'error',
                            cardName: '—',
                            cardRank: '—',
                            serverMsg: data.error || data.reason || 'unknown',
                            scriptNote: ''
                        });

                        handleCardError(data.reason || data.error || 'unknown', 'auto');
                    }
                }

                scheduleNext(CHECK_NEW_CARD_INTERVAL + NEXT_LOOP_EXTRA_DELAY);
            } catch (e) {
                error('Ошибка цикла:', e);
                saveDiagnosticLog('main_loop_error', { error: e });
                scheduleNext(15000);
            } finally {
                isLoopRunning = false;
                updateButtonState();
            }
        }

        // =========================================================
        // SITE INTERCEPTORS
        // =========================================================
        function installFetchInterceptor() {
            if (window.__awVisibleTabFetchInstalled) return;
            window.__awVisibleTabFetchInstalled = true;

            const originalFetch = window.fetch;
            const hookedFetch = async function (...args) {
                const response = await originalFetch.apply(this, args);

                try {
                    const input = args[0];
                    const init = args[1] || {};
                    const url = typeof input === 'string' ? input : (input?.url || '');
                    const requestPayload = init?.body || '';

                    const headers = init?.headers || {};
                    const isOwnAutoRequest =
                        (headers instanceof Headers && headers.get('X-AW-AUTO') === '1') ||
                        (!Array.isArray(headers) && typeof headers === 'object' && headers['X-AW-AUTO'] === '1');

                    if (isOwnAutoRequest) {
                        return response;
                    }

                    if (url.includes('ajax/calculate_series_watch/') || url.includes('ajax/calculate_time_watch/')) {
                        saveDiagnosticLog('site_watch_request_intercepted', {
                            method: String(init?.method || 'GET').toUpperCase(),
                            url: new URL(url, location.href).href,
                            headers: diagnosticSanitizeHeaders(headers),
                            body: diagnosticSanitizeBody(requestPayload),
                            status: response.status,
                            ok: response.ok
                        });
                    }

                    if (url.includes('ajax/calculate_time_watch/')) {
                        await GM_setValue(LAST_SUCCESSFUL_REQUEST_KEY, Date.now());
                    }

                    if (url.includes('card_for_watch') && response.ok) {
                        const cloned = response.clone();
                        const responseText = await cloned.text();

                        let content = responseText;
                        if (content.startsWith('cards{') || content.startsWith('cards(')) {
                            content = content.substring(content.indexOf('{')).replace(/\)$/, '');
                        }

                        try {
                            const siteData = JSON.parse(content);
                            saveDiagnosticLog('site_card_response_intercepted', {
                                method: String(init?.method || 'GET').toUpperCase(),
                                url: new URL(url, location.href).href,
                                requestBody: diagnosticSanitizeBody(requestPayload),
                                status: response.status,
                                response: siteData
                            });
                            if (siteData.cards) {
                                await processCardReward(siteData, requestPayload, 'site');
                            } else {
                                const reason = siteData.reason || siteData.error || '';
                                await parseAndStoreLimitFromReason(reason);

                                const params = requestPayload ? new URLSearchParams(requestPayload) : null;
                                await saveRequestLog({
                                    source: 'site',
                                    watchedAnimeId: params ? params.get('news_id') || 0 : 0,
                                    watchedSeason: params ? params.get('kodik_data[season]') || 1 : 1,
                                    watchedEpisode: params ? params.get('kodik_data[episode]') || 0 : 0,
                                    status: /часто/.test(reason) ? 'rate_limit' : (siteData.reason === 'no' ? 'empty' : 'error'),
                                    cardName: '—',
                                    cardRank: '—',
                                    serverMsg: reason || 'unknown'
                                });
                            }
                        } catch (e) {
                            saveDiagnosticLog('site_card_response_parse_failed', {
                                url: new URL(url, location.href).href,
                                requestBody: diagnosticSanitizeBody(requestPayload),
                                status: response.status,
                                responseText: content,
                                error: e
                            });
                        }
                    }
                } catch (e) {}

                return response;
            };
            hookedFetch.__awVisibleTabOriginal = originalFetch;
            hookedFetch.__awVisibleTabHook = true;
            window.fetch = hookedFetch;
        }

        function installSiteNotificationInterceptor() {
            if (window.__awVisibleTabDleInstalled) return;
            window.__awVisibleTabDleInstalled = true;

            const handleSiteNotification = async (message) => {
                if (!message) return;

                if (message.includes('за первый вход за сегодня')) {
                    await confirmCurrentServerDay('site_notification');
                    const isPaused = await GM_getValue(COLLECTION_PAUSED_KEY, false);
                    if (isPaused) {
                        log('Поймано уведомление нового дня. Сбрасываю паузу.');
                        await GM_setValue(COLLECTION_PAUSED_KEY, false);
                        await GM_deleteValue(PAUSE_DATE_KEY);

                        const limit = await getKnownDailyLimit();
                        await setDailyProgress(0);

                        if (scriptEnabledWatch && isTabVisible()) {
                            tryAcquireTabLock();
                            if (isThisTabLeader()) {
                                scheduleNext(1000);
                            }
                        }
                        updateButtonState();
                    }
                }
            };

            const wrapNotifier = (type, originalFn) => {
                const wrapped = function (message) {
                    try { handleSiteNotification(String(message)); } catch (e) {}
                    return typeof originalFn === 'function' ? originalFn.apply(this, arguments) : undefined;
                };
                wrapped.__awVisibleTabOriginal = originalFn;
                return wrapped;
            };

            const target = unsafeWindow?.DLEPush || window.DLEPush;
            if (target && typeof target === 'object') {
                ['info', 'success', 'error', 'warning', 'warn'].forEach((type) => {
                    target[type] = wrapNotifier(type, target[type]);
                });
            }

            const observerTarget = document.getElementById('DLEPush') || document.body;
            if (observerTarget) {
                const observer = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        for (const node of mutation.addedNodes) {
                            if (!(node instanceof HTMLElement)) continue;
                            const text = (node.textContent || '').trim();
                            if (text) handleSiteNotification(text);
                        }
                    }
                });
                observer.observe(observerTarget, { childList: true, subtree: true });
                window.__awVisibleTabDleObserver = observer;
            }
        }

        // =========================================================
        // MODALS
        // =========================================================
        function removeAnimeDbModal() {
            document.getElementById(ANIME_DB_MODAL_ID)?.remove();
        }

        function removeManualMaxEpModal() {
            document.getElementById(MANUAL_MAX_EP_MODAL_ID)?.remove();
        }

        function createSimpleModal(id, title, bodyHtml, maxWidth = '460px') {
            document.getElementById(id)?.remove();

            const modal = document.createElement('div');
            modal.id = id;
            modal.className = 'aw-modal-overlay';
            modal.innerHTML = `
                <div class="aw-modal-box" style="max-width:${maxWidth}">
                    <div class="aw-modal-head">
                        <div class="aw-modal-title">${title}</div>
                        <button class="aw-modal-close" type="button">×</button>
                    </div>
                    <div class="aw-modal-body">${bodyHtml}</div>
                </div>
            `;

            document.body.appendChild(modal);

            modal.querySelector('.aw-modal-close')?.addEventListener('click', () => modal.remove());
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });

            return modal;
        }

        async function showMessageModal(title, message) {
            const modal = createSimpleModal(
                MANUAL_MAX_EP_MODAL_ID,
                title,
                `
                    <div class="aw-form-sub">${message}</div>
                    <div class="aw-modal-actions">
                        <button class="aw-confirm-btn" id="aw-msg-ok" type="button">OK</button>
                    </div>
                `,
                '420px'
            );

            return new Promise(resolve => {
                modal.querySelector('#aw-msg-ok')?.addEventListener('click', () => {
                    modal.remove();
                    resolve();
                });
            });
        }

        async function showConfirmModal(title, message) {
            const modal = createSimpleModal(
                'aw-confirm-modal',
                title,
                `
                    <div class="aw-form-sub">${message}</div>
                    <div class="aw-modal-actions">
                        <button class="aw-cancel-btn" id="aw-confirm-no" type="button">Отмена</button>
                        <button class="aw-confirm-btn danger" id="aw-confirm-yes" type="button">Удалить</button>
                    </div>
                `,
                '380px'
            );

            return new Promise(resolve => {
                modal.querySelector('#aw-confirm-yes')?.addEventListener('click', () => { modal.remove(); resolve(true); });
                modal.querySelector('#aw-confirm-no')?.addEventListener('click',  () => { modal.remove(); resolve(false); });
            });
        }

        async function askMaxEpisodesModal(info) {
            removeManualMaxEpModal();

            const modal = createSimpleModal(
                MANUAL_MAX_EP_MODAL_ID,
                'Добавление аниме',
                `
                    <div class="aw-form-sub">
                        Автоматически собраны основные данные. Введи вручную
                        <b>максимальное количество серий</b> для этого аниме.
                    </div>

                    <div class="aw-preview">
                        <div><b>Название:</b> ${escapeHtml(info.title || '—')}</div>
                        <div><b>anime_id:</b> ${escapeHtml(info.anime_id || '—')}</div>
                        <div><b>Сезон:</b> ${escapeHtml(info.s ?? '—')}</div>
                        <div><b>Перевод:</b> ${escapeHtml(info.t_title || '—')}</div>
                        <div><b>translation id:</b> ${escapeHtml(info.t_id || '—')}</div>
                    </div>

                    <label class="aw-input-label" for="aw-max-ep-input">Максимум серий</label>
                    <input
                        id="aw-max-ep-input"
                        class="aw-input"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="Например: 12"
                    />
                    <div class="aw-error" id="aw-max-ep-error"></div>

                    <div class="aw-modal-actions">
                        <button class="aw-cancel-btn" id="aw-max-ep-cancel" type="button">Отмена</button>
                        <button class="aw-confirm-btn" id="aw-max-ep-ok" type="button">OK</button>
                    </div>
                `,
                '430px'
            );

            return new Promise(resolve => {
                const input = modal.querySelector('#aw-max-ep-input');
                const errorEl = modal.querySelector('#aw-max-ep-error');

                function close(result) {
                    modal.remove();
                    resolve(result);
                }

                function submit() {
                    const value = parseInt(input.value, 10);
                    if (!Number.isFinite(value) || value < 1) {
                        errorEl.textContent = 'Введи корректное число серий.';
                        input.focus();
                        return;
                    }
                    close(value);
                }

                modal.querySelector('#aw-max-ep-ok')?.addEventListener('click', submit);
                modal.querySelector('#aw-max-ep-cancel')?.addEventListener('click', () => close(null));

                input?.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') submit();
                    if (e.key === 'Escape') close(null);
                });

                setTimeout(() => input?.focus(), 30);
            });
        }

        // =========================================================
        // ANIME DB UI ACTIONS
        // =========================================================
        async function buildAnimeDbListWithProgress() {
            const db = await getAnimeDb();
            const result = [];

            for (const item of db) {
                const progress = await getAnimeProgress(item);
                if (progress.isFullyFarmed) {
                    await addFinishedAnimeToArchive(item);
                }
                result.push({ ...item, progress });
            }

            return result;
        }

        async function addCurrentAnimeToDb() {
            const baseData = collectCurrentAnimeBaseData();

            if (!baseData.anime_id || !baseData.t_title || !baseData.t_id) {
                await showMessageModal('Ошибка', 'Не удалось автоматически собрать обязательные данные для текущего аниме.');
                return false;
            }

            const kodikRange = await getEpisodeRangeFromKodik(baseData.t_link);
            const finalRange = kodikRange || {
                min_ep: 1,
                max_ep: null,
                season: baseData.s
            };

            const max_ep = finalRange.max_ep || await askMaxEpisodesModal(baseData);
            if (max_ep == null) return false;

            const entry = normalizeAnimeEntry({
                anime_id: baseData.anime_id,
                s: finalRange.season || baseData.s,
                min_ep: finalRange.min_ep || 1,
                max_ep,
                t_title: baseData.t_title,
                t_id: baseData.t_id,
                t_link: baseData.t_link,
                title: baseData.title,
                addedAt: Date.now()
            });

            const progressNow = await getAnimeProgress(entry);
            const key = buildAnimeUniqueKey(entry);
            if (!progressNow.isFullyFarmed) {
                await removeFinishedAnimeArchiveByKey(key);
            }

            if (await isAnimeInFinishedArchive(entry)) {
                await showMessageModal('Ошибка', 'В данном аниме уже все карты выфармлены');
                return false;
            }

            if (progressNow.isFullyFarmed) {
                await addFinishedAnimeToArchive(entry);
                await showMessageModal('Ошибка', 'В данном аниме уже все карты выфармлены');
                return false;
            }

            const db = await getAnimeDb();
            const existingIndex = db.findIndex(item => buildAnimeUniqueKey(item) === key);
            if (existingIndex !== -1) {
                const existing = db[existingIndex];
                const updated = normalizeAnimeEntry({
                    ...existing,
                    ...entry,
                    addedAt: existing.addedAt || entry.addedAt
                });

                db[existingIndex] = updated;
                await removeFinishedAnimeArchiveByKey(key);
                await setAnimeDb(db);
                await copyText(JSON.stringify(updated, null, 2));
                await showMessageModal('\u0413\u043e\u0442\u043e\u0432\u043e', '\u0417\u0430\u043f\u0438\u0441\u044c \u0430\u043d\u0438\u043c\u0435 \u0432 \u0431\u0430\u0437\u0435 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0430.');
                return true;
            }

            if (db.some(item => buildAnimeUniqueKey(item) === key)) {
                await showMessageModal('Информация', 'Это аниме уже есть в базе.');
                return false;
            }

            db.push(entry);
            await setAnimeDb(db);

            await copyText(JSON.stringify(entry, null, 2));

            await showMessageModal('\u0413\u043e\u0442\u043e\u0432\u043e', '\u0410\u043d\u0438\u043c\u0435 \u0443\u0441\u043f\u0435\u0448\u043d\u043e \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u043e \u0432 \u0431\u0430\u0437\u0443.');
            return true;
        }

        async function openAnimeDbModal() {
            removeAnimeDbModal();
            await syncFinishedArchiveWithDb();

            const items = await buildAnimeDbListWithProgress();

            let processedEpisodesAll = 0;
            let totalEpisodesAll = 0;

            for (const item of items) {
                processedEpisodesAll += Number(item.progress?.processedEpisodes || 0);
                totalEpisodesAll += Number(item.progress?.totalEpisodes || 0);
            }

            const modal = createSimpleModal(
                ANIME_DB_MODAL_ID,
                'База аниме',
                `
                    <div class="aw-summary">
                        <div class="aw-card">
                            <div class="aw-card-label">Аниме в базе</div>
                            <div class="aw-card-value">${items.length}</div>
                        </div>
                        <div class="aw-card">
                            <div class="aw-card-label">Серии</div>
                            <div class="aw-card-value">${processedEpisodesAll} / ${totalEpisodesAll}</div>
                        </div>
                        <div class="aw-card">
                            <div class="aw-card-label">Полностью выфармлено</div>
                            <div class="aw-card-value">${items.filter(x => x.progress?.isFullyFarmed).length}</div>
                        </div>
                    </div>

                    <div class="aw-actions-top">
                        <button class="aw-action-btn" id="aw-add-current-anime-btn" type="button">Добавить текущее аниме</button>
                        <button class="aw-action-btn secondary" id="aw-refresh-anime-db-btn" type="button">Обновить</button>
                    </div>

                    <div class="aw-list" id="aw-anime-db-list">
                        ${
                            items.length
                                ? items.map(item => {
                                    const key = buildAnimeUniqueKey(item);
                                    const progressText = `${item.progress?.processedEpisodes || 0} / ${item.progress?.totalEpisodes || 0}`;

                                    return `
                                        <div class="aw-item" data-anime-key="${escapeHtml(key)}">
                                            <div class="aw-item-top">
                                                <div>
                                                    <div class="aw-item-title">${escapeHtml(item.title || `anime_id ${item.anime_id}`)}</div>
                                                    <div class="aw-item-sub">
                                                        anime_id: ${escapeHtml(item.anime_id)} · сезон: ${escapeHtml(item.s)}<br>
                                                        перевод: ${escapeHtml(item.t_title)} · t_id: ${escapeHtml(item.t_id)}
                                                    </div>
                                                    <div class="aw-item-progress">
                                                        Прогресс: ${progressText}${item.progress?.isFullyFarmed ? ' · ✅ выфармлено' : ''}
                                                    </div>
                                                </div>
                                                <div class="aw-item-actions">
                                                    <button class="aw-small-btn danger aw-remove-anime-btn" type="button" data-anime-key="${escapeHtml(key)}">Удалить</button>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')
                                : `<div class="aw-empty">База аниме пока пуста.</div>`
                        }
                    </div>
                `,
                '860px'
            );

            modal.querySelector('#aw-refresh-anime-db-btn')?.addEventListener('click', async () => {
                modal.remove();
                await openAnimeDbModal();
            });

            modal.querySelector('#aw-add-current-anime-btn')?.addEventListener('click', async () => {
                const added = await addCurrentAnimeToDb();
                if (added) {
                    removeAnimeDbModal();
                    await openAnimeDbModal();
                }
            });

            modal.querySelectorAll('.aw-remove-anime-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const key = btn.getAttribute('data-anime-key');
                    if (!key) return;
                    const item = btn.closest('.aw-item');
                    const title = item?.querySelector('.aw-item-title')?.textContent || 'это аниме';
                    const confirmed = await showConfirmModal('Удаление', `Удалить «${escapeHtml(title)}» из базы?`);
                    if (!confirmed) return;
                    await removeAnimeFromDbByKey(key);
                    await removeFinishedAnimeArchiveByKey(key);
                    removeAnimeDbModal();
                    await openAnimeDbModal();
                });
            });
        }

        // =========================================================
        // UI
        // =========================================================
        async function updateButtonState() {
            const btn = document.getElementById('aw-active-tab-toggle');
            const info = document.getElementById('aw-active-tab-info');
            const timer = document.getElementById('aw-active-tab-timer');
            const daily = document.getElementById('aw-active-tab-daily');
            const pause = document.getElementById('aw-active-tab-pause');
            const holder = document.getElementById('aw-active-tab-holder');
            const barFill = document.getElementById('aw-daily-bar-fill');
            const lastCardEl = document.getElementById('aw-active-tab-last-card');
            const title = document.querySelector('#aw-active-tab-panel .aw-title');
            if (!btn || !info || !timer || !daily || !pause || !holder) return;

            const visible = isTabVisible();
            const leader = isThisTabLeader();
            const paused = await GM_getValue(COLLECTION_PAUSED_KEY, false);
            const active = scriptEnabledWatch && visible && leader && !paused;

            btn.textContent = active ? 'Автолут: ВКЛ' : 'Автолут: ВЫКЛ';
            btn.style.background = active ? '#14532d' : '#7f1d1d';

            if (!scriptEnabledWatch) {
                info.textContent = 'Модуль выключен';
            } else if (!visible) {
                info.textContent = 'Вкладка скрыта';
            } else if (!leader) {
                info.textContent = 'Другая вкладка уже выполняет автолут';
            } else {
                info.textContent = 'Эта вкладка выполняет автолут';
            }

            let compactTimerText = '-';
            if (nextRunAt > Date.now()) {
                const left = nextRunAt - Date.now();
                compactTimerText = formatMs(left);
                if (left > 60 * 60 * 1000) {
                    const h = Math.floor(left / 3600000);
                    const m = Math.floor((left % 3600000) / 60000);
                    timer.textContent = `До 00:00 МСК: ${h}ч ${m}м`;
                } else {
                    timer.textContent = `До попытки: ${formatMs(left)}`;
                }
            } else if (paused) {
                compactTimerText = 'limit';
                timer.textContent = 'До попытки: пауза (лимит карт)';
            } else if (!scriptEnabledWatch) {
                compactTimerText = 'off';
                timer.textContent = 'До попытки: модуль выкл.';
            } else {
                timer.textContent = 'До попытки: —';
            }

            // прогресс-бар
            const progressState = await GM_getValue(DAILY_PROGRESS_KEY, null);
            const limit = await getKnownDailyLimit();
            const current = progressState?.current || 0;
            if (barFill) {
                const pct = (limit && limit > 0) ? Math.min(100, (current / limit) * 100) : 0;
                barFill.style.width = pct + '%';
                barFill.style.background = pct >= 100 ? '#8b3a3a' : '#2e8b57';
            }
            if (title) {
                const collapsed = await GM_getValue(PANEL_COLLAPSED_KEY, false);
                const dailyCompact = limit ? `${current}/${limit}` : (current > 0 ? `${current}/?` : '?');
                if (collapsed) {
                    title.innerHTML =
                        '<span class="aw-compact-name">АВТОЛУТ</span>' +
                        `<span class="aw-compact-badge aw-compact-limit">${dailyCompact}</span>` +
                        `<span class="aw-compact-badge aw-compact-time">${compactTimerText}</span>`;
                } else {
                    title.textContent = 'Автолут';
                }
            }
            daily.textContent = `Сегодня: ${limit ? `${current} / ${limit}` : (current > 0 ? current : '?')}`;

            pause.textContent = `Пауза: ${paused ? 'да' : 'нет'}`;
            holder.textContent = `Вкладка: ${leader ? 'ведущая' : 'ожидание'}`;

            // последняя полученная карта
            if (lastCardEl) {
                try {
                    const receipts = await getAllReceipts();
                    if (receipts.length > 0) {
                        const last = receipts.reduce((a, b) => (a.receivedAt > b.receivedAt ? a : b));
                        const rank = String(last.rank || last.cardRank || 'e').toLowerCase();
                        const rc = RANK_CONFIG.find(r => r.key === rank) || RANK_CONFIG[RANK_CONFIG.length - 1];
                        lastCardEl.style.display = '';
                        lastCardEl.innerHTML =
                            `<span class="aw-last-card" style="background:${rc.bg};color:${rc.color}">${rc.label}</span>` +
                            `${escapeHtml(last.cardName || '—')}`;
                    } else {
                        lastCardEl.style.display = 'none';
                    }
                } catch (e) {
                    lastCardEl.style.display = 'none';
                }
            }
        }

        async function toggleWatch() {
            scriptEnabledWatch = !(await GM_getValue(STORAGE_KEY_WATCH, true));
            await GM_setValue(STORAGE_KEY_WATCH, scriptEnabledWatch);

            if (scriptEnabledWatch) {
                tryAcquireTabLock();

                if (isTabVisible() && isThisTabLeader()) {
                    safePush('success', 'Автолут включён');
                    scheduleNext(500);
                } else {
                    safePush('info', 'Автолут включён, но сбор сейчас выполняет другая вкладка');
                    stopMainCardCheckLogic();
                }
            } else {
                removeTabLockIfMine();
                safePush('info', 'Автолут выключен');
                stopMainCardCheckLogic();
            }

            updateButtonState();
        }

        async function togglePanelCollapsed() {
            const panel = document.getElementById('aw-active-tab-panel');
            const body = document.getElementById('aw-active-tab-panel-body');
            const btn = document.getElementById('aw-active-tab-collapse');
            if (!body || !btn || !panel) return;

            const current = await GM_getValue(PANEL_COLLAPSED_KEY, false);
            const next = !current;
            await GM_setValue(PANEL_COLLAPSED_KEY, next);

            suiteApplyCollapsibleState(panel, next, () => {
                body.style.display = next ? 'none' : 'block';
                btn.textContent = next ? '▣' : '—';
            });

            if (!next) {
                requestAnimationFrame(() => clampPanelToViewport(panel));
            }

            updateButtonState();
        }

        async function applyPanelCollapsedState() {
            const body = document.getElementById('aw-active-tab-panel-body');
            const btn = document.getElementById('aw-active-tab-collapse');
            if (!body || !btn) return;

            const collapsed = await GM_getValue(PANEL_COLLAPSED_KEY, false);
            body.style.display = collapsed ? 'none' : 'block';
            btn.textContent = collapsed ? '▣' : '—';
            updateButtonState();
        }

        async function createPanel() {
            if (document.getElementById('aw-active-tab-panel')) return;

            GM_addStyle(`
                #aw-active-tab-panel {
                    position: fixed;
                    left: 12px;
                    bottom: 80px;
                    z-index: 999;
                    background: rgba(10,15,26,.98);
                    color: #e2e8f0;
                    padding: 12px 14px;
                    border: 1px solid #1e293b;
                    border-radius: 12px;
                    font-size: 14px;
                    box-shadow: 0 8px 40px rgba(0,0,0,.65);
                    user-select: none;
                    min-width: 280px;
                    font-family: 'Segoe UI', Arial, sans-serif;
                }
                @media (max-width: 520px) {
                    #aw-active-tab-panel {
                        left: 10px;
                        right: auto;
                        bottom: 74px;
                        width: min(320px, calc(100vw - 20px));
                        min-width: 0;
                        max-width: calc(100vw - 20px);
                    }
                }
                #aw-active-tab-panel .aw-head {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 8px;
                    touch-action: none;
                }
                #aw-active-tab-panel .aw-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                    min-width: 0;
                    font-weight: 700;
                    color: #e2e8f0;
                }
                #aw-active-tab-panel-body {
                    max-height: calc(100dvh - 90px);
                    overflow-y: auto;
                    overscroll-behavior: contain;
                }
                #aw-active-tab-panel .aw-icon-btn,
                #aw-active-tab-panel .aw-btn {
                    border: 1px solid #334155;
                    border-radius: 8px;
                    cursor: pointer;
                    color: #cbd5e1;
                    background: #0f172a;
                    font-family: inherit;
                }
                #aw-active-tab-panel .aw-icon-btn {
                    width: 32px;
                    height: 28px;
                }
                #aw-active-tab-panel .aw-btn {
                    padding: 6px 8px;
                    font-size: 13px;
                }
                #aw-active-tab-panel .aw-icon-btn:hover,
                #aw-active-tab-panel .aw-btn:hover {
                    background: #1e293b;
                    color: #e2e8f0;
                }
                #aw-active-tab-toggle {
                    border-radius: 8px;
                    padding: 8px 10px;
                    cursor: pointer;
                    text-align: center;
                    font-weight: 700;
                    border: 1px solid rgba(255,255,255,.08);
                    box-shadow: inset 0 0 0 1px rgba(255,255,255,.04);
                }
                #aw-active-tab-panel .aw-line {
                    margin-top: 6px;
                    font-size: 13px;
                    color: #cbd5e1;
                    opacity: .92;
                }
                #aw-active-tab-panel .aw-actions {
                    margin-top: 8px;
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                }
                .aw-progress-wrap {
                    margin-top: 4px;
                }
                .aw-progress-bar {
                    height: 5px;
                    border-radius: 4px;
                    background: #020617;
                    overflow: hidden;
                    border: 1px solid #1e293b;
                }
                .aw-progress-fill {
                    height: 100%;
                    border-radius: 4px;
                    background: #14532d;
                    transition: width .4s ease;
                    width: 0%;
                }
                .aw-compact-name {
                    color: #93c5fd;
                    font-size: 14px;
                    letter-spacing: .3px;
                }
                .aw-compact-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 54px;
                    padding: 5px 9px;
                    border-radius: 7px;
                    font-size: 13px;
                    line-height: 1;
                    font-weight: 800;
                }
                .aw-compact-limit {
                    color: #bbf7d0;
                    background: #052e16;
                    border: 1px solid #166534;
                    box-shadow: 0 0 12px rgba(34,197,94,.24);
                }
                .aw-compact-time {
                    color: #fde68a;
                    background: #451a03;
                    border: 1px solid #92400e;
                    box-shadow: 0 0 12px rgba(245,158,11,.22);
                }
                .aw-last-card {
                    display: inline-block;
                    font-size: 11px;
                    font-weight: 700;
                    padding: 1px 6px;
                    border-radius: 5px;
                    margin-right: 4px;
                }
                .aw-modal-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 999;
                    background: rgba(2,6,23,.72);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 18px;
                    font-family: 'Segoe UI', Arial, sans-serif;
                }
                .aw-modal-box {
                    width: 100%;
                    max-height: 90vh;
                    overflow: hidden;
                    background: #0a0f1a;
                    color: #e2e8f0;
                    border-radius: 12px;
                    border: 1px solid #1e293b;
                    box-shadow: 0 18px 70px rgba(0,0,0,.78);
                    display: flex;
                    flex-direction: column;
                }
                .aw-modal-head {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 10px;
                    padding: 14px 18px 12px;
                    background: #0f172a;
                    border-bottom: 1px solid #1e293b;
                }
                .aw-modal-title {
                    font-size: 16px;
                    font-weight: 700;
                    color: #e2e8f0;
                }
                .aw-modal-close {
                    border: 1px solid #334155;
                    background: #0a0f1a;
                    color: #94a3b8;
                    width: 30px;
                    height: 30px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 18px;
                    line-height: 1;
                }
                .aw-modal-close:hover {
                    background: #1e293b;
                    color: #e2e8f0;
                }
                .aw-modal-body {
                    padding: 16px 18px 18px;
                    overflow: auto;
                }
                .aw-summary {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0,1fr));
                    gap: 10px;
                    margin-bottom: 14px;
                }
                .aw-card {
                    background: #0f172a;
                    border: 1px solid #1e293b;
                    border-radius: 8px;
                    padding: 12px;
                }
                .aw-card-label {
                    font-size: 12px;
                    color: #94a3b8;
                    margin-bottom: 6px;
                }
                .aw-card-value {
                    font-size: 18px;
                    font-weight: 700;
                    color: #e2e8f0;
                }
                .aw-actions-top {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 14px;
                    flex-wrap: wrap;
                }
                .aw-action-btn {
                    border: 1px solid #1d4ed8;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 700;
                    padding: 10px 14px;
                    color: #bfdbfe;
                    background: #0c1445;
                    font-family: inherit;
                }
                .aw-action-btn.secondary {
                    border-color: #334155;
                    color: #cbd5e1;
                    background: #0f172a;
                }
                .aw-action-btn:hover {
                    filter: brightness(1.15);
                }
                .aw-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .aw-item {
                    background: #0f172a;
                    border: 1px solid #1e293b;
                    border-radius: 8px;
                    padding: 12px;
                }
                .aw-item-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 12px;
                }
                .aw-item-title {
                    font-size: 15px;
                    font-weight: 700;
                    line-height: 1.4;
                    margin-bottom: 5px;
                    color: #e2e8f0;
                }
                .aw-item-sub {
                    font-size: 12px;
                    color: #94a3b8;
                    line-height: 1.45;
                }
                .aw-item-progress {
                    margin-top: 8px;
                    font-size: 13px;
                    font-weight: 700;
                }
                .aw-item-actions {
                    display: flex;
                    gap: 8px;
                    flex-shrink: 0;
                }
                .aw-small-btn {
                    border: 1px solid #334155;
                    border-radius: 8px;
                    cursor: pointer;
                    color: #cbd5e1;
                    padding: 9px 12px;
                    font-size: 12px;
                    font-weight: 700;
                    background: #0a0f1a;
                    font-family: inherit;
                }
                .aw-small-btn.danger {
                    border-color: #7f1d1d;
                    color: #fecdd3;
                    background: #4c0519;
                }
                .aw-small-btn:hover {
                    filter: brightness(1.18);
                }
                .aw-empty {
                    font-size: 13px;
                    color: #94a3b8;
                    background: #0f172a;
                    border: 1px dashed #334155;
                    border-radius: 8px;
                    padding: 16px;
                }
                .aw-form-sub {
                    font-size: 13px;
                    line-height: 1.5;
                    color: #cbd5e1;
                    margin-bottom: 14px;
                }
                .aw-preview {
                    background: #0f172a;
                    border: 1px solid #1e293b;
                    border-radius: 8px;
                    padding: 10px 12px;
                    font-size: 13px;
                    line-height: 1.55;
                    margin-bottom: 14px;
                }
                .aw-preview b {
                    color: #e2e8f0;
                }
                .aw-input-label {
                    display: block;
                    font-size: 13px;
                    margin-bottom: 8px;
                    color: #cbd5e1;
                }
                .aw-input {
                    width: 100%;
                    box-sizing: border-box;
                    padding: 12px 14px;
                    border-radius: 8px;
                    border: 1px solid #334155;
                    background: #0f172a;
                    color: #e2e8f0;
                    font-size: 15px;
                    outline: none;
                }
                .aw-input:focus {
                    border-color: #6366f1;
                }
                .aw-error {
                    min-height: 18px;
                    margin-top: 8px;
                    font-size: 12px;
                    color: #ff8d8d;
                }
                .aw-modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    margin-top: 16px;
                }
                .aw-confirm-btn,
                .aw-cancel-btn {
                    border: 1px solid #334155;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 700;
                    padding: 10px 16px;
                    color: #cbd5e1;
                    font-family: inherit;
                }
                .aw-confirm-btn {
                    color: #bfdbfe;
                    background: #0c1445;
                    border-color: #1d4ed8;
                }
                .aw-confirm-btn.danger {
                    color: #fecdd3;
                    background: #4c0519;
                    border-color: #7f1d1d;
                }
                .aw-cancel-btn {
                    background: #0f172a;
                }
                .aw-rank-bar {
                    display: flex;
                    height: 10px;
                    border-radius: 6px;
                    overflow: hidden;
                    background: #020617;
                    border: 1px solid #1e293b;
                    gap: 1px;
                }
                .aw-rank-badge {
                    display: inline-block;
                    font-size: 12px;
                    font-weight: 700;
                    padding: 2px 8px;
                    border-radius: 6px;
                    border: 1px solid transparent;
                }
                .aw-stat-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                }
                .aw-stat-table thead tr th {
                    color: #94a3b8;
                    font-weight: 600;
                    font-size: 11px;
                    text-align: left;
                    padding: 4px 8px 8px;
                    border-bottom: 1px solid #1e293b;
                }
                .aw-stat-table thead tr th:not(:first-child) {
                    text-align: right;
                }
                .aw-stat-table tbody tr td {
                    padding: 7px 8px;
                    border-bottom: 1px solid #0f172a;
                }
                .aw-stat-table tbody tr:last-child td {
                    border-bottom: none;
                }
                .aw-stat-num {
                    text-align: right;
                    font-weight: 700;
                    font-size: 14px;
                }
                .aw-stat-pct {
                    text-align: right;
                    color: #94a3b8;
                    font-size: 12px;
                }
                @media (max-width: 720px) {
                    .aw-summary {
                        grid-template-columns: 1fr;
                    }
                    .aw-item-top {
                        flex-direction: column;
                    }
                    .aw-item-actions {
                        width: 100%;
                    }
                    .aw-small-btn {
                        flex: 1;
                    }
                }
            `);

            const panel = document.createElement('div');
            panel.id = 'aw-active-tab-panel';
            panel.innerHTML = `
                <div class="aw-head">
                    <div class="aw-title">Автолут</div>
                    <button id="aw-active-tab-collapse" class="aw-icon-btn" title="Свернуть">—</button>
                </div>
                <div id="aw-active-tab-panel-body">
                    <div id="aw-active-tab-toggle">Автолут: ...</div>
                    <div id="aw-active-tab-info" class="aw-line">...</div>
                    <div id="aw-active-tab-holder" class="aw-line">Вкладка: ...</div>
                    <div id="aw-active-tab-pause" class="aw-line">Пауза: ...</div>
                    <div id="aw-active-tab-daily" class="aw-line">Сегодня: ...</div>
                    <div class="aw-progress-wrap aw-line">
                        <div id="aw-daily-bar" class="aw-progress-bar"><div id="aw-daily-bar-fill" class="aw-progress-fill"></div></div>
                    </div>
                    <div id="aw-active-tab-last-card" class="aw-line" style="display:none"></div>
                    <div id="aw-active-tab-timer" class="aw-line">До попытки: ...</div>
                    <div class="aw-actions">
                        <button id="aw-open-anime-db" class="aw-btn">База аниме</button>
                        <button id="aw-open-stats" class="aw-btn">Статистика</button>
                        <button id="aw-active-tab-profile" class="aw-btn">Проверить лимит</button>
                    </div>
                </div>
            `;
            document.body.appendChild(panel);
            panel._suitePersistFloatingPosition = () => GM_setValue(PANEL_POSITION_KEY, {
                left: panel.style.left,
                top: panel.style.top
            });
            suiteKeepInViewport(panel, {margin:8, constrainSize:true});

            panel.querySelector('#aw-active-tab-toggle').addEventListener('click', toggleWatch);
            panel.querySelector('#aw-open-anime-db').addEventListener('click', openAnimeDbModal);
            panel.querySelector('#aw-open-stats').addEventListener('click', openStatsModal);
            panel.querySelector('#aw-active-tab-profile').addEventListener('click', async () => {
                await updateCardCounter(true);
                safePush('info', 'Проверка лимита через профиль выполнена');
            });
            panel.querySelector('#aw-active-tab-collapse').addEventListener('click', togglePanelCollapsed);

            installPanelDrag(panel);
            await applyPanelPosition(panel);

            applyPanelCollapsedState();
            updateButtonState();
        }

        function installPanelDrag(panel) {
            const head = panel.querySelector('.aw-head');
            if (!head) return;

            head.style.cursor = 'grab';
            head.style.touchAction = 'none';
            let dragging = false;
            let startX = 0, startY = 0, origLeft = 0, origTop = 0;
            const getPoint = (e) => e.touches?.[0] || e.changedTouches?.[0] || e;

            head.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                dragging = true;
                startX = e.clientX;
                startY = e.clientY;
                const rect = panel.getBoundingClientRect();
                origLeft = rect.left;
                origTop  = rect.top;
                // Переключаемся на top-позиционирование при начале drag
                panel.style.left   = origLeft + 'px';
                panel.style.top    = origTop + 'px';
                panel.style.right  = 'auto';
                panel.style.bottom = 'auto';
                head.style.cursor = 'grabbing';
                e.preventDefault();
            });

            head.addEventListener('touchstart', (e) => {
                if (e.target.closest('button')) return;
                const point = getPoint(e);
                dragging = true;
                startX = point.clientX;
                startY = point.clientY;
                const rect = panel.getBoundingClientRect();
                origLeft = rect.left;
                origTop  = rect.top;
                panel.style.left   = origLeft + 'px';
                panel.style.top    = origTop + 'px';
                panel.style.right  = 'auto';
                panel.style.bottom = 'auto';
                head.style.cursor = 'grabbing';
                e.preventDefault();
            }, { passive:false });

            document.addEventListener('mousemove', (e) => {
                if (!dragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                const viewport = suiteGetVisibleViewport();
                const newLeft = Math.max(viewport.left, Math.min(viewport.right - panel.offsetWidth, origLeft + dx));
                const newTop  = Math.max(viewport.top, Math.min(viewport.bottom - panel.offsetHeight, origTop + dy));
                panel.style.left  = newLeft + 'px';
                panel.style.top   = newTop  + 'px';
                panel.style.right  = 'auto';
                panel.style.bottom = 'auto';
            });

            document.addEventListener('touchmove', (e) => {
                if (!dragging) return;
                const point = getPoint(e);
                const dx = point.clientX - startX;
                const dy = point.clientY - startY;
                const viewport = suiteGetVisibleViewport();
                const newLeft = Math.max(viewport.left, Math.min(viewport.right - panel.offsetWidth, origLeft + dx));
                const newTop  = Math.max(viewport.top, Math.min(viewport.bottom - panel.offsetHeight, origTop + dy));
                panel.style.left  = newLeft + 'px';
                panel.style.top   = newTop  + 'px';
                panel.style.right  = 'auto';
                panel.style.bottom = 'auto';
                e.preventDefault();
            }, { passive:false });

            document.addEventListener('mouseup', async () => {
                if (!dragging) return;
                dragging = false;
                head.style.cursor = 'grab';
                clampPanelToViewport(panel);
                suiteResolveFloatingButtonOverlaps(panel);
                await panel._suitePersistFloatingPosition();
            });
            document.addEventListener('touchend', async () => {
                if (!dragging) return;
                dragging = false;
                head.style.cursor = 'grab';
                clampPanelToViewport(panel);
                suiteResolveFloatingButtonOverlaps(panel);
                await panel._suitePersistFloatingPosition();
            });
            document.addEventListener('touchcancel', async () => {
                if (!dragging) return;
                dragging = false;
                head.style.cursor = 'grab';
                clampPanelToViewport(panel);
                suiteResolveFloatingButtonOverlaps(panel);
                await panel._suitePersistFloatingPosition();
            });
            window.addEventListener('resize', () => clampPanelToViewport(panel));
        }

        async function applyPanelPosition(panel) {
            const pos = await GM_getValue(PANEL_POSITION_KEY, null);
            if (pos && pos.left) {
                panel.style.left   = pos.left;
                panel.style.right  = 'auto';
                if (pos.top) {
                    panel.style.top    = pos.top;
                    panel.style.bottom = 'auto';
                }
            }
            requestAnimationFrame(() => clampPanelToViewport(panel));
        }

        function clampPanelToViewport(panel) {
            suiteClampToViewport(panel, {margin:8, constrainSize:true});
        }

        function startPanelTicker() {
            stopPanelTicker();
            panelTickerIntervalId = setInterval(() => {
                updateButtonState();
            }, 1000);
        }

        function stopPanelTicker() {
            if (panelTickerIntervalId) {
                clearInterval(panelTickerIntervalId);
                panelTickerIntervalId = null;
            }
        }

        // =========================================================
        // EVENTS
        // =========================================================
        function handleTabActivityChange() {
            updateButtonState();

            if (!isTabVisible()) {
                removeTabLockIfMine();
                stopMainCardCheckLogic();
                return;
            }

            claimTabLock(document.hasFocus?.() === true);

            if (scriptEnabledWatch && isThisTabLeader()) {
                scheduleNext(RESUME_DELAY_MS);
            }
        }

        function handleTabFocus() {
            const becameLeader = claimTabLock(true);
            updateButtonState();
            if (becameLeader && scriptEnabledWatch) {
                const hasFutureRun = checkNewCardTimeoutId && nextRunAt > Date.now() + RESUME_DELAY_MS;
                if (!hasFutureRun) scheduleNext(RESUME_DELAY_MS);
            }
        }

        function handleBeforeUnload() {
            removeTabLockIfMine();
        }

        function installStorageListener() {
            if (storageHandler || storageListenerId) return;

            const onTabLockChange = (event) => {
                updateButtonState();
                const lock = event?.newValue ? (()=>{try{return JSON.parse(event.newValue);}catch(e){return null;}})() : readTabLock();
                if (lock?.tabId === TAB_ID) return;

                if (scriptEnabledWatch && isTabVisible()) {
                    if (!lock || isLockStale(lock)) {
                        claimTabLock(document.hasFocus?.() === true || !lock);
                    }
                    if (isThisTabLeader()) {
                        const hasFutureRun = checkNewCardTimeoutId && nextRunAt > Date.now() + RESUME_DELAY_MS;
                        if (!hasFutureRun) scheduleNext(RESUME_DELAY_MS);
                        return;
                    }
                }

                if (!isThisTabLeader()) {
                    stopMainCardCheckLogic();
                }
            };

            storageHandler = (e) => {
                if (e.key === TAB_LOCK_KEY) onTabLockChange(e);
            };
            window.addEventListener('storage', storageHandler);
        }

        function removeStorageListener() {
            if (storageListenerId && typeof GM_removeValueChangeListener === 'function') {
                GM_removeValueChangeListener(storageListenerId);
                storageListenerId = null;
            }
            if (storageHandler) {
                window.removeEventListener('storage', storageHandler);
                storageHandler = null;
            }
        }

        // =========================================================
        // INIT
        // =========================================================
        async function init() {
            if (!currentUser) {
                log('Пользователь не найден, скрипт остановлен.');
                saveDiagnosticLog('module_init_stopped', { reason: 'current_user_not_found' });
                return;
            }

            scriptEnabledWatch = await GM_getValue(STORAGE_KEY_WATCH, true);
            pauseOnLimitEnabled = await GM_getValue(PAUSE_ON_LIMIT_ENABLED_KEY, true);

            if (await GM_getValue(MAX_FAILED_ATTEMPTS_KEY, null) === null) {
                await GM_setValue(MAX_FAILED_ATTEMPTS_KEY, 2);
            }
            if (await GM_getValue(PAUSE_ON_LIMIT_ENABLED_KEY, null) === null) {
                await GM_setValue(PAUSE_ON_LIMIT_ENABLED_KEY, true);
            }

            await ensureDailyProgressState();
            await ensureAnimeDbInitialized();
            await syncFinishedArchiveWithDb();

            createPanel();
            installFetchInterceptor();
            installSiteNotificationInterceptor();
            installStorageListener();
            startTabLockHeartbeat();
            startPanelTicker();

            document.addEventListener('visibilitychange', handleTabActivityChange);
            window.addEventListener('focus', handleTabFocus);
            document.addEventListener('pointerdown', handleTabFocus, true);
            window.addEventListener('beforeunload', handleBeforeUnload);
            window.addEventListener('pagehide', handleBeforeUnload);

            claimTabLock(document.hasFocus?.() === true);
            await updateCardCounter(false);
            saveDiagnosticLog('module_initialized', {
                scriptEnabledWatch,
                pauseOnLimitEnabled,
                tabLock: readTabLock(),
                smartProgression: await GM_getValue(SMART_PROGRESSION_KEY, null),
                dailyProgress: await GM_getValue(DAILY_PROGRESS_KEY, null)
            });

            if (isTabVisible() && scriptEnabledWatch && isThisTabLeader()) {
                // Восстанавливаем таймер из прошлого запроса — не сбрасываем при перезагрузке
                const restored = await restoreTimerFromStorage();
                if (!restored) {
                    scheduleNext(START_DELAY_MS);
                }
            } else {
                stopMainCardCheckLogic();
            }

            log('Инициализация завершена.');
        }

        window.__suiteAutoLootCardsCleanup = async () => {
            saveDiagnosticLog('module_cleanup_requested', {
                smartProgression: await GM_getValue(SMART_PROGRESSION_KEY, null)
            });
            try {
                scriptEnabledWatch = false;
                await GM_setValue(STORAGE_KEY_WATCH, false);
            } catch (e) {}

            try { removeTabLockIfMine(); } catch (e) {}
            try { stopMainCardCheckLogic(); } catch (e) {}
            try { stopTabLockHeartbeat(); } catch (e) {}
            try { stopPanelTicker(); } catch (e) {}
            try { removeStorageListener(); } catch (e) {}
            try { document.removeEventListener('visibilitychange', handleTabActivityChange); } catch (e) {}
            try { window.removeEventListener('focus', handleTabFocus); } catch (e) {}
            try { document.removeEventListener('pointerdown', handleTabFocus, true); } catch (e) {}
            try { window.removeEventListener('beforeunload', handleBeforeUnload); } catch (e) {}
            try { window.removeEventListener('pagehide', handleBeforeUnload); } catch (e) {}
            try {
                if(window.fetch?.__awVisibleTabHook && window.fetch.__awVisibleTabOriginal){
                    window.fetch = window.fetch.__awVisibleTabOriginal;
                }
                window.__awVisibleTabFetchInstalled = false;
            } catch (e) {}
            try {
                const target = unsafeWindow?.DLEPush || window.DLEPush;
                if(target && typeof target === 'object'){
                    ['info', 'success', 'error', 'warning', 'warn'].forEach(type => {
                        if(target[type]?.__awVisibleTabOriginal) target[type] = target[type].__awVisibleTabOriginal;
                    });
                }
                window.__awVisibleTabDleObserver?.disconnect();
                window.__awVisibleTabDleObserver = null;
                window.__awVisibleTabDleInstalled = false;
            } catch (e) {}
            try { document.getElementById('aw-active-tab-panel')?.remove(); } catch (e) {}
            try { document.getElementById(ANIME_DB_MODAL_ID)?.remove(); } catch (e) {}
            try { document.getElementById(MANUAL_MAX_EP_MODAL_ID)?.remove(); } catch (e) {}
            try { document.getElementById(STATS_MODAL_ID)?.remove(); } catch (e) {}

            window.__suiteAutoLootCardsInstalled = false;
        };

        init();
    })();
  }

  function initLabyrinthQuiz(){
    if(!cfg.modLabyrinthQuiz){ cleanupLabyrinthQuiz(); return; }
    if(!/\/labyrinth(?:\/|$)/.test(location.pathname)){ cleanupLabyrinthQuiz(); return; }
    if(window.__suiteLabyrinthQuizInstalled) return;
    window.__suiteLabyrinthQuizInstalled=true;

    (function () {
      'use strict';

      // ═══════════════════════════════════════════════════════════════
      //  НАСТРОЙКИ — заполни токен бота и ID чата
      // ═══════════════════════════════════════════════════════════════
      const GITHUB_USER  = 'Grizordin';
      const GITHUB_REPO  = 'victorina';
      const META_FILE    = 'meta.json';
      const DB_FILE      = 'quiz_db.json';

      const RAW_BASE     = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main`;
      const META_URL     = `${RAW_BASE}/${META_FILE}`;
      const DB_URL       = `${RAW_BASE}/${DB_FILE}`;

      // Порог нечёткого совпадения (0.0–1.0): 0.9 = почти точно, 0.6 = похожее
      const FUZZY_THRESHOLD       = 0.6;
      const EXACT_THRESHOLD       = 0.9;
      const QUIZ_DEBUG            = false;

      function quizLog(...args) {
        if (QUIZ_DEBUG) console.log(...args);
      }

      // ═══════════════════════════════════════════════════════════════
      //  CSS
      // ═══════════════════════════════════════════════════════════════
      const style = document.createElement('style');
      style.id = 'suite-labyrinth-quiz-style';
      style.textContent = `
        @keyframes pulse-green {
          0%, 100% { box-shadow: 0 0 8px 2px rgba(45,190,119,0.5), 0 0 0 0px rgba(45,190,119,0.3); }
          50%       { box-shadow: 0 0 18px 6px rgba(45,190,119,0.25), 0 0 30px 10px rgba(45,190,119,0.1); }
        }
        @keyframes pulse-yellow {
          0%, 100% { box-shadow: 0 0 8px 2px rgba(255,210,50,0.5), 0 0 0 0px rgba(255,210,50,0.3); }
          50%       { box-shadow: 0 0 18px 6px rgba(255,210,50,0.25), 0 0 30px 10px rgba(255,210,50,0.1); }
        }

        /* Точный ответ — зелёный */
        .labyrinth__quiz-btn--correct {
          background:  #1a6e42 !important;
          color:       #7effc0 !important;
          border:      2px solid #2dbe77 !important;
          animation:   pulse-green 1.6s ease-in-out infinite;
          position:    relative;
        }
        .labyrinth__quiz-btn--correct::after {
          content: '✓';
          position: absolute; right: 16px; top: 50%;
          transform: translateY(-50%);
          font-size: 16px; color: #7effc0;
        }

        /* Неточный ответ — жёлтый */
        .labyrinth__quiz-btn--fuzzy {
          background:  #3d3010 !important;
          color:       #ffe87a !important;
          border:      2px solid #d4a017 !important;
          animation:   pulse-yellow 1.6s ease-in-out infinite;
          position:    relative;
        }
        .labyrinth__quiz-btn--fuzzy::after {
          content: '~';
          position: absolute; right: 16px; top: 50%;
          transform: translateY(-50%);
          font-size: 20px; color: #ffe87a;
        }
      `;
      document.head.appendChild(style);

      // ═══════════════════════════════════════════════════════════════
      //  ЛОКАЛЬНОЕ ХРАНИЛИЩЕ
      // ═══════════════════════════════════════════════════════════════
      function getLocalDB() {
        try {
          return JSON.parse(GM_getValue('quiz_db', 'null')) || { count: 0, questions: [] };
        } catch(e) {
          return { count: 0, questions: [] };
        }
      }
      function setLocalDB(db)   { GM_setValue('quiz_db', JSON.stringify(db)); }
      function getLastCheck()   { return GM_getValue('last_db_check', 0); }
      function setLastCheck()   { GM_setValue('last_db_check', Date.now()); }
      function getLocalMeta()   { return GM_getValue('local_meta_count', -1); }
      function setLocalMeta(n)  { GM_setValue('local_meta_count', n); }

      // ═══════════════════════════════════════════════════════════════
      //  НЕЧЁТКОЕ СРАВНЕНИЕ (расстояние Левенштейна)
      // ═══════════════════════════════════════════════════════════════
      function normalize(str) {
        return String(str).trim().toLowerCase().replace(/\s+/g, ' ');
      }

      // ═══════════════════════════════════════════════════════════════
      //  ИГРОВЫЕ ПРЕФИКСЫ — фразы, которые появляются перед вопросом
      //  и не являются его частью. Просто добавь новую строку в массив.
      // ═══════════════════════════════════════════════════════════════
      const QUESTION_PREFIXES = [
        'Лабиринт повторил чужую судьбу.',
        'Ты отказался от отголоска и выбрал свой путь.',
        // 'Лабиринт открыл новые пути.',   // ← пример как добавить новую фразу
      ];
      const QUESTION_SUFFIX_PATTERNS = [
        /\s*\u0420\u0435\u0437\u043e\u043d\u0430\u043d\u0441\s+\u043f\u0440\u0438\u0448[\u0435\u0451]\u043b\s+\u0438\u0437:\s*.*$/i,
      ];

      // Убирает игровые префиксы и хвосты из текста вопроса перед поиском в базе.
      // Сравнение нечёткое (без учёта регистра и лишних пробелов).
      function cleanQuestionText(text) {
        text = text.trim();
        for (const pattern of QUESTION_SUFFIX_PATTERNS) {
          text = text.replace(pattern, '').trim();
        }
        const normText = normalize(text);
        for (const prefix of QUESTION_PREFIXES) {
          const normPrefix = normalize(prefix);
          if (normText.startsWith(normPrefix)) {
            return text.slice(prefix.length).trim();
          }
        }
        return text;
      }

      function similarity(a, b) {
        a = normalize(a); b = normalize(b);
        if (a === b) return 1;
        if (!a.length || !b.length) return 0;
        const m = a.length, n = b.length;
        const dp = [];
        for (let i = 0; i <= m; i++) {
          dp[i] = [i];
          for (let j = 1; j <= n; j++) {
            dp[i][j] = i === 0 ? j
              : a[i-1] === b[j-1] ? dp[i-1][j-1]
              : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
          }
        }
        return 1 - dp[m][n] / Math.max(m, n);
      }

      function findQuestion(text, db) {
        let best = null, bestScore = 0;
        const normText = normalize(text);
        const textLen  = normText.length;

        for (const q of db.questions) {
          const normQ = normalize(q.question);
          // Быстрая предфильтрация по длине: если длины отличаются более чем вдвое — пропускаем
          const ratio = normQ.length / textLen;
          if (ratio < 0.5 || ratio > 2) continue;

          const score = similarity(normText, normQ);
          if (score > bestScore) { bestScore = score; best = q; }
        }
        if (!best || bestScore < FUZZY_THRESHOLD) return null;
        return { match: best, score: bestScore };
      }

      // Найти кнопку с лучшим совпадением ответа
      function findAnswerButton(answerText, buttons) {
        let best = null, bestScore = 0;
        buttons.forEach(btn => {
          const score = similarity(btn.textContent.trim(), answerText);
          if (score > bestScore) { bestScore = score; best = btn; }
        });
        if (!best || bestScore < FUZZY_THRESHOLD) return null;
        return { btn: best, score: bestScore };
      }

      // ═══════════════════════════════════════════════════════════════
      //  GITHUB FETCH
      // ═══════════════════════════════════════════════════════════════
      function gmFetch(url) {
        return new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            method: 'GET',
            url: url + '?_=' + Date.now(),
            onload: res => {
              if (res.status === 200) {
                try { resolve(JSON.parse(res.responseText)); }
                catch(e) { reject(new Error('JSON parse error')); }
              } else {
                reject(new Error(`HTTP ${res.status}`));
              }
            },
            onerror: err => reject(new Error(String(err)))
          });
        });
      }

      // ═══════════════════════════════════════════════════════════════
      //  TELEGRAM
      // ═══════════════════════════════════════════════════════════════
      function sendTelegram(text) {
          return suiteReportEvent('quiz_question', { quizType: 'TEXT', text });
      }

      function sendQuizReport(quizType, questionText, options, possibleAnswer) {
        suiteReportEvent('quiz_question', {
          quizType,
          question: questionText,
          options,
          possibleAnswer: possibleAnswer || ''
        }).then(ok => quizLog(`[QuizHL] report ${quizType}:`, ok));
      }

      function buildTgMessage(type, questionText, options, possibleAnswer) {
        const label = type === 'NEW'
          ? '🆕 <b>НОВЫЙ</b>'
          : '⚠️ <b>НЕ ТОЧНЫЙ</b>';
        const opts = options.map((o, i) => `  ${i + 1}. ${o}`).join('\n');
        let msg = `${label}\n\n<b>Вопрос:</b>\n${questionText}\n\n<b>Варианты:</b>\n${opts}`;
        if (type === 'FUZZY' && possibleAnswer) {
          msg += `\n\n<i>Возможный ответ из базы:</i> ${possibleAnswer}`;
        }
        return msg;
      }

      // ═══════════════════════════════════════════════════════════════
      //  СИНХРОНИЗАЦИЯ БАЗЫ
      // ═══════════════════════════════════════════════════════════════
      async function downloadDB() {
        const db = await gmFetch(DB_URL);
        setLocalDB(db);
        setLocalMeta(db.count);
        setLastCheck();
        quizLog(`[QuizHL] База загружена: ${db.questions.length} вопросов`);
      }

      async function checkSync() {
        const localDB   = getLocalDB();
        const localMeta = getLocalMeta();
        const ONE_DAY   = 24 * 60 * 60 * 1000;

        // Первый запуск — базы нет
        if (!localDB.questions.length) {
          quizLog('[QuizHL] Первый запуск — загружаю базу...');
          await downloadDB();
          return;
        }

        // Каждый заход — проверяем лёгкий meta.json
        try {
          const meta = await gmFetch(META_URL);
          if (meta.count !== localMeta) {
            quizLog(`[QuizHL] Обновление: remote=${meta.count}, local=${localMeta}`);
            await downloadDB();
            return;
          }
        } catch(e) {
          console.warn('[QuizHL] Не удалось получить meta.json:', e);
        }

        // Раз в сутки — принудительная полная проверка
        if (Date.now() - getLastCheck() > ONE_DAY) {
          quizLog('[QuizHL] Суточная проверка базы...');
          await downloadDB();
        }
      }

      // ═══════════════════════════════════════════════════════════════
      //  ОБРАБОТКА ВИКТОРИНЫ
      // ═══════════════════════════════════════════════════════════════
      let lastProcessedQuestion = '';
      let resetTimer = null;
      let quizDbReady = false;
      let processTimer = null;
      const quizResultTimers = new Set();
      window.__suiteLabyrinthQuizResultTimers = quizResultTimers;
      window.__suiteLabyrinthQuizRuntimeCleanup = () => {
        clearTimeout(processTimer);
        clearTimeout(resetTimer);
        quizResultTimers.forEach(timer => clearInterval(timer));
        quizResultTimers.clear();
      };

      function quizHash(text) {
        let hash = 2166136261;
        for (const char of String(text || '')) {
          hash ^= char.charCodeAt(0);
          hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
      }

      function observeQuizResult(attempt) {
        const startedAt = Date.now();
        let lastSignature = '';
        const timer = setInterval(() => {
          if(!window.__suiteLabyrinthQuizInstalled || !/\/labyrinth(?:\/|$)/.test(location.pathname)){
            clearInterval(timer);
            quizResultTimers.delete(timer);
            cleanupLabyrinthQuiz();
            return;
          }
          const resultText = document.getElementById('labyrinthEventText')?.textContent?.trim() || '';
          const eventTitle = document.getElementById('labyrinthEventTitle')?.textContent?.trim() || '';
          const accChange = document.getElementById('labyrinthEventAcc')?.textContent?.trim() || '';
          const quizVisible = isQuizVisible(document.getElementById('labyrinthQuiz'));
          const signature = `${eventTitle}|${resultText}|${accChange}|${quizVisible}`;
          if(signature !== lastSignature){
            lastSignature = signature;
            suiteTelemetryLog('quiz', 'quiz_result_observation', { ...attempt, eventTitle, resultText, accChange, quizVisible });
          }

          const isIncorrect = /\u043d\u0435\u043f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u044b\u0439\s+\u043e\u0442\u0432\u0435\u0442/i.test(resultText);
          const isCorrect = !isIncorrect && /(?:^|[.!?]\s*)\u043f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u044b\u0439\s+\u043e\u0442\u0432\u0435\u0442/i.test(resultText);
          const timedOut = Date.now() - startedAt >= 12000;
          if(!isCorrect && !isIncorrect && !timedOut) return;

          clearInterval(timer);
          quizResultTimers.delete(timer);
          const result = isCorrect ? 'correct' : (isIncorrect ? 'incorrect' : 'unknown');
          const details = { ...attempt, result, eventTitle, resultText, accChange };
          suiteTelemetryLog('quiz', 'quiz_result_observed', details, result === 'correct' ? 'debug' : 'error');

          if(result === 'unknown'){
            suiteTelemetryLog('quiz', 'quiz_result_unknown', details, 'error');
          } else if(result === 'incorrect' && attempt.selectedAnswer && attempt.selectedAnswer === attempt.highlightedAnswer){
            suiteTelemetryLog('quiz', 'quiz_expected_answer_rejected', details, 'error');
          } else if(result === 'correct' && attempt.expectedAnswer && attempt.selectedAnswer !== attempt.expectedAnswer){
            suiteTelemetryLog('quiz', 'quiz_answer_mismatch', details, 'error');
          }
        }, 250);
        quizResultTimers.add(timer);
      }

      function isQuizVisible(el) {
        if (!el || !el.isConnected) return false;
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function getQuizRoot() {
        const byId = document.getElementById('labyrinthQuiz');
        if (isQuizVisible(byId)) return byId;

        const btn = [...document.querySelectorAll('.labyrinth__quiz-btn')]
          .find(b => isQuizVisible(b));
        return btn ? (btn.closest('#labyrinthQuiz') || btn.closest('[class*="quiz"]') || btn.parentElement) : null;
      }

      function getQuizQuestionText(quiz) {
        const candidates = [
          document.getElementById('labyrinthEventText'),
          quiz?.querySelector('#labyrinthEventText'),
          quiz?.closest('.labyrinth')?.querySelector('#labyrinthEventText'),
          ...document.querySelectorAll('[id*="labyrinth"][id*="Text"], [class*="labyrinth"][class*="text"], [class*="event"][class*="text"]')
        ].filter(Boolean);

        for (const el of candidates) {
          if (!isQuizVisible(el)) continue;
          const text = el.textContent.trim();
          if (text) return text;
        }
        return '';
      }

      function scheduleProcessQuiz(delay = 80) {
        if(!window.__suiteLabyrinthQuizInstalled || !/\/labyrinth(?:\/|$)/.test(location.pathname)) return;
        clearTimeout(processTimer);
        processTimer = setTimeout(processQuiz, delay);
      }

      function processQuiz() {
        if(!window.__suiteLabyrinthQuizInstalled || !/\/labyrinth(?:\/|$)/.test(location.pathname)){
          cleanupLabyrinthQuiz();
          return;
        }
        if (!quizDbReady) return;

        const quiz = getQuizRoot();
        if (!quiz || !isQuizVisible(quiz)) return;

        const buttons = [...quiz.querySelectorAll('.labyrinth__quiz-btn')].filter(isQuizVisible);
        if (!buttons.length) return;

        const questionText = getQuizQuestionText(quiz);
        if (!questionText) return;

        // Не обрабатывать один вопрос дважды, но сброс происходит через минуту
        if (questionText === lastProcessedQuestion) return;
        lastProcessedQuestion = questionText;

        // Сброс через 60 сек — КД на ход минута, тот же вопрос может появиться снова
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => { lastProcessedQuestion = ''; }, 60_000);

        // Сброс предыдущей подсветки
        buttons.forEach(b => b.classList.remove(
          'labyrinth__quiz-btn--correct',
          'labyrinth__quiz-btn--fuzzy'
        ));

        // Поиск запускаем асинхронно, чтобы не блокировать рендер страницы
        const db      = getLocalDB();
        const options = buttons.map(b => b.textContent.trim());
        // Очищаем текст от возможного игрового префикса перед поиском в базе,
        // но оригинальный текст сохраняем для отправки в Telegram
        const cleanedQuestionText = cleanQuestionText(questionText);
        const attempt = {
          attemptId:`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
          question:questionText,
          normalizedQuestion:cleanedQuestionText,
          questionHash:quizHash(normalize(cleanedQuestionText)),
          options,
          room:document.getElementById('labyrinthRoomTitle')?.textContent?.trim() || '',
          expectedAnswer:'',
          highlightedAnswer:'',
          selectedAnswer:'',
          selectionSource:'user'
        };
        suiteTelemetryLog('quiz', 'quiz_shown', attempt);
        buttons.forEach(button => button.addEventListener('click', () => {
          attempt.selectedAnswer = button.textContent.trim();
          suiteTelemetryLog('quiz', 'answer_selected', attempt);
          observeQuizResult(attempt);
        }, { once:true, capture:true }));

        const runSearch = () => {
          if(!window.__suiteLabyrinthQuizInstalled || !/\/labyrinth(?:\/|$)/.test(location.pathname)) return;
          const found = findQuestion(cleanedQuestionText, db);

          if (found) {
            const isExactQuestion = found.score >= EXACT_THRESHOLD;
            const answerResult    = findAnswerButton(found.match.answer, buttons);
            attempt.expectedAnswer = found.match.answer || '';
            attempt.questionMatchScore = found.score;
            attempt.answerMatchScore = answerResult?.score || 0;

            if (isExactQuestion && answerResult && answerResult.score >= EXACT_THRESHOLD) {
              attempt.highlightedAnswer = answerResult.btn.textContent.trim();
              answerResult.btn.classList.add('labyrinth__quiz-btn--correct');
              suiteTelemetryLog('quiz', 'answer_resolved', { ...attempt, matchType:'exact' });
              quizLog(`[QuizHL] ✅ Точный ответ: "${found.match.answer}"`);
            } else {
              if (answerResult) {
                attempt.highlightedAnswer = answerResult.btn.textContent.trim();
                answerResult.btn.classList.add('labyrinth__quiz-btn--fuzzy');
              }
              suiteTelemetryLog('quiz', 'answer_resolved', { ...attempt, matchType:'fuzzy' });
              quizLog(`[QuizHL] ⚠️ Неточный (вопрос: ${found.score.toFixed(2)}, ответ: ${answerResult ? answerResult.score.toFixed(2) : 'не найден'})`);
              sendQuizReport('FUZZY', questionText, options, found.match.answer);
            }
          } else {
            suiteTelemetryLog('quiz', 'answer_not_found', attempt, 'error');
            quizLog('[QuizHL] 🆕 Новый вопрос:', cleanedQuestionText);
            sendQuizReport('NEW', questionText, options, null);
          }
        };

        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(runSearch, { timeout: 500 });
        } else {
          setTimeout(runSearch, 0);
        }
      }

      // ═══════════════════════════════════════════════════════════════
      //  OBSERVER
      // ═══════════════════════════════════════════════════════════════
      const observer = new MutationObserver(() => scheduleProcessQuiz());
      window.__suiteLabyrinthQuizObserver = observer;
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
        attributeFilter: ['style', 'class', 'hidden']
      });

      // ═══════════════════════════════════════════════════════════════
      //  СТАРТ
      // ═══════════════════════════════════════════════════════════════
      let syncAttempts = 0;
      const startQuizSync = () => {
        syncAttempts += 1;
        checkSync().then(() => {
          if(!window.__suiteLabyrinthQuizInstalled || !/\/labyrinth(?:\/|$)/.test(location.pathname)) return;
          quizDbReady = true;
          suiteTelemetryLog('quiz', 'database_ready', { syncAttempts, questionCount:getLocalDB().questions.length });
          scheduleProcessQuiz(0);
        }).catch(error => {
          suiteTelemetryLog('quiz', 'database_sync_failed', { syncAttempts, error:error?.message || String(error) }, 'error');
          if(window.__suiteLabyrinthQuizInstalled && syncAttempts < 5){
            const delay = Math.min(60000, 3000 * (2 ** (syncAttempts - 1)));
            window.__suiteLabyrinthQuizSyncTimer = setTimeout(startQuizSync, delay);
          }
        });
      };
      startQuizSync();

    })();
  }

  // ============================================================
  //  LABYRINTH CLUB WAR
  // ============================================================

  const CLUB_WAR_RELATIONS_URL =
    'https://raw.githubusercontent.com/Grizordin/animeSSS-help/main/club-war-relations.json';
  const CLUB_WAR_CACHE_MS = 3 * 60 * 1000;

  let clubWarRelations = null;
  let clubWarLoadedAt = 0;
  let clubWarObserver = null;
  let clubWarTimer = null;
  let clubWarClickBound = false;
  const CLUB_WAR_ROUTE_RE = /\/labyrinth(?:\/|$)/;
  const clubWarDebug = {
    version: '2.15',
    enabled: false,
    installed: false,
    path: '',
    rootFound: false,
    loaded: false,
    lastError: '',
    cards: [],
    appliedAt: 0
  };

  function publishClubWarDebug(extra = {}) {
    Object.assign(clubWarDebug, extra, {
      enabled: !!cfg.modLabyrinthClubWar,
      installed: !!window.__suiteClubWarRelationsInstalled,
      path: location.pathname
    });

    try {
      const targetWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
      targetWindow.__suiteClubWarDebug = clubWarDebug;
    } catch(e) {
      window.__suiteClubWarDebug = clubWarDebug;
    }
  }

  function readClubWarIds(data, key) {
    return new Set(
      (Array.isArray(data?.[key]) ? data[key] : [])
        .map(id => String(id || '').trim())
        .filter(Boolean)
    );
  }

  function buildClubWarRelations(data) {
    return {
      ally: readClubWarIds(data, 'allies'),
      neutral: readClubWarIds(data, 'neutral'),
      enemy: readClubWarIds(data, 'enemies')
    };
  }

  function loadClubWarRelations() {
    if (clubWarRelations && Date.now() - clubWarLoadedAt < CLUB_WAR_CACHE_MS) {
      return Promise.resolve(clubWarRelations);
    }

    const url = CLUB_WAR_RELATIONS_URL + '?t=' + Date.now();
    const applyData = data => {
      clubWarRelations = buildClubWarRelations(data);
      clubWarLoadedAt = Date.now();
      publishClubWarDebug({
        loaded: true,
        lastError: '',
        counts: {
          ally: clubWarRelations.ally.size,
          neutral: clubWarRelations.neutral.size,
          enemy: clubWarRelations.enemy.size
        }
      });
      return clubWarRelations;
    };

    return fetch(url, { cache:'no-store' })
      .then(response => {
        if(!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(applyData)
      .catch(fetchError => new Promise(resolve => {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          onload: response => {
            try {
              resolve(applyData(JSON.parse(response.responseText || '{}')));
            } catch(parseError) {
              console.warn('[Suite club war] Failed to parse club list:', parseError);
              publishClubWarDebug({ loaded: false, lastError: 'parse: ' + parseError.message });
              resolve(null);
            }
          },
          onerror: requestError => {
            console.warn('[Suite club war] Failed to load club list:', fetchError, requestError);
            publishClubWarDebug({ loaded: false, lastError: 'load: ' + fetchError.message });
            resolve(null);
          }
        });
      }));
  }

  function getClubWarRelationType(card, relations) {
    const clubId = getClubWarCardId(card);
    if (!clubId) return '';

    for (const type of ['ally', 'neutral', 'enemy']) {
      if (relations?.[type]?.has(clubId)) return type;
    }

    return '';
  }

  function getClubWarCardId(card) {
    const datasetId = String(card?.dataset?.clubId || '').trim();
    if (datasetId) return datasetId;

    const textId = String(card?.textContent || '').match(/\bID\s*(\d+)\b/i);
    return textId ? textId[1] : '';
  }

  function getClubWarCards() {
    const roots = [
      ...document.querySelectorAll('#labyrinthClubWarClubs'),
      ...document.querySelectorAll('.labyrinth__club-war-clubs')
    ];

    const cards = roots.flatMap(root => [
      ...root.querySelectorAll('.labyrinth__club-war-club')
    ]);

    if (cards.length) return [...new Set(cards)];
    return [...document.querySelectorAll('.labyrinth__club-war-club')];
  }

  function showClubWarClickNotice(key, icon, title, text, theme) {
    cptShow(
      'club-war:' + key,
      icon,
      title,
      text,
      CPT_CLS[theme] || CPT_CLS['neon-blue']
    );
  }

  function getClubWarCardRelation(card) {
    if(card.classList.contains('suite-club-war-ally')) return 'ally';
    if(card.classList.contains('suite-club-war-neutral')) return 'neutral';
    if(card.classList.contains('suite-club-war-enemy')) return 'enemy';
    return card.dataset.suiteClubWarRelation || '';
  }

  function hasVisibleClubWarEnemy() {
    return getClubWarCards().some(card => (
      card.isConnected && getClubWarCardRelation(card) === 'enemy'
    ));
  }

  function handleClubWarClubClick(event) {
    if(!cfg.modLabyrinthClubWar || !CLUB_WAR_ROUTE_RE.test(location.pathname)) return;
    const card = event.target?.closest?.('.labyrinth__club-war-club');
    if(!card) return;

    const relation = getClubWarCardRelation(card);
    if(relation === 'ally') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      showClubWarClickNotice(
        'ally',
        'warn',
        'Союзный клуб',
        'Это союзный клуб, его нельзя атаковать.',
        'neon-green'
      );
      return;
    }

    if(relation === 'neutral') {
      showClubWarClickNotice(
        'neutral',
        'warn',
        'Нейтралитет',
        'С этим клубом нейтралитет, атаковать нежелательно.',
        'neon-amber'
      );
      return;
    }

    if(relation === 'enemy') {
      showClubWarClickNotice(
        'enemy',
        'bolt',
        'Вражеский клуб',
        'Это вражеский клуб. БЕЕЕЕЙ!',
        'rose'
      );
      return;
    }

    if(hasVisibleClubWarEnemy()) {
      showClubWarClickNotice(
        'unknown-with-enemy',
        'warn',
        'Есть враг',
        'В списке есть вражеский клуб, бей его.',
        'neon-amber'
      );
    }
  }

  function bindClubWarClickGuard() {
    if(clubWarClickBound) return;
    clubWarClickBound = true;
    document.addEventListener('click', handleClubWarClubClick, true);
  }

  function unbindClubWarClickGuard() {
    if(!clubWarClickBound) return;
    clubWarClickBound = false;
    document.removeEventListener('click', handleClubWarClubClick, true);
  }

  function injectClubWarStyles() {
    if (document.getElementById('suite-club-war-style')) return;

    const style = document.createElement('style');
    style.id = 'suite-club-war-style';
    style.textContent = `
      .labyrinth__club-war-club.suite-club-war-ally {
        position:relative !important;
        border-color:#22c55e !important;
        background:linear-gradient(90deg,rgba(20,83,45,.78),rgba(6,78,59,.48)) !important;
        box-shadow:0 0 0 1px rgba(34,197,94,.28),0 0 18px rgba(34,197,94,.28) !important;
      }
      .labyrinth__club-war-club.suite-club-war-neutral {
        position:relative !important;
        border-color:#eab308 !important;
        background:linear-gradient(90deg,rgba(113,63,18,.78),rgba(120,53,15,.46)) !important;
        box-shadow:0 0 0 1px rgba(234,179,8,.26),0 0 18px rgba(234,179,8,.22) !important;
      }
      .labyrinth__club-war-club.suite-club-war-enemy {
        position:relative !important;
        border-color:#ef4444 !important;
        background:linear-gradient(90deg,rgba(127,29,29,.78),rgba(88,28,28,.48)) !important;
        box-shadow:0 0 0 1px rgba(239,68,68,.28),0 0 18px rgba(239,68,68,.28) !important;
      }
      .labyrinth__club-war-club.suite-club-war-ally.is-active,
      .labyrinth__club-war-club.suite-club-war-neutral.is-active,
      .labyrinth__club-war-club.suite-club-war-enemy.is-active,
      .labyrinth__club-war-club.suite-club-war-ally.active,
      .labyrinth__club-war-club.suite-club-war-neutral.active,
      .labyrinth__club-war-club.suite-club-war-enemy.active,
      .labyrinth__club-war-club.suite-club-war-ally.labyrinth__club-war-club--active,
      .labyrinth__club-war-club.suite-club-war-neutral.labyrinth__club-war-club--active,
      .labyrinth__club-war-club.suite-club-war-enemy.labyrinth__club-war-club--active,
      .labyrinth__club-war-club.suite-club-war-ally[aria-selected="true"],
      .labyrinth__club-war-club.suite-club-war-neutral[aria-selected="true"],
      .labyrinth__club-war-club.suite-club-war-enemy[aria-selected="true"] {
        outline:2px solid #f8fafc !important;
        outline-offset:2px !important;
        box-shadow:
          inset 0 0 0 2px rgba(15,23,42,.78),
          0 0 0 2px rgba(248,250,252,.5),
          0 0 18px rgba(248,250,252,.36) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function cleanupClubWarRelations(){
    clearTimeout(clubWarTimer);
    clubWarTimer = null;

    if(clubWarObserver){
      clubWarObserver.disconnect();
      clubWarObserver = null;
    }

    document.querySelectorAll('.labyrinth__club-war-club').forEach(card=>{
      card.classList.remove(
        'suite-club-war-ally',
        'suite-club-war-neutral',
        'suite-club-war-enemy'
      );
      card.querySelector('.suite-club-war-badge')?.remove();
      delete card.dataset.suiteClubWarRelation;
    });

    unbindClubWarClickGuard();
    window.__suiteClubWarRelationsInstalled = false;
    publishClubWarDebug({ installed: false, rootFound: false, cards: [] });
  }

  function scheduleClubWarApply(delay=120){
    clearTimeout(clubWarTimer);
    clubWarTimer = setTimeout(applyClubWarRelations, delay);
  }

  async function applyClubWarRelations(){
    if(!cfg.modLabyrinthClubWar){
      cleanupClubWarRelations();
      return;
    }

    if(!CLUB_WAR_ROUTE_RE.test(location.pathname)){
      cleanupClubWarRelations();
      return;
    }

    const clubCards = getClubWarCards();
    if(!clubCards.length){
      publishClubWarDebug({ rootFound: false, cards: [] });
      return;
    }

    injectClubWarStyles();
    bindClubWarClickGuard();
    const relations = await loadClubWarRelations();
    if(!relations) return;

    const cards = [];
    clubCards.forEach(card=>{
      card.classList.remove(
        'suite-club-war-ally',
        'suite-club-war-neutral',
        'suite-club-war-enemy'
      );

      const type = getClubWarRelationType(card, relations);
      if(type) card.classList.add('suite-club-war-' + type);
      card.dataset.suiteClubWarRelation = type || '';
      card.querySelector('.suite-club-war-badge')?.remove();
      cards.push({
        id: getClubWarCardId(card),
        type: type || '',
        className: card.className,
        badge: ''
      });
    });

    publishClubWarDebug({
      rootFound: true,
      cards,
      appliedAt: Date.now()
    });
  }

  function initClubWarRelations(){
    if(!cfg.modLabyrinthClubWar){
      cleanupClubWarRelations();
      return;
    }

    if(!CLUB_WAR_ROUTE_RE.test(location.pathname)){
      cleanupClubWarRelations();
      return;
    }

    if(window.__suiteClubWarRelationsInstalled){
      scheduleClubWarApply();
      return;
    }

    window.__suiteClubWarRelationsInstalled = true;
    publishClubWarDebug({ installed: true });
    scheduleClubWarApply(0);

    clubWarObserver = new MutationObserver(()=>scheduleClubWarApply());
    clubWarObserver.observe(document.body,{
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class','style','data-club-id']
    });
  }

  function cleanupLabyrinthQuiz(){
    if(window.__suiteLabyrinthQuizInstalled) suiteTelemetryLog('quiz', 'module_cleanup', { path:location.pathname });
    try{ window.__suiteLabyrinthQuizRuntimeCleanup?.(); }catch(e){}
    window.__suiteLabyrinthQuizRuntimeCleanup = null;
    try{ window.__suiteLabyrinthQuizObserver?.disconnect(); }catch(e){}
    window.__suiteLabyrinthQuizObserver = null;
    try{ clearTimeout(window.__suiteLabyrinthQuizSyncTimer); }catch(e){}
    window.__suiteLabyrinthQuizSyncTimer = null;
    try{ window.__suiteLabyrinthQuizResultTimers?.forEach(timer => clearInterval(timer)); }catch(e){}
    window.__suiteLabyrinthQuizResultTimers = null;
    document.getElementById('suite-labyrinth-quiz-style')?.remove();
    document.querySelectorAll('.labyrinth__quiz-btn--correct,.labyrinth__quiz-btn--fuzzy').forEach(el=>{
      el.classList.remove('labyrinth__quiz-btn--correct','labyrinth__quiz-btn--fuzzy');
    });
    window.__suiteLabyrinthQuizInstalled = false;
  }

  function cleanupLabyrinthFatigue(){
    const state = window.__suiteLabyrinthFatigueState;
    if(state) suiteTelemetryLog('fatigue', 'module_cleanup', { state:state.state, lastSnapshot:state.lastSnapshot });
    if(state){
      try{ clearInterval(state.tickInterval); }catch(e){}
      try{ clearTimeout(state.startTimer); }catch(e){}
      try{ state.box?.remove(); }catch(e){}
    }
    document.getElementById('suite-lab-fatigue-modal')?.remove();
    window.__suiteLabyrinthFatigueState = null;
    window.__suiteLabyrinthFatigueInstalled = false;
  }

  function initLabyrinthFatigue(){
    if(!cfg.modLabyrinthFatigue){
      cleanupLabyrinthFatigue();
      return;
    }
    if(!/\/labyrinth(?:\/|$)/.test(location.pathname)){
      cleanupLabyrinthFatigue();
      return;
    }
    if(window.__suiteLabyrinthFatigueInstalled) return;
    window.__suiteLabyrinthFatigueInstalled = true;

    const STORAGE_KEY = 'suite_labyrinth_move_stats_v1';
    const ROOT_ID = 'suite-lab-fatigue-counter';
    const MODAL_ID = 'suite-lab-fatigue-modal';
    const EVENTS_PER_PAGE = 3;

    const TRIGGER_DEFS = {
      fatigue: {
        historyText: 'Усталость',
        label: 'усталость',
        reason: 'последней усталости',
      },
      trap_back: {
        historyText: 'Ловушка отката',
        label: 'откат',
        reason: 'последнего отката',
        titles: ['Ловушка отката'],
      },
      mimic_chest_back: {
        historyText: 'Мимик с откатом',
        label: 'мимик',
        reason: 'последнего мимика',
        titles: ['Это был мимик!'],
        titleNeedles: ['мимик'],
        textNeedles: ['отбросил назад'],
      },
      shield_block: {
        historyText: 'Щит сработал',
        label: 'откат',
        reason: 'последнего отката',
        titleNeedles: ['щит сработал'],
        textNeedles: ['ловушки отката'],
      },
    };

    const EVENT_LABELS = {
      fatigue: TRIGGER_DEFS.fatigue.historyText,
      trap_back: TRIGGER_DEFS.trap_back.historyText,
      mimic_chest: 'Мимик',
      mimic_chest_back: TRIGGER_DEFS.mimic_chest_back.historyText,
      shield_block: TRIGGER_DEFS.shield_block.historyText,
    };

    const runtime = {
      box:null,
      tickInterval:null,
      startTimer:null,
      ticking:false,
      statsPage:0,
      roomSequence:0,
      lastSnapshot:null,
      state: loadState()
    };
    window.__suiteLabyrinthFatigueState = runtime;
    suiteTelemetryLog('fatigue', 'module_initialized', { savedState:runtime.state });

    function makeEmptyState(){
      return {
        startedAt:new Date().toISOString(),
        sessionMoves:0,
        lastTodaySteps:null,
        movesSinceFatigue:0,
        fatigueCount:0,
        trapsBack:0,
        mimics:0,
        mimicBacks:0,
        eventKeys:{},
        events:[],
        history:[]
      };
    }

    function loadState(){
      const data = gmGet(STORAGE_KEY, null);
      return data && typeof data === 'object' ? data : makeEmptyState();
    }

    function saveState(){
      gmSet(STORAGE_KEY, runtime.state);
    }

    function ensureState(){
      if(!runtime.state || typeof runtime.state !== 'object') runtime.state = makeEmptyState();
      runtime.state.eventKeys ||= {};
      runtime.state.events ||= [];
      runtime.state.history ||= [];
      runtime.state.sessionMoves ??= 0;
      runtime.state.lastTodaySteps ??= null;
      runtime.state.movesSinceFatigue ??= 0;
    }

    function readNumber(selector){
      const el = document.querySelector(selector);
      if(!el) return null;
      const value = parseInt(el.textContent.replace(/[^\d-]/g, ''), 10);
      return Number.isFinite(value) ? value : null;
    }

    function getCurrentCell(){
      return document.querySelector('.labyrinth-cell--current') ||
        document.querySelector('.labyrinth-cell.labyrinth-cell--visited[data-event]:last-of-type');
    }

    function getCoord(){
      const data = (unsafeWindow?.labyrinthData || window.labyrinthData)?.mapData?.current;
      if(data && Number.isFinite(data.x) && Number.isFinite(data.y)) return `${data.x},${data.y}`;

      const cell = getCurrentCell();
      if(cell?.dataset?.x && cell?.dataset?.y) return `${cell.dataset.x},${cell.dataset.y}`;
      return '';
    }

    function getCurrentEvent(){
      const source = unsafeWindow?.labyrinthData || window.labyrinthData;
      return getCurrentCell()?.dataset?.event || source?.lastEvent || '';
    }

    function getCellEvent(){
      return getCurrentCell()?.dataset?.event || '';
    }

    function isRendered(el){
      if(!el) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        el.getClientRects().length > 0;
    }

    function getVisibleText(selector){
      const el = document.querySelector(selector);
      if(!isRendered(el)) return '';
      return el.textContent.trim();
    }

    function getTriggerDiagnostics(){
      const source = unsafeWindow?.labyrinthData || window.labyrinthData;
      return {
        title:getVisibleText('#labyrinthEventTitle'),
        eventText:getVisibleText('#labyrinthEventText'),
        fatigueTitle:getVisibleText('#labyrinthFatigueTitle'),
        fatigueText:getVisibleText('#labyrinthFatigueText'),
        lastEvent:String(source?.lastEvent || ''),
        cellEvent:String(getCellEvent() || ''),
      };
    }

    function buildTrigger(type, source){
      const def = TRIGGER_DEFS[type];
      return { type, label:def.label, reason:def.reason, source };
    }

    function matchesVisibleTrigger(def, title, eventText){
      if(!def.titles && !def.titleNeedles && !def.textNeedles) return false;
      if(def.titles?.includes(title)) return true;

      const lowerTitle = title.toLowerCase();
      const lowerText = eventText.toLowerCase();
      const hasTitle = !def.titleNeedles || def.titleNeedles.some(part => lowerTitle.includes(part));
      const hasText = !def.textNeedles || def.textNeedles.some(part => lowerText.includes(part));
      return Boolean(def.titleNeedles || def.textNeedles) && hasTitle && hasText;
    }

    function isFatigueTrigger(raw){
      const title = raw.fatigueTitle.toLowerCase();
      const text = raw.fatigueText.toLowerCase();
      return title.includes('усталость') && text.includes('общий путь откатывается');
    }

    function getActiveTrigger(raw = getTriggerDiagnostics()){
      if(isFatigueTrigger(raw)) return buildTrigger('fatigue', 'fatigueBlock');

      for(const [type, def] of Object.entries(TRIGGER_DEFS)){
        if(matchesVisibleTrigger(def, raw.title, raw.eventText)) return buildTrigger(type, 'visibleEvent');
      }

      return null;
    }

    function collectSnapshot(){
      const raw = getTriggerDiagnostics();
      return {
        today:readNumber('#labyrinthTodaySteps'),
        max:readNumber('#labyrinthMaxSteps'),
        left:readNumber('#labyrinthRemainingSteps'),
        coord:getCoord(),
        event:getCurrentEvent(),
        ...raw,
        trigger:getActiveTrigger(raw),
      };
    }

    function recordMove(delta, snapshot){
      for(let i = 0; i < delta; i += 1){
        runtime.state.sessionMoves += 1;
        runtime.state.movesSinceFatigue += 1;
      }
      runtime.state.history.unshift({
        type:'move',
        at:Date.now(),
        text:`Ход +${delta}`,
        coord:snapshot.coord,
        event:snapshot.event,
        today:snapshot.today,
      });
      suiteTelemetryLog('fatigue', 'moves_recorded', {
        delta,
        snapshot,
        movesSinceFatigue:runtime.state.movesSinceFatigue,
        sessionMoves:runtime.state.sessionMoves
      });
    }

    function roomLogSnapshot(snapshot){
      if(!snapshot) return null;
      return {
        today:snapshot.today,
        max:snapshot.max,
        left:snapshot.left,
        coord:snapshot.coord,
        event:snapshot.event,
        cellEvent:snapshot.cellEvent,
        lastEvent:snapshot.lastEvent,
        title:snapshot.title,
        eventText:snapshot.eventText,
        fatigueTitle:snapshot.fatigueTitle,
        fatigueText:snapshot.fatigueText,
        trigger:snapshot.trigger,
      };
    }

    function recordRoomVisit(previousSnapshot, snapshot){
      const initial = !previousSnapshot;
      if(initial && snapshot.today === null && !snapshot.coord && !snapshot.event) return;
      const todayChanged = !initial && snapshot.today !== previousSnapshot.today;
      const coordinateChanged = !initial
        && !!snapshot.coord
        && !!previousSnapshot.coord
        && snapshot.coord !== previousSnapshot.coord;
      if(!initial && !todayChanged && !coordinateChanged) return;

      const todayDelta = !initial
        && Number.isFinite(snapshot.today)
        && Number.isFinite(previousSnapshot.today)
        ? snapshot.today - previousSnapshot.today
        : null;
      runtime.roomSequence += 1;
      suiteTelemetryLog('fatigue', 'room_visited', {
        sequence:runtime.roomSequence,
        source:initial ? 'initial' : 'transition',
        todayDelta,
        coordinateChanged,
        unobservedRooms:todayDelta > 1 ? todayDelta - 1 : 0,
        previous:roomLogSnapshot(previousSnapshot),
        current:roomLogSnapshot(snapshot),
      });
    }

    function recordTrigger(snapshot, trigger){
      if(!trigger) return false;

      const key = `${snapshot.today}:${trigger.type}`;
      if(runtime.state.lastTriggerKey === key) return false;

      const movesBeforeReset = runtime.state.movesSinceFatigue || 0;
      runtime.state.lastTriggerKey = key;
      runtime.state.lastTriggerLabel = trigger.reason;
      runtime.state.movesSinceFatigue = 0;

      if(trigger.type === 'trap_back') runtime.state.trapsBack = (runtime.state.trapsBack || 0) + 1;
      if(trigger.type === 'mimic_chest') runtime.state.mimics = (runtime.state.mimics || 0) + 1;
      if(trigger.type === 'mimic_chest_back') runtime.state.mimicBacks = (runtime.state.mimicBacks || 0) + 1;
      if(trigger.type === 'fatigue') runtime.state.fatigueCount = (runtime.state.fatigueCount || 0) + 1;

      runtime.state.events.unshift({
        type:trigger.type,
        label:trigger.label,
        at:Date.now(),
        movesSincePrevious:movesBeforeReset,
        today:snapshot.today,
      });
      runtime.state.history.unshift({
        type:'event',
        at:Date.now(),
        text:trigger.label,
        movesBetween:movesBeforeReset,
        today:snapshot.today,
      });
      suiteTelemetryLog('fatigue', 'trigger_recorded', {
        trigger,
        snapshot,
        movesBeforeReset,
        counters:{
          fatigueCount:runtime.state.fatigueCount,
          trapsBack:runtime.state.trapsBack,
          mimics:runtime.state.mimics,
          mimicBacks:runtime.state.mimicBacks
        }
      });
      return true;
    }

    function trimHistory(){
      if(runtime.state.history.length > 150) runtime.state.history = runtime.state.history.slice(0, 150);
      if(runtime.state.events.length > 100) runtime.state.events = runtime.state.events.slice(0, 100);
    }

    function attachBox(){
      const arena = document.querySelector('.labyrinth__arena');
      if(!arena) return false;
      const arenaStyle = getComputedStyle(arena);
      if(arenaStyle.position === 'static') arena.style.position = 'relative';

      if(!runtime.box){
        const box = document.createElement('div');
        box.id = ROOT_ID;
        box.innerHTML = `
          <div class="suite-lab-fatigue-head">
            <span class="suite-lab-fatigue-icon">💤</span>
            <span>Усталость</span>
          </div>
          <span class="suite-lab-fatigue-value"><span data-lab-fatigue="moves">0</span> <span data-lab-fatigue="moves-word">ходов</span></span>
          <span class="suite-lab-fatigue-sub">с начала отсчёта</span>
          <button class="suite-lab-fatigue-btn" type="button" title="Подробная статистика">≡</button>
        `;
        box.querySelector('.suite-lab-fatigue-btn')?.addEventListener('click', showModal);
        runtime.box = box;
      }

      if(runtime.box.parentElement !== arena) arena.appendChild(runtime.box);
      suitePositionLabyrinthFatigueCounter();
      return true;
    }

    function renderBox(){
      if(!runtime.box) return;
      const movesEl = runtime.box.querySelector('[data-lab-fatigue="moves"]');
      const movesWordEl = runtime.box.querySelector('[data-lab-fatigue="moves-word"]');
      const subEl = runtime.box.querySelector('.suite-lab-fatigue-sub');
      const moves = runtime.state.movesSinceFatigue ?? 0;
      if(movesEl) movesEl.textContent = String(moves);
      if(movesWordEl) movesWordEl.textContent = suiteLabMoveWord(moves);
      if(subEl) subEl.textContent = `с ${runtime.state.lastTriggerLabel || 'начала отсчёта'}`;
      suitePositionLabyrinthFatigueCounter();
    }

    function mountModal(){
      if(document.getElementById(MODAL_ID)) return;

      const modal = document.createElement('div');
      modal.id = MODAL_ID;
      modal.innerHTML = `
        <div class="suite-lab-fatigue-modal-box">
          <div class="suite-lab-fatigue-modal-head">
            <div class="suite-lab-fatigue-modal-title">Усталость и откаты</div>
            <button class="suite-lab-fatigue-close" type="button">×</button>
          </div>
          <div class="suite-lab-fatigue-body">
            <div data-lab-fatigue-modal="history"></div>
            <div class="suite-lab-fatigue-pages">
              <button class="suite-lab-fatigue-page-btn" type="button" data-lab-fatigue-page="prev">‹</button>
              <span class="suite-lab-fatigue-page-state">
                <input class="suite-lab-fatigue-page-input" type="number" min="1" step="1" value="1" data-lab-fatigue-page-input>
                <span>/</span>
                <span data-lab-fatigue-page-total>1</span>
              </span>
              <button class="suite-lab-fatigue-page-btn" type="button" data-lab-fatigue-page="next">›</button>
              <button class="suite-lab-fatigue-reset-btn" type="button" data-lab-fatigue-reset>Сброс</button>
            </div>
          </div>
        </div>
      `;
      modal.addEventListener('click', event => {
        if(event.target === modal || event.target.classList.contains('suite-lab-fatigue-close')) modal.classList.remove('is-open');
      });
      modal.querySelector('[data-lab-fatigue-page="prev"]')?.addEventListener('click', () => {
        if(runtime.statsPage > 0){
          runtime.statsPage -= 1;
          renderModal();
        }
      });
      modal.querySelector('[data-lab-fatigue-page="next"]')?.addEventListener('click', () => {
        const pageCount = Math.max(1, Math.ceil((runtime.state.events || []).length / EVENTS_PER_PAGE));
        if(runtime.statsPage < pageCount - 1){
          runtime.statsPage += 1;
          renderModal();
        }
      });
      const input = modal.querySelector('[data-lab-fatigue-page-input]');
      input?.addEventListener('change', goToEnteredPage);
      input?.addEventListener('keydown', event => {
        if(event.key === 'Enter'){
          event.preventDefault();
          goToEnteredPage();
        }
      });
      modal.querySelector('[data-lab-fatigue-reset]')?.addEventListener('click', resetStats);
      document.body.appendChild(modal);
    }

    function showModal(){
      mountModal();
      renderModal();
      document.getElementById(MODAL_ID)?.classList.add('is-open');
    }

    function goToEnteredPage(){
      const input = document.querySelector(`#${MODAL_ID} [data-lab-fatigue-page-input]`);
      if(!input) return;
      const pageCount = Math.max(1, Math.ceil((runtime.state.events || []).length / EVENTS_PER_PAGE));
      const requested = parseInt(input.value, 10);
      runtime.statsPage = Math.max(0, Math.min(pageCount - 1, Number.isFinite(requested) ? requested - 1 : runtime.statsPage));
      renderModal();
    }

    function renderModal(){
      const modal = document.getElementById(MODAL_ID);
      if(!modal) return;

      const history = modal.querySelector('[data-lab-fatigue-modal="history"]');
      const events = runtime.state.events || [];
      const pageCount = Math.max(1, Math.ceil(events.length / EVENTS_PER_PAGE));
      if(runtime.statsPage > pageCount - 1) runtime.statsPage = pageCount - 1;

      const start = runtime.statsPage * EVENTS_PER_PAGE;
      const pageEvents = events.slice(start, start + EVENTS_PER_PAGE);
      if(history) history.innerHTML = renderEventTimeline(events, pageEvents, start, runtime.statsPage === 0);

      const pageInput = modal.querySelector('[data-lab-fatigue-page-input]');
      const pageTotal = modal.querySelector('[data-lab-fatigue-page-total]');
      const prevBtn = modal.querySelector('[data-lab-fatigue-page="prev"]');
      const nextBtn = modal.querySelector('[data-lab-fatigue-page="next"]');
      if(pageInput){
        pageInput.value = String(runtime.statsPage + 1);
        pageInput.max = String(pageCount);
      }
      if(pageTotal) pageTotal.textContent = String(pageCount);
      if(prevBtn) prevBtn.disabled = runtime.statsPage <= 0;
      if(nextBtn) nextBtn.disabled = runtime.statsPage >= pageCount - 1;
    }

    function renderEventTimeline(allEvents, pageEvents, startIndex, showLiveGap){
      if(!pageEvents.length) return '<div class="suite-lab-fatigue-empty">Событий пока нет</div>';

      const liveGap = showLiveGap
        ? `<div class="suite-lab-fatigue-gap is-live"><span class="suite-lab-fatigue-arrow">↑</span><span>${suiteLabMovesText(runtime.state.movesSinceFatigue ?? 0)}</span></div>`
        : '';
      const topPageGap = !showLiveGap && startIndex > 0 ? renderGap(allEvents[startIndex - 1]?.movesSincePrevious) : '';
      const bottomEvent = pageEvents[pageEvents.length - 1];
      const bottomPageGap = allEvents[startIndex + pageEvents.length] ? renderGap(bottomEvent?.movesSincePrevious) : '';

      return `
        <div class="suite-lab-fatigue-timeline">
          ${liveGap}
          ${topPageGap}
          ${pageEvents.map((event, index) => {
            const at = new Date(event.at);
            const date = at.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' });
            const time = at.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
            const gap = index < pageEvents.length - 1 ? renderGap(event.movesSincePrevious) : '';
            return `
              <div class="suite-lab-fatigue-event">
                <div class="suite-lab-fatigue-event-name">${suiteLabEscapeHtml(event.label)}</div>
                <div class="suite-lab-fatigue-event-time">${date} ${time}</div>
              </div>
              ${gap}
            `;
          }).join('')}
          ${bottomPageGap}
        </div>
      `;
    }

    function renderGap(moves){
      return `<div class="suite-lab-fatigue-gap"><span class="suite-lab-fatigue-arrow">↑</span><span>${suiteLabMovesText(moves ?? 0)}</span></div>`;
    }

    function suiteLabMoveWord(value){
      const num = Math.abs(Number(value) || 0);
      const mod100 = num % 100;
      const mod10 = num % 10;
      if(mod100 >= 11 && mod100 <= 14) return 'ходов';
      if(mod10 === 1) return 'ход';
      if(mod10 >= 2 && mod10 <= 4) return 'хода';
      return 'ходов';
    }

    function suiteLabMovesText(value){
      const moves = Number(value) || 0;
      return `${suiteLabEscapeHtml(moves)} ${suiteLabMoveWord(moves)}`;
    }

    function suiteLabEscapeHtml(value){
      return String(value).replace(/[&<>"']/g, char => ({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#039;',
      }[char]));
    }

    function resetStats(){
      if(!confirm('Сбросить статистику ходов и событий?')) return;
      const previousState = runtime.state;
      runtime.state = makeEmptyState();
      suiteTelemetryLog('fatigue', 'stats_reset', { previousState });
      runtime.statsPage = 0;
      saveState();
      renderBox();
      renderModal();
    }

    function tick(){
      if(runtime.ticking) return;
      runtime.ticking = true;
      try{
        ensureState();
        attachBox();

        const snapshot = collectSnapshot();
        const previousSnapshot = runtime.lastSnapshot;
        recordRoomVisit(previousSnapshot, snapshot);
        if(previousSnapshot && JSON.stringify(snapshot) !== JSON.stringify(previousSnapshot)){
          suiteTelemetryLog('fatigue', 'snapshot_changed', { previous:previousSnapshot, current:snapshot });
        }
        if(snapshot.today !== null){
          if(runtime.state.lastTodaySteps === null){
            runtime.state.lastTodaySteps = snapshot.today;
          } else if(snapshot.today > runtime.state.lastTodaySteps){
            recordMove(snapshot.today - runtime.state.lastTodaySteps, snapshot);
            runtime.state.lastTodaySteps = snapshot.today;
          } else if(snapshot.today < runtime.state.lastTodaySteps){
            runtime.state.lastTodaySteps = snapshot.today;
          }
        }

        if(snapshot.trigger) recordTrigger(snapshot, snapshot.trigger);

        runtime.lastSnapshot = snapshot;
        trimHistory();
        saveState();
        renderBox();
        if(document.querySelector(`#${MODAL_ID}.is-open`)) renderModal();
      } finally {
        runtime.ticking = false;
      }
    }

    runtime.startTimer = setTimeout(tick, 500);
    runtime.tickInterval = setInterval(tick, 1000);
  }

  function suitePositionLabyrinthFatigueCounter(){
    const fatigue = document.getElementById('suite-lab-fatigue-counter');
    if(!fatigue) return;

    const emission = cfg.modLabyrinthEmission ? document.getElementById('suite-emission-timer') : null;
    const hasEmission = !!(emission && emission.isConnected && getComputedStyle(emission).display !== 'none');
    const isMobile = typeof window.matchMedia === 'function' && window.matchMedia('(max-width:760px)').matches;
    if(isMobile){
      const emissionHeight = hasEmission
        ? Math.ceil(emission.getBoundingClientRect().height || emission.offsetHeight || 80)
        : 0;
      fatigue.style.top = hasEmission ? `${12 + emissionHeight + 12}px` : '12px';
      fatigue.style.right = '12px';
      return;
    }

    fatigue.style.top = '12px';
    if(!hasEmission){
      fatigue.style.right = '12px';
      return;
    }

    const emissionWidth = Math.ceil(emission.getBoundingClientRect().width || emission.offsetWidth || 172);
    const fatigueWidth = Math.ceil(fatigue.getBoundingClientRect().width || fatigue.offsetWidth || 210);
    const hostWidth = fatigue.parentElement?.getBoundingClientRect().width || window.innerWidth;
    if(emissionWidth + fatigueWidth + 36 <= hostWidth){
      fatigue.style.top = '12px';
      fatigue.style.right = `${12 + emissionWidth + 12}px`;
    }else{
      const emissionHeight = Math.ceil(emission.getBoundingClientRect().height || emission.offsetHeight || 80);
      fatigue.style.top = `${12 + emissionHeight + 12}px`;
      fatigue.style.right = '12px';
    }
  }

  function cleanupLabyrinthEmission(){
    const state = window.__suiteLabyrinthEmissionState;
    if(state){
      try{ clearInterval(state.attachInterval); }catch(e){}
      try{ clearInterval(state.syncInterval); }catch(e){}
      try{ clearInterval(state.renderInterval); }catch(e){}
      try{ clearTimeout(state.startTimer); }catch(e){}
      try{ state.box?.remove(); }catch(e){}
    }
    window.__suiteLabyrinthEmissionState = null;
    window.__suiteLabyrinthEmissionInstalled = false;
    suitePositionLabyrinthFatigueCounter();
  }

  function initLabyrinthEmission(){
    if(!cfg.modLabyrinthEmission){
      cleanupLabyrinthEmission();
      return;
    }
    if(!/\/labyrinth\//.test(location.pathname)){
      cleanupLabyrinthEmission();
      return;
    }
    if(window.__suiteLabyrinthEmissionInstalled) return;
    window.__suiteLabyrinthEmissionInstalled = true;

    const state = {
      endTime:0,
      active:false,
      lastState:'',
      box:null,
      attachInterval:null,
      syncInterval:null,
      renderInterval:null,
      startTimer:null
    };
    window.__suiteLabyrinthEmissionState = state;

    const box = document.createElement('div');
    box.id = 'suite-emission-timer';
    box.innerHTML = `
      <div class="suite-emission-head">
        <span class="suite-emission-icon">☢</span>
        <span>Выброс</span>
      </div>
      <span class="suite-emission-value">Ожидание...</span>
      <span class="suite-emission-sub">Синхронизация с лабиринтом</span>
    `;
    state.box = box;

    const valueEl = box.querySelector('.suite-emission-value');
    const subEl = box.querySelector('.suite-emission-sub');

    function attachTimer(){
      const arena = document.querySelector('.labyrinth__arena');
      if(!arena) return false;
      const arenaStyle = getComputedStyle(arena);
      if(arenaStyle.position === 'static') arena.style.position = 'relative';
      if(box.parentElement !== arena) arena.appendChild(box);
      suitePositionLabyrinthFatigueCounter();
      return true;
    }

    function formatTime(sec){
      sec = Math.max(0, sec);
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      return (h ? String(h).padStart(2,'0') + ':' : '') + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    }

    function syncEmission(){
      const labyrinthSource = unsafeWindow?.labyrinthData || window.labyrinthData;
      const emission = labyrinthSource?.emission;
      if(!emission) return;

      const emissionState = JSON.stringify({
        active: emission.active,
        cooldown_left: emission.cooldown_left,
        seconds_left: emission.seconds_left,
        active_until: emission.active_until
      });
      if(emissionState === state.lastState) return;

      state.lastState = emissionState;
      state.active = !!emission.active;

      if(state.active){
        state.endTime = Number(emission.active_until || 0) * 1000;
      } else {
        state.endTime = Date.now() + Math.max(0, Number(emission.cooldown_left || emission.seconds_left || 0)) * 1000;
      }
    }

    function render(){
      attachTimer();

      if(!state.endTime){
        box.classList.remove('is-active','is-soon');
        valueEl.textContent = 'Ожидание...';
        subEl.textContent = 'Синхронизация с лабиринтом';
        suitePositionLabyrinthFatigueCounter();
        return;
      }

      const left = Math.floor((state.endTime - Date.now()) / 1000);

      if(left <= 0){
        if(state.active){
          box.classList.remove('is-active');
          box.classList.add('is-soon');
          valueEl.textContent = 'Выброс завершён';
          subEl.textContent = 'Ожидаем следующее окно';
        } else {
          box.classList.remove('is-active');
          box.classList.add('is-soon');
          valueEl.textContent = 'Скоро выброс';
          subEl.textContent = 'Момент почти наступил';
        }
        suitePositionLabyrinthFatigueCounter();
        return;
      }

      if(state.active){
        box.classList.add('is-active');
        box.classList.remove('is-soon');
        valueEl.textContent = formatTime(left);
        subEl.textContent = 'До завершения выброса';
      } else {
        box.classList.remove('is-active');
        box.classList.add('is-soon');
        valueEl.textContent = formatTime(left);
        subEl.textContent = 'До следующего выброса';
      }
      suitePositionLabyrinthFatigueCounter();
    }

    state.startTimer = setTimeout(() => {
      attachTimer();
      syncEmission();
      render();
    }, 700);
    state.attachInterval = setInterval(attachTimer, 500);
    state.syncInterval = setInterval(syncEmission, 1000);
    state.renderInterval = setInterval(render, 500);
  }


})();
