// ==UserScript==
// @name         AnimeSSS — Лучшая карта: превью настроек
// @namespace    animesss.best-card-preview
// @version      0.1.0
// @description  Отдельное окно настроек для обсуждения и отладки. Не выбирает карты и не управляет автооткрытием.
// @match        https://animesss.tv/cards/pack*
// @match        https://animesss.com/cards/pack*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  if (document.getElementById('abcp-modal-host') || document.getElementById('cv-best-settings-btn')) return;
  const KEY = 'abcp_settings_v1';
  const defaults = {
    custom: false, rank: 'a', wanted: 'normal', unowned: 'low',
    duplicates: 'normal', demandA: true, demandGap: 40, weak: true, weakThreshold: 10,
    tie: 'manual', protectRare: true, explain: true
  };
  const groups = [
    ['Основа выбора', [
      ['rank', 'Приоритет ранга', [['a','Приоритет A'],['ab','Приоритет A, B'],['highest','Приоритет старшего ранга']], 'Во всех режимах S, ASS, «+» и Gold важнее обычных карт. A — сначала A. A, B — сначала A, затем B. Старший ранг — самый высокий ранг. Среди оставшихся сравнивается ценность.']
    ]],
    ['Личные предпочтения', [
      ['wanted', 'Желаемое', [['normal','Обычный бонус (+15)'],['strong','Усиленный бонус (+30)'],['off','Не в приоритете (+0)']], 'Добавляет желаемой карте +15 или +30 баллов к ценности для выбора. «Не в приоритете» — без бонуса (+0).'],
      ['unowned', 'Нет в наличии', [['low','На низкой ценности'],['always','Всегда'],['never','Никогда']], 'Предпочитать карты, которых у вас нет: только при низкой ценности, всегда или никогда. Граница низкой ценности задаётся ниже, в «Пороге слабого пака».'],
      ['duplicates', 'Штраф за дубли', [['normal','Стандартный штраф'],['off','Без штрафа']], 'Стандартный штраф снижает ценность карты за дубли на руках. «Без штрафа» — дубли не снижают ценность. Отдельные правила выбора без дублей сохраняются.']
    ]],
    ['Дополнительные правила', [
      ['demandA', 'Учитывать спрос среди A', 'check', 'Среди карт A можно выбрать менее ценную, если её хочет заметно больше людей. Нужная разница задаётся рядом.'],
      ['demandGap', 'Преимущество по желающим', {max:10000}, 'На сколько больше людей должны хотеть карту A. Например, 40 — это 140 желающих против 100.'],
      ['weak', 'Без дублей в слабом паке', 'check', 'Если все карты ниже заданного порога, выбрать лучшую из карт с 0 дублей. Если таких нет — выбрать как обычно.'],
      ['weakThreshold', 'Порог слабого пака', {max:100}, 'Ниже какой ценности пак считается слабым. Например, при 10 значение 9 считается слабым, а 10 — нет. Этот порог также используется для «Нет в наличии».']
    ]],
    ['При равенстве', [
      ['tie', 'Если оценки одинаковые', [['manual','Оставить ручной выбор'],['dups','Меньше дублей'],['want','Больше желающих'],['owners','Меньше владельцев'],['random','Случайная карта']], 'Что делать, если лучшие карты одинаковы по ценности. «Случайная карта» выбирает одну из них наугад. Если другой критерий не помог — выбор остаётся ручным.'],
      ['explain', 'Показывать причину выбора', 'check', 'Показывать короткое объяснение, почему эта карта выбрана лучшей.']
    ]]
  ];
  const fields = groups.flatMap(g => g[1]);
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};
    // Migrate obsolete preview choices; never retain removed custom weights or a disabled safety flag.
    raw = {...raw, wanted: raw.wanted === 'first' ? 'off' : raw.wanted, unowned: ({off:'never', close:'low', first:'always'})[raw.unowned] || raw.unowned};
    const out = {...defaults};
    if (typeof raw.custom === 'boolean') out.custom = raw.custom;
    for (const [key,, type] of fields) {
      if (Array.isArray(type)) { if (type.some(([v]) => v === raw[key])) out[key] = raw[key]; }
      else if (type === 'check') { if (typeof raw[key] === 'boolean') out[key] = raw[key]; }
      else if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) out[key] = Math.round(Math.max(0, Math.min(type.max, raw[key])));
    }
    return out;
  }
  let storageError = false, saved;
  try { saved = normalize(GM_getValue(KEY, defaults)); }
  catch { saved = {...defaults}; storageError = true; }
  const host = document.createElement('div');
  host.id = 'abcp-modal-host';
  const root = host.attachShadow({mode:'open'});
  document.body.append(host);
  root.innerHTML = `<style>
    :host{all:initial;color-scheme:dark;font:14px/1.45 "Segoe UI",Arial,sans-serif;color:#ebe6e9}
    *{box-sizing:border-box} [hidden]{display:none!important}
    button,input,select{font:inherit} button{cursor:pointer}
    button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #f192b1;outline-offset:3px}
    dialog{color:#ebe6e9;background:#1b191c;border:1px solid #45353d;border-radius:18px;padding:0;width:min(760px,calc(100vw - 24px));max-width:none;max-height:calc(100dvh - 32px);box-shadow:0 28px 90px #0009;overflow:hidden}
    dialog::backdrop{background:#08070ac7}
    form{display:flex;flex-direction:column;max-height:calc(100dvh - 34px);margin:0}
    header{display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid #393036;gap:12px}
    h2{font-size:21px;margin:0;letter-spacing:-.3px} .eyebrow{font-size:10px;letter-spacing:1.6px;color:#cd93a8;text-transform:uppercase;margin-bottom:4px}
    .close{border:1px solid #46373e;border-radius:50%;width:32px;height:32px;color:#bcb2b8;background:#272127;font-size:22px;padding:0;line-height:1;flex-shrink:0}
    .body{overflow:auto;padding:20px 24px;scrollbar-width:thin}
    .notice{font-size:12px;color:#c8b8c1;background:#292027;border:1px solid #4b303e;border-radius:9px;padding:11px 13px;margin:0 0 18px}
    .notice b{color:#edacc4}
    .mode{display:grid;grid-template-columns:minmax(0,1fr) 50px minmax(0,1fr);align-items:center;gap:21px;padding:12px 0 20px;position:relative}
    #default-label{text-align:right} #custom-label{text-align:left} .mode>.help{position:absolute;right:0;top:-6px}
    .mode-text{color:#9e949b;font-size:13px}.mode-text.active{color:#f4d4e0;font-weight:700}
    .toggle{position:relative;display:inline-flex;align-items:center;justify-content:center;width:50px;height:26px;flex:0 0 50px;vertical-align:middle;line-height:0}
    .toggle input{position:absolute;opacity:0;width:0;height:0;min-width:0;min-height:0;margin:0;padding:0;border:0}
    .slider{position:relative;display:grid;flex:0 0 50px;align-items:center;width:50px;height:26px;padding:2px;cursor:pointer;border-radius:999px;background:linear-gradient(145deg,#121821,#05080d);border:1px solid #94a3b82e;box-shadow:inset 4px 4px 8px #000b,inset -3px -3px 7px #94a3b814,0 0 8px #0008;transition:box-shadow .22s,border-color .22s}
    .slider:before{content:'';position:relative;box-sizing:border-box;grid-area:1/1;align-self:center;justify-self:start;width:20px;height:20px;left:0;top:0;transform:translateX(0);border-radius:50%;background:linear-gradient(145deg,#303743,#171c25);border:1px solid #e2e8f057;box-shadow:0 0 8px #000b,inset 2px 2px 4px #ffffff14,inset -3px -3px 5px #0007;transition:transform .24s cubic-bezier(.2,.8,.2,1);z-index:2}
    .slider:after{content:'';position:absolute;box-sizing:border-box;width:7px;height:7px;left:-9px;top:2px;border-radius:50%;background:#ef4444;box-shadow:0 0 9px #ef4444d9}
    .toggle input:checked+.slider{border-color:#5eead4f2;background:linear-gradient(145deg,#101720,#05080d);box-shadow:inset 4px 4px 8px #000b,inset -3px -3px 7px #5eead41a,0 0 0 1px #4ade80b8,0 0 16px #4ade808c,0 0 22px #2dd4bf6b}
    .toggle input:checked+.slider:before{transform:translateX(24px);border-color:#e2e8f094;box-shadow:0 0 8px #000c,0 0 10px #2dd4bf42,inset 2px 2px 4px #ffffff1a,inset -3px -3px 5px #0008}
    .toggle input:checked+.slider:after{background:#4ade80;box-shadow:0 0 10px #4ade80e6,0 0 16px #2dd4bf8c}
    .toggle input:focus-visible+.slider{outline:2px solid #7dd3fc;outline-offset:3px}
    section+section{margin-top:20px} h3{color:#d89ab1;font-size:11px;letter-spacing:1px;text-transform:uppercase;margin:0 0 12px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 18px}
    section:first-child .grid>.field:only-child{grid-column:1/-1}
    .field{min-width:0}.label{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:13px}.help{display:inline-grid;place-items:center;flex-shrink:0;border:1px solid #64515b;background:transparent;color:#c9a4b4;border-radius:50%;width:19px;height:19px;padding:0;font-size:11px;line-height:1}
    select,input[type=number]{width:100%;min-width:0;height:38px;border:1px solid #453a40;background:#121113;border-radius:8px;color:#e2dce0;padding:7px 10px;font-size:12px}
    input:disabled{opacity:.42} .field.disabled .label{color:#82777e}
    .check-line{display:flex;align-items:center;gap:9px;min-height:38px;padding:8px 10px;background:#211e21;border:1px solid #3c3238;border-radius:8px}
    .check-line label{flex:1;font-size:12px;cursor:pointer}.check-line input{width:16px;height:16px;margin:0;accent-color:#ac3d65;flex-shrink:0}
    .rule{padding:13px 14px;border:1px solid #3a3036;border-radius:9px;background:#211d21}.rule strong{font-size:13px;color:#e1ccd7;display:block;margin-bottom:5px}.rule p{font-size:12px;color:#aba0a7;margin:0;line-height:1.65}
    .footnote{color:#aca0a8;font-size:12px;margin:16px 0 0;line-height:1.6}
    footer{display:flex;gap:9px;align-items:center;flex-wrap:wrap;padding:15px 24px;border-top:1px solid #3b3037;background:#19161a}
    footer button{border:1px solid #4a3b43;border-radius:8px;padding:9px 14px;background:#282127;color:#d9ced5;font-size:12px} footer .primary{background:#95284d;border-color:#be4b73;color:#ffe6ef;font-weight:600} footer .reset{margin-right:auto;background:transparent;color:#bda5b1}
    .feedback{flex-basis:100%;margin:0;font-size:12px;color:#dfb4c6}.feedback:empty{display:none}
    #tooltip{position:fixed;z-index:5;max-width:min(340px,calc(100vw - 40px));padding:12px 14px;background:#30242c;color:#f2e5ec;border:1px solid #975069;border-radius:9px;box-shadow:0 10px 30px #0009;font-size:12px;line-height:1.6;pointer-events:none}
    @media(max-width:540px){header{padding:15px 16px}.body{padding:16px}.grid{grid-template-columns:1fr;gap:13px}.mode{gap:17px}footer{padding:13px 16px;gap:7px}footer button{padding:9px 10px}.mode-text{font-size:12px}h2{font-size:19px}}
    @media(max-width:360px){.mode{gap:10px}.mode-text{font-size:10px}.eyebrow{font-size:9px}footer .reset{flex-basis:100%}footer .cancel{margin-left:auto}}
    @media(prefers-reduced-motion:reduce){*,*:before{transition:none!important}}
  </style>
  <dialog aria-labelledby="heading"><form>
    <header><div><div class="eyebrow">Настройки выбора · предпросмотр</div><h2 id="heading">Лучшая карта</h2></div><button class="close" type="button" aria-label="Закрыть без сохранения">×</button></header>
    <div class="body">
      <p class="notice"><b>Тестовый интерфейс.</b> Настройки сохраняются только в этом скрипте. Выбор карт, статистика и автооткрытие помощника не меняются.</p>
      <div class="mode"><span class="mode-text" id="default-label">По умолчанию</span><label class="toggle"><input id="custom" type="checkbox" role="switch" aria-label="Пользовательский режим"><span class="slider"></span></label><span class="mode-text" id="custom-label">Пользовательский</span><button type="button" class="help" data-help="По умолчанию — описание обычного выбора. Пользовательский — ваши настройки. Переключение не стирает значения. Чтобы запомнить изменения, нажмите «Сохранить»." aria-label="Подсказка о режиме">?</button></div>
      <div id="default-view"><section><h3>Как выбирается карта сейчас</h3><div class="grid">
        <div class="rule"><strong>01 · Ценность карты</strong><p>Учитываются ранг, редкость по числу владельцев, спрос относительно обменов, ваш список желаемого и дубли. Для очень низких оценок есть отдельный расчёт.</p></div>
        <div class="rule"><strong>02 · Приоритет A</strong><p>Если нет карт выше A и особых рангов с плюсом, обычная A имеет приоритет. Среди A меньшая оценка может выиграть при преимуществе по желающим от 40.</p></div>
        <div class="rule"><strong>03 · Слабый пак</strong><p>В обычном сравнении при максимальной ценности ниже 10 предпочтение отдаётся картам с 0 дублей. Среди них выбирается самая ценная.</p></div>
        <div class="rule"><strong>04 · Равные оценки</strong><p>Подсвечиваются все лучшие. Автооткрытие ждёт ручного решения, кроме одинаковых экземпляров одной карты — там допускается первый.</p></div>
      </div></section><p class="footnote">Это описание текущего алгоритма, а не подключение к нему. Для настройки будущего варианта включите «Пользовательский».</p></div>
      <div id="custom-view" hidden></div>
    </div>
    <footer><p class="feedback" role="status" aria-live="polite"></p><button type="button" class="reset">Сбросить настройки</button><button type="button" class="cancel">Отмена</button><button type="submit" class="primary">Сохранить</button></footer>
  </form><div id="tooltip" role="tooltip" hidden></div></dialog>`;
  const $ = selector => root.querySelector(selector);
  const dialog = $('dialog'), form = $('form'), controls = new Map();
  function makeField([key, caption, type, help]) {
    const field = document.createElement('div'); field.className = 'field';
    const label = document.createElement('label'); label.htmlFor = 'field-'+key; label.textContent = caption;
    const hint = document.createElement('button'); hint.type = 'button'; hint.className = 'help'; hint.textContent = '?';
    hint.dataset.help = help; hint.setAttribute('aria-label', 'Подсказка: '+caption);
    const input = document.createElement(Array.isArray(type) ? 'select' : 'input'); input.id = 'field-'+key; input.dataset.key = key;
    if (Array.isArray(type)) for (const [value, text] of type) input.add(new Option(text, value));
    else if (type === 'check') input.type = 'checkbox';
    else { input.type = 'number'; input.min = '0'; input.max = String(type.max); input.step = '1'; input.required = true; }
    if (type === 'check') { field.classList.add('check-line'); field.append(input, label, hint); }
    else { const line = document.createElement('div'); line.className = 'label'; line.append(label, hint); field.append(line, input); }
    controls.set(key, input); return field;
  }
  for (const [title, items] of groups) {
    const section = document.createElement('section'), h = document.createElement('h3'), grid = document.createElement('div');
    h.textContent = title; grid.className = 'grid'; grid.append(...items.map(makeField)); section.append(h, grid); $('#custom-view').append(section);
  }
  const footnote = document.createElement('p'); footnote.className = 'footnote';
  footnote.textContent = 'Защита редких карт остаётся включённой. Это только превью: настройки пока не влияют на выбор карт.';
  $('#custom-view').append(footnote);
  function setValues(value) {
    $('#custom').checked = value.custom;
    for (const [key, input] of controls) { if (input.type === 'checkbox') input.checked = value[key]; else input.value = value[key]; }
    refresh();
  }
  function refresh() {
    const custom = $('#custom').checked;
    $('#default-view').hidden = custom; $('#custom-view').hidden = !custom;
    $('#default-label').classList.toggle('active', !custom); $('#custom-label').classList.toggle('active', custom);
    for (const [key, input] of controls) {
      const relevant = key === 'demandGap' ? controls.get('demandA').checked
        : key === 'weakThreshold' ? controls.get('weak').checked || controls.get('unowned').value === 'low' : true;
      input.disabled = !custom || !relevant; input.closest('.field').classList.toggle('disabled', !relevant);
    }
  }
  function readValues() {
    const value = {custom:$('#custom').checked};
    for (const [key, input] of controls) value[key] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? (input.value === '' ? saved[key] : Number(input.value)) : input.value;
    return normalize(value);
  }
  function open() {
    if(!host.isConnected){document.getElementById('cv-best-settings-btn')?.click();return;}
    if (dialog.open) return;
    setValues(saved); $('.feedback').textContent = storageError ? 'Хранилище недоступно. Сохранение может не сработать.' : '';
    dialog.showModal(); $('.body').scrollTop = 0; $('#custom').focus();
  }
  function close() { hideHelp(); dialog.close(); }
  $('.close').addEventListener('click', close); $('.cancel').addEventListener('click', close);
  dialog.addEventListener('cancel', hideHelp); dialog.addEventListener('close', hideHelp);
  $('#custom').addEventListener('change', refresh);
  for (const input of controls.values()) input.addEventListener('change', refresh);
  $('.reset').addEventListener('click', () => {
    setValues({...defaults, custom:$('#custom').checked});
    $('.feedback').textContent = 'Поля сброшены. Сохраните результат или нажмите «Отмена». Статистика не затронута.';
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const next = readValues();
    try { GM_setValue(KEY, next); saved = next; storageError = false; $('.feedback').textContent = 'Сохранено в превью. На помощника эти настройки не влияют.'; }
    catch { $('.feedback').textContent = 'Не удалось сохранить. Окно оставлено открытым — ваши изменения пока здесь.'; }
  });
  const tooltip = $('#tooltip'); let helpTarget = null;
  function hideHelp() { tooltip.hidden = true; helpTarget?.removeAttribute('aria-describedby'); helpTarget = null; }
  function showHelp(button) {
    hideHelp(); helpTarget = button; button.setAttribute('aria-describedby', 'tooltip');
    tooltip.textContent = button.dataset.help; tooltip.hidden = false;
    const r = button.getBoundingClientRect(), box = tooltip.getBoundingClientRect();
    tooltip.style.left = Math.max(20, Math.min(r.left, innerWidth - box.width - 20))+'px';
    tooltip.style.top = Math.max(12, Math.min(r.bottom + 8, innerHeight - box.height - 12))+'px';
  }
  root.querySelectorAll('.help').forEach(button => {
    button.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') showHelp(button); });
    button.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch') hideHelp(); });
    button.addEventListener('focus', () => showHelp(button));
    button.addEventListener('blur', hideHelp);
    button.addEventListener('click', () => showHelp(button));
  });
  root.addEventListener('pointerdown', event => { if (!event.target.closest('.help')) hideHelp(); });
  $('.body').addEventListener('scroll', hideHelp, {passive:true});
  window.addEventListener('resize', hideHelp, {passive:true});

  // Only this launcher is placed in the helper's card. Its existing button and handlers stay intact.
  const launcher = document.createElement('span'); launcher.id = 'abcp-launcher';
  launcher.style.cssText = 'display:inline-block;max-width:100%;vertical-align:bottom;margin:16px 0 0 8px';
  const launchRoot = launcher.attachShadow({mode:'open'});
  launchRoot.innerHTML = `<style>:host{all:initial;display:inline-block;color-scheme:dark}button{font:600 12px/1.4 "Segoe UI",Arial,sans-serif;color:#f4aec5;background:#9e294f2e;border:1px solid #a63d61;border-radius:8px;padding:10px 14px;cursor:pointer;max-width:100%}button:hover{background:#9e294f52;border-color:#d8678e}button:focus-visible{outline:2px solid #f192b1;outline-offset:3px}small{font-size:9px;margin-left:7px;letter-spacing:.5px;color:#d6b3c1}</style><button type="button">Настроить лучшую карту <small>ПРЕВЬЮ</small></button>`;
  launchRoot.querySelector('button').addEventListener('click', open);
  const fallback = document.createElement('div'); fallback.id = 'abcp-preview-card';
  fallback.style.cssText = 'padding:20px;margin:18px 0;border:1px solid #45353d;border-radius:14px;background:#1b191c;color:#eee;font:14px/1.5 Segoe UI,Arial,sans-serif';
  const title = document.createElement('strong'); title.textContent = 'Лучшая карта · предпросмотр';
  const note = document.createElement('div'); note.textContent = 'Отдельное окно настроек. Выбор карт пока не изменяется.'; note.style.cssText = 'font-size:12px;color:#bca9b3;margin-top:5px';
  fallback.append(title, note);
  let decoratedTitle = null, originalTitle = '', observer, scheduled = false, integrated = false;
  function mount() {
    if(integrated)return;
    scheduled = false;
    const body = document.querySelector('#cv-pack-stats-card .cv-pack-tool-body');
    if (body) {
      if (launcher.parentElement !== body) body.append(launcher);
      fallback.remove();
      const heading = body.querySelector('.cv-pack-tool-title');
      if (heading && heading !== decoratedTitle) {
        decoratedTitle = heading; originalTitle = heading.textContent;
        heading.textContent = 'Статистика и лучшая карта';
      }
    } else {
      const anchor = document.querySelector('.packs-guarantees, .packs-shop-heading');
      if (anchor) { if (launcher.parentElement !== fallback) fallback.append(launcher); if (!fallback.isConnected) anchor.after(fallback); }
    }
  }
  observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true; queueMicrotask(mount);
  });
  // Watch only DOM structure; no polling, network hooks, card analysis or automated clicks.
  observer.observe(document.querySelector('.packs-page') || document.body, {childList:true, subtree:true});
  mount();
  document.addEventListener('suite-best-card-integrated', () => {
    integrated=true;
    observer.disconnect(); close(); launcher.remove(); fallback.remove(); host.remove();
    if(decoratedTitle?.textContent === 'Статистика и лучшая карта')decoratedTitle.textContent=originalTitle;
    window.removeEventListener('resize', hideHelp);
  }, {once:true});
  if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('Лучшая карта — открыть превью настроек', open);
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    observer.disconnect();
    if (decoratedTitle?.textContent === 'Статистика и лучшая карта') decoratedTitle.textContent = originalTitle;
  }, {once:true});
})();
